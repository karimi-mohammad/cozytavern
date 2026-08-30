# 🏰 CozyTavern

A lightweight, modern AI chat frontend designed for **D&D sessions**, **tabletop RPGs**, and **interactive storytelling**. Built with React + Express + SQLite.

![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

---

## ✨ Features

### 🎭 Character Management
- Create and edit AI characters with **Character Card V3** format
- Upload character avatars
- Organize characters with tags and search
- Support for first messages, example dialogues, and personality traits

### 🎲 D&D & Tabletop Ready
- **Lorebook (World Info)** — Maintain world lore, NPCs, locations, and items
- **Persona System** — Play as your character with custom name and description
- **Context Management** — Keep important world details in scope with smart injection
- **Macro Support** — Use `{{char}}` and `{{user}}` in character definitions

### 💬 Advanced Chat Features
- **Live Streaming** — Watch AI responses appear in real-time
- **Message Editing** — Edit any message (user or AI)
- **Regenerate** — Get alternative responses from AI
- **Swipe** — Navigate between response versions
- **Branch** — Fork conversations at any point

### 🎨 Modern UI
- **3 Themes** — Dark, Darker, and Light modes
- **Responsive Design** — Works great on desktop and mobile
- **Skeleton Loading** — Smooth loading states
- **Toast Notifications** — Non-intrusive feedback

### 🔌 Wide API Compatibility
- **OpenAI** — GPT-4, GPT-4o, etc.
- **Anthropic** — Claude 3.5 Sonnet, Claude 3 Opus
- **Ollama** — Local models (Llama 3, Mistral, etc.)
- **OpenRouter** — Access multiple providers
- **Any OpenAI-compatible API** — DeepSeek, Groq, Together AI, and more

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or higher
- An API key from any supported provider

### One-Click Start

**Windows:**
```bash
# Double-click start.bat
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

### Manual Setup

```bash
# 1. Clone the repository
git clone https://github.com/karimi-mohammad/cozytavern.git
cd CozyTavern

# 2. Install all dependencies
npm run install:all

# 3. Start development server
npm run dev
```

Open your browser to **http://localhost:5173**

---

## 📖 Usage

### 1. Configure Your API

1. Click the **⚙️ Settings** icon in the sidebar
2. Enter your API settings:
   - **Endpoint**: Your API provider URL
   - **API Key**: Your secret key
   - **Model**: Choose your model (e.g., `gpt-4`, `claude-3-opus`, `llama3`)

### 2. Create a Character

1. Click **🎭 Characters** in the sidebar
2. Click **+ New Character**
3. Fill in the details:
   - **Name**: Character's name
   - **Description**: Who they are
   - **Personality**: Key traits
   - **First Message**: How they greet you
   - **System Prompt**: Special instructions (optional)

### 3. Start Chatting

1. Select your character from the sidebar
2. Click **New Chat**
3. Start your adventure!

### 4. Use Lorebooks (World Info)

Lorebooks let you maintain world knowledge that AI can reference:

1. Go to **📚 Lorebooks** in the sidebar
2. Create entries for:
   - Important locations
   - Key NPCs
   - World rules
   - Item descriptions
3. Activate lorebooks in your chat settings

---

## 🛠️ Development

### Project Structure

```
CozyTavern/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── store/          # State management (Zustand)
│   │   ├── api/            # API client
│   │   └── utils/          # Helper functions
│   └── dist/               # Built frontend
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── utils/          # Utilities
│   │   └── db.ts           # SQLite database
│   └── dist/               # Built server
├── start.bat               # Windows launcher
└── start.sh                # Linux/macOS launcher
```

### Available Scripts

```bash
npm run dev              # Start both server and client
npm run dev:server       # Start only server (port 3002)
npm run dev:client       # Start only client (port 5173)
npm run build            # Build client for production
npm start                # Start production server
npm run install:all      # Install all dependencies
```

### Running Tests

```bash
cd server
npm test                 # Run all tests
npm run test:watch       # Run in watch mode
```

---

## 🎲 D&D Session Tips

### Character Setup Example

```json
{
  "name": "Dungeon Master",
  "description": "A masterful storyteller who guides adventurers through epic quests",
  "personality": "Creative, descriptive, fair but challenging",
  "first_mes": "Welcome, adventurer! The torchlight flickers as you descend into the ancient dungeon. What do you do?",
  "system_prompt": "You are a D&D 5e dungeon master. Describe environments vividly. Track HP and status effects. Challenge players fairly."
}
```

### World Building with Lorebooks

Create entries for your campaign setting:

- **Locations**: Cities, dungeons, landmarks
- **NPCs**: Quest givers, merchants, allies, enemies
- **Lore**: History, factions, religions
- **Items**: Magic items, quest objects

---

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite + Tailwind CSS + TypeScript |
| Backend | Express.js + TypeScript |
| State | Zustand |
| Database | SQLite (better-sqlite3) |
| Testing | Vitest + Supertest |

---

## 📝 Character Card Format

CozyTavern supports the **Character Card V3** standard:

```json
{
  "spec": "chara_card_v3",
  "spec_version": "3.0",
  "data": {
    "name": "Gandalf",
    "nickname": "Grey Pilgrim",
    "description": "A wise wizard who guides the Fellowship",
    "personality": "Wise, patient, occasionally mysterious",
    "scenario": "Middle-earth, Third Age",
    "first_mes": "I am Gandalf the Grey. I have need of your courage...",
    "mes_example": "<example dialogue>",
    "system_prompt": "Stay in character as Gandalf",
    "tags": ["fantasy", "wizard", "lord-of-the-rings"]
  }
}
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

Inspired by [SillyTavern](https://github.com/SillyTavern/SillyTavern) — a fantastic tool for AI character interactions.

---

## 🎮 Made with ❤️

This project was built as a fun side project using **vibe coding** — where creativity meets code. Enjoy your D&D sessions! 🎲
