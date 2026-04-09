import { env } from "../lib/config";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  text: string;
  modelId: string;
  provider: string;
}

export class AIProvider {
  private static async fetchWithTimeout(url: string, options: any, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  static async request(
    provider: string,
    modelId: string,
    messages: ChatMessage[],
    apiKey: string,
    options: { host?: string } = {}
  ): Promise<AIResponse> {
    switch (provider) {
      case "openai":
        return this.requestOpenAI(modelId, messages, apiKey);
      case "anthropic":
        return this.requestAnthropic(modelId, messages, apiKey);
      case "deepseek":
        return this.requestDeepSeek(modelId, messages, apiKey);
      case "groq":
        return this.requestGroq(modelId, messages, apiKey);
      case "mistral":
        return this.requestMistral(modelId, messages, apiKey);
      case "openrouter":
        return this.requestOpenRouter(modelId, messages, apiKey, options.host);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private static async getResponseData(response: Response, providerName: string) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    throw new Error(`${providerName} error (${response.status}): ${text.slice(0, 100)}`);
  }

  private static async requestOpenAI(modelId: string, messages: ChatMessage[], apiKey: string): Promise<AIResponse> {
    const response = await this.fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId || "gpt-3.5-turbo", messages }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    
    const data = await this.getResponseData(response, "OpenAI");
    if (!response.ok) throw new Error(data.error?.message || "OpenAI error");

    return { text: data.choices[0].message.content, modelId, provider: "openai" };
  }

  private static async requestAnthropic(modelId: string, messages: ChatMessage[], apiKey: string): Promise<AIResponse> {
    const anthropicMessages = messages.filter(m => m.role !== 'system');
    const systemMsg = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');

    const response = await this.fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ 
        model: modelId || "claude-3-haiku-20240307", 
        max_tokens: 1024, 
        system: systemMsg || undefined, 
        messages: anthropicMessages 
      }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    
    const data = await this.getResponseData(response, "Anthropic");
    if (!response.ok) throw new Error(data.error?.message || "Anthropic error");

    return { text: data.content[0].text, modelId, provider: "anthropic" };
  }

  private static async requestDeepSeek(modelId: string, messages: ChatMessage[], apiKey: string): Promise<AIResponse> {
    const response = await this.fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId || "deepseek-chat", messages }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    
    const data = await this.getResponseData(response, "DeepSeek");
    if (!response.ok) throw new Error(data.error?.message || "DeepSeek error");

    return { text: data.choices[0].message.content, modelId, provider: "deepseek" };
  }

  private static async requestGroq(modelId: string, messages: ChatMessage[], apiKey: string): Promise<AIResponse> {
    const response = await this.fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId || "llama3-8b-8192", messages }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    
    const data = await this.getResponseData(response, "Groq");
    if (!response.ok) throw new Error(data.error?.message || "Groq error");

    return { text: data.choices[0].message.content, modelId, provider: "groq" };
  }

  private static async requestMistral(modelId: string, messages: ChatMessage[], apiKey: string): Promise<AIResponse> {
    const response = await this.fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId || "mistral-tiny", messages }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    
    const data = await this.getResponseData(response, "Mistral");
    if (!response.ok) throw new Error(data.error?.message || "Mistral error");

    return { text: data.choices[0].message.content, modelId, provider: "mistral" };
  }

  private static async requestOpenRouter(modelId: string, messages: ChatMessage[], apiKey: string, host?: string): Promise<AIResponse> {
    const baseUrl = host?.replace(/\/$/, '') || "https://openrouter.ai/api/v1";
    const endpoint = `${baseUrl}/chat/completions`;

    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}`, 
        "HTTP-Referer": env.NODE_ENV === 'production' ? "https://ais-dev.run.app" : "http://localhost:3000", 
        "X-Title": "Free AI Router" 
      },
      body: JSON.stringify({ model: modelId, messages }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    
    const data = await this.getResponseData(response, "OpenRouter");
    if (data.error && (data.error.code === 429 || data.error.message?.toLowerCase().includes('limit'))) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (!response.ok) throw new Error(data.error?.message || "OpenRouter error");

    return { text: data.choices[0].message.content, modelId, provider: "openrouter" };
  }
}
