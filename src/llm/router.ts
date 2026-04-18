import { ModelConfig, PoolStatus } from '../types.js';
import { CapacityExceededError } from '../errors.js';

const maxConcurrentOverride = process.env['LLM_MAX_CONCURRENT_PER_MODEL']
  ? parseInt(process.env['LLM_MAX_CONCURRENT_PER_MODEL'], 10)
  : null;

function resolveMaxConcurrent(base: number): number {
  return maxConcurrentOverride !== null && !isNaN(maxConcurrentOverride)
    ? maxConcurrentOverride
    : base;
}

const MODEL_POOL: ModelConfig[] = [
  // Tier 1: OpenRouter (Priority 0 - Primary)
  { id: 'or-nemotron-super', provider: 'openrouter', modelName: 'nvidia/nemotron-3-super-120b-a12b:free', apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },
  { id: 'or-trinity-large', provider: 'openrouter', modelName: 'arcee-ai/trinity-large-preview:free', apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },
  { id: 'or-gpt-oss',        provider: 'openrouter', modelName: 'openai/gpt-oss-120b:free',          apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },
  { id: 'or-nemotron-nano',  provider: 'openrouter', modelName: 'nvidia/nemotron-3-nano-30b-a3b:free', apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },
  { id: 'or-minimax',        provider: 'openrouter', modelName: 'minimax/minimax-m2.5:free',          apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },
  { id: 'or-nemotron-9b',    provider: 'openrouter', modelName: 'nvidia/nemotron-nano-9b-v2:free',   apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },
  { id: 'or-nemotron-vl',    provider: 'openrouter', modelName: 'nvidia/nemotron-nano-12b-v2-vl:free', apiKeyEnv: 'OPENROUTER_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 0 },

  // Tier 2: Groq (Priority 1)
  { id: 'groq-llama-3.3-70b', provider: 'groq', modelName: 'llama-3.3-70b-versatile', apiKeyEnv: 'GROQ_API_KEY', maxConcurrent: resolveMaxConcurrent(8), priority: 1 },
  { id: 'groq-llama-3.1-70b', provider: 'groq', modelName: 'llama-3.1-70b-versatile', apiKeyEnv: 'GROQ_API_KEY', maxConcurrent: resolveMaxConcurrent(8), priority: 1 },
  { id: 'groq-mixtral',      provider: 'groq', modelName: 'mixtral-8x7b-32768',      apiKeyEnv: 'GROQ_API_KEY', maxConcurrent: resolveMaxConcurrent(8), priority: 1 },

  // Tier 3: Gemini (Priority 2)
  { id: 'gemini-2.5-flash',  provider: 'gemini', modelName: 'gemini-2.5-flash', apiKeyEnv: 'GEMINI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 2 },
  { id: 'gemini-2.5-pro',    provider: 'gemini', modelName: 'gemini-2.5-pro',   apiKeyEnv: 'GEMINI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 2 },
  { id: 'gemma-3-1b-it',     provider: 'gemini', modelName: 'gemma-3-1b-it',    apiKeyEnv: 'GEMINI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 2 },
  { id: 'gemma-3-4b-it',     provider: 'gemini', modelName: 'gemma-3-4b-it',    apiKeyEnv: 'GEMINI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 2 },
  { id: 'gemma-3-12b-it',    provider: 'gemini', modelName: 'gemma-3-12b-it',   apiKeyEnv: 'GEMINI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 2 },
  { id: 'gemma-3-27b-it',    provider: 'gemini', modelName: 'gemma-3-27b-it',   apiKeyEnv: 'GEMINI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 2 },

  // Tier 4: OpenAI paid fallback (Priority 3)
  //{ id: 'openai-gpt4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', apiKeyEnv: 'OPENAI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 3 },
  //{ id: 'openai-gpt4o',      provider: 'openai', modelName: 'gpt-4o',      apiKeyEnv: 'OPENAI_API_KEY', maxConcurrent: resolveMaxConcurrent(10), priority: 3 },
];

interface ModelState {
  config: ModelConfig;
  activeSessions: number;
  available: boolean;
}

export class LLMRouter {
  private pool: Map<string, ModelState>;
  private rrCounter: number = 0;

  constructor(models: ModelConfig[] = MODEL_POOL) {
    this.pool = new Map(
      models.map((config) => [
        config.id,
        { config, activeSessions: 0, available: true },
      ])
    );
  }

  selectModel(): ModelConfig {
    const allEligible = Array.from(this.pool.values()).filter(
      (m) => m.available && m.activeSessions < m.config.maxConcurrent
    );
    return this.selectModelFromEligible(allEligible);
  }

  selectModelByProviders(preferredProviders: ModelConfig['provider'][]): ModelConfig {
    return this.selectModelByProvidersExcluding(preferredProviders, []);
  }

  selectModelByProvidersExcluding(
    preferredProviders: ModelConfig['provider'][],
    excludedModelIds: string[],
  ): ModelConfig {
    const excluded = new Set(excludedModelIds);
    const providerEligible = Array.from(this.pool.values()).filter(
      (m) =>
        m.available &&
        m.activeSessions < m.config.maxConcurrent &&
        preferredProviders.includes(m.config.provider) &&
        !excluded.has(m.config.id)
    );
    if (providerEligible.length > 0) {
      return this.selectModelFromEligible(providerEligible);
    }
    const fallbackEligible = Array.from(this.pool.values()).filter(
      (m) =>
        m.available &&
        m.activeSessions < m.config.maxConcurrent &&
        !excluded.has(m.config.id)
    );
    return this.selectModelFromEligible(fallbackEligible);
  }

  private selectModelFromEligible(allEligible: ModelState[]): ModelConfig {

    if (allEligible.length === 0) {
      throw new CapacityExceededError();
    }

    // Sort by priority (ascending: 0 is highest)
    const sortedPriorities = Array.from(new Set(allEligible.map(m => m.config.priority))).sort((a, b) => a - b);
    
    // Find the highest priority level that has available models
    let eligible: ModelState[] = [];
    for (const p of sortedPriorities) {
      eligible = allEligible.filter(m => m.config.priority === p);
      if (eligible.length > 0) break;
    }

    const minSessions = Math.min(...eligible.map((m) => m.activeSessions));
    const tied = eligible.filter((m) => m.activeSessions === minSessions);

    // Round-robin among tied models at the current highest priority level
    const selected = tied[this.rrCounter % tied.length]!;
    this.rrCounter = (this.rrCounter + 1) % tied.length;

    return selected.config;
  }

  acquire(modelId: string): void {
    const state = this.pool.get(modelId);
    if (state) {
      state.activeSessions += 1;
    }
  }

  release(modelId: string): void {
    const state = this.pool.get(modelId);
    if (state) {
      state.activeSessions = Math.max(0, state.activeSessions - 1);
    }
  }

  markUnavailable(modelId: string, durationMs: number = 60_000): void {
    const state = this.pool.get(modelId);
    if (state) {
      state.available = false;
      setTimeout(() => {
        state.available = true;
      }, durationMs);
    }
  }

  getPoolStatus(): PoolStatus[] {
    return Array.from(this.pool.values()).map((m) => ({
      modelId: m.config.id,
      provider: m.config.provider,
      activeSessions: m.activeSessions,
      maxConcurrent: m.config.maxConcurrent,
      available: m.available,
    }));
  }

  getModelIds(): string[] {
    return Array.from(this.pool.values()).map((m) => m.config.id);
  }
}

export const llmRouter = new LLMRouter();
