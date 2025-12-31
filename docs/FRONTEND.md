# 🖥️ Frontend Documentation

> AstroJS + Tailwind CSS + WorkOS AuthKit + Cloudflare Pages

## Overview

The goldfish.chat frontend is built with **AstroJS** — a modern static site generator with islands architecture for interactive components. Authentication is handled by **WorkOS AuthKit** for enterprise SSO/SAML support. It's deployed to **Cloudflare Pages** for global edge distribution.

## 📁 File Structure

```
src/
├── components/
│   ├── ChatWindow.astro       # Main chat display area
│   ├── MessageBubble.astro    # Individual message component
│   ├── ChatInput.astro        # Text input + send button
│   ├── ModelSelector.astro    # Dropdown to pick AI model
│   ├── ChatSidebar.astro      # Shows 3 recent chats
│   ├── PrivacyBadge.astro     # "Only 3 chats stored" indicator
│   ├── ThemeToggle.astro      # Dark/light mode switch
│   └── UserButton.astro       # User profile/sign-out button
├── layouts/
│   └── MainLayout.astro       # Base HTML layout
├── pages/
│   ├── index.astro            # Landing page (public)
│   ├── chat.astro             # Chat app (protected)
│   ├── sign-in.ts             # WorkOS sign-in redirect
│   ├── sign-out.ts            # WorkOS sign-out handler
│   └── auth/
│       └── callback.ts        # OAuth callback handler
├── middleware.ts              # Auth middleware for protected routes
├── scripts/
│   ├── chat.ts                # Chat logic & API calls
│   ├── store.ts               # Client state (nanostores)
│   └── stream.ts              # Handle streaming responses
├── env.d.ts                   # TypeScript environment types
└── styles/
    └── global.css             # Tailwind + custom styles
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
# From project root
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:4321`

### Build for Production

```bash
npm run build
npm run preview  # Preview production build
```

## 📦 Dependencies

```json
{
  "dependencies": {
    "astro": "^5.x",
    "@astrojs/cloudflare": "^12.x",
    "@workos-inc/node": "^7.x",
    "nanostores": "^0.11.x"
  },
  "devDependencies": {
    "tailwindcss": "^4.x",
    "@tailwindcss/typography": "^0.5.x",
    "typescript": "^5.x"
  }
}
```

## 🔐 WorkOS AuthKit Integration

### Environment Variables

```bash
# .env.local
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_PASSWORD=<32+ character random string>
PUBLIC_API_URL=http://localhost:8787
```

### TypeScript Types

```typescript
// src/env.d.ts
/// <reference types="astro/client" />

import type { User } from '@workos-inc/node';

declare global {
  namespace App {
    interface Locals {
      user: User;
    }
  }
}
```

### Auth Middleware

The middleware protects routes and injects user info into `Astro.locals`:

```typescript
// src/middleware.ts
import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { WorkOS, type SessionCookieData } from '@workos-inc/node';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = new URL(context.request.url);

  // Protected routes - require authentication
  if (pathname.startsWith('/chat') || pathname.startsWith('/api')) {
    return withAuth(context, next);
  }

  return next();
});

async function withAuth(context: APIContext, next: MiddlewareNext) {
  const cookie = context.cookies.get('wos-session');

  if (!cookie?.value) {
    return context.redirect('/sign-in');
  }

  const workos = new WorkOS(import.meta.env.WORKOS_API_KEY, {
    clientId: import.meta.env.WORKOS_CLIENT_ID,
  });

  // Verify session
  const authResponse = await workos.userManagement.authenticateWithSessionCookie({
    sessionData: cookie.value,
    cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
  });

  if (!authResponse.authenticated && authResponse.reason !== 'invalid_jwt') {
    return context.redirect('/sign-in');
  }

  // Refresh session if needed
  const refreshResponse = await workos.userManagement.refreshAndSealSessionData({
    sessionData: cookie.value,
    cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
  });

  if (!refreshResponse.authenticated) {
    context.cookies.delete('wos-session', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
    return context.redirect('/sign-in');
  }

  // Update session cookie
  context.cookies.set('wos-session', String(refreshResponse.sealedSession), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  });

  // Get user from session
  const sessionData = await workos.userManagement.getSessionFromCookie({
    sessionData: cookie.value,
    cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
  }) as SessionCookieData;

  context.locals.user = sessionData.user;

  return next();
}
```

### Sign-In Route

```typescript
// src/pages/sign-in.ts
import type { APIRoute } from 'astro';
import { WorkOS } from '@workos-inc/node';

export const GET: APIRoute = async ({ redirect }) => {
  const workos = new WorkOS(import.meta.env.WORKOS_API_KEY);

  const authorizationURL = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    redirectUri: `${import.meta.env.SITE}/auth/callback`,
    clientId: import.meta.env.WORKOS_CLIENT_ID,
  });

  return redirect(authorizationURL);
};

export const prerender = false;
```

### OAuth Callback

```typescript
// src/pages/auth/callback.ts
import type { APIRoute } from 'astro';
import { WorkOS } from '@workos-inc/node';

export const GET: APIRoute = async ({ redirect, request, cookies }) => {
  const code = new URL(request.url).searchParams.get('code');

  if (!code) {
    return new Response('No code found in the URL', { status: 400 });
  }

  const workos = new WorkOS(import.meta.env.WORKOS_API_KEY);

  try {
    const session = await workos.userManagement.authenticateWithCode({
      code,
      clientId: import.meta.env.WORKOS_CLIENT_ID,
      session: {
        sealSession: true,
        cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
      },
    });

    cookies.set('wos-session', String(session.sealedSession), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });

    return redirect('/chat');
  } catch (error) {
    console.error('Auth callback error:', error);
    return redirect('/sign-in');
  }
};

export const prerender = false;
```

### Sign-Out Route

```typescript
// src/pages/sign-out.ts
import type { APIRoute } from 'astro';
import { WorkOS } from '@workos-inc/node';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const cookie = cookies.get('wos-session');

  if (!cookie?.value) {
    return redirect('/');
  }

  const workos = new WorkOS(import.meta.env.WORKOS_API_KEY, {
    clientId: import.meta.env.WORKOS_CLIENT_ID,
  });

  const logoutUrl = await workos.userManagement.getLogoutUrlFromSessionCookie({
    sessionData: cookie.value,
    cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
  });

  cookies.delete('wos-session', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  });

  return redirect(logoutUrl);
};

export const prerender = false;
```

### Protected Page Example

```astro
---
// src/pages/chat.astro
import Layout from '../layouts/MainLayout.astro';
import ChatWindow from '../components/ChatWindow.astro';
import ChatSidebar from '../components/ChatSidebar.astro';
import UserButton from '../components/UserButton.astro';

export const prerender = false;

const { user } = Astro.locals;
---

<Layout title="Chat - goldfish.chat">
  <div class="flex h-screen">
    <ChatSidebar />
    <main class="flex-1 flex flex-col">
      <header class="border-b p-4 flex justify-between items-center">
        <h1>goldfish.chat 🐠</h1>
        <UserButton user={user} />
      </header>
      <ChatWindow />
    </main>
  </div>
</Layout>
```

### User Button Component

```astro
---
// src/components/UserButton.astro
import type { User } from '@workos-inc/node';

interface Props {
  user: User;
}

const { user } = Astro.props;
---

<div class="flex items-center gap-3">
  <span class="text-sm text-gray-600 dark:text-gray-400">
    {user.firstName || user.email}
  </span>
  <a 
    href="/sign-out" 
    class="text-sm text-red-500 hover:text-red-600"
    data-astro-prefetch="false"
  >
    Sign out
  </a>
</div>
```

## 🏗️ Architecture

### Islands Architecture

Astro uses an "islands" approach — most of the page is static HTML, with interactive "islands" of JavaScript where needed.

```astro
---
// This runs at build time (server)
import ChatWindow from '../components/ChatWindow.astro';
---

<!-- Static HTML -->
<main>
  <!-- Interactive island -->
  <ChatWindow client:load />
</main>
```

### State Management

We use **nanostores** for lightweight, framework-agnostic state:

```typescript
// src/scripts/store.ts
import { atom, map } from 'nanostores';

// Active conversation
export const $activeChat = atom<string | null>(null);

// All conversations (max 3)
export const $conversations = map<Record<string, Conversation>>({});

// Selected AI model
export const $selectedModel = atom<string>('gpt-4o');

// Theme preference
export const $theme = atom<'light' | 'dark'>('dark');
```

### API Communication

API calls include credentials for session cookie authentication:

```typescript
// src/scripts/chat.ts
const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787';

export async function sendMessage(message: string, model: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    credentials: 'include', // Include session cookie
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId: $activeChat.get(),
      message,
      model,
    }),
  });
  
  // Handle streaming response
  await handleStream(response);
}
```

### Streaming Responses

```typescript
// src/scripts/stream.ts
export async function handleStream(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        const { content } = JSON.parse(data);
        appendToCurrentMessage(content);
      }
    }
  }
}
```

## 🧩 Components

### ChatWindow

Main chat display area with auto-scroll and message rendering.

```astro
---
// ChatWindow.astro
---
<div 
  id="chat-window"
  class="flex-1 overflow-y-auto p-4 space-y-4"
  data-testid="chat-window"
>
  <div id="messages-container">
    <!-- Messages rendered here -->
  </div>
  <div id="scroll-anchor"></div>
</div>

<script>
  // Auto-scroll to bottom on new messages
  const container = document.getElementById('chat-window');
  const observer = new MutationObserver(() => {
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  });
  observer.observe(document.getElementById('messages-container')!, { childList: true });
</script>
```

### MessageBubble

Displays user and assistant messages with appropriate styling.

```astro
---
// MessageBubble.astro
interface Props {
  role: 'user' | 'assistant';
  content: string;
}

const { role, content } = Astro.props;
const isUser = role === 'user';
---

<div class={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
  <div 
    class={`max-w-[80%] rounded-2xl px-4 py-2 ${
      isUser 
        ? 'bg-blue-500 text-white rounded-br-md' 
        : 'bg-gray-200 dark:bg-gray-700 rounded-bl-md'
    }`}
  >
    {content}
  </div>
</div>
```

### ChatInput

Text input with send button and keyboard handling.

```astro
---
// ChatInput.astro
---
<form id="chat-form" class="border-t p-4 flex gap-2">
  <textarea
    id="message-input"
    placeholder="Type a message..."
    class="flex-1 resize-none rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    rows="1"
    data-testid="message-input"
  ></textarea>
  <button
    type="submit"
    class="bg-blue-500 text-white rounded-xl px-6 py-3 hover:bg-blue-600 transition"
    data-testid="send-button"
  >
    Send
  </button>
</form>

<script>
  import { sendMessage } from '../scripts/chat';
  import { $selectedModel } from '../scripts/store';
  
  const form = document.getElementById('chat-form') as HTMLFormElement;
  const input = document.getElementById('message-input') as HTMLTextAreaElement;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    await sendMessage(message, $selectedModel.get());
  });
  
  // Enter to send (Shift+Enter for new line)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
</script>
```

### ModelSelector

Dropdown to select AI model.

```astro
---
// ModelSelector.astro
const models = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'llama-3-8b', name: 'Llama 3 8B', provider: 'Workers AI' },
];
---

<select
  id="model-selector"
  class="rounded-lg border px-3 py-2 bg-white dark:bg-gray-800"
  aria-label="Model"
  data-testid="model-selector"
>
  {models.map((model) => (
    <option value={model.id}>
      {model.name}
    </option>
  ))}
</select>

<script>
  import { $selectedModel } from '../scripts/store';
  
  const selector = document.getElementById('model-selector') as HTMLSelectElement;
  
  // Set initial value
  selector.value = $selectedModel.get();
  
  // Update store on change
  selector.addEventListener('change', () => {
    $selectedModel.set(selector.value);
    localStorage.setItem('selectedModel', selector.value);
  });
</script>
```

### ChatSidebar

Shows the 3 most recent conversations.

```astro
---
// ChatSidebar.astro
---
<aside class="w-64 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
  <div class="p-4 border-b">
    <button
      id="new-chat-btn"
      class="w-full bg-blue-500 text-white rounded-lg py-2 hover:bg-blue-600 transition"
      data-testid="new-chat-button"
    >
      + New Chat
    </button>
  </div>
  
  <nav id="chat-list" class="flex-1 overflow-y-auto p-2 space-y-1">
    <!-- Chat items rendered dynamically -->
  </nav>
  
  <div class="p-4 border-t">
    <PrivacyBadge />
  </div>
</aside>
```

### ThemeToggle

Dark/light mode switch with system preference detection.

```astro
---
// ThemeToggle.astro
---
<button
  id="theme-toggle"
  class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
  aria-label="Toggle theme"
  data-testid="theme-toggle"
>
  <span id="theme-icon">🌙</span>
</button>

<script>
  import { $theme } from '../scripts/store';
  
  const toggle = document.getElementById('theme-toggle')!;
  const icon = document.getElementById('theme-icon')!;
  
  function updateTheme(theme: 'light' | 'dark') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
  }
  
  // Initialize from localStorage or system preference
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (systemDark ? 'dark' : 'light');
  $theme.set(initial);
  updateTheme(initial);
  
  toggle.addEventListener('click', () => {
    const newTheme = $theme.get() === 'dark' ? 'light' : 'dark';
    $theme.set(newTheme);
    updateTheme(newTheme);
  });
</script>
```

## 🎨 Styling

### Tailwind Configuration

```javascript
// tailwind.config.mjs
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        goldfish: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
```

### Global Styles

```css
/* src/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100;
  }
}

@layer components {
  .chat-bubble-user {
    @apply bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2;
  }
  
  .chat-bubble-assistant {
    @apply bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-2;
  }
}
```

## 📋 Implementation Phases

### Phase A1: Authentication Setup (WorkOS)
| Task | Status | Description |
|------|--------|-------------|
| A1.1 | ⬜ | Create WorkOS account and configure AuthKit |
| A1.2 | ⬜ | Set up environment variables |
| A1.3 | ⬜ | Create `src/middleware.ts` for route protection |
| A1.4 | ⬜ | Implement `/sign-in` redirect route |
| A1.5 | ⬜ | Implement `/auth/callback` OAuth handler |
| A1.6 | ⬜ | Implement `/sign-out` route |
| A1.7 | ⬜ | Create `UserButton.astro` component |

### Phase F1: Project Setup
| Task | Status | Description |
|------|--------|-------------|
| F1.1 | ⬜ | Initialize AstroJS with `npm create astro@latest` |
| F1.2 | ⬜ | Add Cloudflare adapter (`@astrojs/cloudflare`) |
| F1.3 | ⬜ | Set up Tailwind CSS for styling |
| F1.4 | ⬜ | Configure TypeScript |
| F1.5 | ⬜ | Install `@workos-inc/node` |

### Phase F2: Core UI Components
| Task | Status | Description |
|------|--------|-------------|
| F2.1 | ⬜ | Create `MainLayout.astro` with responsive shell |
| F2.2 | ⬜ | Build `ChatWindow.astro` - scrollable message area |
| F2.3 | ⬜ | Build `MessageBubble.astro` - user/assistant styling |
| F2.4 | ⬜ | Build `ChatInput.astro` - textarea + send button |
| F2.5 | ⬜ | Build `ModelSelector.astro` - dropdown with AI models |

### Phase F3: Chat Sidebar
| Task | Status | Description |
|------|--------|-------------|
| F3.1 | ⬜ | Build `ChatSidebar.astro` - list of 3 chats |
| F3.2 | ⬜ | Add "New Chat" button |
| F3.3 | ⬜ | Add chat title/preview display |
| F3.4 | ⬜ | Add visual indicator for active chat |

### Phase F4: Interactivity
| Task | Status | Description |
|------|--------|-------------|
| F4.1 | ⬜ | Set up nanostores for state management |
| F4.2 | ⬜ | Implement `chat.ts` - send messages to API |
| F4.3 | ⬜ | Implement `stream.ts` - handle SSE streaming |
| F4.4 | ⬜ | Add optimistic UI updates |

### Phase F5: Polish
| Task | Status | Description |
|------|--------|-------------|
| F5.1 | ⬜ | Add `ThemeToggle.astro` - dark/light mode |
| F5.2 | ⬜ | Add `PrivacyBadge.astro` - show "🐠 3 chats max" |
| F5.3 | ⬜ | Loading states & skeleton screens |
| F5.4 | ⬜ | Error handling & retry UI |
| F5.5 | ⬜ | Mobile responsive design |
| F5.6 | ⬜ | Keyboard shortcuts |

## 🔧 Configuration

### astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'hybrid', // hybrid for SSR auth routes + static pages
  adapter: cloudflare(),
  integrations: [tailwind()],
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(
        process.env.PUBLIC_API_URL || 'http://localhost:8787'
      ),
    },
  },
});
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

## 🧪 Testing

See [TESTING.md](./TESTING.md) for frontend testing with Playwright.

## 📚 Resources

- [Astro Documentation](https://docs.astro.build)
- [WorkOS AuthKit Documentation](https://workos.com/docs/user-management/authkit)
- [Astro AuthKit Example](https://github.com/chantastic/astro-authkit)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Nanostores Documentation](https://github.com/nanostores/nanostores)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
