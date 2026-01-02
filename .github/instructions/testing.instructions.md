---
applyTo: tests/**, playwright.config.ts
---

# Testing Instructions

## Stack
- **E2E**: Playwright
- **Mocks**: MSW (Mock Service Worker)
- **Contracts**: Zod schemas

## Test Structure
```
tests/
├── e2e/           # Playwright browser tests
├── contracts/     # API schema validation
├── mocks/         # MSW handlers + mock data
└── fixtures/      # Shared test utilities
```

## Commands
```bash
npm test              # All tests
npm run test:e2e      # E2E only
npm run test:contracts # Contracts only
npm run test:headed   # With browser visible
npm run test:debug    # Debug mode
```

## Writing E2E Tests

### Test File Pattern
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    const element = page.getByTestId('element-name');
    await expect(element).toBeVisible();
  });
});
```

### Selectors
- Use `data-testid` attributes: `page.getByTestId('chat-item')`
- Use semantic queries: `page.getByRole('button', { name: 'Send' })`
- Avoid CSS selectors and XPath

### Key Test IDs
| Element | Test ID |
|---------|---------|
| Chat window | `chat-window` |
| Message input | `message-input` |
| Send button | `send-button` |
| Message bubble | `message-bubble` |
| Chat list item | `chat-item` |
| New chat button | `new-chat-button` |
| Model selector | `model-selector` |
| Theme toggle | `theme-toggle` |
| Privacy badge | `privacy-badge` |
| Clear all button | `clear-all-button` |
| Delete chat button | `delete-chat-button` |

## Writing Contract Tests

### Schema Pattern (Zod)
```typescript
import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.number(),
});
```

### Contract Test Pattern
```typescript
test('GET /api/resource returns valid schema', async ({ request }) => {
  const response = await request.get(`${API_URL}/api/resource`);
  expect(response.ok()).toBeTruthy();
  
  const data = await response.json();
  const result = ResourceSchema.safeParse(data);
  expect(result.success).toBe(true);
});
```

## MSW Mock Handlers

### Adding a Handler
```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/endpoint', () => {
    return HttpResponse.json({ data: mockData });
  }),
  
  http.post('*/api/endpoint', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true });
  }),
];
```

### Mock Streaming Response
```typescript
http.post('*/api/chat', async () => {
  const stream = createMockStream('Response text');
  return new HttpResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
});
```

## Test Assertions

### Visibility
```typescript
await expect(element).toBeVisible();
await expect(element).toBeHidden();
```

### Content
```typescript
await expect(element).toHaveText('exact text');
await expect(element).toContainText('partial');
await expect(element).toHaveValue('input value');
```

### State
```typescript
await expect(element).toBeEnabled();
await expect(element).toBeDisabled();
await expect(element).toHaveClass(/active/);
```

### Count
```typescript
await expect(items).toHaveCount(3);
```

## Coverage Areas

### Required Test Coverage
1. **Chat** - Send/receive messages, streaming, input handling
2. **Sidebar** - Conversation list, switching, new chat
3. **Privacy** - 3-chat limit, delete, clear all
4. **Models** - Selection, persistence
5. **Theme** - Toggle, persistence, system preference
6. **Errors** - Network failures, invalid responses

## CI Integration
Tests run automatically on push to `main` and pull requests. Reports uploaded as artifacts for 30 days.

## Agent Invocation
- **Frontend**: If you need to update frontend components or logic, invoke the **Frontend Agent** using `runSubagent`.
  - Prompt: "Act as a Frontend Agent. [Task description]..."
- **Backend**: If you need to update the backend API or logic, invoke the **Backend Agent** using `runSubagent`.
  - Prompt: "Act as a Backend Agent. [Task description]..."
