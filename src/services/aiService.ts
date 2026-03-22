import { GoogleGenAI } from "@google/genai";
import { Message } from '../types';

export class AIService {
  private static ai: GoogleGenAI | null = null;

  private static getGemini() {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    return this.ai;
  }

  static async callProxy(provider: string, prompt: string, apiKey?: string, modelName?: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider, prompt, apiKey, modelName, history, systemInstruction }),
      signal
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    if (response.status === 504 || response.status === 503) throw new Error("TIMEOUT");
    if (!response.ok) {
      let errorMessage = "API Hatası";
      try {
        const data = await response.json();
        errorMessage = data.error || data.details || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.text;
  }

  static async callGemini(prompt: string, history?: Message[], systemInstruction?: string, attachments?: { data: string, mimeType: string }[], signal?: AbortSignal) {
    const ai = this.getGemini();
    
    // Format history for Gemini
    const contents: any[] = (history || []).filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const userParts: any[] = [{ text: prompt }];
    
    // Add attachments if any
    if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
        userParts.push({
          inlineData: {
            data: att.data.split(',')[1], // Remove data:image/png;base64,
            mimeType: att.mimeType
          }
        });
      });
    }

    contents.push({ role: 'user', parts: userParts });

    const responsePromise = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 60000)
    );

    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        signal.addEventListener('abort', () => reject(new Error("ABORTED")));
      }
    });

    const response = await Promise.race([responsePromise, timeoutPromise, abortPromise]);

    return response.text;
  }

  static async callOpenAI(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('openai', prompt, apiKey, undefined, history, systemInstruction, signal);
  }

  static async callAnthropic(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('anthropic', prompt, apiKey, undefined, history, systemInstruction, signal);
  }

  static async callDeepSeek(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('deepseek', prompt, apiKey, undefined, history, systemInstruction, signal);
  }

  static async callGroq(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('groq', prompt, apiKey, undefined, history, systemInstruction, signal);
  }

  static async callMistral(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('mistral', prompt, apiKey, undefined, history, systemInstruction, signal);
  }

  static async callOpenRouter(prompt: string, apiKey: string, modelId: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('openrouter', prompt, apiKey, modelId, history, systemInstruction, signal);
  }

  static async fetchOpenRouterFreeModels(apiKey: string) {
    const response = await fetch("/api/ai/openrouter/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.details || data.error || "OpenRouter modelleri yüklenemedi.");
    }
    
    return response.json();
  }

  static async extractTextFromPdf(file: File): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  }
}
