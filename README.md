# 🚀 Free Router

Ücretsiz yapay zeka modellerini tek bir arayüzden yönetmenizi sağlayan, akıllı yönlendirme ve gelişmiş hafıza sistemine sahip tam kapsamlı bir AI platformu.

![App Screenshot](https://picsum.photos/seed/ai-hub/1200/600)

## ✨ Öne Çıkan Özellikler

- **Çoklu Sağlayıcı Desteği**: Gemini, OpenAI, Anthropic, DeepSeek, Groq, Mistral ve OpenRouter entegrasyonu.
- **🛡️ Akıllı Failover (Hata Toleransı)**: Bir model hata verdiğinde (bakiye yetersizliği, kota dolumu vb.) sistem otomatik olarak en uygun alternatif modeli bulur ve isteği kesintisiz devam ettirir.
- **🧠 Hafıza Sarayı (Memory Palace)**: Tüm modellerle olan geçmiş etkileşimlerinizi analiz eden ve ortak bir bağlam oluşturan gelişmiş JSON tabanlı hafıza sistemi.
- **⚙️ Backend Akıllı Yönlendirici**: İstekleriniz içeriğine göre (Yazılım, Mantık, Yaratıcı, Hızlı Yanıt) analiz edilir ve en başarılı modele otomatik yönlendirilir.
- **🧹 Otomatik Temizlik**: Kredisi biten veya hata veren modeller listeden her dakika otomatik olarak temizlenir, liste her zaman güncel kalır.
- **🔄 Dinamik Model Senkronizasyonu**: OpenRouter üzerindeki yeni ücretsiz modeller 24 saatte bir otomatik olarak taranır ve sisteme eklenir.

## 🛠️ Teknoloji Yığını

- **Frontend**: React 19, TypeScript, Tailwind CSS, Framer Motion.
- **Backend**: Express.js, Tsx.
- **AI**: Google Generative AI SDK (@google/genai), OpenRouter API.

## ⌨️ Klavye Kısayolları

| Kısayol | İşlev |
| :--- | :--- |
| `Alt + R` | Tüm model kotalarını sıfırla |
| `Alt + 1-9` | Modeller arasında hızlı geçiş yap |
| `Ctrl + Enter` | Mesajı gönder |

## 🚀 Başlangıç

1. **Bağımlılıkları Yükleyin**:
   ```bash
   npm install
   ```

2. **Çevre Değişkenlerini Ayarlayın**:
   `.env.example` dosyasını baz alarak bir `.env` dosyası oluşturun ve API anahtarlarınızı ekleyin:
   ```env
   GEMINI_API_KEY=...
   OPENROUTER_API_KEY=...
   ```

3. **Geliştirme Sunucusunu Başlatın**:
   ```bash
   npm run dev
   ```

## 🤖 Yönlendirme Kategorileri

Sistem, istemlerinizi şu kategorilere göre puanlar:
- **Yazılım ve Teknik**: Kodlama, hata ayıklama.
- **Mantık ve Analiz**: Karmaşık problemler, matematik.
- **Yaratıcı Yazım**: Hikaye, içerik üretimi.
- **Hızlı Yanıt**: Özetleme, kısa sorular.

## 🧠 Hafıza Yönetimi

Uygulama `/memories` dizininde dosya tabanlı bir saklama alanı kullanır. Veriler `MemPalace` sınıfı üzerinden JSON formatında işlenir ve modellerin "uzun süreli hafızası" olarak sistem talimatlarına (System Prompt) enjekte edilir.

---

Built with ❤️ for the AI community.
