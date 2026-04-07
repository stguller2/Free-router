import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS Middleware for local .app support
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Endpoint to save memory.md for a specific model
  app.post("/api/memory", async (req, res) => {
    const { content, modelId } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    try {
      const memoriesDir = path.join(process.cwd(), "memories");
      await fs.mkdir(memoriesDir, { recursive: true });
      
      const fileName = modelId ? `memory_${modelId.replace(/[^a-z0-9]/gi, '_')}.md` : "memory.md";
      await fs.writeFile(path.join(memoriesDir, fileName), content, "utf8");
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving memory:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to read memory for a specific model
  app.get("/api/memory/:modelId", async (req, res) => {
    const { modelId } = req.params;
    try {
      const memoriesDir = path.join(process.cwd(), "memories");
      await fs.mkdir(memoriesDir, { recursive: true });
      
      const fileName = `memory_${modelId.replace(/[^a-z0-9]/gi, '_')}.md`;
      const filePath = path.join(memoriesDir, fileName);
      
      try {
        const content = await fs.readFile(filePath, "utf8");
        res.json({ content });
      } catch (e) {
        res.json({ content: "" }); // Return empty if file doesn't exist
      }
    } catch (error: any) {
      console.error("Error reading specific memory:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to read all memory files
  app.get("/api/memory", async (req, res) => {
    try {
      const memoriesDir = path.join(process.cwd(), "memories");
      await fs.mkdir(memoriesDir, { recursive: true });
      
      const files = await fs.readdir(memoriesDir);
      const mdFiles = files.filter(f => f.endsWith(".md"));
      
      let combinedContent = "";
      
      // Sort files to keep consistent order
      mdFiles.sort();

      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(memoriesDir, file), "utf8");
        const modelName = file.replace("memory_", "").replace(".md", "");
        combinedContent += `\n\n--- MEMORY FROM MODEL: ${modelName} ---\n\n${content}\n`;
      }
      
      // Also check the old legacy memory.md if it exists in root
      const oldMemoryPath = path.join(process.cwd(), "memory.md");
      try {
        const oldContent = await fs.readFile(oldMemoryPath, "utf8");
        combinedContent = `\n\n--- LEGACY GLOBAL MEMORY ---\n\n${oldContent}\n` + combinedContent;
      } catch (e) {}

      res.json({ content: combinedContent.trim() });
    } catch (error: any) {
      console.error("Error reading memory.md:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Proxy for AI Models
  app.post("/api/ai/proxy", async (req, res) => {
    let { provider, prompt, apiKey, modelName, history, systemInstruction } = req.body;

    // Fallback to environment variables if apiKey is missing or placeholder
    if (!apiKey || apiKey === 'YOUR_OPENROUTER_KEY') {
      if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;
    }

    if (!provider || !apiKey) {
      return res.status(400).json({ error: "Missing required fields or API key not configured" });
    }

    // Helper to format history for different providers
    const formatHistory = (hist: any[]) => {
      return (hist || []).map(m => ({
        role: m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'assistant'),
        content: m.content
      }));
    };

    try {
      const commonMessages = [
        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        ...formatHistory(history), 
        { role: "user", content: prompt }
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      if (provider === 'openai') {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName || "gpt-3.5-turbo",
            messages: commonMessages,
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content });
      }

      if (provider === 'anthropic') {
        // Anthropic expects system as a top-level field, not in messages
        const anthropicMessages = commonMessages.filter(m => m.role !== 'system');
        const systemMsg = commonMessages
          .filter(m => m.role === 'system')
          .map(m => m.content)
          .join('\n\n');

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelName || "claude-3-haiku-20240307",
            max_tokens: 1024,
            system: systemMsg,
            messages: anthropicMessages,
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.content[0].text });
      }

      if (provider === 'deepseek') {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName || "deepseek-chat",
            messages: commonMessages,
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content });
      }

      if (provider === 'groq') {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName || "llama3-8b-8192",
            messages: commonMessages,
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content });
      }

      if (provider === 'mistral') {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName || "mistral-tiny",
            messages: commonMessages,
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content });
      }

      if (provider === 'openrouter') {
        const host = req.headers['x-router-host'] as string || "https://openrouter.ai/api/v1";
        const endpoint = `${host.replace(/\/$/, '')}/chat/completions`;
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://ais-dev.run.app",
            "X-Title": "Free AI Router",
          },
          body: JSON.stringify({
            model: modelName,
            messages: commonMessages,
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        if (response.status === 429 || (data.error && (data.error.code === 429 || data.error.message?.toLowerCase().includes('limit')))) {
          return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        }
        
        if (!response.ok) return res.status(response.status).json(data);
        return res.json({ text: data.choices[0].message.content });
      }

      res.status(400).json({ error: "Invalid provider" });
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Health check endpoint
  app.get(["/api/health", "/api/health/"], (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Config endpoint to check which API keys are set on the server
  app.get("/api/config", (req, res) => {
    res.json({
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY
    });
  });

  // OpenRouter health check
  app.get(["/api/ai/openrouter/health", "/api/ai/openrouter/health/"], async (req, res) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "HEAD"
      });
      res.json({ 
        status: response.ok ? "ok" : "error", 
        statusCode: response.status,
        message: response.statusText
      });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Dynamic models storage path
  const DYNAMIC_MODELS_PATH = path.join(process.cwd(), "openrouter_models.json");

  // Function to sync OpenRouter models
  async function syncOpenRouterModels() {
    console.log("[SYNC] Starting OpenRouter free models sync...");
    let apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.log("[SYNC] Skip sync: No OPENROUTER_API_KEY in environment");
      return;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://ais-dev.run.app",
          "X-Title": "Free Router Sync"
        }
      });
      
      if (!response.ok) {
        console.error("[SYNC] OpenRouter API error:", response.status);
        return;
      }

      const data = await response.json();
      const freeModels = (data.data || []).filter((m: any) => 
        m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0')
      ).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: 'openrouter',
        quotaLimit: 50,
        quotaUsed: 0,
        isAvailable: true,
        status: 'idle',
        tier: m.id.includes('llama') ? 3 : 2
      }));

      await fs.writeFile(DYNAMIC_MODELS_PATH, JSON.stringify(freeModels, null, 2), "utf8");
      console.log(`[SYNC] Successfully synced ${freeModels.length} free models to ${DYNAMIC_MODELS_PATH}`);
    } catch (error: any) {
      console.error("[SYNC] OpenRouter models fetch error:", error);
    }
  }

  // Sync on startup
  syncOpenRouterModels();

  // Schedule sync every 24 hours
  setInterval(syncOpenRouterModels, 24 * 60 * 60 * 1000);

  // Endpoint to get dynamic models
  app.get("/api/models/dynamic", async (req, res) => {
    try {
      const content = await fs.readFile(DYNAMIC_MODELS_PATH, "utf8");
      res.json(JSON.parse(content));
    } catch (e) {
      res.json([]); // Return empty if file doesn't exist yet
    }
  });

  // Endpoint to fetch OpenRouter models (manual trigger/check)
  app.get(["/api/ai/openrouter/models", "/api/ai/openrouter/models/"], async (req, res) => {
    console.log("GET /api/ai/openrouter/models request received");
    let apiKey = req.headers.authorization?.split(" ")[1];
    
    // Fallback to environment variable if key is missing, placeholder, or invalid string
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === 'YOUR_OPENROUTER_KEY' || apiKey === '' || apiKey === 'Bearer') {
      apiKey = process.env.OPENROUTER_API_KEY;
    }

    if (!apiKey) {
      console.log("OpenRouter models request failed: No API key");
      return res.status(401).json({ error: "API key required. Please configure OPENROUTER_API_KEY in environment variables or enter it in settings." });
    }

    try {
      console.log("Fetching OpenRouter models...");
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://ais-dev.run.app",
          "X-Title": "Free Router"
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch(e) { errorData = { message: errorText }; }
        
        console.error("OpenRouter API error:", response.status, errorData);
        return res.status(response.status).json({ 
          error: `OpenRouter API Hatası (${response.status})`,
          details: errorData.error?.message || errorData.message || "Bilinmeyen hata"
        });
      }

      const data = await response.json();
      // Filter for free models
      const freeModels = (data.data || []).filter((m: any) => 
        m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0')
      );
      console.log(`Found ${freeModels.length} free models`);
      res.json(freeModels);
    } catch (error: any) {
      console.error("OpenRouter models fetch error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
