export interface AnalysisSession {
  id: string;
  resume: string;
  targetRole: string;
  targetCompanies: string[] | null;
  status: 'pending' | 'complete' | 'error';
  result: AnalysisResult | null;
  error: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface AnalysisResult {
  resumeScore: ResumeScore;
  heatmap: Heatmap;
  strengths: Finding[];
  weaknesses: Finding[];
  top1Comparison: Top1Comparison;
  gapAnalysis: GapAnalysis;
  bulletImprovements: BulletImprovement[];
  roadmap: Roadmap;
  profileOptimization: ProfileOptimization;
  finalVerdict: FinalVerdict;
}

export interface ResumeScore {
  overall: number; // 0–100
  breakdown: {
    keywordMatch: number;
    formatting: number;
    readability: number;
    structure: number;
  };
  rationale: string[]; // at least 3 observations
  highRiskFlag: boolean; // true if overall < 50
}

export interface HeatmapSection {
  name: string;
  attention: 'high' | 'medium' | 'low';
  explanation: string; // at least 2 sentences
}

export interface Heatmap {
  sections: HeatmapSection[];
  missingSections: string[];
}

export interface Finding {
  area: string;
  description: string;
}

export interface Top1Comparison {
  missingSkills: string[];
  experienceGaps: string[];
  projectQualityDifferences: string[];
  presentationDifferences: string[];
}

export interface GapItem {
  label: string;
  severity: 'critical' | 'moderate' | 'minor';
}

export interface GapAnalysis {
  readinessPercentage: number; // 0–100
  methodology: string;
  gaps: GapItem[];
  notCompetitiveNote: string | null;
}

export interface BulletImprovement {
  original: string;
  rewritten: string;
}

export interface RoadmapPhase {
  label: '30 Days' | '3 Months' | '6 Months';
  actionItems: string[];
}

export interface Roadmap {
  phases: [RoadmapPhase, RoadmapPhase, RoadmapPhase];
}

export interface ProfileOptimization {
  linkedin: string[];
  github: string[];
  portfolio: string[];
}

export interface FinalVerdict {
  readinessPercentage: number;
  readinessLabel: 'Not Competitive' | 'Developing' | 'Competitive' | 'Top-Tier';
  rejectionReasons: string[];
  stepsToTopTier: string[];
}

export interface ModelConfig {
  id: string;
  provider: 'openai' | 'gemini' | 'openrouter' | 'groq';
  modelName: string;
  apiKeyEnv: string;
  maxConcurrent: number;
  priority: number; // 0 (highest) to N (lowest)
}

export interface PoolStatus {
  modelId: string;
  provider: string;
  activeSessions: number;
  maxConcurrent: number;
  available: boolean;
}
