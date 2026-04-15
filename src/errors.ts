export class CapacityExceededError extends Error {
  constructor(message = 'Service temporarily at capacity. Please try again in a moment.') {
    super(message);
    this.name = 'CapacityExceededError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class LLMResponseError extends Error {
  constructor(
    message: string,
    public readonly modelId?: string,
  ) {
    super(message);
    this.name = 'LLMResponseError';
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(message = 'Failed to persist session. Please try again.') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AnalysisTimeoutError extends Error {
  constructor(message = 'Analysis timed out. Please try again.') {
    super(message);
    this.name = 'AnalysisTimeoutError';
  }
}

export class AllProvidersFailedError extends Error {
  constructor(message = 'All AI providers are currently unavailable. Please try again shortly.') {
    super(message);
    this.name = 'AllProvidersFailedError';
  }
}
