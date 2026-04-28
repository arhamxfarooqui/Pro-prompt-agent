export type ModelProvider = 'webgpu' | 'ollama' | 'groq';
export type ModelState = 'hot' | 'cold' | 'loading' | 'error';
export type WebGPUModel = 'Llama-3.1-8B-Instruct-q4f16_1-MLC' | 'gemma-2-2b-it-q4f16_1-MLC' | 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  provider?: ModelProvider;
}

export interface LLMResponse {
  content: string;
  provider: ModelProvider;
  tokensUsed?: number;
  latencyMs: number;
  wasFallback: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  sizeBytes?: number;
  sizeLabel?: string;
  isDownloaded: boolean;
  isActive: boolean;
  downloadProgress?: number;
}

export interface ProviderConfig {
  groq: { apiKey: string; model: string };
  ollama: { baseUrl: string; model: string };
  webgpu: { model: WebGPUModel | null; state: ModelState };
  activeProvider: ModelProvider;
}
