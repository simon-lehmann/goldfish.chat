export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface UserStorage {
  chats: Conversation[];  // Max 3 - FIFO rotation
  preferences: UserPreferences;
}

export interface UserPreferences {
  defaultModel: string;
  theme: 'light' | 'dark';
}

export interface Env {
  USER_STORAGE: DurableObjectNamespace;
  AI: Ai;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;
  WORKOS_COOKIE_PASSWORD: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  model: string;
}

export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'workers-ai';
  available: boolean;
}

// WorkOS user from session
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
}
