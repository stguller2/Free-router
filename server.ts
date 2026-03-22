import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Endpoint to save memory.md
  app.post("/api/memory", async (req, res) => {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    try {
      await fs.writeFile(path.join(process.cwd(), "memory.md"), content, "utf8");
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving memory.md:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Proxy for AI Models
  app.post("/api/ai/proxy", async (req, res) => {
    const { provider, prompt, apiKey, modelName, history, systemInstruction } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Helper to format history for different providers
    const formatHistory = (hist: any[]) => {
      return (hist || []).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
    };

    try {
      const commonMessages = [
        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        ...formatHistory(history), 
        { role: "user", content: prompt }
      ];

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
        });
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content });
      }

      if (provider === 'anthropic') {
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
            messages: commonMessages,
          }),
        });
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
        });
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
        });
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
        });
        if (response.status === 429) return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        const data = await response.json();
        return res.json({ text: data.choices[0].message.content });
      }

      if (provider === 'openrouter') {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        });
        
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

  // Endpoint to fetch OpenRouter models
  app.get("/api/ai/openrouter/models", async (req, res) => {
    const apiKey = req.headers.authorization?.split(" ")[1];
    if (!apiKey) {
      console.log("OpenRouter models request failed: No API key");
      return res.status(401).json({ error: "API key required" });
    }

    try {
      console.log("Fetching OpenRouter models...");
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", response.status, errorText);
        return res.status(response.status).json({ error: `OpenRouter API error: ${response.status}` });
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
