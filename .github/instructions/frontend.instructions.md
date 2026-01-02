```instructions
---
applyTo: src/**, astro.config.mjs, tailwind.config.mjs
---

# Frontend Instructions

## Stack
- **Framework**: AstroJS (Islands Architecture)
- **Styling**: Tailwind CSS
- **State**: Nanostores (Framework-agnostic state)
- **Auth**: WorkOS AuthKit
- **Deployment**: Cloudflare Pages

## Architecture
- **Islands**: Static HTML shell with interactive islands (`client:load`).
- **Routing**: File-based routing in `src/pages/`.
- **Middleware**: `src/middleware.ts` handles auth protection.

## State Management (Nanostores)
Located in `src/scripts/store.ts`:
- `$activeChat`: `atom<string | null>` - Current conversation ID.
- `$conversations`: `map<Record<string, Conversation>>` - Cache of user's chats (max 3).
- `$selectedModel`: `atom<string>` - Selected AI model ID.
- `$theme`: `atom<'light' | 'dark'>` - UI theme preference.

## Authentication (WorkOS)
- **User Object**: Available in `Astro.locals.user` (server-side) or via API.
- **Protection**: Middleware redirects unauthenticated users to `/sign-in`.
- **Flow**: `/sign-in` -> WorkOS Hosted UI -> `/auth/callback` -> `/chat`.
- **Sign Out**: `/sign-out` clears cookie and redirects to WorkOS logout.

## API Integration
- **Base URL**: `import.meta.env.PUBLIC_API_URL`
- **Credentials**: Always use `credentials: 'include'` in fetch to send session cookies.
- **Streaming**: Chat responses use Server-Sent Events (SSE).
  - Handle with `src/scripts/stream.ts`.
  - Format: `data: {"content": "..."}` or `data: [DONE]`.

## Key Components
| Component | Path | Description |
|-----------|------|-------------|
| `ChatWindow` | `src/components/ChatWindow.astro` | Main message display, auto-scrolls. |
| `ChatInput` | `src/components/ChatInput.astro` | Textarea + send button. Handles Enter/Shift+Enter. |
| `ChatSidebar` | `src/components/ChatSidebar.astro` | Lists recent chats (max 3). |
| `MessageBubble` | `src/components/MessageBubble.astro` | Renders user/assistant messages. |
| `ModelSelector` | `src/components/ModelSelector.astro` | Dropdown for AI model selection. |
| `UserButton` | `src/components/UserButton.astro` | Displays user info & sign-out link. |
| `ThemeToggle` | `src/components/ThemeToggle.astro` | Switches light/dark mode. |

## Styling Guidelines
- Use **Tailwind CSS** utility classes.
- Support **Dark Mode**: Use `dark:` prefix (e.g., `bg-white dark:bg-gray-900`).
- **Colors**:
  - User Bubble: `bg-blue-500 text-white`
  - Assistant Bubble: `bg-gray-200 dark:bg-gray-700`
- **Responsive**: Mobile-first, use `md:`, `lg:` breakpoints.

## Development Workflow
```bash
npm run dev        # Start dev server (localhost:4321)
npm run build      # Build for production
npm run preview    # Preview build locally
```

## Common Tasks

### Adding a New Component
1. Create `.astro` file in `src/components/`.
2. Define props interface: `interface Props { ... }`.
3. Add script tag if interactive: `<script>...</script>`.
4. Import and use in `src/pages/` or other components.

### Modifying State
1. Import atom/map from `src/scripts/store.ts`.
2. Use `.get()` to read value.
3. Use `.set()` or `.setKey()` to update.
4. Subscribe in scripts if reacting to changes: `$atom.subscribe(...)`.

### Handling API Errors
- Check `response.ok`.
- Parse error JSON: `{ error: string }`.
- Display user-friendly toast or alert.
```