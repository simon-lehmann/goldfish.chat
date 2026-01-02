import { Hono } from 'hono';
import type { Env, Model } from '../types';

export const modelsRoute = new Hono<{ Bindings: Env }>();

const AVAILABLE_MODELS: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', available: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', available: true },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', available: true },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', available: true },
  { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B', provider: 'workers-ai', available: true },
  { id: '@cf/mistral/mistral-7b-instruct-v0.1', name: 'Mistral 7B', provider: 'workers-ai', available: true },
];

modelsRoute.get('/', (c) => {
  return c.json({ models: AVAILABLE_MODELS });
});
