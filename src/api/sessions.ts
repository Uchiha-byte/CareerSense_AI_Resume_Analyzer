import type { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { llmRouter } from '../llm/router.js';
import { createAdapter } from '../llm/adapters.js';
import { buildPrompt } from '../llm/prompt.js';
import { validateAnalysisResult, ANALYSIS_RESULT_SCHEMA } from '../analysis/validate.js';
import { createSession, updateSession } from '../db/sessions.js';
import { extractTextFromFile } from '../analysis/parser.js';
import {
  CapacityExceededError,
  ProviderError,
  DatabaseError,
  LLMResponseError,
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
  resume: string,
  targetRole: string,
  targetCompanies: string[] | null,
): Promise<AnalysisResult> {
  const prompt = buildPrompt(resume, targetRole, targetCompanies, ANALYSIS_RESULT_SCHEMA);
  const adapter = createAdapter(model);
  const raw = await withTimeout(adapter.call(prompt, ANALYSIS_RESULT_SCHEMA), TIMEOUT_MS);
  const parsed: unknown = JSON.parse(raw);
  return validateAnalysisResult(parsed);
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

  // 3. Select and acquire initial model
  let model: ModelConfig;
  try {
    model = llmRouter.selectModel();
  } catch (err) {
    if (err instanceof CapacityExceededError) {
      res.status(503).json({ error: 'System is currently under high load. Please try again in a few seconds.' });
      return;
    }
    throw err;
  }

  // 4. Create session record
  const sessionId = uuidv4();
  try {
    createSession({ id: sessionId, resume: resumeText, targetRole, targetCompanies: companies });
  } catch {
    res.status(500).json({ error: 'Failed to initialize session. Please try again.' });
    return;
  }

  // 5. RESILIENT PROCESSING LOOP
  // This loop will attempt to analyze the resume, switching models automatically if one fails.
  const maxAttempts = 5; 
  let currentAttempt = 0;
  let result: AnalysisResult | null = null;
  let lastError: any = null;
  let acquiredModelId: string = '';

  while (currentAttempt < maxAttempts && !result) {
    currentAttempt++;
    
    // Select model (for first attempt it's already selected, for subsequent we need a new one)
    if (currentAttempt > 1) {
      try {
        model = llmRouter.selectModel();
      } catch (err) {
        lastError = err;
        break; // No more models available
      }
    }

    console.log(`[AICore] Attempt ${currentAttempt}: Using ${model.provider.toUpperCase()} (${model.modelName})`);
    llmRouter.acquire(model.id);
    acquiredModelId = model.id;

    try {
      result = await callModel(model, resumeText, targetRole, companies);
    } catch (err) {
      lastError = err;
      
      // Release and mark failed model as unavailable for a while
      llmRouter.release(acquiredModelId);
      if (err instanceof ProviderError) {
         llmRouter.markUnavailable(acquiredModelId, 120_000); // 2 mins penalty for provider errors
      }
      acquiredModelId = '';

      // If it's a timeout, we might want to retry with a different model
      // If it's a validation error, we definitely want a different model or provider
      console.warn(`Attempt ${currentAttempt} failed with model ${model.id}:`, err instanceof Error ? err.message : err);
      
      // Continue loop to try next model
    }
  }

  try {
    if (result) {
      // 6. Update session to complete
      updateSession(sessionId, { status: 'complete', result, modelUsed: acquiredModelId });
      res.status(201).json({ sessionId, result });
    } else {
      // 7. All attempts failed
      const errorMessage = lastError instanceof Error ? lastError.message : 'Exhausted all AI providers';
      updateSession(sessionId, { status: 'error', error: errorMessage });
      res.status(502).json({ error: 'AI analysis failed after multiple attempts. Please check your inputs or try again later.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal system error during finalization.' });
  } finally {
    if (acquiredModelId) {
      llmRouter.release(acquiredModelId);
    }
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
