# 🧪 Testing Documentation

> Playwright E2E + MSW Mocks + Contract Tests + Auth Mocking

## Overview

goldfish.chat uses a pragmatic testing strategy focused on:

1. **E2E Tests** — Playwright tests against the frontend with mocked backend
2. **Contract Tests** — Validate API request/response schemas
3. **Mock Backend** — MSW (Mock Service Worker) for consistent, fast tests
4. **Auth Mocking** — Bypass WorkOS auth in tests with mock sessions

This approach lets us:
- Test frontend in isolation (fast, reliable)
- Validate API contracts without running real backend
- Test authenticated flows without real WorkOS credentials
- Catch integration issues early

## 📁 File Structure

```
tests/
├── e2e/                           # Playwright E2E tests
│   ├── auth.spec.ts               # Authentication flow tests
│   ├── chat.spec.ts               # Chat flow tests
│   ├── sidebar.spec.ts            # Sidebar navigation tests
│   ├── model-selection.spec.ts    # Model switching tests
│   ├── privacy.spec.ts            # 3-chat limit, clear data tests
│   ├── theme.spec.ts              # Dark/light mode tests
│   └── error-states.spec.ts       # Error handling tests
├── contracts/
│   ├── schemas.ts                 # Zod schema definitions
│   ├── chat.contract.test.ts      # POST /api/chat contract
│   ├── conversations.contract.test.ts
│   └── models.contract.test.ts
├── mocks/
│   ├── handlers.ts                # MSW request handlers
│   ├── auth.ts                    # Auth mock helpers
│   ├── server.ts                  # MSW server setup
│   └── data/
│       ├── conversations.ts       # Mock conversation data
│       ├── models.ts              # Mock models list
│       ├── users.ts               # Mock user data
│       └── streaming.ts           # Mock SSE responses
├── fixtures/
│   └── test-fixtures.ts           # Shared test utilities
└── playwright.config.ts
```

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all tests
npm test

# Run E2E tests only
npm run test:e2e

# Run contract tests only
npm run test:contracts

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Run specific test file
npx playwright test tests/e2e/chat.spec.ts
```

## 📦 Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.49.x",
    "msw": "^2.x",
    "zod": "^3.x"
  }
}
```

## 🔧 Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    process.env.CI ? ['github'] : ['line'],
  ],
  
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "playwright test",
    "test:e2e": "playwright test tests/e2e/",
    "test:contracts": "playwright test tests/contracts/",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:ci": "playwright test --reporter=github",
    "test:report": "playwright show-report"
  }
}
```

## 🎭 Mock Backend (MSW)

### Server Setup

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());
```

### Request Handlers

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { mockConversations } from './data/conversations';
import { mockModels } from './data/models';
import { createMockStream } from './data/streaming';

export const handlers = [
  // GET /api/models
  http.get('*/api/models', () => {
    return HttpResponse.json({ models: mockModels });
  }),

  // GET /api/conversations
  http.get('*/api/conversations', () => {
    return HttpResponse.json({ conversations: mockConversations });
  }),

  // GET /api/conversations/:id
  http.get('*/api/conversations/:id', ({ params }) => {
    const conversation = mockConversations.find(c => c.id === params.id);
    if (!conversation) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(conversation);
  }),

  // DELETE /api/conversations/:id
  http.delete('*/api/conversations/:id', ({ params }) => {
    const index = mockConversations.findIndex(c => c.id === params.id);
    if (index === -1) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json({ success: true });
  }),

  // DELETE /api/conversations (clear all)
  http.delete('*/api/conversations', () => {
    return HttpResponse.json({ success: true });
  }),

  // POST /api/chat - Streaming response
  http.post('*/api/chat', async ({ request }) => {
    const body = await request.json() as { message: string; model: string };
    
    // Create mock streaming response
    const stream = createMockStream(`This is a response to: ${body.message}`);
    
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),
];
```

## 🔐 Auth Mocking

For E2E tests, we need to bypass WorkOS authentication. There are two strategies:

### Strategy 1: Mock Session Cookie (Recommended)

Set a mock session cookie that the backend accepts in test mode:

```typescript
// tests/mocks/auth.ts
import type { Page } from '@playwright/test';

export const mockUser = {
  id: 'user_test_123456789',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};

// Set mock auth cookie before tests
export async function loginAsTestUser(page: Page) {
  // In test environment, set a special cookie the backend recognizes
  await page.context().addCookies([
    {
      name: 'wos-session',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

// Clear auth for unauthenticated tests
export async function logout(page: Page) {
  await page.context().clearCookies();
}
```

### Strategy 2: Mock Auth Endpoints

Intercept WorkOS redirect routes:

```typescript
// tests/mocks/handlers.ts (add to existing handlers)

// Mock sign-in redirect
http.get('*/sign-in', () => {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/chat',
      'Set-Cookie': 'wos-session=test-session-token; Path=/; HttpOnly',
    },
  });
}),

// Mock auth callback
http.get('*/auth/callback', () => {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/chat',
      'Set-Cookie': 'wos-session=test-session-token; Path=/; HttpOnly',
    },
  });
}),
```

### Test Environment Detection (Backend)

Configure the backend to accept test tokens in development:

```typescript
// worker/src/lib/auth.ts
export async function verifySession(c: Context<{ Bindings: Env }>): Promise<User | null> {
  // In test mode, accept mock session
  if (c.env.ENVIRONMENT === 'test') {
    const cookie = c.req.header('Cookie');
    if (cookie?.includes('wos-session=test-session-token')) {
      return {
        id: 'user_test_123456789',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      } as User;
    }
  }

  // Production verification logic...
}
```

### Mock Data

```typescript
// tests/mocks/data/users.ts
export const mockUsers = {
  testUser: {
    id: 'user_test_123456789',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
  enterpriseUser: {
    id: 'user_enterprise_987654321',
    email: 'admin@acme.com',
    firstName: 'Admin',
    lastName: 'User',
    organizationId: 'org_acme_123',
  },
};

// tests/mocks/data/conversations.ts
import type { Conversation } from '../../../src/types';

export const mockConversations: Conversation[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Hello, how are you?...',
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Hello, how are you?', timestamp: 1704067200000 },
      { role: 'assistant', content: 'I\'m doing great, thanks for asking!', timestamp: 1704067201000 },
    ],
    createdAt: 1704067200000,
    updatedAt: 1704067201000,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    title: 'What is the weather like?...',
    model: 'claude-3-5-sonnet',
    messages: [
      { role: 'user', content: 'What is the weather like?', timestamp: 1704067100000 },
      { role: 'assistant', content: 'I don\'t have access to real-time weather data.', timestamp: 1704067101000 },
    ],
    createdAt: 1704067100000,
    updatedAt: 1704067101000,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    title: 'Tell me a joke...',
    model: 'llama-3-8b',
    messages: [
      { role: 'user', content: 'Tell me a joke', timestamp: 1704067000000 },
      { role: 'assistant', content: 'Why did the goldfish blush? Because it saw the ocean\'s bottom! 🐠', timestamp: 1704067001000 },
    ],
    createdAt: 1704067000000,
    updatedAt: 1704067001000,
  },
];

// tests/mocks/data/models.ts
import type { Model } from '../../../src/types';

export const mockModels: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', available: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', available: true },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', available: true },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', available: true },
  { id: 'llama-3-8b', name: 'Llama 3 8B', provider: 'workers-ai', available: true },
];

// tests/mocks/data/streaming.ts
export function createMockStream(response: string): ReadableStream {
  const encoder = new TextEncoder();
  const words = response.split(' ');
  
  return new ReadableStream({
    async start(controller) {
      for (const word of words) {
        const chunk = `data: ${JSON.stringify({ content: word + ' ' })}\n\n`;
        controller.enqueue(encoder.encode(chunk));
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}
```

## 📋 Contract Definitions

### Zod Schemas

```typescript
// tests/contracts/schemas.ts
import { z } from 'zod';

// Base schemas
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.number(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  model: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['openai', 'anthropic', 'workers-ai']),
  available: z.boolean(),
});

// API Response schemas
export const ConversationsListResponseSchema = z.object({
  conversations: z.array(ConversationSchema).max(3),
});

export const ModelsListResponseSchema = z.object({
  models: z.array(ModelSchema),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

// API Request schemas
export const ChatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(10000),
  model: z.string(),
});

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
});

// Type exports
export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
```

## 🧪 E2E Tests

### Auth Flow Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser, logout } from '../mocks/auth';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to sign-in', async ({ page }) => {
    await logout(page);
    await page.goto('/chat');
    
    // Should be redirected to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should allow authenticated users to access chat', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
    
    // Should stay on chat page
    await expect(page).toHaveURL(/chat/);
    await expect(page.getByTestId('chat-window')).toBeVisible();
  });

  test('should display user info when logged in', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
    
    // Should show user name or email
    await expect(page.getByText('Test')).toBeVisible();
  });

  test('should sign out and redirect to home', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
    
    // Click sign out
    await page.getByText('Sign out').click();
    
    // Should redirect to home
    await expect(page).toHaveURL('/');
  });
});
```

### Chat Flow Tests

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../mocks/auth';

test.describe('Chat functionality', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
  });

  test('should display empty chat window on first load', async ({ page }) => {
    const chatWindow = page.getByTestId('chat-window');
    await expect(chatWindow).toBeVisible();
    
    const messages = page.getByTestId('message-bubble');
    await expect(messages).toHaveCount(0);
  });

  test('should send a message and display it', async ({ page }) => {
    const input = page.getByTestId('message-input');
    const sendButton = page.getByTestId('send-button');
    
    await input.fill('Hello, AI!');
    await sendButton.click();
    
    // User message should appear immediately
    await expect(page.getByText('Hello, AI!')).toBeVisible();
  });

  test('should receive streamed response from AI', async ({ page }) => {
    const input = page.getByTestId('message-input');
    const sendButton = page.getByTestId('send-button');
    
    await input.fill('Tell me something');
    await sendButton.click();
    
    // Wait for AI response (streamed)
    await expect(page.getByText(/This is a response to/)).toBeVisible({ 
      timeout: 10000 
    });
  });

  test('should clear input after sending', async ({ page }) => {
    const input = page.getByTestId('message-input');
    const sendButton = page.getByTestId('send-button');
    
    await input.fill('Test message');
    await sendButton.click();
    
    await expect(input).toHaveValue('');
  });

  test('should send message on Enter key', async ({ page }) => {
    const input = page.getByTestId('message-input');
    
    await input.fill('Enter key test');
    await input.press('Enter');
    
    await expect(page.getByText('Enter key test')).toBeVisible();
  });

  test('should allow newline with Shift+Enter', async ({ page }) => {
    const input = page.getByTestId('message-input');
    
    await input.fill('Line 1');
    await input.press('Shift+Enter');
    await input.type('Line 2');
    
    await expect(input).toHaveValue('Line 1\nLine 2');
  });

  test('should not send empty messages', async ({ page }) => {
    const sendButton = page.getByTestId('send-button');
    await sendButton.click();
    
    const messages = page.getByTestId('message-bubble');
    await expect(messages).toHaveCount(0);
  });
});
```

### Sidebar Tests

```typescript
// tests/e2e/sidebar.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../mocks/auth';

test.describe('Chat sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
  });

  test('should display list of conversations', async ({ page }) => {
    const chatItems = page.getByTestId('chat-item');
    await expect(chatItems).toHaveCount(3); // Mock has 3 conversations
  });

  test('should show conversation titles', async ({ page }) => {
    await expect(page.getByText('Hello, how are you?...')).toBeVisible();
    await expect(page.getByText('What is the weather like?...')).toBeVisible();
    await expect(page.getByText('Tell me a joke...')).toBeVisible();
  });

  test('should switch active conversation on click', async ({ page }) => {
    const secondChat = page.getByTestId('chat-item').nth(1);
    await secondChat.click();
    
    await expect(secondChat).toHaveClass(/active/);
    
    // Should load messages for that conversation
    await expect(page.getByText('What is the weather like?')).toBeVisible();
  });

  test('should create new chat on button click', async ({ page }) => {
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click();
    
    // Chat window should be empty
    const messages = page.getByTestId('message-bubble');
    await expect(messages).toHaveCount(0);
  });

  test('should highlight active chat', async ({ page }) => {
    const firstChat = page.getByTestId('chat-item').first();
    await firstChat.click();
    
    await expect(firstChat).toHaveClass(/active/);
  });
});
```

### Privacy Tests

```typescript
// tests/e2e/privacy.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../mocks/auth';

test.describe('Privacy features', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
  });

  test('should display privacy badge', async ({ page }) => {
    const badge = page.getByTestId('privacy-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('3 chats');
  });

  test('should show maximum 3 conversations', async ({ page }) => {
    const chatItems = page.getByTestId('chat-item');
    const count = await chatItems.count();
    expect(count).toBeLessThanOrEqual(3);
  });

  test('should clear all data on button click', async ({ page }) => {
    // Open settings or find clear button
    const clearButton = page.getByTestId('clear-all-button');
    await clearButton.click();
    
    // Confirm dialog
    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();
    
    // Should show empty state
    const chatItems = page.getByTestId('chat-item');
    await expect(chatItems).toHaveCount(0);
  });

  test('should delete individual conversation', async ({ page }) => {
    const firstChat = page.getByTestId('chat-item').first();
    const deleteButton = firstChat.getByTestId('delete-chat-button');
    
    // Hover to reveal delete button
    await firstChat.hover();
    await deleteButton.click();
    
    // Should have one less conversation
    const chatItems = page.getByTestId('chat-item');
    await expect(chatItems).toHaveCount(2);
  });
});
```

### Model Selection Tests

```typescript
// tests/e2e/model-selection.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../mocks/auth';

test.describe('Model selection', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
  });

  test('should display model selector', async ({ page }) => {
    const selector = page.getByTestId('model-selector');
    await expect(selector).toBeVisible();
  });

  test('should list available models', async ({ page }) => {
    const selector = page.getByTestId('model-selector');
    await selector.click();
    
    await expect(page.getByRole('option', { name: 'GPT-4o' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Claude 3.5 Sonnet' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Llama 3 8B' })).toBeVisible();
  });

  test('should change model on selection', async ({ page }) => {
    const selector = page.getByTestId('model-selector');
    await selector.selectOption('claude-3-5-sonnet');
    
    await expect(selector).toHaveValue('claude-3-5-sonnet');
  });

  test('should persist model selection', async ({ page }) => {
    const selector = page.getByTestId('model-selector');
    await selector.selectOption('claude-3-5-sonnet');
    
    // Reload page
    await page.reload();
    
    await expect(selector).toHaveValue('claude-3-5-sonnet');
  });
});
```

### Theme Tests

```typescript
// tests/e2e/theme.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../mocks/auth';

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/chat');
  });

  test('should display theme toggle button', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();
  });

  test('should toggle between light and dark mode', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');
    const html = page.locator('html');
    
    // Check initial state
    const initialDark = await html.evaluate(el => el.classList.contains('dark'));
    
    // Toggle
    await toggle.click();
    
    // Should be opposite
    const afterToggle = await html.evaluate(el => el.classList.contains('dark'));
    expect(afterToggle).toBe(!initialDark);
  });

  test('should persist theme preference', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');
    const html = page.locator('html');
    
    // Set to dark mode
    const isDark = await html.evaluate(el => el.classList.contains('dark'));
    if (!isDark) await toggle.click();
    
    // Reload
    await page.reload();
    
    // Should still be dark
    await expect(html).toHaveClass(/dark/);
  });

  test('should respect system preference on first load', async ({ page }) => {
    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' });
    await loginAsTestUser(page);
    await page.goto('/chat');
    
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });
});
```

## 📝 Contract Tests

```typescript
// tests/contracts/conversations.contract.test.ts
import { test, expect } from '@playwright/test';
import { 
  ConversationsListResponseSchema, 
  ConversationSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from './schemas';

const API_URL = process.env.API_URL || 'http://localhost:8787';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Conversations API Contract', () => {
  const headers = {
    'X-User-ID': TEST_USER_ID,
    'Content-Type': 'application/json',
  };

  test('GET /api/conversations returns valid schema', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/conversations`, { headers });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    const result = ConversationsListResponseSchema.safeParse(data);
    
    if (!result.success) {
      console.error('Schema validation failed:', result.error.format());
    }
    expect(result.success).toBe(true);
  });

  test('GET /api/conversations returns max 3 conversations', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/conversations`, { headers });
    const data = await response.json();
    
    expect(data.conversations.length).toBeLessThanOrEqual(3);
  });

  test('GET /api/conversations/:id returns valid conversation', async ({ request }) => {
    // First get list to get a valid ID
    const listResponse = await request.get(`${API_URL}/api/conversations`, { headers });
    const listData = await listResponse.json();
    
    if (listData.conversations.length > 0) {
      const id = listData.conversations[0].id;
      const response = await request.get(`${API_URL}/api/conversations/${id}`, { headers });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      const result = ConversationSchema.safeParse(data);
      
      expect(result.success).toBe(true);
    }
  });

  test('GET /api/conversations/:id returns 404 for invalid ID', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/conversations/00000000-0000-0000-0000-000000000000`,
      { headers }
    );
    
    expect(response.status()).toBe(404);
    const data = await response.json();
    const result = ErrorResponseSchema.safeParse(data);
    
    expect(result.success).toBe(true);
  });

  test('DELETE /api/conversations/:id returns success schema', async ({ request }) => {
    // First get a valid ID
    const listResponse = await request.get(`${API_URL}/api/conversations`, { headers });
    const listData = await listResponse.json();
    
    if (listData.conversations.length > 0) {
      const id = listData.conversations[0].id;
      const response = await request.delete(`${API_URL}/api/conversations/${id}`, { headers });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      const result = SuccessResponseSchema.safeParse(data);
      
      expect(result.success).toBe(true);
    }
  });
});

// tests/contracts/models.contract.test.ts
import { test, expect } from '@playwright/test';
import { ModelsListResponseSchema } from './schemas';

const API_URL = process.env.API_URL || 'http://localhost:8787';

test.describe('Models API Contract', () => {
  test('GET /api/models returns valid schema', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/models`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    const result = ModelsListResponseSchema.safeParse(data);
    
    if (!result.success) {
      console.error('Schema validation failed:', result.error.format());
    }
    expect(result.success).toBe(true);
  });

  test('GET /api/models returns at least one model', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/models`);
    const data = await response.json();
    
    expect(data.models.length).toBeGreaterThan(0);
  });

  test('All models have required provider types', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/models`);
    const data = await response.json();
    
    const validProviders = ['openai', 'anthropic', 'workers-ai'];
    for (const model of data.models) {
      expect(validProviders).toContain(model.provider);
    }
  });
});

// tests/contracts/chat.contract.test.ts
import { test, expect } from '@playwright/test';
import { ChatRequestSchema } from './schemas';

const API_URL = process.env.API_URL || 'http://localhost:8787';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Chat API Contract', () => {
  const headers = {
    'X-User-ID': TEST_USER_ID,
    'Content-Type': 'application/json',
  };

  test('POST /api/chat accepts valid request', async ({ request }) => {
    const validRequest = {
      message: 'Hello, AI!',
      model: 'gpt-4o',
    };
    
    // Validate request schema
    const requestResult = ChatRequestSchema.safeParse(validRequest);
    expect(requestResult.success).toBe(true);
    
    const response = await request.post(`${API_URL}/api/chat`, {
      headers,
      data: validRequest,
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/event-stream');
  });

  test('POST /api/chat returns streaming response', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/chat`, {
      headers,
      data: { message: 'Test', model: 'gpt-4o' },
    });
    
    const text = await response.text();
    
    // Should contain SSE format
    expect(text).toContain('data: ');
    expect(text).toContain('[DONE]');
  });

  test('POST /api/chat rejects empty message', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/chat`, {
      headers,
      data: { message: '', model: 'gpt-4o' },
    });
    
    expect(response.status()).toBe(400);
  });

  test('POST /api/chat rejects missing model', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/chat`, {
      headers,
      data: { message: 'Hello' },
    });
    
    expect(response.status()).toBe(400);
  });

  test('POST /api/chat requires X-User-ID header', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/chat`, {
      data: { message: 'Hello', model: 'gpt-4o' },
    });
    
    expect(response.status()).toBe(400);
  });
});
```

## 📋 Implementation Phases

### Phase T1: Test Infrastructure
| Task | Status | Description |
|------|--------|-------------|
| T1.1 | ⬜ | Install Playwright |
| T1.2 | ⬜ | Install MSW |
| T1.3 | ⬜ | Configure `playwright.config.ts` |
| T1.4 | ⬜ | Set up test scripts |
| T1.5 | ⬜ | Create test fixtures |

### Phase T2: Mock Backend
| Task | Status | Description |
|------|--------|-------------|
| T2.1 | ⬜ | Create MSW handlers |
| T2.2 | ⬜ | Create mock data fixtures |
| T2.3 | ⬜ | Implement mock streaming |
| T2.4 | ⬜ | Integrate MSW with Playwright |

### Phase T3: E2E Tests
| Task | Status | Description |
|------|--------|-------------|
| T3.1 | ⬜ | `chat.spec.ts` - Chat flow tests |
| T3.2 | ⬜ | `sidebar.spec.ts` - Navigation tests |
| T3.3 | ⬜ | `model-selection.spec.ts` - Model switching |
| T3.4 | ⬜ | `privacy.spec.ts` - 3-chat limit tests |
| T3.5 | ⬜ | `theme.spec.ts` - Theme toggle tests |
| T3.6 | ⬜ | `error-states.spec.ts` - Error handling |

### Phase T4: Contract Tests
| Task | Status | Description |
|------|--------|-------------|
| T4.1 | ⬜ | Define Zod schemas |
| T4.2 | ⬜ | `chat.contract.test.ts` |
| T4.3 | ⬜ | `conversations.contract.test.ts` |
| T4.4 | ⬜ | `models.contract.test.ts` |
| T4.5 | ⬜ | Streaming response contract |

### Phase T5: CI Integration
| Task | Status | Description |
|------|--------|-------------|
| T5.1 | ⬜ | GitHub Actions workflow |
| T5.2 | ⬜ | Playwright CI configuration |
| T5.3 | ⬜ | Test coverage reporting |
| T5.4 | ⬜ | PR validation checks |

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Zod Documentation](https://zod.dev/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
