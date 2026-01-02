import type { Message } from '../../types';

interface AnthropicParams {
  model: string;
  messages: Message[];
  apiKey: string;
  onChunk: (chunk: string) => Promise<void>;
}

export async function callAnthropic(params: AnthropicParams): Promise<void> {
  const { model, messages, apiKey, onChunk } = params;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
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
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            await onChunk(parsed.delta.text);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
}
