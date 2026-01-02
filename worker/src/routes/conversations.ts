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
