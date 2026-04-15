import type {
  AnalysisResult,
  ResumeScore,
  Heatmap,
  HeatmapSection,
  Finding,
  Top1Comparison,
  GapAnalysis,
  GapItem,
  BulletImprovement,
  Roadmap,
  RoadmapPhase,
  ProfileOptimization,
  FinalVerdict,
} from '../types.js';
import { LLMResponseError } from '../errors.js';

// ---------------------------------------------------------------------------
// JSON Schema constant (passed to buildPrompt as the `schema` parameter)
// ---------------------------------------------------------------------------

export const ANALYSIS_RESULT_SCHEMA = {
  type: 'object',
  required: [
    'resumeScore',
    'heatmap',
    'strengths',
    'weaknesses',
    'top1Comparison',
    'gapAnalysis',
    'bulletImprovements',
    'roadmap',
    'profileOptimization',
    'finalVerdict',
  ],
  properties: {
    resumeScore: {
      type: 'object',
      required: ['overall', 'breakdown', 'rationale', 'highRiskFlag'],
      properties: {
        overall: { type: 'integer', minimum: 0, maximum: 100 },
        breakdown: {
          type: 'object',
          required: ['keywordMatch', 'formatting', 'readability', 'structure'],
          properties: {
            keywordMatch: { type: 'integer', minimum: 0, maximum: 100 },
            formatting: { type: 'integer', minimum: 0, maximum: 100 },
            readability: { type: 'integer', minimum: 0, maximum: 100 },
            structure: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
        rationale: { type: 'array', items: { type: 'string' }, minItems: 3 },
        highRiskFlag: { type: 'boolean' },
      },
    },
    heatmap: {
      type: 'object',
      required: ['sections', 'missingSections'],
      properties: {
        sections: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'attention', 'explanation'],
            properties: {
              name: { type: 'string' },
              attention: { type: 'string', enum: ['high', 'medium', 'low'] },
              explanation: { type: 'string' },
            },
          },
        },
        missingSections: { type: 'array', items: { type: 'string' } },
      },
    },
    strengths: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['area', 'description'],
        properties: {
          area: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    weaknesses: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['area', 'description'],
        properties: {
          area: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    top1Comparison: {
      type: 'object',
      required: ['missingSkills', 'experienceGaps', 'projectQualityDifferences', 'presentationDifferences'],
      properties: {
        missingSkills: { type: 'array', items: { type: 'string' }, minItems: 1 },
        experienceGaps: { type: 'array', items: { type: 'string' }, minItems: 1 },
        projectQualityDifferences: { type: 'array', items: { type: 'string' }, minItems: 1 },
        presentationDifferences: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
    },
    gapAnalysis: {
      type: 'object',
      required: ['readinessPercentage', 'methodology', 'gaps', 'notCompetitiveNote'],
      properties: {
        readinessPercentage: { type: 'integer', minimum: 0, maximum: 100 },
        methodology: { type: 'string', minLength: 1 },
        gaps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'severity'],
            properties: {
              label: { type: 'string', minLength: 1 },
              severity: { type: 'string', enum: ['critical', 'moderate', 'minor'] },
            },
          },
        },
        notCompetitiveNote: { type: ['string', 'null'] },
      },
    },
    bulletImprovements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['original', 'rewritten'],
        properties: {
          original: { type: 'string' },
          rewritten: { type: 'string', minLength: 1 },
        },
      },
    },
    roadmap: {
      type: 'object',
      required: ['phases'],
      properties: {
        phases: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            required: ['label', 'actionItems'],
            properties: {
              label: { type: 'string', enum: ['30 Days', '3 Months', '6 Months'] },
              actionItems: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 3 },
            },
          },
        },
      },
    },
    profileOptimization: {
      type: 'object',
      required: ['linkedin', 'github', 'portfolio'],
      properties: {
        linkedin: { type: 'array', items: { type: 'string' }, minItems: 2 },
        github: { type: 'array', items: { type: 'string' }, minItems: 2 },
        portfolio: { type: 'array', items: { type: 'string' }, minItems: 2 },
      },
    },
    finalVerdict: {
      type: 'object',
      required: ['readinessPercentage', 'readinessLabel', 'rejectionReasons', 'stepsToTopTier'],
      properties: {
        readinessPercentage: { type: 'integer', minimum: 0, maximum: 100 },
        readinessLabel: {
          type: 'string',
          enum: ['Not Competitive', 'Developing', 'Competitive', 'Top-Tier'],
        },
        rejectionReasons: { type: 'array', items: { type: 'string' }, minItems: 2 },
        stepsToTopTier: { type: 'array', items: { type: 'string' }, minItems: 3 },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg: string): never {
  throw new LLMResponseError(`AnalysisResult validation failed: ${msg}`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isInRange(v: number, min: number, max: number): boolean {
  return v >= min && v <= max;
}

function requireInteger(v: unknown, path: string): number {
  if (!isInteger(v)) fail(`${path} must be an integer, got ${JSON.stringify(v)}`);
  return v as number;
}

function requireIntegerInRange(v: unknown, path: string, min = 0, max = 100): number {
  const n = requireInteger(v, path);
  if (!isInRange(n, min, max)) fail(`${path} must be in [${min}, ${max}], got ${n}`);
  return n;
}

function requireString(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(`${path} must be a string, got ${JSON.stringify(v)}`);
  return v as string;
}

function requireNonEmptyString(v: unknown, path: string): string {
  const s = requireString(v, path);
  if (s.trim().length === 0) fail(`${path} must be a non-empty string`);
  return s;
}

function requireArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path} must be an array, got ${JSON.stringify(v)}`);
  return v as unknown[];
}

function requireNonEmptyArray(v: unknown, path: string): unknown[] {
  const arr = requireArray(v, path);
  if (arr.length === 0) fail(`${path} must be a non-empty array`);
  return arr;
}

function requireMinLengthArray(v: unknown, path: string, min: number): unknown[] {
  const arr = requireArray(v, path);
  if (arr.length < min) fail(`${path} must have at least ${min} item(s), got ${arr.length}`);
  return arr;
}

function requireObject(v: unknown, path: string): Record<string, unknown> {
  if (!isObject(v)) fail(`${path} must be an object, got ${JSON.stringify(v)}`);
  return v as Record<string, unknown>;
}

function requireDistinct(values: string[], path: string): void {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) fail(`${path} must contain distinct strings, duplicate found: "${v}"`);
    seen.add(v);
  }
}

// ---------------------------------------------------------------------------
// Section validators
// ---------------------------------------------------------------------------

function validateResumeScore(raw: unknown): ResumeScore {
  const obj = requireObject(raw, 'resumeScore');

  const overall = requireIntegerInRange(obj['overall'], 'resumeScore.overall');

  const bd = requireObject(obj['breakdown'], 'resumeScore.breakdown');
  const breakdown = {
    keywordMatch: requireIntegerInRange(bd['keywordMatch'], 'resumeScore.breakdown.keywordMatch'),
    formatting: requireIntegerInRange(bd['formatting'], 'resumeScore.breakdown.formatting'),
    readability: requireIntegerInRange(bd['readability'], 'resumeScore.breakdown.readability'),
    structure: requireIntegerInRange(bd['structure'], 'resumeScore.breakdown.structure'),
  };

  const rationaleRaw = requireMinLengthArray(obj['rationale'], 'resumeScore.rationale', 3);
  const rationale = rationaleRaw.map((item, i) => requireString(item, `resumeScore.rationale[${i}]`));
  requireDistinct(rationale, 'resumeScore.rationale');

  if (typeof obj['highRiskFlag'] !== 'boolean') {
    fail('resumeScore.highRiskFlag must be a boolean');
  }
  const highRiskFlag = obj['highRiskFlag'] as boolean;

  if (highRiskFlag !== (overall < 50)) {
    fail(
      `resumeScore.highRiskFlag must be true if and only if overall < 50 (overall=${overall}, highRiskFlag=${highRiskFlag})`,
    );
  }

  return { overall, breakdown, rationale, highRiskFlag };
}

function validateHeatmapSection(raw: unknown, path: string): HeatmapSection {
  const obj = requireObject(raw, path);
  const name = requireString(obj['name'], `${path}.name`);
  const attentionRaw = requireString(obj['attention'], `${path}.attention`);
  if (attentionRaw !== 'high' && attentionRaw !== 'medium' && attentionRaw !== 'low') {
    fail(`${path}.attention must be 'high', 'medium', or 'low', got "${attentionRaw}"`);
  }
  const attention = attentionRaw as 'high' | 'medium' | 'low';
  const explanation = requireString(obj['explanation'], `${path}.explanation`);
  return { name, attention, explanation };
}

function validateHeatmap(raw: unknown): Heatmap {
  const obj = requireObject(raw, 'heatmap');

  const sectionsRaw = requireNonEmptyArray(obj['sections'], 'heatmap.sections');
  const sections = sectionsRaw.map((s, i) => validateHeatmapSection(s, `heatmap.sections[${i}]`));

  const hasHigh = sections.some((s) => s.attention === 'high');
  const hasLow = sections.some((s) => s.attention === 'low');
  if (!hasHigh) fail('heatmap.sections must contain at least one section with attention === "high"');
  if (!hasLow) fail('heatmap.sections must contain at least one section with attention === "low"');

  const missingSectionsRaw = requireArray(obj['missingSections'], 'heatmap.missingSections');
  const missingSections = missingSectionsRaw.map((s, i) =>
    requireString(s, `heatmap.missingSections[${i}]`),
  );

  return { sections, missingSections };
}

function validateFinding(raw: unknown, path: string): Finding {
  const obj = requireObject(raw, path);
  const area = requireString(obj['area'], `${path}.area`);
  const description = requireString(obj['description'], `${path}.description`);
  return { area, description };
}

function validateFindings(raw: unknown, field: 'strengths' | 'weaknesses'): Finding[] {
  const arr = requireMinLengthArray(raw, field, 2);
  return arr.map((item, i) => validateFinding(item, `${field}[${i}]`));
}

function validateTop1Comparison(raw: unknown): Top1Comparison {
  const obj = requireObject(raw, 'top1Comparison');

  const fields = [
    'missingSkills',
    'experienceGaps',
    'projectQualityDifferences',
    'presentationDifferences',
  ] as const;

  const result: Partial<Top1Comparison> = {};
  for (const field of fields) {
    const arr = requireMinLengthArray(obj[field], `top1Comparison.${field}`, 1);
    result[field] = arr.map((item, i) => requireString(item, `top1Comparison.${field}[${i}]`));
  }

  return result as Top1Comparison;
}

function validateGapItem(raw: unknown, path: string): GapItem {
  const obj = requireObject(raw, path);
  const label = requireNonEmptyString(obj['label'], `${path}.label`);
  const severityRaw = requireString(obj['severity'], `${path}.severity`);
  if (severityRaw !== 'critical' && severityRaw !== 'moderate' && severityRaw !== 'minor') {
    fail(`${path}.severity must be 'critical', 'moderate', or 'minor', got "${severityRaw}"`);
  }
  return { label, severity: severityRaw as GapItem['severity'] };
}

function validateGapAnalysis(raw: unknown): GapAnalysis {
  const obj = requireObject(raw, 'gapAnalysis');

  const readinessPercentage = requireIntegerInRange(
    obj['readinessPercentage'],
    'gapAnalysis.readinessPercentage',
  );
  const methodology = requireNonEmptyString(obj['methodology'], 'gapAnalysis.methodology');

  const gapsRaw = requireArray(obj['gaps'], 'gapAnalysis.gaps');
  const gaps = gapsRaw.map((item, i) => validateGapItem(item, `gapAnalysis.gaps[${i}]`));

  if (readinessPercentage < 90 && gaps.length === 0) {
    fail('gapAnalysis.gaps must be non-empty when readinessPercentage < 90');
  }

  let notCompetitiveNote: string | null = null;
  if (obj['notCompetitiveNote'] !== null && obj['notCompetitiveNote'] !== undefined) {
    notCompetitiveNote = requireString(obj['notCompetitiveNote'], 'gapAnalysis.notCompetitiveNote');
  }

  if (readinessPercentage < 60) {
    if (!notCompetitiveNote || notCompetitiveNote.trim().length === 0) {
      fail('gapAnalysis.notCompetitiveNote must be a non-empty string when readinessPercentage < 60');
    }
  }

  return { readinessPercentage, methodology, gaps, notCompetitiveNote };
}

function validateBulletImprovements(raw: unknown): BulletImprovement[] {
  const arr = requireArray(raw, 'bulletImprovements');
  const improvements = arr.map((item, i) => {
    const obj = requireObject(item, `bulletImprovements[${i}]`);
    const original = requireString(obj['original'], `bulletImprovements[${i}].original`);
    const rewritten = requireNonEmptyString(obj['rewritten'], `bulletImprovements[${i}].rewritten`);
    if (rewritten === original) {
      fail(`bulletImprovements[${i}].rewritten must differ from original`);
    }
    return { original, rewritten };
  });

  const rewrittenStrings = improvements.map((imp) => imp.rewritten);
  requireDistinct(rewrittenStrings, 'bulletImprovements[*].rewritten');

  return improvements;
}

function validateRoadmapPhase(raw: unknown, index: number): RoadmapPhase {
  const path = `roadmap.phases[${index}]`;
  const obj = requireObject(raw, path);

  const expectedLabels = ['30 Days', '3 Months', '6 Months'] as const;
  const label = requireString(obj['label'], `${path}.label`);
  if (label !== expectedLabels[index]) {
    fail(`${path}.label must be "${expectedLabels[index]}", got "${label}"`);
  }

  const actionItemsRaw = requireMinLengthArray(obj['actionItems'], `${path}.actionItems`, 3);
  const actionItems = actionItemsRaw.map((item, i) => {
    const s = requireString(item, `${path}.actionItems[${i}]`);
    if (s.trim().length === 0) fail(`${path}.actionItems[${i}] must be a non-empty string`);
    return s;
  });

  return { label: label as RoadmapPhase['label'], actionItems };
}

function validateRoadmap(raw: unknown): Roadmap {
  const obj = requireObject(raw, 'roadmap');
  const phasesRaw = requireArray(obj['phases'], 'roadmap.phases');

  if (phasesRaw.length !== 3) {
    fail(`roadmap.phases must contain exactly 3 items, got ${phasesRaw.length}`);
  }

  const phases = phasesRaw.map((phase, i) => validateRoadmapPhase(phase, i)) as [
    RoadmapPhase,
    RoadmapPhase,
    RoadmapPhase,
  ];

  const allActionItems = phases.flatMap((p) => p.actionItems);
  requireDistinct(allActionItems, 'roadmap phases action items');

  return { phases };
}

function validateProfileOptimization(raw: unknown): ProfileOptimization {
  const obj = requireObject(raw, 'profileOptimization');

  const linkedin = requireMinLengthArray(obj['linkedin'], 'profileOptimization.linkedin', 2).map(
    (s, i) => requireString(s, `profileOptimization.linkedin[${i}]`),
  );
  const github = requireMinLengthArray(obj['github'], 'profileOptimization.github', 2).map((s, i) =>
    requireString(s, `profileOptimization.github[${i}]`),
  );
  const portfolio = requireMinLengthArray(obj['portfolio'], 'profileOptimization.portfolio', 2).map(
    (s, i) => requireString(s, `profileOptimization.portfolio[${i}]`),
  );

  const allSuggestions = [...linkedin, ...github, ...portfolio];
  requireDistinct(allSuggestions, 'profileOptimization suggestions across all platforms');

  return { linkedin, github, portfolio };
}

function validateFinalVerdict(raw: unknown, gapReadiness: number): FinalVerdict {
  const obj = requireObject(raw, 'finalVerdict');

  const readinessPercentage = requireIntegerInRange(
    obj['readinessPercentage'],
    'finalVerdict.readinessPercentage',
  );

  const validLabels = ['Not Competitive', 'Developing', 'Competitive', 'Top-Tier'] as const;
  const readinessLabelRaw = requireString(obj['readinessLabel'], 'finalVerdict.readinessLabel');
  if (!(validLabels as readonly string[]).includes(readinessLabelRaw)) {
    fail(
      `finalVerdict.readinessLabel must be one of ${validLabels.map((l) => `"${l}"`).join(', ')}, got "${readinessLabelRaw}"`,
    );
  }
  const readinessLabel = readinessLabelRaw as FinalVerdict['readinessLabel'];

  const rejectionReasonsRaw = requireMinLengthArray(
    obj['rejectionReasons'],
    'finalVerdict.rejectionReasons',
    2,
  );
  const rejectionReasons = rejectionReasonsRaw.map((s, i) =>
    requireString(s, `finalVerdict.rejectionReasons[${i}]`),
  );

  const stepsToTopTierRaw = requireMinLengthArray(
    obj['stepsToTopTier'],
    'finalVerdict.stepsToTopTier',
    3,
  );
  const stepsToTopTier = stepsToTopTierRaw.map((s, i) =>
    requireString(s, `finalVerdict.stepsToTopTier[${i}]`),
  );

  if (readinessPercentage !== gapReadiness) {
    fail(
      `finalVerdict.readinessPercentage (${readinessPercentage}) must equal gapAnalysis.readinessPercentage (${gapReadiness})`,
    );
  }

  return { readinessPercentage, readinessLabel, rejectionReasons, stepsToTopTier };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function validateAnalysisResult(json: unknown): AnalysisResult {
  const obj = requireObject(json, 'AnalysisResult');

  const resumeScore = validateResumeScore(obj['resumeScore']);
  const heatmap = validateHeatmap(obj['heatmap']);
  const strengths = validateFindings(obj['strengths'], 'strengths');
  const weaknesses = validateFindings(obj['weaknesses'], 'weaknesses');
  const top1Comparison = validateTop1Comparison(obj['top1Comparison']);
  const gapAnalysis = validateGapAnalysis(obj['gapAnalysis']);
  const bulletImprovements = validateBulletImprovements(obj['bulletImprovements']);
  const roadmap = validateRoadmap(obj['roadmap']);
  const profileOptimization = validateProfileOptimization(obj['profileOptimization']);
  const finalVerdict = validateFinalVerdict(obj['finalVerdict'], gapAnalysis.readinessPercentage);

  return {
    resumeScore,
    heatmap,
    strengths,
    weaknesses,
    top1Comparison,
    gapAnalysis,
    bulletImprovements,
    roadmap,
    profileOptimization,
    finalVerdict,
  };
}
