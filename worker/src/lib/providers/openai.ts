import type { Message } from '../../types';

interface OpenAIParams {
  model: string;
  messages: Message[];
  apiKey: string;
  onChunk: (chunk: string) => Promise<void>;
}

export async function callOpenAI(params: OpenAIParams): Promise<void> {
  const { model, messages, apiKey, onChunk } = params;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          await onChunk(content);
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}
