import { AIModel } from '../types';

export interface RoutingDecision {
  modelId: string;
  provider: string;
  reason: string;
  category: string;
}

export const BACKEND_ROUTING_CATEGORIES = {
  CODING: {
    id: 'coding',
    name: 'Yazılım ve Teknik',
    keywords: ['kod', 'python', 'javascript', 'html', 'css', 'react', 'sql', 'program', 'debug', 'error', 'api', 'json', 'typescript', 'java', 'c++', 'rust', 'go', 'backend', 'frontend', 'developer', 'script', 'git', 'docker', 'linux', 'terminal'],
    targets: ['claude-3-5-sonnet', 'qwen', 'deepseek', 'codestral', 'gpt-4o', 'llama-3.1-405b']
  },
  LOGIC: {
    id: 'logic',
    name: 'Mantık ve Analiz',
    keywords: ['analiz', 'mantık', 'neden', 'ispat', 'felsefe', 'karmaşık', 'strateji', 'matematik', 'denklem', 'problem', 'çözüm', 'kanıt', 'teorem', 'olasılık', 'istatistik', 'finans', 'ekonomi', 'planlama'],
    targets: ['gpt-4o', 'llama-3.1', 'claude-3-opus', 'gemini-1.5-pro']
  },
  CREATIVE: {
    id: 'creative',
    name: 'Yaratıcı Yazım',
    keywords: ['hikaye', 'yaratıcı', 'şiir', 'senaryo', 'kurgu', 'roman', 'edebiyat', 'masal', 'diyalog', 'karakter', 'betimleme', 'anlatı', 'blog', 'makale', 'içerik', 'sosyal medya'],
    targets: ['zephyr', 'claude-3-haiku', 'mistral', 'gpt-4o-mini', 'gemini-1.5-flash']
  },
  FAST: {
    id: 'fast',
    name: 'Hızlı Yanıt ve Özet',
    keywords: ['özet', 'kısaca', 'liste', 'maddeler', 'çeviri', 'tercüme', 'anlamı', 'nedir', 'kimdir', 'hava durumu', 'saat kaç', 'merhaba', 'nasılsın'],
    targets: ['gemini-1.5-flash', 'gpt-4o-mini', 'llama-3-8b', 'mistral-7b']
  }
};

export class BackendRouter {
  static decideModel(prompt: string, availableModels: AIModel[], excludeIds: string[] = []): RoutingDecision {
    const p = prompt.toLowerCase();
    const scores: Record<string, number> = {};

    const filteredModels = availableModels.filter(m => !excludeIds.includes(m.id));
    if (filteredModels.length === 0 && availableModels.length > 0) {
      // If all models are excluded, fallback to any available model as a last resort
      // but ideally we should have something.
    }

    const modelsToUse = filteredModels.length > 0 ? filteredModels : availableModels;

    // 1. Keyword Scoring
    Object.entries(BACKEND_ROUTING_CATEGORIES).forEach(([key, cat]) => {
      let score = 0;
      cat.keywords.forEach(kw => {
        if (p.includes(kw)) score += 1;
        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escapedKw}\\b`).test(p)) score += 2;
      });
      scores[key] = score;
    });

    // Find best category
    const bestCategoryKey = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const bestCategory = (BACKEND_ROUTING_CATEGORIES as any)[bestCategoryKey];

    // If we have a clear category match
    if (scores[bestCategoryKey] > 0) {
      const targetModels = modelsToUse.filter(m => 
        bestCategory.targets.some((t: string) => m.id.toLowerCase().includes(t.toLowerCase())) && 
        m.isAvailable
      );

      if (targetModels.length > 0) {
        // Sort by tier (quality)
        const bestModel = targetModels.sort((a, b) => b.tier - a.tier)[0];
        return {
          modelId: bestModel.id,
          provider: bestModel.provider,
          category: bestCategory.name,
          reason: `İçerik "${bestCategory.name}" kategorisiyle eşleşti.`
        };
      }
    }

    // 2. Default Fallback (Strongest available model)
    const fallbackModels = modelsToUse.filter(m => m.isAvailable);
    const bestFallback = fallbackModels.sort((a, b) => b.tier - a.tier)[0] || modelsToUse[0];

    return {
      modelId: bestFallback.id,
      provider: bestFallback.provider,
      category: 'Genel',
      reason: 'Belirgin bir kategori bulunamadı, en uygun genel model seçildi.'
    };
  }
}
