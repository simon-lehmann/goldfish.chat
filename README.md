# 🐠 goldfish.chat

> *"A goldfish has a 3-second memory. Your chat history has 3 conversations."*

A privacy-first AI chat application where conversations are ephemeral — only the last 3 chats are retained per user.

## 🎯 Vision

In a world where every conversation is logged, analyzed, and stored forever, **goldfish.chat** takes a different approach. We believe your AI conversations should be:

- **Private** — No tracking, no analytics, no permanent storage
- **Ephemeral** — Only your 3 most recent conversations exist
- **Simple** — One interface to chat with any AI model
- **Transparent** — You always know exactly what data exists about you

## ✨ Features

- 🤖 **Multi-Model Support** — Chat with GPT-4, Claude, Llama, Mistral, and more
- 🔒 **Privacy by Design** — Only 3 conversations stored, oldest auto-deleted
- 🔐 **Enterprise Ready** — SSO/SAML via WorkOS AuthKit for B2B clients
- 🌊 **Streaming Responses** — Real-time AI responses as they're generated
- 🎨 **Clean UI** — Minimal, distraction-free chat interface
- 🌙 **Dark Mode** — Easy on the eyes, day or night
- 📱 **Mobile Friendly** — Works great on any device
- 🗑️ **One-Click Clear** — Instantly delete all your data

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     AstroJS + Cloudflare Pages                       │    │
│  │   • Static site with islands of interactivity                       │    │
│  │   • Chat UI, model selector, theme toggle                           │    │
│  │   • WorkOS AuthKit integration (SSR routes)                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                          WorkOS Session Cookie / JWT
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │  Cloudflare Worker   │─▶│  Durable Objects │  │  Cloudflare AI        │  │
│  │  (API Routes)        │  │  (User Storage)  │  │  Gateway              │  │
│  │  + Session verify    │  │  keyed by visitorId│ │                       │  │
│  └──────────────────────┘  └──────────────────┘  └───────────┬───────────┘  │
│                                                               │              │
│           ┌───────────────────────┐                          ▼              │
│           │      WorkOS           │              ┌───────────────────────┐  │
│           │  • AuthKit (login)    │              │  AI Providers         │  │
│           │  • SSO/SAML           │              │  OpenAI, Anthropic,   │  │
│           │  • Directory Sync     │              │  Workers AI, etc.     │  │
│           └───────────────────────┘              └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | AstroJS, Tailwind CSS, TypeScript |
| **Auth** | WorkOS AuthKit (SSO/SAML for enterprise) |
| **Backend** | Cloudflare Workers, Hono |
| **Storage** | Cloudflare Durable Objects |
| **AI** | Cloudflare AI Gateway |
| **Testing** | Playwright, MSW |
| **Hosting** | Cloudflare Pages + Workers |

## 📁 Project Structure

```
goldfish.chat/
├── src/                    # Frontend (AstroJS)
│   ├── components/         # UI components
│   ├── layouts/            # Page layouts
│   ├── pages/              # Routes
│   │   ├── auth/           # Auth callback routes
│   │   ├── sign-in.ts      # WorkOS sign-in redirect
│   │   └── sign-out.ts     # WorkOS sign-out
│   ├── middleware.ts       # Auth middleware
│   ├── scripts/            # Client-side JS
│   └── styles/             # CSS
├── worker/                 # Backend (Cloudflare Worker)
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── durable-objects/# Storage classes
│   │   └── lib/            # Utilities
│   └── wrangler.toml       # Worker config
├── tests/                  # Testing
│   ├── e2e/                # Playwright tests
│   ├── contracts/          # Contract tests
│   └── mocks/              # MSW handlers
└── docs/                   # Documentation
    ├── FRONTEND.md
    ├── BACKEND.md
    └── TESTING.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Cloudflare account (free tier works!)

### Development

```bash
# Clone the repository
git clone https://github.com/yourusername/goldfish.chat
cd goldfish.chat

# Install dependencies
npm install

# Start development servers
npm run dev          # Frontend on :4321
npm run dev:worker   # Backend on :8787

# Run tests
npm test
```

### Environment Variables

```bash
# .env.local (frontend)
PUBLIC_API_URL=http://localhost:8787
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_PASSWORD=<32+ character secret>

# .dev.vars (worker)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
```

## 🔐 Privacy Promise

1. **Secure authentication** — Enterprise SSO/SAML via WorkOS, no password storage
2. **3 conversations max** — Oldest conversation auto-deleted when you start a 4th
3. **No analytics** — Zero tracking, zero telemetry
4. **No logs** — Chat content is never logged server-side
5. **Your data, your control** — One click to delete everything
6. **Open source** — Verify our privacy claims yourself

## 🗺️ Roadmap

- [x] Project planning
- [ ] **v1.0 MVP**
  - [ ] Basic chat UI
  - [ ] 3 AI models (GPT-4, Claude, Llama)
  - [ ] 3-chat limit with auto-rotation
  - [ ] Dark/light theme
- [ ] **v1.1**
  - [ ] Markdown rendering
  - [ ] Code syntax highlighting
  - [ ] Export chat as text
- [ ] **v2.0**
  - [ ] Image generation models
  - [ ] Voice input
  - [ ] Keyboard shortcuts

## 📖 Documentation

- [Frontend Guide](./docs/FRONTEND.md) — AstroJS setup, components, styling
- [Backend Guide](./docs/BACKEND.md) — Worker, Durable Objects, AI Gateway
- [Testing Guide](./docs/TESTING.md) — Playwright, mocks, contract tests

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>🐠 Remember less. Chat more.</strong>
</p>
