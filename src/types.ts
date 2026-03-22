export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'groq' | 'mistral' | 'openrouter';

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  quotaLimit: number;
  quotaUsed: number;
  isAvailable: boolean;
  apiKey?: string;
  lastUsed?: number;
  status: 'idle' | 'active' | 'exhausted' | 'error';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  timestamp: number;
}

export interface AppState {
  models: AIModel[];
  activeModelId: string;
  messages: Message[];
  isSmartRouting: boolean;
}
