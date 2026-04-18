import type { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { llmRouter } from '../llm/router.js';
import { createAdapter } from '../llm/adapters.js';
import { validateAnalysisResult, ANALYSIS_RESULT_SCHEMA } from '../analysis/validate.js';
import { createSession, findReusableCompletedSessionByInputHash, updateSession } from '../db/sessions.js';
import { extractTextFromFile } from '../analysis/parser.js';
import {
  CapacityExceededError,
  ProviderError,
} from '../errors.js';
import type { AnalysisResult, ModelConfig } from '../types.js';

const TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms),
    ),
  ]);
}

async function callModel(
  model: ModelConfig,
  prompt: string,
): Promise<unknown> {
  const adapter = createAdapter(model);
  const raw = await withTimeout(adapter.call(prompt, ANALYSIS_RESULT_SCHEMA), TIMEOUT_MS);
  return JSON.parse(raw) as unknown;
}

type TaskName = 'ats' | 'gaps' | 'bullets' | 'roadmap' | 'aggregate';

const TASK_PROVIDER_PREFERENCE: Record<TaskName, ModelConfig['provider'][]> = {
  ats: ['groq', 'gemini', 'openrouter'],
  gaps: ['openrouter', 'gemini', 'groq'],
  bullets: ['openrouter', 'groq', 'gemini'],
  roadmap: ['gemini', 'openrouter', 'groq'],
  aggregate: ['gemini', 'openrouter', 'groq'],
};

function taskPrompt(task: TaskName, resume: string, targetRole: string, targetCompanies: string[] | null): string {
  const companiesLine = targetCompanies?.length ? `Target Companies: ${targetCompanies.join(', ')}` : 'Target Companies: None';
  const input = `Target Role: ${targetRole}\n${companiesLine}\nResume:\n${resume}`;

  if (task === 'ats') {
    return `You are CareerSense ATS evaluator.
Return ONLY JSON:
{
  "resumeScore": { "overall":0-100, "breakdown":{"keywordMatch":0-100,"formatting":0-100,"readability":0-100,"structure":0-100}, "rationale":["...", "...", "..."], "highRiskFlag":boolean },
  "heatmap": { "sections":[{"name":"...","attention":"high|medium|low","explanation":"2+ sentences"}], "missingSections":["..."] }
}
Rules: rationale has >=3 distinct items; include at least one high and one low section; highRiskFlag=true iff overall<50.
Input:
${input}`;
  }
  if (task === 'gaps') {
    return `You are CareerSense gap analyst.
Return ONLY JSON:
{
  "strengths":[{"area":"...","description":"..."}],
  "weaknesses":[{"area":"...","description":"..."}],
  "top1Comparison":{"missingSkills":["..."],"experienceGaps":["..."],"projectQualityDifferences":["..."],"presentationDifferences":["..."]},
  "gapAnalysis":{"readinessPercentage":0-100,"methodology":"one sentence","gaps":[{"label":"...","severity":"critical|moderate|minor"}],"notCompetitiveNote":"..."|null}
}
Rules: strengths>=2, weaknesses>=2; each top1 list>=1; if readiness<90 then gaps non-empty; if readiness<60 notCompetitiveNote non-empty else null.
Input:
${input}`;
  }
  if (task === 'bullets') {
    return `You are CareerSense bullet optimizer.
Return ONLY JSON:
{ "bulletImprovements":[{"original":"...","rewritten":"..."}] }
Rules: provide >=3 items; each rewritten must differ from original; rewritten entries must be distinct; use action + task + measurable impact style.
Input:
${input}`;
  }
  if (task === 'roadmap') {
    return `You are CareerSense roadmap planner.
Return ONLY JSON:
{
  "profileOptimization":{"linkedin":["..."],"github":["..."],"portfolio":["..."]},
  "roadmap":{"phases":[
    {"label":"30 Days","actionItems":["...","...","..."]},
    {"label":"3 Months","actionItems":["...","...","..."]},
    {"label":"6 Months","actionItems":["...","...","..."]}
  ]}
}
Rules: each platform has >=2 items; phases exactly in that order; each phase has >=3 distinct action items.
Input:
${input}`;
  }

  return '';
}

function aggregatePrompt(
  resume: string,
  targetRole: string,
  targetCompanies: string[] | null,
  parts: Record<'ats' | 'gaps' | 'bullets' | 'roadmap', unknown>,
): string {
  const companiesLine = targetCompanies?.length ? `Target Companies: ${targetCompanies.join(', ')}` : 'Target Companies: None';
  return `You are CareerSense final aggregator.
Merge sub-analyses into ONE final JSON object matching this schema exactly.
Output ONLY JSON.
Must preserve consistency:
- finalVerdict.readinessPercentage == gapAnalysis.readinessPercentage
- readinessLabel maps to percentage: 0-39 Not Competitive, 40-59 Developing, 60-79 Competitive, 80-100 Top-Tier
- keep data grounded in resume.

Target Role: ${targetRole}
${companiesLine}
Resume:
${resume}

Sub-results JSON:
${JSON.stringify(parts)}

Schema:
${JSON.stringify(ANALYSIS_RESULT_SCHEMA)}`;
}

async function runTaskWithRetry(
  task: TaskName,
  prompt: string,
  maxAttempts = 4,
  globallyUsedModelIds: Set<string> = new Set(),
): Promise<{ json: unknown; modelId: string }> {
  let lastError: unknown = null;
  const attemptedModelIds: string[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    let model: ModelConfig;
    try {
      model = llmRouter.selectModelByProvidersExcluding(
        TASK_PROVIDER_PREFERENCE[task],
        [...attemptedModelIds, ...Array.from(globallyUsedModelIds)],
      );
    } catch (err) {
      lastError = err;
      break;
    }
    attemptedModelIds.push(model.id);
    globallyUsedModelIds.add(model.id);
    llmRouter.acquire(model.id);
    console.log(`[AICore][${task}] attempt ${i + 1}/${maxAttempts} -> ${model.provider}:${model.modelName} (${model.id})`);
    try {
      const json = await callModel(model, prompt);
      console.log(`[AICore][${task}] success <- ${model.provider}:${model.modelName} (${model.id})`);
      return { json, modelId: model.id };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AICore][${task}] failed on ${model.id}: ${msg}`);
      if (err instanceof ProviderError) {
        llmRouter.markUnavailable(model.id, 120_000);
      }
    } finally {
      llmRouter.release(model.id);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Task "${task}" failed`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeAggregateWithParts(
  aggregated: unknown,
  parts: Record<'ats' | 'gaps' | 'bullets' | 'roadmap', unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = isObject(aggregated) ? { ...aggregated } : {};
  const ats = isObject(parts.ats) ? parts.ats : {};
  const gaps = isObject(parts.gaps) ? parts.gaps : {};
  const bullets = isObject(parts.bullets) ? parts.bullets : {};
  const roadmap = isObject(parts.roadmap) ? parts.roadmap : {};

  merged['resumeScore'] = merged['resumeScore'] ?? ats['resumeScore'];
  merged['heatmap'] = merged['heatmap'] ?? ats['heatmap'];
  merged['strengths'] = merged['strengths'] ?? gaps['strengths'];
  merged['weaknesses'] = merged['weaknesses'] ?? gaps['weaknesses'];
  merged['top1Comparison'] = merged['top1Comparison'] ?? gaps['top1Comparison'];
  merged['gapAnalysis'] = merged['gapAnalysis'] ?? gaps['gapAnalysis'];
  merged['bulletImprovements'] = merged['bulletImprovements'] ?? bullets['bulletImprovements'];
  merged['roadmap'] = merged['roadmap'] ?? roadmap['roadmap'];
  merged['profileOptimization'] = merged['profileOptimization'] ?? roadmap['profileOptimization'];
  return merged;
}

function toReadinessLabel(score: number): 'Not Competitive' | 'Developing' | 'Competitive' | 'Top-Tier' {
  if (score <= 39) return 'Not Competitive';
  if (score <= 59) return 'Developing';
  if (score <= 79) return 'Competitive';
  return 'Top-Tier';
}

function sanitizeDeterministicFields(merged: Record<string, unknown>): Record<string, unknown> {
  if (isObject(merged['resumeScore']) && typeof merged['resumeScore']['overall'] === 'number') {
    const overall = merged['resumeScore']['overall'];
    merged['resumeScore']['highRiskFlag'] = overall < 50;
  }

  if (isObject(merged['gapAnalysis']) && isObject(merged['finalVerdict'])) {
    const readiness = merged['gapAnalysis']['readinessPercentage'];
    if (typeof readiness === 'number') {
      merged['finalVerdict']['readinessPercentage'] = readiness;
      merged['finalVerdict']['readinessLabel'] = toReadinessLabel(readiness);
    }
  }

  return merged;
}

function normalizeTaskOutput(task: 'ats' | 'gaps' | 'bullets' | 'roadmap', raw: unknown): Record<string, unknown> {
  if (task === 'bullets') {
    if (Array.isArray(raw)) {
      return { bulletImprovements: raw };
    }
    return isObject(raw) ? raw : { bulletImprovements: [] };
  }
  return isObject(raw) ? raw : {};
}

async function callMultiAgentPipeline(
  resume: string,
  targetRole: string,
  targetCompanies: string[] | null,
): Promise<{ result: AnalysisResult; modelIds: string[] }> {
  console.log(`[AICore] Multi-agent pipeline started for role="${targetRole}"`);
  const globallyUsedModelIds = new Set<string>();
  const maxAttemptsPerTask = llmRouter.getModelIds().length;
  const taskDefs: Array<{ task: 'ats' | 'gaps' | 'bullets' | 'roadmap'; prompt: string }> = [
    { task: 'ats', prompt: taskPrompt('ats', resume, targetRole, targetCompanies) },
    { task: 'gaps', prompt: taskPrompt('gaps', resume, targetRole, targetCompanies) },
    { task: 'bullets', prompt: taskPrompt('bullets', resume, targetRole, targetCompanies) },
    { task: 'roadmap', prompt: taskPrompt('roadmap', resume, targetRole, targetCompanies) },
  ];

  const [atsRes, gapsRes, bulletsRes, roadmapRes] = await Promise.all(
    taskDefs.map(({ task, prompt }) =>
      runTaskWithRetry(task, prompt, maxAttemptsPerTask, globallyUsedModelIds),
    ),
  );
  const parts = {
    ats: normalizeTaskOutput('ats', atsRes.json),
    gaps: normalizeTaskOutput('gaps', gapsRes.json),
    bullets: normalizeTaskOutput('bullets', bulletsRes.json),
    roadmap: normalizeTaskOutput('roadmap', roadmapRes.json),
  } as const;

  const aggregate = await runTaskWithRetry(
    'aggregate',
    aggregatePrompt(resume, targetRole, targetCompanies, parts),
    maxAttemptsPerTask,
    globallyUsedModelIds,
  );
  let result: AnalysisResult | null = null;
  let aggregateModelId = aggregate.modelId;
  let validationError: unknown = null;

  try {
    const merged = sanitizeDeterministicFields(mergeAggregateWithParts(aggregate.json, parts));
    result = validateAnalysisResult(merged);
  } catch (err) {
    validationError = err;
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[AICore][aggregate] validation retry triggered: ${reason}`);
  }

  if (!result) {
    const repairPrompt = `${aggregatePrompt(resume, targetRole, targetCompanies, parts)}

Previous aggregation failed validation with this reason:
${validationError instanceof Error ? validationError.message : String(validationError)}

Return FULL JSON for ALL required top-level keys. Do not omit any key.`;
    const repaired = await runTaskWithRetry('aggregate', repairPrompt, maxAttemptsPerTask, globallyUsedModelIds);
    aggregateModelId = repaired.modelId;
    const merged = sanitizeDeterministicFields(mergeAggregateWithParts(repaired.json, parts));
    result = validateAnalysisResult(merged);
  }

  console.log(
    `[AICore] Multi-agent pipeline complete. Models used: ${[
      atsRes.modelId,
      gapsRes.modelId,
      bulletsRes.modelId,
      roadmapRes.modelId,
      aggregateModelId,
    ].join(' -> ')}`
  );
  return {
    result,
    modelIds: [atsRes.modelId, gapsRes.modelId, bulletsRes.modelId, roadmapRes.modelId, aggregateModelId],
  };
}

function normalizeCompanies(companies: string[] | null): string[] | null {
  if (!companies || companies.length === 0) return null;
  const norm = companies
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter((c) => c.length > 0)
    .map((c) => c.toLowerCase());
  norm.sort();
  return norm.length > 0 ? norm : null;
}

function computeInputHash(resumeText: string, targetRole: string, companies: string[] | null): string {
  const normalized = JSON.stringify({
    v: 1,
    targetRole: targetRole.trim().toLowerCase(),
    targetCompanies: normalizeCompanies(companies),
    resume: resumeText.trim(),
  });
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export const postSession: RequestHandler = async (req, res) => {
  const { targetRole, targetCompanies } = req.body;
  let resumeText = req.body.resume; // Possible direct text input

  // 1. Handle file upload if present
  if (req.file) {
    try {
      resumeText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
    } catch (err) {
      console.error('File extraction error:', err);
      res.status(400).json({ error: 'Failed to extract text from file. Please ensure it is a valid PDF or Image.' });
      return;
    }
  }

  // 2. Validate required fields
  if (typeof resumeText !== 'string' || resumeText.trim().length === 0) {
    res.status(400).json({ error: 'Missing required field: resume content (either as text or file)' });
    return;
  }
  if (typeof targetRole !== 'string' || targetRole.trim().length === 0) {
    res.status(400).json({ error: 'Missing required field: targetRole' });
    return;
  }

  const companies: string[] | null = Array.isArray(targetCompanies)
    ? (targetCompanies as string[])
    : typeof targetCompanies === 'string' 
      ? JSON.parse(targetCompanies)
      : null;
  console.log(`[AICore] New analysis request: role="${targetRole}" companies=${companies?.length ?? 0}`);

  // 2.5 Dedup: reuse completed result for identical inputs (saves tokens)
  const inputHash = computeInputHash(resumeText, targetRole, companies);
  try {
    const cached = findReusableCompletedSessionByInputHash(inputHash);
    if (cached?.result) {
      res.status(200).json({ sessionId: cached.id, result: cached.result, reused: true });
      return;
    }
  } catch {
    // If cache lookup fails, continue with normal flow.
  }

  // 4. Create session record
  const sessionId = uuidv4();
  try {
    createSession({ id: sessionId, inputHash, resume: resumeText, targetRole, targetCompanies: companies });
  } catch {
    res.status(500).json({ error: 'Failed to initialize session. Please try again.' });
    return;
  }

  // 5. RESILIENT PROCESSING LOOP
  // This loop will attempt to analyze the resume, switching models automatically if one fails.
  let result: AnalysisResult | null = null;
  let modelTrace: string[] = [];
  let lastError: unknown = null;
  try {
    const pipeline = await callMultiAgentPipeline(resumeText, targetRole, companies);
    result = pipeline.result;
    modelTrace = pipeline.modelIds;
  } catch (err) {
    lastError = err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AICore] Multi-agent pipeline failed: ${msg}`);
  }

  try {
    if (result) {
      // 6. Update session to complete
      updateSession(sessionId, { status: 'complete', result, modelUsed: modelTrace.join(',') });
      res.status(201).json({ sessionId, result });
    } else {
      // 7. All attempts failed
      const errorMessage = lastError instanceof Error ? lastError.message : 'Exhausted all AI providers';
      updateSession(sessionId, { status: 'error', error: errorMessage });
      res.status(503).json({ error: 'AI services are currently unavailable. Try again shortly.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal system error during finalization.' });
  }
};

import { getSessionById, getAllSessions, deleteSession } from '../db/sessions.js';

export const getSession: RequestHandler = (req, res) => {
  const { id } = req.params;
  const session = getSessionById(id);

  if (!session) {
    res.status(404).json({ error: `Session not found: ${id}` });
    return;
  }

  res.status(200).json(session);
};

export const listSessions: RequestHandler = (_req, res) => {
  try {
    const sessions = getAllSessions();
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve sessions.' });
  }
};

export const deleteSessionHandler: RequestHandler = (req, res) => {
  const { id } = req.params;
  try {
    deleteSession(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session.' });
  }
};
