# Free AI Router Hub

A sophisticated, full-stack AI model aggregation platform that provides intelligent routing, memory persistence, and real-time access to various AI providers, with a special focus on free-tier models.

![App Screenshot](https://picsum.photos/seed/ai-hub/1200/600)

## 🚀 Features

- **Multi-Provider Integration**: Support for Gemini, OpenAI, Anthropic, DeepSeek, Groq, Mistral, and OpenRouter.
- **Backend Intelligent Routing**: A server-side decision engine that analyzes prompts to select the most suitable model based on task category (Coding, Logic, Creative, Fast).
- **Dynamic Model Sync**: Automatically synchronizes and discovers new free-tier models from OpenRouter every 24 hours.
- **Memory Palace**: Persistent memory system that allows models to maintain context across sessions, with both model-specific and global memory stores.
- **Advanced UI/UX**:
  - Polished Dark/Light mode support.
  - Real-time token speed monitoring.
  - File attachment support.
  - Voice recording interface.
  - Responsive sidebar for session and model management.
- **Quota Management**: Built-in tracking for model usage and limits.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js, Express.
- **AI Integration**: Google Generative AI SDK, OpenRouter API, and direct provider proxies.

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/free-ai-router.git
   cd free-ai-router
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_key
   OPENROUTER_API_KEY=your_openrouter_key
   # Optional:
   OPENAI_API_KEY=...
   ANTHROPIC_API_KEY=...
   DEEPSEEK_API_KEY=...
   GROQ_API_KEY=...
   MISTRAL_API_KEY=...
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🤖 Backend Routing Logic

The system categorizes incoming prompts into four main areas:
- **Coding**: Technical tasks, debugging, and script generation.
- **Logic**: Mathematical problems, complex analysis, and strategic planning.
- **Creative**: Storytelling, content creation, and creative writing.
- **Fast**: Quick summaries, translations, and general queries.

It then selects the highest-tier available model assigned to that specific category.

## 🧠 Memory System

The application uses a file-based memory system stored in the `/memories` directory. 
- `memory.md`: Global context shared across all models.
- `memory_{modelId}.md`: Specific context for individual models to maintain their unique "personality" or specialized knowledge.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the AI community.
