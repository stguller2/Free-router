import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Zap, 
  RefreshCw, 
  Send, 
  Bot, 
  User, 
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Mic,
  Paperclip,
  X,
  Terminal,
  Layout,
  Command,
  Activity,
  History,
  Trash2,
  Copy,
  Check,
  Sun,
  Moon,
  Plus,
  Database,
  Square,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AIService, SmartRouter, RoutingDecision } from './services/aiService';
import { AIModel, Message, ChatSession, ProviderState, ModelProvider, ProviderStatus } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INITIAL_MODELS: AIModel[] = [
  { id: 'gemini-flash', name: 'Gemini 3 Flash', provider: 'gemini', quotaLimit: 15, quotaUsed: 0, isAvailable: true, status: 'idle', tier: 3 },
  { id: 'gpt-3.5', name: 'ChatGPT 3.5', provider: 'openai', quotaLimit: 10, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 2 },
  { id: 'claude-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', quotaLimit: 5, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 2 },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', quotaLimit: 10, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 3 },
  { id: 'groq-llama', name: 'Groq Llama 3', provider: 'groq', quotaLimit: 20, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 3 },
  { id: 'mistral-tiny', name: 'Mistral Tiny', provider: 'mistral', quotaLimit: 10, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 1 },
  // OpenRouter Free Tier Models (v1)
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', provider: 'openrouter', quotaLimit: 50, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 2 },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', provider: 'openrouter', quotaLimit: 50, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 1 },
  { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)', provider: 'openrouter', quotaLimit: 50, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 2 },
  { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B (Free)', provider: 'openrouter', quotaLimit: 50, quotaUsed: 0, isAvailable: false, status: 'idle', tier: 1 },
];

const createNewSession = (modelId: string = 'gemini-flash'): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'Yeni Sohbet',
  messages: [],
  activeModelId: modelId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const DEFAULT_SYSTEM_PROMPT = `Sen "Free Router" ekosisteminin bir parçası olan, çoklu model desteğine ve uzun süreli hafızaya sahip gelişmiş bir yapay zeka asistanısın.

TEMEL KURALLAR VE YETENEKLER:
1. HAFIZA YÖNETİMİ: Sana sunulan "[UZUN SÜRELİ HAFIZA (memory.md)]" bölümündeki bilgileri dikkatle incele. Kullanıcı farklı bir sohbette olsa bile, oradaki geçmiş bilgileri (isim, tercihler, önceki konular) kullanarak tutarlı bir deneyim sun.
2. MODEL FARKINDALIĞI: Sen birçok farklı modelden (Gemini, GPT, Claude, Llama vb.) biri olabilirsin. Eğer bir model hata verirse sistem seni otomatik olarak devreye almış olabilir. Kullanıcıya nerede kaldığını hissettirmeden akıcı bir şekilde yardımcı ol.
3. DOSYA ANALİZİ: Kullanıcı PDF, resim veya metin dosyası yüklediğinde, bu içeriği en öncelikli bilgi kaynağı olarak kabul et ve derinlemesine analiz yap.
4. ÜSLUP: Profesyonel, yardımsever ve çözüm odaklı ol. Cevaplarını Markdown formatında, okunaklı ve yapılandırılmış bir şekilde sun.
5. DİL: Kullanıcı aksini belirtmedikçe her zaman Türkçe cevap ver.

Kullanıcının şu anki isteğine, hem mevcut sohbet geçmişini hem de uzun süreli hafızayı sentezleyerek en doğru yanıtı ver.`;

export default function App() {
  const [models, setModels] = useState<AIModel[]>(() => {
    const saved = localStorage.getItem('ai_hub_models');
    if (saved) {
      return JSON.parse(saved);
    }
    return INITIAL_MODELS;
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('ai_hub_sessions');
    if (saved) {
      return JSON.parse(saved);
    }
    return [createNewSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('ai_hub_active_session_id');
    if (saved && sessions.some(s => s.id === saved)) {
      return saved;
    }
    return sessions[0]?.id || '';
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];
  const activeModelId = activeSession?.activeModelId || 'gemini-flash';

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSmartRouting, setIsSmartRouting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [routingStatus, setRoutingStatus] = useState<'stable' | 'routing' | 'exhausted'>('stable');
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('openrouter_key') || '');
  const [routerHost, setRouterHost] = useState(() => localStorage.getItem('router_host') || 'https://openrouter.ai/api/v1');
  const [openFangKey, setOpenFangKey] = useState(() => localStorage.getItem('openfang_key') || '');
  const [openFangHost, setOpenFangHost] = useState(() => localStorage.getItem('openfang_host') || 'http://localhost:8080');
  const [passOpenRouterKeyToOpenFang, setPassOpenRouterKeyToOpenFang] = useState(() => localStorage.getItem('pass_openrouter_to_openfang') === 'true');
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem('ai_hub_system_prompt') || DEFAULT_SYSTEM_PROMPT);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showModelGuide, setShowModelGuide] = useState(false);
  const [isSystemPromptSaved, setIsSystemPromptSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [copyStatus, setCopyStatus] = useState<number | null>(null);
  const [tokenSpeed, setTokenSpeed] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [serverConfig, setServerConfig] = useState<{ hasOpenRouterKey: boolean, hasOpenFangKey: boolean, hasGeminiKey: boolean }>({
    hasOpenRouterKey: false,
    hasOpenFangKey: false,
    hasGeminiKey: false
  });

  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderState>>({
    gemini: { id: 'gemini', name: 'Google Gemini', status: 'unknown', lastChecked: Date.now() },
    openrouter: { id: 'openrouter', name: 'OpenRouter', status: 'unknown', lastChecked: Date.now() },
    openai: { id: 'openai', name: 'OpenAI', status: 'unknown', lastChecked: Date.now() },
    anthropic: { id: 'anthropic', name: 'Anthropic', status: 'unknown', lastChecked: Date.now() },
    deepseek: { id: 'deepseek', name: 'DeepSeek', status: 'unknown', lastChecked: Date.now() },
    groq: { id: 'groq', name: 'Groq', status: 'unknown', lastChecked: Date.now() },
    mistral: { id: 'mistral', name: 'Mistral', status: 'unknown', lastChecked: Date.now() },
    openfang: { id: 'openfang', name: 'OpenFang', status: 'unknown', lastChecked: Date.now() },
  });

  const updateProviderStatus = (provider: ModelProvider, status: ProviderStatus, latency?: number) => {
    setProviderStatuses(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        status,
        latency,
        lastChecked: Date.now()
      }
    }));
  };

  useEffect(() => {
    // Fetch server configuration
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          setServerConfig(config);
          
          // Update model availability based on server config
          setModels(prev => prev.map(m => {
            if (m.provider === 'gemini') return { ...m, isAvailable: config.hasGeminiKey };
            if (m.provider === 'openrouter') return { ...m, isAvailable: !!m.apiKey || config.hasOpenRouterKey };
            if (m.provider === 'openfang') return { ...m, isAvailable: !!m.apiKey || config.hasOpenFangKey };
            return m;
          }));

          if (config.hasGeminiKey) updateProviderStatus('gemini', 'active');
          if (config.hasOpenRouterKey) updateProviderStatus('openrouter', 'active');
          if (config.hasOpenFangKey) updateProviderStatus('openfang', 'active');
        }
      } catch (e) {
        console.error("Failed to fetch server config:", e);
      }
    };
    fetchConfig();
  }, []);

  const [lastFailedRequest, setLastFailedRequest] = useState<{
    prompt: string;
    modelId: string;
    history: Message[];
    attachments?: { data: string, mimeType: string }[];
  } | null>(null);

  const modelsRef = useRef(models);
  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('ai_hub_models', JSON.stringify(models));
    localStorage.setItem('ai_hub_sessions', JSON.stringify(sessions));
    localStorage.setItem('ai_hub_active_session_id', activeSessionId);
    localStorage.setItem('openrouter_key', openRouterKey);
    localStorage.setItem('router_host', routerHost);
    localStorage.setItem('openfang_key', openFangKey);
    localStorage.setItem('openfang_host', openFangHost);
    localStorage.setItem('pass_openrouter_to_openfang', String(passOpenRouterKeyToOpenFang));
    localStorage.setItem('ai_hub_system_prompt', systemPrompt);
    localStorage.setItem('theme', theme);
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [models, sessions, activeSessionId, openRouterKey, theme]);

  const updateActiveSession = (updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, ...updates, updatedAt: Date.now() } : s
    ));
  };

  const setMessages = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const messages = typeof newMessages === 'function' ? newMessages(s.messages) : newMessages;
        
        // Auto-generate title if it's the first user message
        let title = s.title;
        if (title === 'Yeni Sohbet' && messages.length > 0) {
          const firstUserMsg = messages.find(m => m.role === 'user');
          if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }

        return { ...s, messages, title, updatedAt: Date.now() };
      }
      return s;
    }));
  };

  const setActiveModelId = (modelId: string) => {
    const currentModel = models.find(m => m.id === activeModelId);
    const nextModel = models.find(m => m.id === modelId);
    
    if (currentModel && nextModel && currentModel.id !== nextModel.id) {
      const agentMsg: Message = {
        id: `agent-ready-${Date.now()}`,
        role: 'system',
        content: `🧠 **Hafıza Ajanı (Yerel):** \`memory.md\` verileri ${nextModel.name} için hazırlandı. İlk mesajınızla birlikte tüm geçmiş bağlam aktarılacak.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, agentMsg]);
    }
    updateActiveSession({ activeModelId: modelId });
  };

  const handleSaveSystemPrompt = () => {
    localStorage.setItem('ai_hub_system_prompt', systemPrompt);
    setIsSystemPromptSaved(true);
    setSuccessMessage("Sistem talimatları başarıyla kaydedildi.");
    setTimeout(() => {
      setIsSystemPromptSaved(false);
      setSuccessMessage(null);
    }, 3000);
  };

  const handleNewChat = () => {
    const newSession = createNewSession(activeModelId);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    inputRef.current?.focus();
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
      const newSession = createNewSession(activeModelId);
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
      return;
    }
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  // Save all conversations to memory.md whenever sessions change
  useEffect(() => {
    const saveMemory = async () => {
      if (sessions.length === 0) return;

      const markdown = sessions.map(session => {
        const sessionHeader = `## Session: ${session.title} (${new Date(session.createdAt).toLocaleString('tr-TR')})\n\n`;
        const sessionMessages = session.messages.map(m => {
          const role = m.role === 'user' ? '### User' : (m.role === 'system' ? '### System' : '### Assistant');
          const time = new Date(m.timestamp || Date.now()).toLocaleString('tr-TR');
          const modelInfo = m.modelId ? ` [Model: ${m.modelId}]` : '';
          return `${role}${modelInfo} (${time})\n\n${m.content}\n\n---\n`;
        }).join('\n');
        return sessionHeader + sessionMessages;
      }).join('\n\n');

      try {
        await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: markdown })
        });
      } catch (err) {
        console.error("Failed to save memory.md:", err);
      }
    };

    const timeoutId = setTimeout(saveMemory, 2000); // Debounce save
    return () => clearTimeout(timeoutId);
  }, [sessions]);

  useEffect(() => {
    setConnectionStatus('idle');
  }, [openRouterKey]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + R to reset all quotas
      if (e.altKey && e.key.toLowerCase() === 'r') {
        setModels(prev => prev.map(m => ({ ...m, quotaUsed: 0, status: 'idle' })));
        setSuccessMessage("Tüm model kotaları sıfırlandı. Artık tüm modelleri kullanabilirsiniz.");
        setTimeout(() => setSuccessMessage(null), 3000);
        e.preventDefault();
      }
      // Alt + 1-9 to switch models
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const sortedModels = [...models].sort((a, b) => b.tier - a.tier);
        if (sortedModels[index]) {
          const targetModel = sortedModels[index];
          setActiveModelId(targetModel.id);
          const systemMsg: Message = {
            id: `sys-manual-${Date.now()}`,
            role: 'system',
            content: `🎯 Modele geçildi: ${targetModel.name}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, systemMsg]);
          inputRef.current?.focus();
          e.preventDefault();
        }
      }
      // Ctrl + Enter to send
      if (e.ctrlKey && e.key === 'Enter') {
        handleSend();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [models, activeModelId, input, isLoading]);

  const activeModel = models.find(m => m.id === activeModelId) || models[0];

  const ProviderStatusIndicator = ({ provider }: { provider: ProviderState }) => {
    const getStatusColor = (status: ProviderStatus) => {
      switch (status) {
        case 'active': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
        case 'slow': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
        case 'error': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
        default: return 'bg-gray-500';
      }
    };

    return (
      <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-white/5 transition-colors group">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusColor(provider.status))} />
          <span className="text-[10px] font-medium text-[#777] truncate group-hover:text-[#999] transition-colors">{provider.name}</span>
        </div>
        {provider.latency && (
          <span className="text-[9px] font-mono text-[#444] shrink-0">{provider.latency}ms</span>
        )}
      </div>
    );
  };

  const getModelTier = (modelId: string): number => {
    const id = modelId.toLowerCase();
    if (id.includes('405b') || id.includes('gpt-4o') || id.includes('claude-3-5-sonnet')) return 5;
    if (id.includes('72b') || id.includes('pro') || id.includes('llama-3.1')) return 4;
    if (id.includes('flash') || id.includes('70b') || id.includes('mini')) return 3;
    if (id.includes('8b') || id.includes('9b') || id.includes('nemo')) return 2;
    return 1;
  };

  const connectOpenRouter = async () => {
    console.log("Connect button clicked, key length:", openRouterKey.length);
    if (!openRouterKey.trim()) return;
    setIsConnecting(true);
    setConnectionStatus('idle');
    setError(null);
    try {
      console.log("Fetching models from OpenRouter...");
      const start = Date.now();
      const freeModels = await AIService.fetchOpenRouterFreeModels(openRouterKey);
      const latency = Date.now() - start;
      console.log("Models received:", freeModels.length);
      
      const newModels: AIModel[] = freeModels.map((m: any) => ({
        id: m.id,
        name: m.name || m.id.split('/')[1],
        provider: 'openrouter',
        quotaLimit: 50, // Arbitrary high limit for free tier
        quotaUsed: 0,
        isAvailable: true,
        apiKey: openRouterKey,
        status: 'idle',
        tier: getModelTier(m.id)
      }));

      // Keep existing non-openrouter models and add new ones
      setModels(prev => {
        const filtered = prev.filter(m => m.provider !== 'openrouter');
        return [...filtered, ...newModels];
      });
      
      if (newModels.length > 0) {
        setConnectionStatus('success');
        updateProviderStatus('openrouter', latency > 2000 ? 'slow' : 'active', latency);
        setActiveModelId(newModels[0].id);
        setSuccessMessage(`Başarılı! ${newModels.length} ücretsiz model havuzuna eklendi.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setConnectionStatus('error');
        setError("Hiç ücretsiz model bulunamadı. Lütfen API anahtarını kontrol edin.");
      }
    } catch (err: any) {
      setConnectionStatus('error');
      updateProviderStatus('openrouter', 'error');
      console.error("Connection error:", err);
      let msg = "OpenRouter bağlantısı başarısız: ";
      if (err.message === "Failed to fetch") {
        msg += "Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı kontrol edin.";
      } else {
        msg += err.message || "Bilinmeyen hata";
      }
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    // Auto-connect to OpenRouter if key exists on mount
    if (openRouterKey && connectionStatus === 'idle') {
      connectOpenRouter();
    }
    // Auto-connect to OpenFang if key exists on mount
    if (openFangKey) {
      connectOpenFang();
    }
  }, []);

  const connectOpenFang = async () => {
    if (!openFangKey.trim() || !openFangHost.trim()) return;
    setIsConnecting(true);
    try {
      const start = Date.now();
      
      // Try to fetch models from OpenFang (OpenAI compatible endpoint)
      try {
        const response = await fetch(`${openFangHost.replace(/\/$/, '')}/v1/models`, {
          headers: {
            'Authorization': `Bearer ${openFangKey}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            const newModels: AIModel[] = data.data.map((m: any) => ({
              id: m.id,
              name: `OpenFang: ${m.id}`,
              provider: 'openfang',
              quotaLimit: 100,
              quotaUsed: 0,
              isAvailable: true,
              apiKey: openFangKey,
              status: 'idle',
              tier: m.id.includes('gpt-4') || m.id.includes('claude-3') ? 5 : 4
            }));
            
            setModels(prev => {
              const filtered = prev.filter(m => m.provider !== 'openfang');
              return [...filtered, ...newModels];
            });
            
            const latency = Date.now() - start;
            updateProviderStatus('openfang', 'active', latency);
            setSuccessMessage("OpenFang bağlantısı başarılı! Modeller yüklendi.");
            setTimeout(() => setSuccessMessage(null), 3000);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not fetch models from OpenFang, falling back to default", e);
      }

      // Fallback to default model if fetch fails
      const latency = Date.now() - start;
      const newModel: AIModel = {
        id: 'openfang-default',
        name: 'OpenFang Default',
        provider: 'openfang',
        quotaLimit: 100,
        quotaUsed: 0,
        isAvailable: true,
        apiKey: openFangKey,
        status: 'idle',
        tier: 4
      };

      setModels(prev => {
        const filtered = prev.filter(m => m.id !== 'openfang-default');
        return [...filtered, newModel];
      });

      updateProviderStatus('openfang', 'active', latency);
      setSuccessMessage("OpenFang bağlantısı başarılı!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("OpenFang connection error:", err);
      updateProviderStatus('openfang', 'error');
      setError("OpenFang bağlantısı kurulamadı. Lütfen Host URL ve API Key'i kontrol edin.");
    } finally {
      setIsConnecting(false);
    }
  };

  const findNextAvailableModel = (excludeIds: string[]) => {
    return [...modelsRef.current]
      .filter(m => 
        !excludeIds.includes(m.id) && 
        m.isAvailable && 
        m.status !== 'exhausted' && 
        m.quotaUsed < m.quotaLimit
      )
      .sort((a, b) => b.tier - a.tier)[0];
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    let finalPrompt = input;
    let attachments: { data: string, mimeType: string }[] = [];
    const currentFile = attachedFile;

    setIsLoading(true);
    setError(null);
    setLastFailedRequest(null);
    setRoutingStatus('stable');

    const currentHistory = [...messages];

    try {
      if (currentFile) {
        if (currentFile.type.startsWith('image/')) {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(currentFile);
          });
          const base64 = await base64Promise;
          attachments.push({ data: base64, mimeType: currentFile.type });
        } else if (currentFile.type === 'application/pdf') {
          const pdfText = await AIService.extractTextFromPdf(currentFile);
          finalPrompt = `[Döküman İçeriği (${currentFile.name})]:\n${pdfText}\n\n[Kullanıcı Sorusu]:\n${input}`;
        } else if (currentFile.type.startsWith('text/') || currentFile.name.endsWith('.md') || currentFile.name.endsWith('.json')) {
          const text = await currentFile.text();
          finalPrompt = `[Dosya İçeriği (${currentFile.name})]:\n${text}\n\n[Kullanıcı Sorusu]:\n${input}`;
        }
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: currentFile ? `[Dosya: ${currentFile.name}]\n\n${input}` : input,
        modelId: activeModelId,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setAttachedFile(null);

      let targetModelId = activeModelId;
      
      // Proactive Routing: If smart routing is on, try to pick the best model for the task
      // Only run proactive routing for the FIRST message of a session to maintain context stability
      if (isSmartRouting && currentHistory.length === 0) {
        const decision = await SmartRouter.route(finalPrompt, modelsRef.current);
        if (decision && decision.modelId !== activeModelId) {
          const suggestedModel = modelsRef.current.find(m => m.id === decision.modelId);
          if (suggestedModel) {
            setRoutingStatus('routing');
            const routeMsg: Message = {
              id: `route-${Date.now()}`,
              role: 'system',
              content: `🎯 **${decision.category}** tespiti yapıldı. ${decision.reason} En uygun model olan **${suggestedModel.name}** seçiliyor...`,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, routeMsg]);
            setActiveModelId(decision.modelId);
            targetModelId = decision.modelId;
          }
        }
      }

      await attemptAIRequest(finalPrompt, targetModelId, currentHistory, attachments, abortControllerRef.current?.signal);
    } catch (err: any) {
      if (err.message === 'ABORTED') {
        setIsLoading(false);
        return;
      }

      setLastFailedRequest({
        prompt: finalPrompt,
        modelId: activeModelId,
        history: currentHistory,
        attachments
      });

      if (isSmartRouting) {
        setRoutingStatus('routing');
        let currentFailedModelId = activeModelId;
        let exhaustedIds = [activeModelId];
        let lastError = err;

        // Try to find and use next models until success or exhaustion
        while (true) {
          setModels(prev => prev.map(m => m.id === currentFailedModelId ? { ...m, status: 'exhausted' } : m));
          const currentModel = modelsRef.current.find(m => m.id === currentFailedModelId);
          const nextModel = findNextAvailableModel(exhaustedIds);

          if (!nextModel) {
            setRoutingStatus('exhausted');
            setError("Kullanılabilir başka model bulunamadı veya tüm modellerin kotası doldu.");
            break;
          }

          exhaustedIds.push(nextModel.id);
          let reason = "bağlantı hatası verdi";
          if (lastError.message === 'QUOTA_EXCEEDED') reason = "kotası doldu";
          else if (lastError.message === 'TIMEOUT') reason = "zaman aşımına uğradı";

          const systemMsg: Message = {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: `🔄 ${currentModel?.name || 'Model'} ${reason}. Otomatik olarak ${nextModel.name} modeline geçiliyor...`,
            timestamp: Date.now(),
          };
          
          setMessages(prev => [...prev, systemMsg]);
          setActiveModelId(nextModel.id);
          
          try {
            // We need to pass the actual model object or data because models state is stale here
            await attemptAIRequest(finalPrompt, nextModel.id, currentHistory, attachments, abortControllerRef.current?.signal);
            setRoutingStatus('stable');
            setLastFailedRequest(null);
            break;
          } catch (retryErr: any) {
            if (retryErr.message === 'ABORTED') {
              setIsLoading(false);
              return;
            }
            currentFailedModelId = nextModel.id;
            lastError = retryErr;
            setLastFailedRequest({
              prompt: finalPrompt,
              modelId: nextModel.id,
              history: currentHistory,
              attachments
            });
            // Continue loop to try next model
          }
        }
      } else {
        let errorMsg = err.message || "Bilinmeyen bir hata oluştu.";
        if (err.message === 'QUOTA_EXCEEDED') errorMsg = "Modelin kullanım kotası doldu. Lütfen başka bir model seçin veya daha sonra tekrar deneyin.";
        else if (err.message === 'TIMEOUT') errorMsg = "İstek zaman aşımına uğradı. Model şu an çok yoğun olabilir.";
        else if (err.name === 'AbortError' || err.message === 'ABORTED') errorMsg = "İstek iptal edildi.";
        
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const attemptAIRequest = async (prompt: string, modelId: string, history: Message[], attachments?: { data: string, mimeType: string }[], signal?: AbortSignal) => {
    const model = modelsRef.current.find(m => m.id === modelId)!;
    
    // Check local quota before calling API
    if (model.quotaUsed >= model.quotaLimit) {
      setError(`${model.name} modelinin yerel kullanım kotası doldu.`);
      throw new Error("QUOTA_EXCEEDED");
    }

    setModels(prev => prev.map(m => m.id === modelId ? { ...m, status: 'active' } : m));

    // Fetch memory.md to provide long-term context
    let memoryContext = "";
    try {
      const memRes = await fetch('/api/memory');
      if (memRes.ok) {
        const memData = await memRes.json();
        if (memData.content) {
          memoryContext = `\n\n[UZUN SÜRELİ HAFIZA (memory.md)]:\n${memData.content.slice(-6000)}\n(Not: Yukarıdaki hafıza geçmiş tüm sohbetleri içerir. Kullanıcının tercihlerini ve geçmişini buradan hatırla.)`;
        }
      }
    } catch (e) {
      console.warn("Memory context could not be loaded", e);
    }

    const finalSystemPrompt = `${systemPrompt}${memoryContext}`;

    const startTime = Date.now();
    let responseText = "";
    try {
      if (model.provider === 'gemini') {
        responseText = await AIService.callGemini(prompt, history, finalSystemPrompt, attachments, signal);
      } else if (model.provider === 'openrouter' && model.apiKey) {
        responseText = await AIService.callOpenRouter(prompt, model.apiKey, model.id, routerHost, history, finalSystemPrompt, signal);
      } else if (model.provider === 'openfang' && model.apiKey) {
        const orKey = passOpenRouterKeyToOpenFang ? openRouterKey : undefined;
        responseText = await AIService.callOpenFang(prompt, model.apiKey, model.id, openFangHost, orKey, history, finalSystemPrompt, signal);
      } else if (model.provider === 'openai' && model.apiKey) {
        responseText = await AIService.callOpenAI(prompt, model.apiKey, history, finalSystemPrompt, signal);
      } else if (model.provider === 'anthropic' && model.apiKey) {
        responseText = await AIService.callAnthropic(prompt, model.apiKey, history, finalSystemPrompt, signal);
      } else if (model.provider === 'deepseek' && model.apiKey) {
        responseText = await AIService.callDeepSeek(prompt, model.apiKey, history, finalSystemPrompt, signal);
      } else if (model.provider === 'groq' && model.apiKey) {
        responseText = await AIService.callGroq(prompt, model.apiKey, history, finalSystemPrompt, signal);
      } else if (model.provider === 'mistral' && model.apiKey) {
        responseText = await AIService.callMistral(prompt, model.apiKey, history, finalSystemPrompt, signal);
      } else {
        throw new Error("API anahtarı eksik.");
      }

      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const latencyMs = endTime - startTime;
      
      updateProviderStatus(model.provider, latencyMs > 5000 ? 'slow' : 'active', latencyMs);

      const estimatedTokens = responseText.length / 4; // Rough heuristic
      const speed = durationSeconds > 0 ? Math.round(estimatedTokens / durationSeconds) : 0;
      
      setTokenSpeed(speed);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        modelId: modelId,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, quotaUsed: m.quotaUsed + 1, status: 'idle' } : m
      ));
    } catch (error) {
      updateProviderStatus(model.provider, 'error');
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, status: error instanceof Error && error.message === 'QUOTA_EXCEEDED' ? 'exhausted' : 'error' } : m));
      throw error;
    }
  };

  const handleRetry = async () => {
    if (!lastFailedRequest || isLoading) return;
    
    const { prompt, modelId, history, attachments } = lastFailedRequest;
    
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setLastFailedRequest(null);
    setRoutingStatus('stable');

    try {
      await attemptAIRequest(prompt, modelId, history, attachments, abortControllerRef.current?.signal);
    } catch (err: any) {
      if (err.message === 'ABORTED') {
        setIsLoading(false);
        return;
      }

      setLastFailedRequest({ prompt, modelId, history, attachments });

      if (isSmartRouting) {
        setRoutingStatus('routing');
        let currentFailedModelId = modelId;
        let exhaustedIds = [modelId];
        let lastError = err;

        while (true) {
          setModels(prev => prev.map(m => m.id === currentFailedModelId ? { ...m, status: 'exhausted' } : m));
          const currentModel = modelsRef.current.find(m => m.id === currentFailedModelId);
          const nextModel = findNextAvailableModel(exhaustedIds);

          if (!nextModel) {
            setRoutingStatus('exhausted');
            setError("Kullanılabilir başka model bulunamadı veya tüm modellerin kotası doldu.");
            break;
          }

          exhaustedIds.push(nextModel.id);
          let reason = "bağlantı hatası verdi";
          if (lastError.message === 'QUOTA_EXCEEDED') reason = "kotası doldu";
          else if (lastError.message === 'TIMEOUT') reason = "zaman aşımına uğradı";

          const systemMsg: Message = {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: `🔄 ${currentModel?.name || 'Model'} ${reason}. Otomatik olarak ${nextModel.name} modeline geçiliyor...`,
            timestamp: Date.now(),
          };
          
          setMessages(prev => [...prev, systemMsg]);
          setActiveModelId(nextModel.id);
          
          try {
            await attemptAIRequest(prompt, nextModel.id, history, attachments, abortControllerRef.current?.signal);
            setRoutingStatus('stable');
            setLastFailedRequest(null);
            break;
          } catch (retryErr: any) {
            if (retryErr.message === 'ABORTED') {
              setIsLoading(false);
              return;
            }
            currentFailedModelId = nextModel.id;
            lastError = retryErr;
            setLastFailedRequest({ prompt, modelId: nextModel.id, history, attachments });
          }
        }
      } else {
        let errorMsg = err.message || "Bilinmeyen bir hata oluştu.";
        if (err.message === 'QUOTA_EXCEEDED') errorMsg = "Modelin kullanım kotası doldu. Lütfen başka bir model seçin veya daha sonra tekrar deneyin.";
        else if (err.message === 'TIMEOUT') errorMsg = "İstek zaman aşımına uğradı. Model şu an çok yoğun olabilir.";
        else if (err.name === 'AbortError' || err.message === 'ABORTED') errorMsg = "İstek iptal edildi.";

        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setRoutingStatus('stable');
  };

  const updateApiKey = (id: string, key: string) => {
    setModels(prev => prev.map(m => {
      if (m.id === id) {
        const isAvailable = !!key || 
          (m.provider === 'gemini' && serverConfig.hasGeminiKey) ||
          (m.provider === 'openrouter' && serverConfig.hasOpenRouterKey) ||
          (m.provider === 'openfang' && serverConfig.hasOpenFangKey);
        return { ...m, apiKey: key, isAvailable, status: 'idle' };
      }
      return m;
    }));
  };

  return (
    <div className={cn(
      "flex h-screen font-sans selection:bg-blue-500/30 transition-colors duration-300",
      theme === 'dark' ? "bg-[#0B0B0B] text-[#E0E0E0]" : "bg-[#F5F5F7] text-gray-900"
    )}>
      {/* Sidebar - Model Management */}
      <aside className={cn(
        "w-[300px] border-r flex flex-col transition-colors duration-300",
        theme === 'dark' ? "bg-[#0F0F0F] border-[#1E1E1E]" : "bg-white border-gray-200"
      )}>
        <div className={cn(
          "p-4 border-b flex items-center justify-between",
          theme === 'dark' ? "border-[#1E1E1E]" : "border-gray-100"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Zap size={14} className="text-white fill-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">Free Router</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleNewChat}
              className={cn(
                "p-1.5 rounded-md transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                theme === 'dark' ? "hover:bg-[#2A2A2A] text-[#888] hover:text-blue-400" : "hover:bg-gray-100 text-gray-500 hover:text-blue-600"
              )}
              title="Yeni Sohbet"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Yeni Sohbet</span>
            </button>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'dark' ? "hover:bg-[#2A2A2A] text-[#888]" : "hover:bg-gray-100 text-gray-500"
              )}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button 
              onClick={() => setShowSettings(true)} 
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'dark' ? "hover:bg-[#2A2A2A] text-[#888]" : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-6">
            {/* Provider Status */}
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[11px] font-bold text-[#555] uppercase tracking-wider">Provider Status</h3>
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    Object.values(providerStatuses).some(p => p.status === 'active') ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-gray-500"
                  )} />
                  <span className="text-[10px] font-medium text-[#777]">
                    System Online
                  </span>
                </div>
              </div>
              
              <div className={cn(
                "border rounded-lg p-2 space-y-1",
                theme === 'dark' ? "bg-[#161616] border-[#222]" : "bg-gray-50 border-gray-200"
              )}>
                {Object.values(providerStatuses)
                  .filter(p => {
                    // Only show providers that have been checked or are primary
                    return p.status !== 'unknown' || p.id === 'gemini' || p.id === 'openrouter';
                  })
                  .map(provider => (
                    <ProviderStatusIndicator key={provider.id} provider={provider} />
                  ))}
              </div>

              <div className="mt-3 px-1">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className={theme === 'dark' ? "text-[#666]" : "text-gray-500"}>Router API (OpenRouter/Free Router)</span>
                  <button 
                    onClick={connectOpenRouter}
                    className="text-blue-500 hover:text-blue-400 font-medium"
                  >
                    {isConnecting ? "Connecting..." : (connectionStatus === 'success' ? "Refresh" : "Connect")}
                  </button>
                </div>
                <div className="space-y-2">
                  <input 
                    type="text"
                    placeholder="Host URL (e.g. https://api.freerouter.ai/v1)"
                    value={routerHost}
                    onChange={(e) => setRouterHost(e.target.value)}
                    className={cn(
                      "w-full border rounded p-2 text-[10px] focus:outline-none focus:border-blue-500/50 transition-colors",
                      theme === 'dark' ? "bg-[#0B0B0B] border-[#2A2A2A] text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <input 
                    type="password"
                    placeholder="Enter API Key..."
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    className={cn(
                      "w-full border rounded p-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors",
                      theme === 'dark' ? "bg-[#0B0B0B] border-[#2A2A2A] text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
              </div>

              <div className="mt-3 px-1">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className={theme === 'dark' ? "text-[#666]" : "text-gray-500"}>OpenFang API</span>
                  <button 
                    onClick={connectOpenFang}
                    className="text-blue-500 hover:text-blue-400 font-medium"
                  >
                    {isConnecting ? "Connecting..." : "Connect"}
                  </button>
                </div>
                <div className="space-y-2">
                  <input 
                    type="text"
                    placeholder="Host URL (e.g. http://localhost:8080)"
                    value={openFangHost}
                    onChange={(e) => setOpenFangHost(e.target.value)}
                    className={cn(
                      "w-full border rounded p-2 text-[10px] focus:outline-none focus:border-blue-500/50 transition-colors",
                      theme === 'dark' ? "bg-[#0B0B0B] border-[#2A2A2A] text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <input 
                    type="password"
                    placeholder="Enter OpenFang Key..."
                    value={openFangKey}
                    onChange={(e) => setOpenFangKey(e.target.value)}
                    className={cn(
                      "w-full border rounded p-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors",
                      theme === 'dark' ? "bg-[#0B0B0B] border-[#2A2A2A] text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 px-1">
                  <input 
                    type="checkbox"
                    id="passOpenRouter"
                    checked={passOpenRouterKeyToOpenFang}
                    onChange={(e) => setPassOpenRouterKeyToOpenFang(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="passOpenRouter" className={cn(
                    "text-[10px] cursor-pointer select-none",
                    theme === 'dark' ? "text-[#888]" : "text-gray-500"
                  )}>
                    OpenRouter Anahtarını Aktar
                  </label>
                </div>
              </div>
            </section>

            {/* Chat History */}
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[11px] font-bold text-[#555] uppercase tracking-wider">Sohbet Geçmişi</h3>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      if (window.confirm("Tüm sohbet geçmişi silinecek. Emin misiniz?")) {
                        setSessions([createNewSession(activeModelId)]);
                        setActiveSessionId(sessions[0].id);
                      }
                    }}
                    className={cn(
                      "p-1 rounded-md transition-colors",
                      theme === 'dark' ? "hover:bg-[#1E1E1E] text-[#444] hover:text-red-400" : "hover:bg-gray-100 text-gray-400 hover:text-red-500"
                    )}
                    title="Tümünü Temizle"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button 
                    onClick={handleNewChat}
                    className={cn(
                      "p-1 rounded-md transition-colors",
                      theme === 'dark' ? "hover:bg-[#1E1E1E] text-[#666] hover:text-blue-400" : "hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                    )}
                    title="Yeni Sohbet"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-3 px-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]">
                  <Search size={12} />
                </div>
                <input 
                  type="text"
                  placeholder="Sohbetlerde ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full pl-8 pr-2 py-1.5 text-[10px] rounded-md border focus:outline-none transition-all",
                    theme === 'dark' 
                      ? "bg-[#0B0B0B] border-[#222] text-[#999] focus:border-blue-500/30" 
                      : "bg-white border-gray-200 text-gray-600 focus:border-blue-500/30"
                  )}
                />
              </div>

              <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                {sessions
                  .filter(session => {
                    const query = searchQuery.toLowerCase();
                    const titleMatch = session.title.toLowerCase().includes(query);
                    const contentMatch = session.messages.some(m => m.content.toLowerCase().includes(query));
                    return titleMatch || contentMatch;
                  })
                  .map(session => (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={cn(
                      "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border",
                      activeSessionId === session.id
                        ? (theme === 'dark' ? "bg-[#1E1E1E] border-[#333] text-white" : "bg-white border-gray-200 text-blue-600 shadow-sm")
                        : (theme === 'dark' ? "bg-transparent border-transparent text-[#666] hover:bg-[#161616] hover:text-[#999]" : "bg-transparent border-transparent text-gray-500 hover:bg-gray-50")
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare size={12} className="shrink-0" />
                      <span className="text-[10px] truncate font-medium">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChat(session.id, e)}
                      className={cn(
                        "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                        theme === 'dark' ? "hover:bg-[#252525] text-[#444]" : "hover:bg-gray-200 text-gray-400"
                      )}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Model List */}
            <section>
              <h3 className="text-[11px] font-bold text-[#555] uppercase tracking-wider mb-3 px-1">Loaded Models</h3>
              <div className="space-y-1">
                {[...models].sort((a, b) => b.tier - a.tier).map((model, idx) => (
                  <button
                    key={model.id}
                    onClick={() => setActiveModelId(model.id)}
                    className={cn(
                      "w-full flex flex-col p-3 rounded-lg transition-all border text-left group",
                      activeModelId === model.id 
                        ? (theme === 'dark' ? "bg-[#1E1E1E] border-[#333] shadow-lg" : "bg-white border-gray-300 shadow-md") 
                        : (theme === 'dark' ? "bg-transparent border-transparent hover:bg-[#161616] hover:border-[#222]" : "bg-transparent border-transparent hover:bg-gray-100 hover:border-gray-200")
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div 
                          onClick={(e) => {
                            if (model.status === 'exhausted') {
                              e.stopPropagation();
                              setModels(prev => prev.map(m => m.id === model.id ? { ...m, quotaUsed: 0, status: 'idle' } : m));
                              setSuccessMessage(`${model.name} modelinin kotası başarıyla sıfırlandı.`);
                              setTimeout(() => setSuccessMessage(null), 3000);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-center rounded-full transition-all",
                            model.status === 'active' && "text-blue-500 animate-pulse",
                            model.status === 'idle' && "text-emerald-500",
                            model.status === 'exhausted' && "text-amber-500 hover:scale-125 hover:text-emerald-500 cursor-pointer",
                            model.status === 'error' && "text-red-500"
                          )}
                          title={model.status === 'exhausted' ? "Kotayı Sıfırla" : ""}
                        >
                          {model.status === 'active' && <Activity size={10} />}
                          {model.status === 'idle' && <CheckCircle2 size={10} />}
                          {model.status === 'exhausted' && <AlertTriangle size={10} />}
                          {model.status === 'error' && <XCircle size={10} />}
                        </div>
                        <span className={cn(
                          "text-xs font-medium truncate",
                          activeModelId === model.id 
                            ? (theme === 'dark' ? "text-white" : "text-gray-900") 
                            : (theme === 'dark' ? "text-[#999] group-hover:text-[#CCC]" : "text-gray-500 group-hover:text-gray-700")
                        )}>
                          {model.name}
                        </span>
                        <span className={cn(
                          "text-[8px] font-bold px-1 rounded-[2px]",
                          model.tier >= 4 ? "bg-purple-500/10 text-purple-500" : 
                          model.tier >= 3 ? "bg-blue-500/10 text-blue-500" : 
                          "bg-gray-500/10 text-gray-500"
                        )}>
                          T{model.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-tighter px-1 rounded-[2px]",
                          model.status === 'active' && "bg-blue-500/10 text-blue-500",
                          model.status === 'idle' && "bg-emerald-500/10 text-emerald-500",
                          model.status === 'exhausted' && "bg-amber-500/10 text-amber-500",
                          model.status === 'error' && "bg-red-500/10 text-red-500"
                        )}>
                          {model.status}
                        </span>
                        <span className={cn(
                          "text-[9px] font-mono",
                          theme === 'dark' ? "text-[#444] group-hover:text-[#666]" : "text-gray-400 group-hover:text-gray-500"
                        )}>Alt+{idx + 1}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={cn(
                        "truncate max-w-[140px] opacity-60",
                        theme === 'dark' ? "text-[#555]" : "text-gray-400"
                      )}>{model.id}</span>
                      <span className={theme === 'dark' ? "text-[#555]" : "text-gray-400"}>{Math.round((model.quotaUsed / model.quotaLimit) * 100)}%</span>
                    </div>
                    <div className={cn(
                      "mt-2 h-1 rounded-full overflow-hidden",
                      theme === 'dark' ? "bg-[#111]" : "bg-gray-200"
                    )}>
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          model.status === 'active' && "bg-blue-500",
                          model.status === 'idle' && "bg-emerald-500",
                          model.status === 'exhausted' && "bg-amber-500",
                          model.status === 'error' && "bg-red-500"
                        )}
                        style={{ width: `${(model.quotaUsed / model.quotaLimit) * 100}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Stats */}
            <section className={cn(
              "pt-4 border-t",
              theme === 'dark' ? "border-[#1E1E1E]" : "border-gray-100"
            )}>
              <div className={cn(
                "rounded-lg p-3 space-y-2",
                theme === 'dark' ? "bg-[#161616]" : "bg-gray-50"
              )}>
                <div className="flex justify-between text-[10px]">
                  <span className={theme === 'dark' ? "text-[#666]" : "text-gray-400"}>TOKEN SPEED</span>
                  <span className="text-emerald-500 font-mono">{tokenSpeed || '0.0'} t/s</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className={theme === 'dark' ? "text-[#666]" : "text-gray-400"}>CONTEXT</span>
                  <span className={cn("font-mono", theme === 'dark' ? "text-[#999]" : "text-gray-600")}>{messages.length} msgs</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className={cn(
          "p-4 border-t transition-colors duration-300 space-y-3",
          theme === 'dark' ? "border-[#1E1E1E] bg-[#0B0B0B]" : "border-gray-100 bg-gray-50"
        )}>
          <div className="flex items-center justify-between text-[11px] text-[#555]">
            <div className="flex items-center gap-2">
              <Activity size={12} />
              <span>System Health</span>
            </div>
            {(() => {
              const hasError = models.some(m => m.status === 'error');
              const allExhausted = models.length > 0 && models.every(m => m.status === 'exhausted' || m.status === 'error');
              
              if (allExhausted) return <span className="text-red-500 font-bold">CRITICAL</span>;
              if (hasError) return <span className="text-amber-500 font-bold">DEGRADED</span>;
              return <span className="text-emerald-500 font-bold">OPTIMAL</span>;
            })()}
          </div>

          <button 
            onClick={() => {
              alert("Mac'e kurmak için:\n1. Safari'de bu sayfayı açın.\n2. 'Dosya' menüsünden 'Dock'a Ekle...' seçeneğini seçin.\n\nChrome kullanıyorsanız:\n1. Adres çubuğundaki 'Yükle' simgesine tıklayın.");
            }}
            className={cn(
              "w-full py-2 rounded-lg border flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all",
              theme === 'dark' 
                ? "bg-[#161616] border-[#222] text-[#666] hover:text-blue-400 hover:border-blue-500/30" 
                : "bg-white border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 shadow-sm"
            )}
          >
            <Layout size={12} />
            <span>Mac'e Uygulama Olarak Kur</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col relative overflow-hidden transition-colors duration-300",
        theme === 'dark' ? "bg-[#0B0B0B]" : "bg-white"
      )}>
        {/* Header */}
        <header className={cn(
          "h-14 border-b flex items-center justify-between px-6 z-20 transition-colors duration-300",
          theme === 'dark' 
            ? "bg-[#0F0F0F]/95 border-[#1E1E1E] backdrop-blur supports-[backdrop-filter]:bg-[#0F0F0F]/60" 
            : "bg-white/95 border-gray-100 backdrop-blur supports-[backdrop-filter]:bg-white/60"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 border rounded-md transition-colors",
              theme === 'dark' ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-gray-50 border-gray-200"
            )}>
              {(() => {
                const activeModel = models.find(m => m.id === activeModelId);
                if (!activeModel) return <div className="w-2 h-2 bg-[#333] rounded-full" />;
                return (
                  <div className={cn(
                    "flex items-center justify-center rounded-full",
                    activeModel.status === 'active' && "text-blue-500 animate-pulse",
                    activeModel.status === 'idle' && "text-emerald-500",
                    activeModel.status === 'exhausted' && "text-amber-500",
                    activeModel.status === 'error' && "text-red-500"
                  )}>
                    {activeModel.status === 'active' && <Activity size={12} />}
                    {activeModel.status === 'idle' && <CheckCircle2 size={12} />}
                    {activeModel.status === 'exhausted' && <AlertTriangle size={12} />}
                    {activeModel.status === 'error' && <XCircle size={12} />}
                  </div>
                );
              })()}
              <span className={cn(
                "text-xs font-semibold",
                theme === 'dark' ? "text-[#CCC]" : "text-gray-700"
              )}>
                {models.find(m => m.id === activeModelId)?.name || "Select Model"}
              </span>
            </div>
            <div className={cn("h-4 w-[1px]", theme === 'dark' ? "bg-[#222]" : "bg-gray-200")} />
            <div className="flex items-center gap-2 text-[11px] text-[#666]">
              <Activity size={12} />
              <span>Routing: <span className={cn(routingStatus === 'stable' ? "text-emerald-500" : "text-amber-500")}>{routingStatus.toUpperCase()}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMessages([])}
              className={cn(
                "p-2 rounded-md transition-colors hover:text-red-400",
                theme === 'dark' ? "hover:bg-[#222] text-[#777]" : "hover:bg-gray-100 text-gray-400"
              )}
              title="Clear Chat"
            >
              <Trash2 size={16} />
            </button>
            <button 
              onClick={() => setIsSmartRouting(!isSmartRouting)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                isSmartRouting 
                  ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400" 
                  : (theme === 'dark' ? "bg-[#1A1A1A] border-[#2A2A2A] text-[#888] hover:text-[#CCC] hover:border-[#333]" : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300")
              )}
              title="Automatic Model Switching"
            >
              <Zap size={14} />
              <span>Smart Routing</span>
            </button>
            <button 
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                showSystemPrompt 
                  ? "bg-blue-600/10 border-blue-500/30 text-blue-400" 
                  : (theme === 'dark' ? "bg-[#1A1A1A] border-[#2A2A2A] text-[#888] hover:text-[#CCC] hover:border-[#333]" : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300")
              )}
            >
              <Layout size={14} />
              <span>System Prompt</span>
            </button>
            <button 
              onClick={() => setShowModelGuide(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                theme === 'dark' ? "bg-[#1A1A1A] border-[#2A2A2A] text-[#888] hover:text-[#CCC] hover:border-[#333]" : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Bot size={14} />
              <span>Model Rehberi</span>
            </button>
          </div>
        </header>

        {/* System Prompt Area */}
        <AnimatePresence>
          {showSystemPrompt && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "border-b overflow-hidden transition-colors duration-300",
                theme === 'dark' ? "border-[#1E1E1E] bg-[#0F0F0F]" : "border-gray-100 bg-gray-50"
              )}
            >
              <div className="p-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#555] uppercase tracking-wider">
                    <Command size={12} />
                    <span>System Configuration</span>
                  </div>
                  <button 
                    onClick={handleSaveSystemPrompt}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                      isSystemPromptSaved 
                        ? "bg-emerald-500 text-white" 
                        : (theme === 'dark' ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm")
                    )}
                  >
                    {isSystemPromptSaved ? <Check size={10} /> : <Copy size={10} />}
                    {isSystemPromptSaved ? "Kaydedildi" : "Kaydet"}
                  </button>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    setIsSystemPromptSaved(false);
                  }}
                  placeholder="Enter system instructions to guide the model's behavior..."
                  className={cn(
                    "w-full border rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500/40 min-h-[100px] resize-none transition-colors",
                    theme === 'dark' ? "bg-[#0B0B0B] border-[#222] text-[#AAA] placeholder:text-[#333]" : "bg-white border-gray-200 text-gray-700 placeholder:text-gray-300"
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
            {messages.length === 0 ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className={cn(
                  "w-16 h-16 border rounded-2xl flex items-center justify-center text-blue-500 mb-2 shadow-xl",
                  theme === 'dark' ? "bg-[#161616] border-[#222]" : "bg-blue-50 border-blue-100"
                )}>
                  <Bot size={32} />
                </div>
                <h2 className={cn(
                  "text-xl font-bold tracking-tight",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>Free Router'a Hoş Geldiniz</h2>
                <p className={cn(
                  "max-w-sm text-sm leading-relaxed",
                  theme === 'dark' ? "text-[#666]" : "text-gray-500"
                )}>
                  Tüm ücretsiz modelleri tek bir yerden yönetin. Akıllı yönlendirme ile kotalarınızı en verimli şekilde kullanın.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  {['Explain quantum computing', 'Write a Python script', 'Summarize a text', 'Creative writing'].map(suggestion => (
                    <button 
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className={cn(
                        "px-4 py-2 border rounded-lg text-xs transition-all text-left",
                        theme === 'dark' 
                          ? "bg-[#161616] border-[#222] text-[#888] hover:text-[#CCC] hover:border-[#333]" 
                          : "bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 shadow-sm"
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx} 
                  className={cn(
                    "flex gap-4 group",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 border shadow-sm",
                    msg.role === 'user' 
                      ? "bg-blue-600 border-blue-500 text-white" 
                      : (msg.role === 'system' 
                          ? "bg-amber-600/20 border-amber-500/30 text-amber-500" 
                          : (theme === 'dark' ? "bg-[#1A1A1A] border-[#2A2A2A] text-blue-500" : "bg-blue-50 border-blue-100 text-blue-600"))
                  )}>
                    {msg.role === 'user' ? <User size={16} /> : (msg.role === 'system' ? <Activity size={16} /> : <Bot size={16} />)}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        theme === 'dark' ? "text-[#555]" : "text-gray-400"
                      )}>
                        {msg.role === 'user' ? "You" : (msg.role === 'system' ? "System" : "Assistant")}
                      </span>
                      <span className={cn(
                        "text-[9px] font-mono",
                        theme === 'dark' ? "text-[#333]" : "text-gray-300"
                      )}>
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed relative shadow-sm",
                      msg.role === 'user' 
                        ? (theme === 'dark' ? "bg-[#1A1A1A] border border-[#2A2A2A] text-[#E0E0E0]" : "bg-blue-600 text-white border border-blue-500") 
                        : (msg.role === 'system' 
                            ? "bg-amber-500/5 border border-amber-500/10 text-amber-200/70 italic" 
                            : (theme === 'dark' ? "bg-[#0F0F0F] border border-[#1E1E1E] text-[#CCC]" : "bg-gray-50 border border-gray-100 text-gray-800"))
                    )}>
                      <div className={cn(
                        "markdown-body prose prose-sm max-w-none",
                        (msg.role === 'user' && theme === 'light') ? "prose-invert" : (theme === 'dark' ? "prose-invert" : "")
                      )}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      
                      {msg.role === 'assistant' && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              setCopyStatus(idx);
                              setTimeout(() => setCopyStatus(null), 2000);
                            }}
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              theme === 'dark' ? "hover:bg-[#222] text-[#555] hover:text-[#AAA]" : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                            )}
                          >
                            {copyStatus === idx ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {showModelGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={cn(
                  "w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl border flex flex-col",
                  theme === 'dark' ? "bg-[#0F0F0F] border-[#1E1E1E]" : "bg-white border-gray-100"
                )}
              >
                <div className="p-6 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                      <Bot size={20} />
                    </div>
                    <div>
                      <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>Model Yetenek Rehberi</h2>
                      <p className="text-xs text-[#666]">İhtiyacınıza en uygun modeli seçin</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowModelGuide(false)}
                    className={cn("p-2 rounded-full transition-colors", theme === 'dark' ? "hover:bg-[#1E1E1E] text-[#444]" : "hover:bg-gray-100 text-gray-400")}
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        name: "Gemini 2.0 Flash",
                        desc: "Google'ın en yeni ve en hızlı modeli. Multimodal (resim/video/ses) desteği ve geniş bağlam penceresi ile genel kullanım için mükemmeldir.",
                        tags: ["Hız", "Multimodal", "Geniş Bağlam"],
                        color: "text-blue-500"
                      },
                      {
                        name: "GPT-4o / 4o-mini",
                        desc: "OpenAI'ın amiral gemisi. Mantık yürütme, karmaşık talimat takibi ve dengeli performans konusunda endüstri standardıdır.",
                        tags: ["Mantık", "Dengeli", "Popüler"],
                        color: "text-emerald-500"
                      },
                      {
                        name: "Claude 3.5 Sonnet",
                        desc: "Anthropic'in en yetenekli modeli. Kod yazma, nüanslı yazım ve insansı etkileşim konusunda rakipsiz kabul edilir.",
                        tags: ["Kodlama", "Yazım", "Nüans"],
                        color: "text-orange-500"
                      },
                      {
                        name: "Llama 3.1 405B",
                        desc: "Meta'nın devasa açık kaynak modeli. En karmaşık mantık yürütme (reasoning) ve derin veri analizi görevleri için tasarlanmıştır.",
                        tags: ["Reasoning", "Analiz", "Güç"],
                        color: "text-purple-500"
                      },
                      {
                        name: "Qwen 2.5 72B",
                        desc: "Alibaba'nın teknik uzmanı. Matematik, kodlama ve yapılandırılmış veri işleme konularında dünya standartlarındadır.",
                        tags: ["Matematik", "Kod", "Teknik"],
                        color: "text-cyan-500"
                      },
                      {
                        name: "DeepSeek V3",
                        desc: "Kodlama ve teknik dökümantasyon hazırlama konusunda oldukça verimli, tutarlı ve mantıklı yanıtlar üretir.",
                        tags: ["Kodlama", "Verimlilik", "Mantık"],
                        color: "text-blue-400"
                      },
                      {
                        name: "Mistral / Mixtral",
                        desc: "Avrupa menşeli verimli modeller. Hızlı özetleme, sınıflandırma ve temel sohbet görevlerinde çok başarılıdır.",
                        tags: ["Hız", "Özetleme", "Verimlilik"],
                        color: "text-orange-400"
                      },
                      {
                        name: "Phi-3 / Gemma 2",
                        desc: "Küçük ama etkili modeller. Basit görevler, hızlı yanıtlar ve düşük gecikme süreli etkileşimler için idealdir.",
                        tags: ["Hafif", "Hızlı", "Verimli"],
                        color: "text-pink-500"
                      }
                    ].map(m => (
                      <div key={m.name} className={cn(
                        "p-4 rounded-xl border transition-all",
                        theme === 'dark' ? "bg-[#161616] border-[#222]" : "bg-gray-50 border-gray-200"
                      )}>
                        <h4 className={cn("text-sm font-bold mb-2", m.color)}>{m.name}</h4>
                        <p className={cn("text-xs leading-relaxed mb-3", theme === 'dark' ? "text-[#888]" : "text-gray-500")}>{m.desc}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.tags.map(t => (
                            <span key={t} className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded",
                              theme === 'dark' ? "bg-[#222] text-[#555]" : "bg-white text-gray-400 border border-gray-100"
                            )}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={cn("p-4 border-t text-center", theme === 'dark' ? "bg-[#0B0B0B] border-[#1E1E1E]" : "bg-gray-50 border-gray-100")}>
                  <p className="text-[10px] text-[#555]">Not: Ücretsiz modellerin kullanım limitleri (rate limits) OpenRouter tarafından belirlenir.</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-30"
            >
              <div className={cn(
                "border rounded-xl p-4 backdrop-blur-md flex items-start gap-3 shadow-2xl",
                theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
              )}>
                <div className={cn(
                  "p-1.5 rounded-lg",
                  theme === 'dark' ? "bg-emerald-500/20 text-emerald-500" : "bg-emerald-100 text-emerald-600"
                )}>
                  <ShieldCheck size={16} />
                </div>
                <div className="flex-1">
                  <h4 className={cn(
                    "text-xs font-bold uppercase tracking-wider mb-1",
                    theme === 'dark' ? "text-emerald-400" : "text-emerald-700"
                  )}>Sistem Mesajı</h4>
                  <p className={cn(
                    "text-xs leading-relaxed",
                    theme === 'dark' ? "text-emerald-200/70" : "text-emerald-600"
                  )}>{successMessage}</p>
                </div>
                <button onClick={() => setSuccessMessage(null)} className={cn(
                  "transition-colors",
                  theme === 'dark' ? "text-emerald-500/50 hover:text-emerald-500" : "text-emerald-400 hover:text-emerald-600"
                )}>
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-30"
            >
              <div className={cn(
                "border rounded-xl p-4 backdrop-blur-md flex items-start gap-3 shadow-2xl",
                theme === 'dark' ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
              )}>
                <div className={cn(
                  "p-1.5 rounded-lg",
                  theme === 'dark' ? "bg-red-500/20 text-red-500" : "bg-red-100 text-red-600"
                )}>
                  <Activity size={16} />
                </div>
                <div className="flex-1">
                  <h4 className={cn(
                    "text-xs font-bold uppercase tracking-wider mb-1",
                    theme === 'dark' ? "text-red-400" : "text-red-700"
                  )}>Hata</h4>
                  <p className={cn(
                    "text-xs leading-relaxed",
                    theme === 'dark' ? "text-red-200/70" : "text-red-600"
                  )}>{error}</p>
                  {lastFailedRequest && (
                    <button 
                      onClick={handleRetry}
                      className={cn(
                        "mt-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                        theme === 'dark' 
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      )}
                    >
                      <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                      Yeniden Dene
                    </button>
                  )}
                </div>
                <button onClick={() => setError(null)} className={cn(
                  "transition-colors",
                  theme === 'dark' ? "text-red-500/50 hover:text-red-500" : "text-red-400 hover:text-red-600"
                )}>
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className={cn(
          "p-6 border-t transition-colors duration-300",
          theme === 'dark' ? "bg-[#0F0F0F] border-[#1E1E1E]" : "bg-white border-gray-100"
        )}>
          <div className="max-w-4xl mx-auto">
            {attachedFile && (
              <div className={cn(
                "mb-3 flex items-center gap-2 p-2 rounded-lg w-fit border shadow-sm",
                theme === 'dark' ? "bg-blue-500/5 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
              )}>
                <Paperclip size={14} className="text-blue-500" />
                <span className="text-xs font-medium truncate max-w-[200px]">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="p-1 hover:bg-blue-500/10 rounded transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}
            
            <div className={cn(
              "relative flex items-end gap-3 border rounded-2xl p-2 transition-all shadow-xl",
              theme === 'dark' 
                ? "bg-[#161616] border-[#2A2A2A] focus-within:border-blue-500/50" 
                : "bg-gray-50 border-gray-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/5"
            )}>
              <div className="flex flex-col gap-1 pb-1 pl-1 items-center">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    theme === 'dark' ? "text-[#666] hover:text-blue-500 hover:bg-[#222]" : "text-gray-400 hover:text-blue-600 hover:bg-gray-200"
                  )}
                  title="Attach File"
                >
                  <Paperclip size={20} />
                </button>
                <div className={cn(
                  "flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter opacity-30",
                  theme === 'dark' ? "text-[#555]" : "text-gray-400"
                )} title="memory.md aktif">
                  <Database size={8} />
                  <span className="hidden sm:inline">MEM</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
                />
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your message... (Shift+Enter for new line)"
                className={cn(
                  "flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-1 resize-none min-h-[44px] max-h-48 custom-scrollbar",
                  theme === 'dark' ? "text-[#E0E0E0] placeholder:text-[#444]" : "text-gray-900 placeholder:text-gray-400"
                )}
                rows={1}
              />

              <div className="flex items-center gap-2 pb-1 pr-1">
                <button 
                  onClick={() => setIsRecording(!isRecording)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    isRecording 
                      ? "bg-red-500 text-white animate-pulse" 
                      : (theme === 'dark' ? "hover:bg-[#222] text-[#666] hover:text-emerald-500" : "hover:bg-gray-200 text-gray-400 hover:text-emerald-600")
                  )}
                  title="Voice Input"
                >
                  <Mic size={20} />
                </button>
                
                <button
                  onClick={isLoading ? handleStop : handleSend}
                  disabled={!isLoading && (!input.trim() && !attachedFile)}
                  className={cn(
                    "p-2.5 rounded-xl transition-all flex items-center justify-center",
                    !isLoading && (!input.trim() && !attachedFile)
                      ? (theme === 'dark' ? "bg-[#222] text-[#444]" : "bg-gray-200 text-gray-400")
                      : isLoading 
                        ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                        : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                  )}
                  title={isLoading ? "Durdur" : "Gönder"}
                >
                  {isLoading ? <Square size={18} fill="currentColor" /> : <Send size={18} />}
                </button>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between px-2">
              <div className={cn(
                "flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest",
                theme === 'dark' ? "text-[#444]" : "text-gray-400"
              )}>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span>{models.find(m => m.id === activeModelId)?.provider || "N/A"}</span>
                </div>
                <span>Context: {messages.length} / 50</span>
              </div>
              <p className={cn(
                "text-[10px] font-mono uppercase tracking-widest",
                theme === 'dark' ? "text-[#444]" : "text-gray-400"
              )}>
                Press <kbd className={cn(
                  "px-1 rounded border",
                  theme === 'dark' ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-gray-100 border-gray-200"
                )}>Enter</kbd> to send
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowSettings(false)} 
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-2xl bg-[#0F0F0F] border border-[#1E1E1E] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#1E1E1E] flex items-center justify-between bg-[#161616]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Model Configuration</h3>
                    <p className="text-xs text-[#666]">Manage API keys and model availability</p>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-[#222] rounded-full transition-colors text-[#555] hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {models.map(model => (
                  <div key={model.id} className="space-y-3 p-4 border border-[#1E1E1E] rounded-xl bg-[#0B0B0B] hover:border-[#2A2A2A] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#888] uppercase tracking-wider">{model.provider}</span>
                        <span className="text-sm font-medium text-[#CCC]">{model.name}</span>
                      </div>
                      <button 
                        onClick={() => setModels(prev => prev.map(m => m.id === model.id ? { ...m, quotaUsed: 0, status: 'idle' } : m))} 
                        className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
                      >
                        Reset Quota
                      </button>
                    </div>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder={
                            model.provider === 'gemini' 
                              ? (serverConfig.hasGeminiKey ? "Sistem Tarafından Yapılandırıldı" : "Gemini Anahtarı Eksik") 
                              : (model.provider === 'openrouter' && serverConfig.hasOpenRouterKey)
                                ? "Sistem Tarafından Yapılandırıldı (Opsiyonel)"
                                : (model.provider === 'openfang' && serverConfig.hasOpenFangKey)
                                  ? "Sistem Tarafından Yapılandırıldı (Opsiyonel)"
                                  : `Enter ${model.name} API Key`
                          }
                          disabled={model.provider === 'gemini'}
                          value={model.apiKey || ''}
                          onChange={(e) => updateApiKey(model.id, e.target.value)}
                          className={cn(
                            "w-full bg-[#161616] border border-[#222] rounded-lg p-3 text-sm text-[#E0E0E0] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-30 placeholder:text-[#333]",
                            model.provider === 'gemini' && !serverConfig.hasGeminiKey && "border-red-500/30"
                          )}
                        />
                        {(model.provider === 'gemini' || (model.provider === 'openrouter' && serverConfig.hasOpenRouterKey) || (model.provider === 'openfang' && serverConfig.hasOpenFangKey)) && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {(model.provider === 'gemini' ? serverConfig.hasGeminiKey : (model.provider === 'openrouter' ? serverConfig.hasOpenRouterKey : serverConfig.hasOpenFangKey)) ? (
                              <>
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Aktif</span>
                                <ShieldCheck size={16} className="text-emerald-500/50" />
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Eksik</span>
                                <AlertCircle size={16} className="text-red-500/50" />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                  </div>
                ))}
              </div>
              
              <div className="p-6 bg-[#161616] border-t border-[#1E1E1E] flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
