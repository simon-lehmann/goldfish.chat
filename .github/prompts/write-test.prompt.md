---
tools:
  ['execute', 'read', 'edit', 'search', 'agent', 'todo']
---
# Write Test Prompt

Write tests for goldfish.chat following these guidelines.

## Context Files
- [docs/TESTING.md](../../docs/TESTING.md) - Full testing documentation
- [docs/agents/testing.md](../../docs/agents/testing.md) - Testing instructions

## Test Types

### E2E Test (Playwright)
Location: `tests/e2e/`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should [expected behavior]', async ({ page }) => {
    // Arrange - setup
    // Act - perform action
    // Assert - verify outcome
  });
});
```

### Contract Test (Zod)
Location: `tests/contracts/`

```typescript
import { test, expect } from '@playwright/test';
import { Schema } from './schemas';

test('API returns valid schema', async ({ request }) => {
  const response = await request.get(`${API_URL}/api/endpoint`);
  const data = await response.json();
  expect(Schema.safeParse(data).success).toBe(true);
});
```

## Requirements
- Use `data-testid` for element selection
- Test user-visible behavior, not implementation
- Include both happy path and error cases
- Mock external dependencies via MSW
- Keep tests independent and idempotent
