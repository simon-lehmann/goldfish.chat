# ⚙️ Backend Documentation

> Cloudflare Workers + Durable Objects + WorkOS Auth + AI Gateway

## Overview

The goldfish.chat backend runs entirely on **Cloudflare's edge network**, using:
- **Workers** — Serverless API routes
- **Durable Objects** — Per-user persistent storage (3 chats max)
- **WorkOS** — Session verification for authenticated requests
- **AI Gateway** — Unified interface to multiple AI providers

## 📁 File Structure

```
worker/
├── src/
│   ├── index.ts                    # Worker entry point & routing
│   ├── routes/
│   │   ├── chat.ts                 # POST /api/chat
│   │   ├── history.ts              # GET /api/history
│   │   ├── conversations.ts        # GET/DELETE /api/conversations
│   │   └── models.ts               # GET /api/models
│   ├── durable-objects/
│   │   └── UserChatStorage.ts      # Durable Object class
│   ├── lib/
│   │   ├── auth.ts                 # WorkOS session verification
│   │   ├── ai-gateway.ts           # AI Gateway wrapper
│   │   ├── providers/
│   │   │   ├── openai.ts           # OpenAI adapter
│   │   │   ├── anthropic.ts        # Anthropic adapter
│   │   │   └── workers-ai.ts       # Workers AI adapter
│   │   └── streaming.ts            # SSE response helpers
│   └── types.ts                    # TypeScript interfaces
├── wrangler.toml                   # Cloudflare config
├── package.json
└── tsconfig.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Installation

```bash
cd worker
npm install

# Login to Cloudflare
wrangler login

# Start local development
npm run dev
```

The API will be available at `http://localhost:8787`

### Deploy to Production

```bash
npm run deploy
```

## 📦 Dependencies

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@workos-inc/node": "^7.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "wrangler": "^3.x",
    "@cloudflare/workers-types": "^4.x",
    "typescript": "^5.x"
  }
}
```

## 🔧 Configuration

### wrangler.toml

```toml
name = "goldfish-chat-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"

# Durable Objects binding
[durable_objects]
bindings = [
  { name = "USER_STORAGE", class_name = "UserChatStorage" }
]

# Durable Objects migrations
[[migrations]]
tag = "v1"
new_classes = ["UserChatStorage"]

# Workers AI binding
[ai]
binding = "AI"

# Environment variables (secrets added via wrangler secret)
[vars]
ENVIRONMENT = "production"

# Development overrides
[env.dev]
vars = { ENVIRONMENT = "development" }
```

### Secrets

```bash
# Add API keys as secrets (not in wrangler.toml!)
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put WORKOS_API_KEY
wrangler secret put WORKOS_CLIENT_ID
wrangler secret put WORKOS_COOKIE_PASSWORD
```

### Local Development (.dev.vars)

```bash
# .dev.vars (gitignored)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_PASSWORD=<32+ character secret>
```

## 📐 Type Definitions

```typescript
// src/types.ts

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface UserStorage {
  chats: Conversation[];  // Max 3 - FIFO rotation
  preferences: UserPreferences;
}

export interface UserPreferences {
  defaultModel: string;
  theme: 'light' | 'dark';
}

export interface Env {
  USER_STORAGE: DurableObjectNamespace;
  AI: Ai;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;
  WORKOS_COOKIE_PASSWORD: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  model: string;
}

export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'workers-ai';
  available: boolean;
}

// WorkOS user from session
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
}
```

## 🔐 WorkOS Session Verification

The backend verifies the session cookie forwarded from the frontend:

```typescript
// src/lib/auth.ts
import { WorkOS, type User } from '@workos-inc/node';
import type { Context } from 'hono';
import type { Env } from '../types';

export async function verifySession(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const cookie = c.req.header('Cookie');
  if (!cookie) return null;

  // Extract wos-session from cookie header
  const sessionMatch = cookie.match(/wos-session=([^;]+)/);
  if (!sessionMatch) return null;

  const sessionData = sessionMatch[1];

  const workos = new WorkOS(c.env.WORKOS_API_KEY, {
    clientId: c.env.WORKOS_CLIENT_ID,
  });

  try {
    const result = await workos.userManagement.authenticateWithSessionCookie({
      sessionData,
      cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
    });

    if (!result.authenticated) {
      return null;
    }

    const session = await workos.userManagement.getSessionFromCookie({
      sessionData,
      cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
    });

    return session?.user || null;
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}
```

## 🏗️ Worker Entry Point

```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chatRoute } from './routes/chat';
import { conversationsRoute } from './routes/conversations';
import { modelsRoute } from './routes/models';
import { UserChatStorage } from './durable-objects/UserChatStorage';
import { verifySession } from './lib/auth';
import type { Env, AuthUser } from './types';

type Variables = {
  user: AuthUser;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS middleware
app.use('/*', cors({
  origin: ['https://goldfish.chat', 'http://localhost:4321'],
  allowHeaders: ['Content-Type', 'Cookie'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true, // Allow cookies
}));

// Auth middleware - verify WorkOS session
app.use('/api/*', async (c, next) => {
  const user = await verifySession(c);
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  c.set('user', {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    organizationId: user.organizationId,
  });
  
  await next();
});

// Routes
app.route('/api/chat', chatRoute);
app.route('/api/conversations', conversationsRoute);
app.route('/api/models', modelsRoute);

// Health check (public)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Export worker and Durable Object
export default app;
export { UserChatStorage };
```

## 💾 Durable Objects

### UserChatStorage Class

```typescript
// src/durable-objects/UserChatStorage.ts
import type { Conversation, Message, UserStorage, UserPreferences } from '../types';

const MAX_CHATS = 3;

export class UserChatStorage {
  private state: DurableObjectState;
  private storage: UserStorage | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async getStorage(): Promise<UserStorage> {
    if (!this.storage) {
      this.storage = await this.state.storage.get<UserStorage>('data') || {
        chats: [],
        preferences: {
          defaultModel: 'gpt-4o',
          theme: 'dark',
        },
      };
    }
    return this.storage;
  }

  private async saveStorage(): Promise<void> {
    await this.state.storage.put('data', this.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // GET /chats - List all conversations
      if (method === 'GET' && url.pathname === '/chats') {
        const storage = await this.getStorage();
        return Response.json({ conversations: storage.chats });
      }

      // GET /chats/:id - Get single conversation
      if (method === 'GET' && url.pathname.startsWith('/chats/')) {
        const id = url.pathname.split('/')[2];
        const storage = await this.getStorage();
        const chat = storage.chats.find(c => c.id === id);
        if (!chat) {
          return Response.json({ error: 'Chat not found' }, { status: 404 });
        }
        return Response.json(chat);
      }

      // POST /chats - Create or update conversation
      if (method === 'POST' && url.pathname === '/chats') {
        const body = await request.json() as {
          conversationId?: string;
          message: Message;
          model: string;
        };

        const storage = await this.getStorage();
        let chat: Conversation;

        if (body.conversationId) {
          // Add message to existing conversation
          chat = storage.chats.find(c => c.id === body.conversationId)!;
          if (!chat) {
            return Response.json({ error: 'Chat not found' }, { status: 404 });
          }
          chat.messages.push(body.message);
          chat.updatedAt = Date.now();
        } else {
          // Create new conversation
          chat = {
            id: crypto.randomUUID(),
            title: body.message.content.slice(0, 50) + '...',
            model: body.model,
            messages: [body.message],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          // FIFO: Remove oldest if at max
          if (storage.chats.length >= MAX_CHATS) {
            storage.chats.sort((a, b) => a.updatedAt - b.updatedAt);
            storage.chats.shift(); // Remove oldest
          }

          storage.chats.push(chat);
        }

        await this.saveStorage();
        return Response.json(chat);
      }

      // DELETE /chats/:id - Delete conversation
      if (method === 'DELETE' && url.pathname.startsWith('/chats/')) {
        const id = url.pathname.split('/')[2];
        const storage = await this.getStorage();
        const index = storage.chats.findIndex(c => c.id === id);
        if (index === -1) {
          return Response.json({ error: 'Chat not found' }, { status: 404 });
        }
        storage.chats.splice(index, 1);
        await this.saveStorage();
        return Response.json({ success: true });
      }

      // DELETE /clear - Delete all data
      if (method === 'DELETE' && url.pathname === '/clear') {
        this.storage = {
          chats: [],
          preferences: { defaultModel: 'gpt-4o', theme: 'dark' },
        };
        await this.saveStorage();
        return Response.json({ success: true });
      }

      // GET/PUT /preferences
      if (url.pathname === '/preferences') {
        const storage = await this.getStorage();
        if (method === 'GET') {
          return Response.json(storage.preferences);
        }
        if (method === 'PUT') {
          const prefs = await request.json() as Partial<UserPreferences>;
          storage.preferences = { ...storage.preferences, ...prefs };
          await this.saveStorage();
          return Response.json(storage.preferences);
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      console.error('Durable Object error:', error);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }
}
```

## 🌐 API Routes

### Chat Route (POST /api/chat)

```typescript
// src/routes/chat.ts
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { callAI } from '../lib/ai-gateway';
import type { Env, Message, AuthUser } from '../types';

type Variables = {
  user: AuthUser;
};

const ChatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(10000),
  model: z.string(),
});

export const chatRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

chatRoute.post('/', async (c) => {
  // Validate request
  const body = await c.req.json();
  const result = ChatRequestSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error }, 400);
  }

  const { conversationId, message, model } = result.data;
  const user = c.get('user');

  // Get Durable Object for this user (keyed by WorkOS user ID)
  const id = c.env.USER_STORAGE.idFromName(`user_${user.id}`);
  const stub = c.env.USER_STORAGE.get(id);

  // Save user message
  const userMessage: Message = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
  };

  const saveResponse = await stub.fetch('http://do/chats', {
    method: 'POST',
    body: JSON.stringify({ conversationId, message: userMessage, model }),
  });
  const chat = await saveResponse.json();

  // Get conversation history for context
  const historyResponse = await stub.fetch(`http://do/chats/${chat.id}`);
  const fullChat = await historyResponse.json();

  // Stream AI response
  return streamSSE(c, async (stream) => {
    let fullResponse = '';

    await callAI({
      model,
      messages: fullChat.messages,
      env: c.env,
      onChunk: async (chunk: string) => {
        fullResponse += chunk;
        await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
      },
    });

    // Save assistant message
    const assistantMessage: Message = {
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
    };

    await stub.fetch('http://do/chats', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: chat.id,
        message: assistantMessage,
        model,
      }),
    });

    await stream.writeSSE({ data: '[DONE]' });
  });
});
```

### Conversations Route

```typescript
// src/routes/conversations.ts
import { Hono } from 'hono';
import type { Env, AuthUser } from '../types';

type Variables = {
  user: AuthUser;
};

export const conversationsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// List all conversations
conversationsRoute.get('/', async (c) => {
  const user = c.get('user');
  const id = c.env.USER_STORAGE.idFromName(`user_${user.id}`);
  const stub = c.env.USER_STORAGE.get(id);

  const response = await stub.fetch('http://do/chats');
  return c.json(await response.json());
});

// Get single conversation
conversationsRoute.get('/:id', async (c) => {
  const user = c.get('user');
  const chatId = c.req.param('id');
  const id = c.env.USER_STORAGE.idFromName(`user_${user.id}`);
  const stub = c.env.USER_STORAGE.get(id);

  const response = await stub.fetch(`http://do/chats/${chatId}`);
  if (!response.ok) {
    return c.json({ error: 'Chat not found' }, 404);
  }
  return c.json(await response.json());
});

// Delete conversation
conversationsRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const chatId = c.req.param('id');
  const id = c.env.USER_STORAGE.idFromName(`user_${user.id}`);
  const stub = c.env.USER_STORAGE.get(id);

  const response = await stub.fetch(`http://do/chats/${chatId}`, {
    method: 'DELETE',
  });
  return c.json(await response.json());
});

// Clear all data
conversationsRoute.delete('/', async (c) => {
  const user = c.get('user');
  const id = c.env.USER_STORAGE.idFromName(`user_${user.id}`);
  const stub = c.env.USER_STORAGE.get(id);

  const response = await stub.fetch('http://do/clear', { method: 'DELETE' });
  return c.json(await response.json());
});
```

### Models Route

```typescript
// src/routes/models.ts
import { Hono } from 'hono';
import type { Env, Model } from '../types';

export const modelsRoute = new Hono<{ Bindings: Env }>();

const AVAILABLE_MODELS: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', available: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', available: true },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', available: true },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', available: true },
  { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B', provider: 'workers-ai', available: true },
  { id: '@cf/mistral/mistral-7b-instruct-v0.1', name: 'Mistral 7B', provider: 'workers-ai', available: true },
];

modelsRoute.get('/', (c) => {
  return c.json({ models: AVAILABLE_MODELS });
});
```

## 🤖 AI Gateway Integration

```typescript
// src/lib/ai-gateway.ts
import type { Env, Message } from '../types';
import { callOpenAI } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callWorkersAI } from './providers/workers-ai';

interface CallAIParams {
  model: string;
  messages: Message[];
  env: Env;
  onChunk: (chunk: string) => Promise<void>;
}

export async function callAI(params: CallAIParams): Promise<void> {
  const { model, messages, env, onChunk } = params;

  // Route to appropriate provider
  if (model.startsWith('gpt-')) {
    await callOpenAI({ model, messages, apiKey: env.OPENAI_API_KEY, onChunk });
  } else if (model.startsWith('claude-')) {
    await callAnthropic({ model, messages, apiKey: env.ANTHROPIC_API_KEY, onChunk });
  } else if (model.startsWith('@cf/')) {
    await callWorkersAI({ model, messages, ai: env.AI, onChunk });
  } else {
    throw new Error(`Unknown model: ${model}`);
  }
}
```

### OpenAI Provider

```typescript
// src/lib/providers/openai.ts
import type { Message } from '../../types';

interface OpenAIParams {
  model: string;
  messages: Message[];
  apiKey: string;
  onChunk: (chunk: string) => Promise<void>;
}

export async function callOpenAI(params: OpenAIParams): Promise<void> {
  const { model, messages, apiKey, onChunk } = params;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          await onChunk(content);
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}
```

### Workers AI Provider

```typescript
// src/lib/providers/workers-ai.ts
import type { Message } from '../../types';

interface WorkersAIParams {
  model: string;
  messages: Message[];
  ai: Ai;
  onChunk: (chunk: string) => Promise<void>;
}

export async function callWorkersAI(params: WorkersAIParams): Promise<void> {
  const { model, messages, ai, onChunk } = params;

  const response = await ai.run(model as any, {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
  });

  // Workers AI returns an AsyncIterable when streaming
  for await (const chunk of response as AsyncIterable<any>) {
    if (chunk.response) {
      await onChunk(chunk.response);
    }
  }
}
```

## 📋 Implementation Phases

### Phase A1: Authentication Setup (WorkOS)
| Task | Status | Description |
|------|--------|-------------|
| A1.1 | ⬜ | Add WorkOS secrets to wrangler |
| A1.2 | ⬜ | Create `src/lib/auth.ts` session verifier |
| A1.3 | ⬜ | Add auth middleware to worker entry |
| A1.4 | ⬜ | Test session verification with frontend |

### Phase B1: Worker Setup
| Task | Status | Description |
|------|--------|-------------|
| B1.1 | ⬜ | Initialize Worker with `npm create cloudflare@latest` |
| B1.2 | ⬜ | Configure `wrangler.toml` with bindings |
| B1.3 | ⬜ | Set up TypeScript |
| B1.4 | ⬜ | Create basic routing with Hono |
| B1.5 | ⬜ | Install `@workos-inc/node` |

### Phase B2: Durable Objects
| Task | Status | Description |
|------|--------|-------------|
| B2.1 | ⬜ | Create `UserChatStorage` Durable Object class |
| B2.2 | ⬜ | Implement 3-chat circular buffer (FIFO) |
| B2.3 | ⬜ | Add methods: `getChats()`, `addChat()`, `deleteChat()` |
| B2.4 | ⬜ | Add message append to existing chat |
| B2.5 | ⬜ | Store user preferences |

### Phase B3: API Routes
| Task | Status | Description |
|------|--------|-------------|
| B3.1 | ⬜ | `POST /api/chat` - Send message, stream response |
| B3.2 | ⬜ | `GET /api/conversations` - List user's 3 chats |
| B3.3 | ⬜ | `GET /api/conversations/:id` - Get single chat |
| B3.4 | ⬜ | `DELETE /api/conversations/:id` - Delete chat |
| B3.5 | ⬜ | `DELETE /api/clear` - Clear all user data |
| B3.6 | ⬜ | `GET /api/models` - List available models |

### Phase B4: AI Gateway
| Task | Status | Description |
|------|--------|-------------|
| B4.1 | ⬜ | Configure AI Gateway in Cloudflare dashboard |
| B4.2 | ⬜ | Create unified `ai-gateway.ts` interface |
| B4.3 | ⬜ | Implement OpenAI provider |
| B4.4 | ⬜ | Implement Anthropic provider |
| B4.5 | ⬜ | Implement Workers AI provider |
| B4.6 | ⬜ | Add streaming response support |

### Phase B5: Security & Privacy
| Task | Status | Description |
|------|--------|-------------|
| B5.1 | ⬜ | Verify WorkOS session on all API routes |
| B5.2 | ⬜ | Add rate limiting per user |
| B5.3 | ⬜ | Input sanitization with Zod |
| B5.4 | ⬜ | CORS configuration with credentials |
| B5.5 | ⬜ | Ensure no chat content logging |

## 🌐 API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message, returns streamed response |
| `GET` | `/api/conversations` | List all chats (max 3) |
| `GET` | `/api/conversations/:id` | Get single chat with messages |
| `DELETE` | `/api/conversations/:id` | Delete a specific chat |
| `DELETE` | `/api/conversations` | Delete all user data |
| `GET` | `/api/models` | List available AI models |

### Authentication

All `/api/*` endpoints require a valid WorkOS session cookie:

| Cookie | Description |
|--------|-------------|
| `wos-session` | Sealed WorkOS session cookie (set by frontend) |

The backend verifies the session and extracts the user ID for Durable Object keying.

### Response Formats

**Success (List Conversations)**
```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Hello, how are you?...",
      "model": "gpt-4o",
      "messages": [...],
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000
    }
  ]
}
```

**Success (Chat Stream)**
```
data: {"content":"Hello"}
data: {"content":" there"}
data: {"content":"!"}
data: [DONE]
```

**Error**
```json
{
  "error": "Invalid request",
  "code": "VALIDATION_ERROR"
}
```

## 🧪 Testing

See [TESTING.md](./TESTING.md) for backend contract testing.

## 📚 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [WorkOS Documentation](https://workos.com/docs)
- [WorkOS AuthKit](https://workos.com/docs/user-management/authkit)
- [Hono Framework](https://hono.dev/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
