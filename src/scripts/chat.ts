import { $activeChat, $conversations, $selectedModel, type Message } from './store';
import { handleStream } from './stream';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787';

export async function sendMessage(message: string, model: string): Promise<void> {
  const conversationId = $activeChat.get();
  
  // Optimistic update
  if (conversationId) {
      const conversations = $conversations.get();
      const chat = conversations[conversationId];
      if (chat) {
          const updatedMessages = [...chat.messages, { role: 'user', content: message } as Message];
          $conversations.setKey(conversationId, {
              ...chat,
              messages: updatedMessages
          });
      }
  }

  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    credentials: 'include', // Include session cookie
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      message,
      model,
    }),
  });
  
  // Handle streaming response
  await handleStream(response);
}
