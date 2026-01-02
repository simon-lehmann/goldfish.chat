import { atom, map } from 'nanostores';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  messages: Message[];
}

// Active conversation ID
export const $activeChat = atom<string | null>(null);

// All conversations (max 3)
export const $conversations = map<Record<string, Conversation>>({});

// Selected AI model
export const $selectedModel = atom<string>('gpt-4o');

// Theme preference
export const $theme = atom<'light' | 'dark'>('dark');
