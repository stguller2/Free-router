import { AIService } from './aiService';
import { MemPalace, MemPalaceState } from './mempalace/palace';

export class MemoryPalaceService {
  private static palaceInstance: MemPalace | null = null;
  private static readonly GLOBAL_PALACE_ID = 'global_palace';

  static async getPalace(): Promise<MemPalace> {
    try {
      const res = await fetch(`/api/memory/${this.GLOBAL_PALACE_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data.content && data.content.startsWith('{')) {
          return MemPalace.fromJSON(data.content);
        }
      }
    } catch (e) {
      console.warn("Failed to load global palace", e);
    }
    return new MemPalace();
  }

  static async savePalace(palace: MemPalace) {
    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: palace.toJSON(), modelId: this.GLOBAL_PALACE_ID })
      });
    } catch (e) {
      console.error("Failed to save global palace", e);
    }
  }

  static async mineMemory(rawContent: string): Promise<string> {
    const palace = await this.getPalace();
    
    const miningPrompt = `
Sen bir "Hafıza Madencisi" (Memory Miner) ajanısın. Görevin, farklı yapay zeka modelleriyle yapılan tüm konuşmaları analiz etmek ve bu bilgileri tek bir ortak "Memory Palace" (Hafıza Sarayı) formatına dönüştürmektir.

### MEVCUT ORTAK HAFIZA SARAYI:
${palace.getPalaceView()}

### ANALİZ EDİLECEK YENİ VERİLER (Farklı Modellerden):
${rawContent}

### TALİMATLAR:
1. Yeni verilerdeki önemli bilgileri ayıkla.
2. Bilgileri şu kategorilere yerleştir:
   - identity: Kullanıcının kimliği, adı, dili, temel özellikleri.
   - technical: Kullanılan teknolojiler, kodlama tercihleri, projede kullanılan kütüphaneler.
   - history: Yapılan önemli değişiklikler, tamamlanan görevler, alınan kararlar.
   - preference: Arayüz tercihleri, model tercihleri, özel istekler.
3. Mevcut bilgileri güncelle veya üzerine ekle. Tekrar eden bilgilerden kaçın.
4. Farklı modellerden gelen bilgileri sentezle ve tutarlı bir bütün oluştur.
5. Çelişkili bilgi varsa en güncel olanı tut.
6. ÇIKTI FORMATI: Sadece aşağıdaki JSON formatında yanıt ver, başka açıklama yapma.

\`\`\`json
{
  "nodes": [
    {"type": "identity", "content": "bilgi 1"},
    {"type": "technical", "content": "bilgi 2"}
  ],
  "edges": [
    {"from": "node_id_1", "to": "node_id_2", "relation": "related_to"}
  ]
}
\`\`\`
`;

    try {
      const response = await AIService.callGemini(miningPrompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const minedData = JSON.parse(jsonMatch[0]);
        minedData.nodes.forEach((n: any) => palace.addNode(n.type, n.content));
        minedData.edges.forEach((e: any) => palace.addEdge(e.from, e.to, e.relation));
        
        // AAAK Compression check
        await palace.aaakCompress();
        
        await this.savePalace(palace);
        return palace.toJSON();
      }
    } catch (error) {
      console.error("Global memory mining failed:", error);
    }

    return palace.toJSON();
  }
}
