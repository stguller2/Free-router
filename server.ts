import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

import { BackendRouter } from "./src/services/backendRouter";
import { AIModel } from "./src/types";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Static initial models (same as App.tsx)
  const INITIAL_MODELS: AIModel[] = [
    { id: 'gemini-flash', name: 'Gemini 3 Flash', provider: 'gemini', quotaLimit: 15, quotaUsed: 0, isAvailable: true, status: 'idle', tier: 3 },
    { id: 'gpt-3.5', name: 'ChatGPT 3.5', provider: 'openai', quotaLimit: 10, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 2 },
    { id: 'claude-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', quotaLimit: 5, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 2 },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', quotaLimit: 10, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 3 },
    { id: 'groq-llama', name: 'Groq Llama 3', provider: 'groq', quotaLimit: 20, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 3 },
    { id: 'mistral-tiny', name: 'Mistral Tiny', provider: 'mistral', quotaLimit: 10, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 1 },
  ];

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
      if (m.provider === 'gemini') isAvailable = !!process.env.GEMINI_API_KEY;
      if (m.provider === 'openrouter') isAvailable = !!process.env.OPENROUTER_API_KEY;
      if (m.provider === 'openai') isAvailable = !!process.env.OPENAI_API_KEY;
      if (m.provider === 'anthropic') isAvailable = !!process.env.ANTHROPIC_API_KEY;
      if (m.provider === 'deepseek') isAvailable = !!process.env.DEEPSEEK_API_KEY;
      if (m.provider === 'groq') isAvailable = !!process.env.GROQ_API_KEY;
      if (m.provider === 'mistral') isAvailable = !!process.env.MISTRAL_API_KEY;
      
      return { ...m, isAvailable };
    });
  }

  const formatHistory = (hist: any[]) => {
    return (hist || []).map(m => ({
      role: m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'assistant'),
      content: m.content
    }));
  };

  async function handleProxyRequest(req: any, res: any, decision?: any) {
    let { provider, prompt, apiKey, modelName, history, systemInstruction } = req.body;

    if (!apiKey || apiKey === 'YOUR_OPENROUTER_KEY' || apiKey === 'SYSTEM') {
      if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;
      if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
      if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
      if (provider === 'deepseek') apiKey = process.env.DEEPSEEK_API_KEY;
      if (provider === 'groq') apiKey = process.env.GROQ_API_KEY;
      if (provider === 'mistral') apiKey = process.env.MISTRAL_API_KEY;
    }

    if (!provider || !apiKey) {
      return res.status(400).json({ error: "Missing required fields or API key not configured" });
    }

    try {
      const commonMessages = [
        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        ...formatHistory(history), 
        { role: "user", content: prompt }
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      if (provider === 'openai') {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelName || "gpt-3.5-turbo", messages: commonMessages }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content, routedTo: decision?.modelId });
      }

      if (provider === 'anthropic') {
        const anthropicMessages = commonMessages.filter(m => m.role !== 'system');
        const systemMsg = commonMessages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: modelName || "claude-3-haiku-20240307", max_tokens: 1024, system: systemMsg, messages: anthropicMessages }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.content[0].text, routedTo: decision?.modelId });
      }

      if (provider === 'deepseek') {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelName || "deepseek-chat", messages: commonMessages }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content, routedTo: decision?.modelId });
      }

      if (provider === 'groq') {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelName || "llama3-8b-8192", messages: commonMessages }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content, routedTo: decision?.modelId });
      }

      if (provider === 'mistral') {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelName || "mistral-tiny", messages: commonMessages }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content, routedTo: decision?.modelId });
      }

      if (provider === 'openrouter') {
        const host = req.headers['x-router-host'] as string || "https://openrouter.ai/api/v1";
        const endpoint = `${host.replace(/\/$/, '')}/chat/completions`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "https://ais-dev.run.app", "X-Title": "Free AI Router" },
          body: JSON.stringify({ model: modelName, messages: commonMessages }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (response.status === 429 || (data.error && (data.error.code === 429 || data.error.message?.toLowerCase().includes('limit')))) {
          return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        }
        if (!response.ok) return res.status(response.status).json(data);
        return res.json({ text: data.choices[0].message.content, routedTo: decision?.modelId });
      }

      res.status(400).json({ error: "Invalid provider" });
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  // Endpoints
  app.post("/api/ai/chat", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    try {
      const availableModels = await getAvailableModels();
      const decision = BackendRouter.decideModel(prompt, availableModels);
      req.body.provider = decision.provider;
      req.body.modelName = decision.modelId;
      return handleProxyRequest(req, res, decision);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/proxy", async (req, res) => {
    return handleProxyRequest(req, res);
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
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY
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
    let apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": process.env.APP_URL || "https://ais-dev.run.app", "X-Title": "Free Router Sync" }
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
    if (!apiKey || apiKey === 'YOUR_OPENROUTER_KEY') apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "API key required" });
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": process.env.APP_URL || "https://ais-dev.run.app", "X-Title": "Free Router" }
      });
      const data = await response.json();
      const freeModels = (data.data || []).filter((m: any) => m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0'));
      res.json(freeModels);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
