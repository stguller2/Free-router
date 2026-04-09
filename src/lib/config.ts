import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;

export const INITIAL_MODELS = [
  { id: 'gemini-flash', name: 'Gemini 3 Flash', provider: 'gemini', quotaLimit: 15, quotaUsed: 0, isAvailable: !!env.GEMINI_API_KEY, status: 'idle', tier: 3 },
  { id: 'gpt-3.5', name: 'ChatGPT 3.5', provider: 'openai', quotaLimit: 10, quotaUsed: 0, isAvailable: !!env.OPENAI_API_KEY, status: 'idle', tier: 2 },
  { id: 'claude-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', quotaLimit: 5, quotaUsed: 0, isAvailable: !!env.ANTHROPIC_API_KEY, status: 'idle', tier: 2 },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', quotaLimit: 10, quotaUsed: 0, isAvailable: !!env.DEEPSEEK_API_KEY, status: 'idle', tier: 3 },
  { id: 'groq-llama', name: 'Groq Llama 3', provider: 'groq', quotaLimit: 20, quotaUsed: 0, isAvailable: !!env.GROQ_API_KEY, status: 'idle', tier: 3 },
  { id: 'mistral-tiny', name: 'Mistral Tiny', provider: 'mistral', quotaLimit: 10, quotaUsed: 0, isAvailable: !!env.MISTRAL_API_KEY, status: 'idle', tier: 1 },
];
