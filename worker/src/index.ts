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
  const session = await verifySession(c);
  
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const { user, organizationId } = session;
  
  c.set('user', {
    id: user.id,
    email: user.email,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    organizationId: organizationId || undefined,
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
