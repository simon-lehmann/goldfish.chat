import type { Conversation, Message, UserStorage, UserPreferences } from '../types';

const MAX_CHATS = 3;

export class UserChatStorage {
  private state: DurableObjectState;
  private storage: UserStorage | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async getStorage(): Promise<UserStorage> {
    if (!this.storage) {
      this.storage = await this.state.storage.get<UserStorage>('data') || {
        chats: [],
        preferences: {
          defaultModel: 'gpt-4o',
          theme: 'dark',
        },
      };
    }
    return this.storage;
  }

  private async saveStorage(): Promise<void> {
    await this.state.storage.put('data', this.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // GET /chats - List all conversations
      if (method === 'GET' && url.pathname === '/chats') {
        const storage = await this.getStorage();
        return Response.json({ conversations: storage.chats });
      }

      // GET /chats/:id - Get single conversation
      if (method === 'GET' && url.pathname.startsWith('/chats/')) {
        const id = url.pathname.split('/')[2];
        const storage = await this.getStorage();
        const chat = storage.chats.find(c => c.id === id);
        if (!chat) {
          return Response.json({ error: 'Chat not found' }, { status: 404 });
        }
        return Response.json(chat);
      }

      // POST /chats - Create or update conversation
      if (method === 'POST' && url.pathname === '/chats') {
        const body = await request.json() as {
          conversationId?: string;
          message: Message;
          model: string;
        };

        const storage = await this.getStorage();
        let chat: Conversation;

        if (body.conversationId) {
          // Add message to existing conversation
          chat = storage.chats.find(c => c.id === body.conversationId)!;
          if (!chat) {
            return Response.json({ error: 'Chat not found' }, { status: 404 });
          }
          chat.messages.push(body.message);
          chat.updatedAt = Date.now();
        } else {
          // Create new conversation
          chat = {
            id: crypto.randomUUID(),
            title: body.message.content.slice(0, 50) + '...',
            model: body.model,
            messages: [body.message],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          // FIFO: Remove oldest if at max
          if (storage.chats.length >= MAX_CHATS) {
            storage.chats.sort((a, b) => a.updatedAt - b.updatedAt);
            storage.chats.shift(); // Remove oldest
          }

          storage.chats.push(chat);
        }

        await this.saveStorage();
        return Response.json(chat);
      }

      // DELETE /chats/:id - Delete conversation
      if (method === 'DELETE' && url.pathname.startsWith('/chats/')) {
        const id = url.pathname.split('/')[2];
        const storage = await this.getStorage();
        const index = storage.chats.findIndex(c => c.id === id);
        if (index === -1) {
          return Response.json({ error: 'Chat not found' }, { status: 404 });
        }
        storage.chats.splice(index, 1);
        await this.saveStorage();
        return Response.json({ success: true });
      }

      // DELETE /clear - Delete all data
      if (method === 'DELETE' && url.pathname === '/clear') {
        this.storage = {
          chats: [],
          preferences: { defaultModel: 'gpt-4o', theme: 'dark' },
        };
        await this.saveStorage();
        return Response.json({ success: true });
      }

      // GET/PUT /preferences
      if (url.pathname === '/preferences') {
        const storage = await this.getStorage();
        if (method === 'GET') {
          return Response.json(storage.preferences);
        }
        if (method === 'PUT') {
          const prefs = await request.json() as Partial<UserPreferences>;
          storage.preferences = { ...storage.preferences, ...prefs };
          await this.saveStorage();
          return Response.json(storage.preferences);
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      console.error('Durable Object error:', error);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }
}
