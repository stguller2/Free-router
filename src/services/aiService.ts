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

  static async callProxy(provider: string, prompt: string, apiKey?: string, modelName?: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal, extraHeaders?: Record<string, string>) {
    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders
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

  static async callOpenRouter(prompt: string, apiKey: string, modelId: string, host: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    return this.callProxy('openrouter', prompt, apiKey, modelId, history, systemInstruction, signal, {
      'X-Router-Host': host
    });
  }

  static async callOpenFang(prompt: string, apiKey: string, modelId: string, host: string, openRouterKey?: string, history?: Message[], systemInstruction?: string, signal?: AbortSignal) {
    const headers: Record<string, string> = {
      'X-OpenFang-Host': host
    };
    
    if (openRouterKey) {
      headers['X-OpenRouter-Key'] = openRouterKey;
    }

    return this.callProxy('openfang', prompt, apiKey, modelId, history, systemInstruction, signal, headers);
  }

  static async fetchOpenRouterFreeModels(apiKey: string) {
    const response = await fetch("/api/ai/openrouter/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    
    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        throw new Error(`OpenRouter API Hatası (${response.status}): ${response.statusText}. Yanıt: ${text.substring(0, 50)}...`);
      }
      throw new Error(errorData.details || errorData.error?.message || errorData.error || "OpenRouter modelleri yüklenemedi.");
    }
    
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("JSON parse error in fetchOpenRouterFreeModels:", e);
        const snippet = text.substring(0, 100).replace(/</g, "&lt;");
        throw new Error(`Sunucudan geçersiz JSON yanıtı alındı. Yanıt başlangıcı: "${snippet}..." Lütfen sunucu loglarını kontrol edin.`);
      }
    } catch (e: any) {
      throw e;
    }
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

export interface RoutingDecision {
  modelId: string;
  reason: string;
  confidence: number;
  category: string;
}

export const ROUTING_CATEGORIES = {
  CODING: {
    id: 'coding',
    name: 'Yazılım ve Teknik',
    keywords: ['kod', 'python', 'javascript', 'html', 'css', 'react', 'sql', 'program', 'debug', 'error', 'api', 'json', 'typescript', 'java', 'c++', 'rust', 'go', 'backend', 'frontend', 'developer', 'script', 'git', 'docker', 'linux', 'terminal'],
    targets: ['claude-3-5-sonnet', 'qwen', 'deepseek', 'codestral', 'gpt-4o', 'openfang']
  },
  LOGIC: {
    id: 'logic',
    name: 'Mantık ve Analiz',
    keywords: ['analiz', 'mantık', 'neden', 'ispat', 'felsefe', 'karmaşık', 'strateji', 'matematik', 'denklem', 'problem', 'çözüm', 'kanıt', 'teorem', 'olasılık', 'istatistik', 'finans', 'ekonomi', 'planlama'],
    targets: ['405b', 'gpt-4o', 'llama-3.1', 'pro', 'claude-3-opus', 'openfang']
  },
  CREATIVE: {
    id: 'creative',
    name: 'Yaratıcı Yazım',
    keywords: ['hikaye', 'yaratıcı', 'şiir', 'senaryo', 'kurgu', 'roman', 'edebiyat', 'masal', 'diyalog', 'karakter', 'betimleme', 'anlatı', 'blog', 'makale', 'içerik', 'sosyal medya'],
    targets: ['zephyr', 'claude', 'mistral', 'gpt-4o-mini']
  },
  FAST: {
    id: 'fast',
    name: 'Hızlı Yanıt ve Özet',
    keywords: ['özet', 'kısaca', 'liste', 'maddeler', 'çeviri', 'tercüme', 'anlamı', 'nedir', 'kimdir', 'hava durumu', 'saat kaç', 'merhaba', 'nasılsın'],
    targets: ['flash', 'mini', '7b', '8b', 'haiku']
  }
};

export class SmartRouter {
  static async route(prompt: string, availableModels: any[]): Promise<RoutingDecision | null> {
    const p = prompt.toLowerCase();
    const scores: Record<string, number> = {};

    // 1. Keyword Scoring
    Object.entries(ROUTING_CATEGORIES).forEach(([key, cat]) => {
      let score = 0;
      cat.keywords.forEach(kw => {
        if (p.includes(kw)) score += 1;
        // Exact word match bonus
        if (new RegExp(`\\b${kw}\\b`).test(p)) score += 2;
      });
      scores[key] = score;
    });

    // Find best category
    const bestCategoryKey = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const bestCategory = (ROUTING_CATEGORIES as any)[bestCategoryKey];

    if (scores[bestCategoryKey] > 0) {
      const targetModels = availableModels.filter(m => 
        bestCategory.targets.some((t: string) => m.id.toLowerCase().includes(t)) && 
        m.isAvailable && m.status !== 'exhausted'
      );

      if (targetModels.length > 0) {
        const bestModel = targetModels.sort((a, b) => b.tier - a.tier)[0];
        return {
          modelId: bestModel.id,
          category: bestCategory.name,
          reason: `İstek içeriği "${bestCategory.name}" kategorisiyle eşleşti.`,
          confidence: Math.min(scores[bestCategoryKey] / 5, 1)
        };
      }
    }

    // 2. LLM-based Classification (if keywords are not strong enough)
    if (scores[bestCategoryKey] < 3 && availableModels.some(m => m.id.includes('flash'))) {
      try {
        const classificationPrompt = `Aşağıdaki kullanıcı isteğini şu kategorilerden birine ata: ${Object.values(ROUTING_CATEGORIES).map(c => c.name).join(', ')}. 
        Sadece kategori adını döndür.
        
        İstek: "${prompt}"`;
        
        const categoryName = await AIService.callGemini(classificationPrompt);
        const matchedCategory = Object.values(ROUTING_CATEGORIES).find(c => categoryName.includes(c.name));
        
        if (matchedCategory) {
          const targetModels = availableModels.filter(m => 
            matchedCategory.targets.some((t: string) => m.id.toLowerCase().includes(t)) && 
            m.isAvailable && m.status !== 'exhausted'
          );

          if (targetModels.length > 0) {
            const bestModel = targetModels.sort((a, b) => b.tier - a.tier)[0];
            return {
              modelId: bestModel.id,
              category: matchedCategory.name,
              reason: `Yapay zeka analizi ile "${matchedCategory.name}" kategorisi belirlendi.`,
              confidence: 0.9
            };
          }
        }
      } catch (e) {
        console.error("Routing classification error:", e);
      }
    }

    // 3. Default to strongest general model if no specific match
    const generalModels = availableModels.filter(m => 
      m.isAvailable && m.status !== 'exhausted' && m.tier >= 4
    );
    
    if (generalModels.length > 0) {
      const bestGeneral = generalModels.sort((a, b) => b.tier - a.tier)[0];
      return {
        modelId: bestGeneral.id,
        category: 'Genel',
        reason: 'Belirgin bir kategori bulunamadı, en güçlü genel model seçiliyor.',
        confidence: 0.5
      };
    }

    return null;
  }
}
