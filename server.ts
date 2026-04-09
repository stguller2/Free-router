import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

import { BackendRouter } from "./src/services/backendRouter";
import { AIModel, ModelProvider } from "./src/types";
import { env, INITIAL_MODELS } from "./src/lib/config";
import { AIProvider, ChatMessage } from "./src/services/aiProvider";
import { z } from "zod";

// Custom Error Class
class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

// Request Validation Schemas
const chatRequestSchema = z.object({
  prompt: z.string().min(1),
  history: z.array(z.any()).optional(),
  systemInstruction: z.string().optional(),
  excludeIds: z.array(z.string()).optional(),
});

const proxyRequestSchema = z.object({
  provider: z.string(),
  prompt: z.string().min(1),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
  history: z.array(z.any()).optional(),
  systemInstruction: z.string().optional(),
});

async function startServer() {
  const app = express();
  const PORT = env.PORT;

  app.use(express.json());

  // CORS Middleware for local .app support
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Router-Host");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  const DYNAMIC_MODELS_PATH = path.join(process.cwd(), "openrouter_models.json");

  // Helper to get all available models on backend
  async function getAvailableModels(): Promise<AIModel[]> {
    let dynamicModels: AIModel[] = [];
    try {
      const content = await fs.readFile(DYNAMIC_MODELS_PATH, "utf8");
      dynamicModels = JSON.parse(content);
    } catch (e) {}

    const allModels = [...INITIAL_MODELS, ...dynamicModels];
    
    return allModels.map(m => {
      let isAvailable = false;
      const provider = m.provider as ModelProvider;
      if (provider === 'gemini') isAvailable = !!env.GEMINI_API_KEY;
      if (provider === 'openrouter') isAvailable = !!env.OPENROUTER_API_KEY;
      if (provider === 'openai') isAvailable = !!env.OPENAI_API_KEY;
      if (provider === 'anthropic') isAvailable = !!env.ANTHROPIC_API_KEY;
      if (provider === 'deepseek') isAvailable = !!env.DEEPSEEK_API_KEY;
      if (provider === 'groq') isAvailable = !!env.GROQ_API_KEY;
      if (provider === 'mistral') isAvailable = !!env.MISTRAL_API_KEY;
      
      return { 
        ...m, 
        isAvailable, 
        provider,
        status: m.status as 'active' | 'error' | 'idle' | 'exhausted'
      };
    });
  }

  const formatHistory = (hist: any[]): ChatMessage[] => {
    return (hist || []).map(m => ({
      role: m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'assistant'),
      content: m.content
    }));
  };

  async function handleProxyRequest(req: Request, res: Response, decision?: any) {
    const validated = proxyRequestSchema.parse(req.body);
    let { provider, prompt, apiKey, modelName, history, systemInstruction } = validated;

    if (!apiKey || apiKey === 'YOUR_OPENROUTER_KEY' || apiKey === 'SYSTEM') {
      apiKey = (env as any)[`${provider.toUpperCase()}_API_KEY`];
    }

    if (!provider || !apiKey) {
      throw new AppError(400, "Missing required fields or API key not configured");
    }

    const messages: ChatMessage[] = [
      ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
      ...formatHistory(history), 
      { role: "user" as const, content: prompt }
    ];

    const host = req.headers['x-router-host'] as string;
    const result = await AIProvider.request(provider, modelName || "", messages, apiKey, { host });
    
    return res.json({ 
      text: result.text, 
      routedTo: decision?.modelId || result.modelId,
      provider: result.provider
    });
  }

  // Endpoints
  app.post("/api/ai/chat", async (req, res, next) => {
    try {
      const { prompt, excludeIds } = chatRequestSchema.parse(req.body);
      const availableModels = await getAvailableModels();
      const decision = BackendRouter.decideModel(prompt, availableModels, excludeIds || []);
      
      req.body.provider = decision.provider;
      req.body.modelName = decision.modelId;
      
      await handleProxyRequest(req, res, decision);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/proxy", async (req, res, next) => {
    try {
      await handleProxyRequest(req, res);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/memory", async (req, res) => {
    const { content, modelId } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });
    try {
      const memoriesDir = path.join(process.cwd(), "memories");
      await fs.mkdir(memoriesDir, { recursive: true });
      const fileName = modelId ? `memory_${modelId.replace(/[^a-z0-9]/gi, '_')}.md` : "memory.md";
      await fs.writeFile(path.join(memoriesDir, fileName), content, "utf8");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/memory/:modelId", async (req, res) => {
    const { modelId } = req.params;
    try {
      const memoriesDir = path.join(process.cwd(), "memories");
      const fileName = `memory_${modelId.replace(/[^a-z0-9]/gi, '_')}.md`;
      const filePath = path.join(memoriesDir, fileName);
      const content = await fs.readFile(filePath, "utf8");
      res.json({ content });
    } catch (e) {
      res.json({ content: "" });
    }
  });

  app.get("/api/memory", async (req, res) => {
    try {
      const memoriesDir = path.join(process.cwd(), "memories");
      await fs.mkdir(memoriesDir, { recursive: true });
      const files = await fs.readdir(memoriesDir);
      const mdFiles = files.filter(f => f.endsWith(".md")).sort();
      let combinedContent = "";
      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(memoriesDir, file), "utf8");
        const modelName = file.replace("memory_", "").replace(".md", "");
        combinedContent += `\n\n--- MEMORY FROM MODEL: ${modelName} ---\n\n${content}\n`;
      }
      const oldMemoryPath = path.join(process.cwd(), "memory.md");
      try {
        const oldContent = await fs.readFile(oldMemoryPath, "utf8");
        combinedContent = `\n\n--- LEGACY GLOBAL MEMORY ---\n\n${oldContent}\n` + combinedContent;
      } catch (e) {}
      res.json({ content: combinedContent.trim() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.get("/api/config", (req, res) => res.json({
    hasOpenRouterKey: !!env.OPENROUTER_API_KEY,
    hasGeminiKey: !!env.GEMINI_API_KEY
  }));

  app.get("/api/ai/openrouter/health", async (req, res) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", { method: "HEAD" });
      res.json({ status: response.ok ? "ok" : "error", statusCode: response.status });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  async function syncOpenRouterModels() {
    console.log("[SYNC] Starting OpenRouter free models sync...");
    let apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) return;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": env.NODE_ENV === 'production' ? "https://ais-dev.run.app" : "http://localhost:3000", "X-Title": "Free Router Sync" }
      });
      if (!response.ok) return;
      const data = await response.json();
      const freeModels = (data.data || []).filter((m: any) => 
        m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0')
      ).map((m: any) => ({
        id: m.id, name: m.name || m.id, provider: 'openrouter', quotaLimit: 50, quotaUsed: 0, isAvailable: true, status: 'idle', tier: m.id.includes('llama') ? 3 : 2
      }));
      await fs.writeFile(DYNAMIC_MODELS_PATH, JSON.stringify(freeModels, null, 2), "utf8");
      console.log(`[SYNC] Successfully synced ${freeModels.length} free models`);
    } catch (error: any) {
      console.error("[SYNC] Error:", error);
    }
  }

  syncOpenRouterModels();
  setInterval(syncOpenRouterModels, 24 * 60 * 60 * 1000);

  app.get("/api/models/dynamic", async (req, res) => {
    try {
      const content = await fs.readFile(DYNAMIC_MODELS_PATH, "utf8");
      res.json(JSON.parse(content));
    } catch (e) {
      res.json([]);
    }
  });

  app.get(["/api/ai/openrouter/models", "/api/ai/openrouter/models/"], async (req, res) => {
    let apiKey = req.headers.authorization?.split(" ")[1];
    if (!apiKey || apiKey === 'YOUR_OPENROUTER_KEY') apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "API key required" });
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": env.NODE_ENV === 'production' ? "https://ais-dev.run.app" : "http://localhost:3000", "X-Title": "Free Router" }
      });
      const data = await response.json();
      const freeModels = (data.data || []).filter((m: any) => m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0'));
      res.json(freeModels);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  if (env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Global Error:", err);
    const status = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({
      status: "error",
      statusCode: status,
      message: message,
      stack: env.NODE_ENV === "development" ? err.stack : undefined,
    });
  });

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
