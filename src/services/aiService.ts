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

  static async callProxy(provider: string, prompt: string, apiKey?: string, modelName?: string, history?: Message[], systemInstruction?: string) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider, prompt, apiKey, modelName, history, systemInstruction }),
    });

    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "API error");
    }

    const data = await response.json();
    return data.text;
  }

  static async callGemini(prompt: string, history?: Message[], systemInstruction?: string, attachments?: { data: string, mimeType: string }[]) {
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    return response.text;
  }

  static async callOpenAI(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string) {
    return this.callProxy('openai', prompt, apiKey, undefined, history, systemInstruction);
  }

  static async callAnthropic(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string) {
    return this.callProxy('anthropic', prompt, apiKey, undefined, history, systemInstruction);
  }

  static async callDeepSeek(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string) {
    return this.callProxy('deepseek', prompt, apiKey, undefined, history, systemInstruction);
  }

  static async callGroq(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string) {
    return this.callProxy('groq', prompt, apiKey, undefined, history, systemInstruction);
  }

  static async callMistral(prompt: string, apiKey: string, history?: Message[], systemInstruction?: string) {
    return this.callProxy('mistral', prompt, apiKey, undefined, history, systemInstruction);
  }

  static async callOpenRouter(prompt: string, apiKey: string, modelId: string, history?: Message[], systemInstruction?: string) {
    return this.callProxy('openrouter', prompt, apiKey, modelId, history, systemInstruction);
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
