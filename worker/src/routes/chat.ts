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
  const chat = await saveResponse.json() as any;

  // Get conversation history for context
  const historyResponse = await stub.fetch(`http://do/chats/${chat.id}`);
  const fullChat = await historyResponse.json() as any;

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
