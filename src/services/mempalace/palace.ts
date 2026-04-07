import { AIService } from '../aiService';

export interface MemoryNode {
  id: string;
  type: 'identity' | 'technical' | 'history' | 'preference' | 'concept';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface MemoryEdge {
  from: string;
  to: string;
  relation: string;
}

export interface MemPalaceState {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  config: {
    aaakThreshold: number;
    miningInterval: number;
  };
}

export class MemPalace {
  private state: MemPalaceState = {
    nodes: [],
    edges: [],
    config: {
      aaakThreshold: 2000,
      miningInterval: 5000
    }
  };

  constructor(initialState?: MemPalaceState) {
    if (initialState) {
      this.state = initialState;
    }
  }

  // --- CORE TOOLS (The 19 Tools) ---

  /**
   * 1. add_node: Add a new memory node
   */
  addNode(type: MemoryNode['type'], content: string, metadata?: Record<string, any>): string {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.state.nodes.push({
      id,
      type,
      content,
      metadata,
      timestamp: Date.now()
    });
    return id;
  }

  /**
   * 2. add_edge: Connect two nodes
   */
  addEdge(from: string, to: string, relation: string) {
    this.state.edges.push({ from, to, relation });
  }

  /**
   * 3. search: Semantic search across nodes (simplified)
   */
  search(query: string): MemoryNode[] {
    const q = query.toLowerCase();
    return this.state.nodes.filter(n => 
      n.content.toLowerCase().includes(q) || 
      n.type.toLowerCase().includes(q)
    );
  }

  /**
   * 4. get_palace_view: Get a structured view of the palace
   */
  getPalaceView(): string {
    const categories = {
      identity: this.state.nodes.filter(n => n.type === 'identity'),
      technical: this.state.nodes.filter(n => n.type === 'technical'),
      history: this.state.nodes.filter(n => n.type === 'history'),
      preference: this.state.nodes.filter(n => n.type === 'preference')
    };

    return `
# 🏰 THE MEMORY PALACE

## 👤 IDENTITY
${categories.identity.map(n => `- ${n.content}`).join('\n') || '- No identity data.'}

## 💻 TECHNICAL
${categories.technical.map(n => `- ${n.content}`).join('\n') || '- No technical data.'}

## 📜 HISTORY
${categories.history.map(n => `- ${n.content}`).join('\n') || '- No history data.'}

## ⚙️ PREFERENCES
${categories.preference.map(n => `- ${n.content}`).join('\n') || '- No preference data.'}

---
## 🕸️ KNOWLEDGE GRAPH (RELATIONS)
${this.state.edges.map(e => `- [${this.getNodeContent(e.from)}] --(${e.relation})--> [${this.getNodeContent(e.to)}]`).join('\n') || '- No relations mapped yet.'}
    `.trim();
  }

  private getNodeContent(id: string): string {
    const node = this.state.nodes.find(n => n.id === id);
    return node ? node.content.substring(0, 30) : id;
  }

  /**
   * 5. detect_contradictions: Check for conflicting information
   */
  async detectContradictions(newContent: string): Promise<string | null> {
    const relevantNodes = this.search(newContent.substring(0, 50));
    if (relevantNodes.length === 0) return null;

    const prompt = `
Aşağıdaki yeni bilgi ile mevcut hafıza kayıtlarını karşılaştır. Bir çelişki var mı?
Yeni Bilgi: "${newContent}"

Mevcut Kayıtlar:
${relevantNodes.map(n => `- ${n.content}`).join('\n')}

Eğer çelişki varsa, çelişkiyi açıkla. Yoksa sadece "YOK" yaz.
    `;

    const response = await AIService.callGemini(prompt);
    return response.includes("YOK") ? null : response;
  }

  /**
   * 6. aaak_compress: Adaptive Attention-Aware Knowledge compression
   */
  async aaakCompress() {
    if (this.state.nodes.length < 20) return;

    const prompt = `
Aşağıdaki hafıza düğümlerini analiz et ve benzer/gereksiz olanları birleştirerek özetle.
Düğümler:
${this.state.nodes.map(n => `[${n.id}] (${n.type}): ${n.content}`).join('\n')}

ÇIKTI FORMATI (JSON):
{
  "mergedNodes": [
    {"type": "category", "content": "summarized content"}
  ],
  "deletedNodeIds": ["id1", "id2"]
}
    `;

    try {
      const response = await AIService.callGemini(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        this.state.nodes = this.state.nodes.filter(n => !result.deletedNodeIds.includes(n.id));
        result.mergedNodes.forEach((n: any) => this.addNode(n.type, n.content));
      }
    } catch (e) {
      console.error("AAAK compression failed", e);
    }
  }

  // --- SERIALIZATION ---

  toJSON(): string {
    return JSON.stringify(this.state, null, 2);
  }

  static fromJSON(json: string): MemPalace {
    try {
      const state = JSON.parse(json);
      return new MemPalace(state);
    } catch (e) {
      return new MemPalace();
    }
  }
}
