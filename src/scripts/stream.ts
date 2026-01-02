import { $conversations, $activeChat, type Message } from './store';

export async function handleStream(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data.trim() === '[DONE]') return;
        
        try {
            const parsed = JSON.parse(data);
            const content = parsed.content;
            if (content) {
                appendToCurrentMessage(content);
            }
        } catch (e) {
            console.error('Error parsing stream data', e);
        }
      }
    }
  }
}

function appendToCurrentMessage(content: string) {
    const activeChatId = $activeChat.get();
    if (!activeChatId) return;

    const conversations = $conversations.get();
    const chat = conversations[activeChatId];
    
    if (!chat) return;

    const lastMessage = chat.messages[chat.messages.length - 1];
    
    // If last message is user, we need to start a new assistant message
    // If last message is assistant, we append
    
    if (lastMessage && lastMessage.role === 'assistant') {
        const updatedMessages = [...chat.messages];
        updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + content
        };
        
        $conversations.setKey(activeChatId, {
            ...chat,
            messages: updatedMessages
        });
    } else {
        // New assistant message
        const updatedMessages = [...chat.messages, { role: 'assistant', content } as Message];
        $conversations.setKey(activeChatId, {
            ...chat,
            messages: updatedMessages
        });
    }
}
