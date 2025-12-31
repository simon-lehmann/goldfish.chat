---
tools:
  ['execute', 'read', 'edit', 'search', 'agent', 'todo']
---
# Fix Test Prompt

Debug and fix failing tests in goldfish.chat.

## Context Files
- [docs/TESTING.md](../../docs/TESTING.md) - Full testing documentation
- [docs/agents/testing.md](../../docs/agents/testing.md) - Testing instructions

## Debug Commands
```bash
npm run test:debug     # Interactive debugger
npm run test:headed    # See browser
npm run test:ui        # Playwright UI mode
```

## Common Issues

### Element Not Found
- Verify `data-testid` exists in component
- Check if element is conditionally rendered
- Add wait: `await expect(element).toBeVisible()`

### Timing Issues
- Use `await expect().toBeVisible({ timeout: 10000 })`
- Wait for network: `await page.waitForResponse()`
- Wait for state: `await page.waitForLoadState()`

### Mock Not Working
- Verify MSW handler pattern matches request URL
- Check handler is in `handlers.ts` array
- Confirm server is started in test setup

### Flaky Tests
- Avoid arbitrary `waitForTimeout()`
- Use explicit conditions instead
- Check for race conditions in state

## Fix Process
1. Run test in debug mode to observe failure
2. Check if selector matches current DOM
3. Verify mock returns expected data
4. Add appropriate waits if timing issue
5. Run test multiple times to confirm fix
