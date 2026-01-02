import type { Message } from '../../types';

interface WorkersAIParams {
  model: string;
  messages: Message[];
  ai: Ai;
  onChunk: (chunk: string) => Promise<void>;
}

export async function callWorkersAI(params: WorkersAIParams): Promise<void> {
  const { model, messages, ai, onChunk } = params;

  const response = await ai.run(model as any, {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
  });

  // Workers AI returns an AsyncIterable when streaming
  for await (const chunk of response as AsyncIterable<any>) {
    if (chunk.response) {
      await onChunk(chunk.response);
    }
  }
}
