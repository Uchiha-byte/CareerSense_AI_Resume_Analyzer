import { ProviderError } from '../errors.js';
import { ModelConfig } from '../types.js';

export interface LLMAdapter {
  call(prompt: string, schema: object): Promise<string>;
}

export class OpenAIAdapter implements LLMAdapter {
  constructor(
    private readonly modelName: string,
    private readonly apiKey: string,
  ) {}

  async call(prompt: string, _schema: object): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        `OpenAI API error: ${response.status} ${response.statusText}`,
        'openai',
        response.status,
      );
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]!.message.content;
  }
}

export class GeminiAdapter implements LLMAdapter {
  constructor(
    private readonly modelName: string,
    private readonly apiKey: string,
  ) {}

  async call(prompt: string, _schema: object): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        `Gemini API error: ${response.status} ${response.statusText}`,
        'gemini',
        response.status,
      );
    }

    const data = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return data.candidates[0]!.content.parts[0]!.text;
  }
}

export class OpenRouterAdapter implements LLMAdapter {
  constructor(
    private readonly modelName: string,
    private readonly apiKey: string,
  ) {}

  async call(prompt: string, _schema: object): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'CareerSense AI',
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
        'openrouter',
        response.status,
      );
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]!.message.content;
  }
}

export class GroqAdapter implements LLMAdapter {
  constructor(
    private readonly modelName: string,
    private readonly apiKey: string,
  ) {}

  async call(prompt: string, _schema: object): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        `Groq API error: ${response.status} ${response.statusText}`,
        'groq',
        response.status,
      );
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]!.message.content;
  }
}

export function createAdapter(config: ModelConfig): LLMAdapter {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`API key not set: environment variable "${config.apiKeyEnv}" is missing`);
  }

  switch (config.provider) {
    case 'openai':
      return new OpenAIAdapter(config.modelName, apiKey);
    case 'gemini':
      return new GeminiAdapter(config.modelName, apiKey);
    case 'openrouter':
      return new OpenRouterAdapter(config.modelName, apiKey);
    case 'groq':
      return new GroqAdapter(config.modelName, apiKey);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
