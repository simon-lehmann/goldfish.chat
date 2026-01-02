---
applyTo: worker/**, wrangler.jsonc
---

# Backend Instructions

## Stack
- **Runtime**: Cloudflare Workers
- **Storage**: Durable Objects (Per-user state)
- **Framework**: Hono
- **Auth**: WorkOS (Session verification)
- **AI**: Cloudflare AI Gateway (OpenAI, Anthropic, Workers AI)

## Architecture
- **Worker**: `worker/src/index.ts` handles routing and auth middleware.
- **Durable Object**: `worker/src/durable-objects/UserChatStorage.ts` manages user state (chats, preferences).
- **Routes**: `worker/src/routes/` contains API endpoints.
- **Lib**: `worker/src/lib/` contains shared logic (auth, AI providers).

## Key Components
| Component | Path | Description |
|-----------|------|-------------|
| `UserChatStorage` | `worker/src/durable-objects/UserChatStorage.ts` | Stores user's 3 chats and preferences. |
| `chatRoute` | `worker/src/routes/chat.ts` | Handles chat messages and streaming responses. |
| `verifySession` | `worker/src/lib/auth.ts` | Verifies WorkOS session cookies. |
| `callAI` | `worker/src/lib/ai-gateway.ts` | Unified interface for AI providers. |

## Development Workflow
```bash
cd worker
npm run dev        # Start local dev server (localhost:8787)
npm run deploy     # Deploy to Cloudflare
```

## Common Tasks

### Adding a New Route
1. Create file in `worker/src/routes/`.
2. Define Hono app/route.
3. Mount in `worker/src/index.ts`.

### Modifying Durable Object
1. Edit `worker/src/durable-objects/UserChatStorage.ts`.
2. Update `fetch` method to handle new requests.
3. Update `UserStorage` interface in `worker/src/types.ts` if state schema changes.

### Adding an AI Provider
1. Create provider adapter in `worker/src/lib/providers/`.
2. Update `worker/src/lib/ai-gateway.ts` to route to new provider.
3. Add model to `AVAILABLE_MODELS` in `worker/src/routes/models.ts`.

## Agent Invocation
- **Frontend**: If you need to update frontend components or logic, invoke the **Frontend Agent** using `runSubagent`.
  - Prompt: "Act as a Frontend Agent. [Task description]..."
- **Testing**: If you need to update tests (E2E, contracts), invoke the **Testing Agent** using `runSubagent`.
  - Prompt: "Act as a Testing Agent. [Task description]..."
