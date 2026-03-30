export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'groq' | 'mistral' | 'openrouter' | 'openfang';

export type ProviderStatus = 'active' | 'error' | 'slow' | 'unknown';

export interface ProviderState {
  id: ModelProvider;
  name: string;
  status: ProviderStatus;
  latency?: number;
  lastChecked: number;
}

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
  tier: number; // 1: Weakest, 5: Strongest
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  activeModelId: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  sessions: ChatSession[];
  activeSessionId: string;
  models: AIModel[];
  isSmartRouting: boolean;
}
