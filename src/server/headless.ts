import { IntelligenceAgent } from '@copilotkit/core';
import type { Message } from '@ag-ui/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { voiceReceiptMessagePrefix } from '../shared/voice-receipt.js';

export function currentTurnText(messages: Message[], error?: Error): string {
  if (error) throw error;
  const content = messages
    .filter((message) => message.role === 'assistant')
    .at(-1)?.content;
  if (typeof content !== 'string' || !content.trim())
    throw new Error('The current compute turn returned no assistant response.');
  return content;
}

const runtimeInfoSchema = z.object({
  mode: z.string().optional(),
  intelligence: z.object({ wsUrl: z.string().optional() }).optional(),
  agents: z.record(z.string(), z.unknown()),
});

export async function runThreadTurn(
  runtimeUrl: string,
  headers: Record<string, string>,
  dotId: string,
  threadId: string,
  prompt: string,
  signal: AbortSignal,
  metadata?: Record<string, unknown>,
): Promise<string> {
  signal.throwIfAborted();
  const response = await fetch(`${runtimeUrl}/info`, { headers, signal });
  if (!response.ok)
    throw new Error(`Intelligence runtime returned HTTP ${response.status}.`);
  const info = runtimeInfoSchema.parse(await response.json());
  if (!Object.hasOwn(info.agents, dotId))
    throw new Error('The selected Dot is unavailable in the runtime.');

  // If running in local / self-hosted mode (no CopilotKit Cloud WebSocket)
  if (info.mode !== 'intelligence' || !info.intelligence?.wsUrl) {
    const runRes = await fetch(`${runtimeUrl}/agent/${dotId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        threadId,
        runId: randomUUID(),
        state: {},
        messages: [
          {
            id: `${metadata?.opendotsSource === 'voice_receipt' ? voiceReceiptMessagePrefix : ''}${randomUUID()}`,
            role: 'user',
            content: prompt,
            ...(metadata ? { metadata } : {}),
          },
        ],
        tools: [],
        context: [],
        forwardedProps: {},
      }),
      signal,
    });
    if (!runRes.ok)
      throw new Error(`Agent run failed with HTTP ${runRes.status}`);

    const reader = runRes.body?.getReader();
    if (!reader) throw new Error('No response stream from agent');
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let runErrorText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            if (
              data.type === 'TEXT_MESSAGE_CONTENT' ||
              data.type === 'TEXT_MESSAGE_CHUNK'
            ) {
              if (typeof data.delta === 'string') accumulatedText += data.delta;
            } else if (data.type === 'RUN_ERROR') {
              runErrorText = data.message || 'Run error';
            }
          } catch {
            // ignore non-json
          }
        }
      }
    }
    if (runErrorText && !accumulatedText.trim()) throw new Error(runErrorText);
    if (!accumulatedText.trim())
      throw new Error('The current compute turn returned no assistant response.');
    return accumulatedText.trim();
  }

  // Core's runtime discovery is browser-only. Use the SDK's Node-compatible
  // Intelligence agent for voice compute and scheduled server turns.
  const agent = new IntelligenceAgent({
    url: info.intelligence.wsUrl,
    runtimeUrl,
    agentId: dotId,
    headers,
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
      }),
  });
  agent.threadId = threadId;
  let runError: Error | undefined;
  const subscription = agent.subscribe({
    onRunErrorEvent: ({ event }) => {
      runError = new Error(event.message);
    },
  });
  const stop = () => agent.abortRun();
  signal.addEventListener('abort', stop, { once: true });
  try {
    signal.throwIfAborted();
    agent.addMessage({
      id: `${metadata?.opendotsSource === 'voice_receipt' ? voiceReceiptMessagePrefix : ''}${randomUUID()}`,
      role: 'user',
      content: prompt,
      ...(metadata ? { metadata } : {}),
    });
    const result = await agent.runAgent();
    signal.throwIfAborted();
    return currentTurnText(result.newMessages, runError);
  } finally {
    signal.removeEventListener('abort', stop);
    subscription.unsubscribe();
    await agent.detachActiveRun();
  }
}
