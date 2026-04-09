export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  text: string;
  modelId: string;
  provider: string;
}

export class AIService {
  // Frontend Compatibility Methods
  static async callSmartChat(prompt: string, history: any[], systemInstruction?: string, excludeIds: string[] = [], signal?: AbortSignal) {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history, systemInstruction, excludeIds }),
      signal
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.error || "Backend routing failed");
    }
    return response.json();
  }

  static async callGemini(prompt: string, history: any[] = [], systemInstruction?: string, attachments?: any[], signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", prompt, history, systemInstruction, attachments }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "Gemini request failed");
    return data.text;
  }

  static async callOpenRouter(prompt: string, apiKey: string, modelId: string, host: string, history: any[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-router-host": host },
      body: JSON.stringify({ provider: "openrouter", prompt, apiKey, modelName: modelId, history, systemInstruction }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "OpenRouter request failed");
    return data.text;
  }

  static async callOpenAI(prompt: string, apiKey: string, history: any[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", prompt, apiKey, history, systemInstruction }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "OpenAI request failed");
    return data.text;
  }

  static async callAnthropic(prompt: string, apiKey: string, history: any[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "anthropic", prompt, apiKey, history, systemInstruction }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "Anthropic request failed");
    return data.text;
  }

  static async callDeepSeek(prompt: string, apiKey: string, history: any[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "deepseek", prompt, apiKey, history, systemInstruction }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "DeepSeek request failed");
    return data.text;
  }

  static async callGroq(prompt: string, apiKey: string, history: any[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "groq", prompt, apiKey, history, systemInstruction }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "Groq request failed");
    return data.text;
  }

  static async callMistral(prompt: string, apiKey: string, history: any[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "mistral", prompt, apiKey, history, systemInstruction }),
      signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "Mistral request failed");
    return data.text;
  }

  static async extractTextFromPdf(file: File): Promise<string> {
    // Placeholder or actual implementation if needed
    return "PDF extraction is not implemented in this version.";
  }
}
