import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Platform } from './platform.js';
import type { WorkspaceStore } from './workspace.js';
import type { Store } from './store.js';

export function agentGateway(
  platform: Platform,
  workspace: WorkspaceStore,
  store: Store,
) {
  const app = new Hono();

  // CORS middleware for universal multi-platform access
  app.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-API-Key, Accept',
    );
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }
    await next();
  });

  // 1. List available Bharath Law Chambers Agents
  app.get('/agents', (c) => {
    const dots = workspace.dots().map((d) => ({
      id: d.id,
      name: d.name,
      instructions: d.instructions,
      memoryAllowed: d.memoryAllowed,
      researchAllowed: d.researchAllowed,
    }));
    return c.json({
      platform: 'Bharath Law',
      version: '1.0.0',
      agents: dots,
    });
  });

  // 2. Multi-Platform Chat Endpoint (Harness + Persistent + Concise Layer)
  app.post('/agent/:dotId/chat', async (c) => {
    const dotId = c.req.param('dotId');
    const dot = workspace.dot(dotId);
    if (!dot) {
      return c.json(
        {
          error: `Agent '${dotId}' not found. Check GET /api/v1/agents for valid IDs.`,
        },
        404,
      );
    }

    const body = z
      .object({
        prompt: z.string().trim().min(1).max(8000),
        threadId: z.string().optional(),
        concise: z.boolean().default(true),
      })
      .safeParse(await c.req.json().catch(() => ({})));

    if (!body.success) {
      return c.json(
        { error: 'Invalid request: prompt is required (1-8000 characters).' },
        400,
      );
    }

    const { prompt, concise } = body.data;
    let threadId = body.data.threadId;

    // Persistence Layer: Bind thread if not present
    if (!threadId) {
      threadId = randomUUID();
      workspace.bindThread(
        threadId,
        dot.id,
        prompt.slice(0, 50) || 'External Platform Conversation',
      );
    } else {
      const existing = workspace.conversations().find((t) => t.id === threadId);
      if (!existing) {
        workspace.bindThread(
          threadId,
          dot.id,
          prompt.slice(0, 50) || 'External Platform Conversation',
        );
      }
    }

    // Concise Layer: inject concise instructions if requested
    const formattedPrompt = concise
      ? `${prompt}\n\n[Concise Mode Directive: Deliver a concise, direct, and actionable answer. Avoid unnecessary preamble.]`
      : prompt;

    // Record user message in SQLite persistence
    workspace.addMessage(threadId, 'user', prompt);

    const startTime = Date.now();
    try {
      const signal = AbortSignal.timeout(90_000);
      const response = await platform.turn(threadId, formattedPrompt, signal);

      // Record agent response in SQLite persistence
      workspace.addMessage(threadId, 'assistant', response);

      const latencyMs = Date.now() - startTime;
      return c.json({
        threadId,
        agent: {
          id: dot.id,
          name: dot.name,
        },
        response,
        metrics: {
          latencyMs,
          concise,
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Agent invocation failed.',
          threadId,
          latencyMs,
        },
        500,
      );
    }
  });

  // 3. OpenAI-Compatible Chat Completions Endpoint
  // Allows LangChain, LlamaIndex, Cursor, AutoGen, CrewAI, and OpenAI SDK to connect natively!
  app.post('/chat/completions', async (c) => {
    const data = await c.req.json().catch(() => ({}));
    const modelParam = data.model || 'bharath-law';
    const messages = Array.isArray(data.messages) ? data.messages : [];

    const lastUserMessage = [...messages]
      .reverse()
      .find((m: any) => m.role === 'user')?.content;

    if (!lastUserMessage || typeof lastUserMessage !== 'string') {
      return c.json(
        { error: { message: 'A user message is required in messages array.' } },
        400,
      );
    }

    // Match dot by name or ID, or default to initial dot
    const dots = workspace.dots();
    const matchedDot =
      dots.find(
        (d) =>
          d.id === modelParam ||
          d.name.toLowerCase().includes(String(modelParam).toLowerCase()) ||
          d.name.toLowerCase().replace(/\s+/g, '-') ===
            String(modelParam).toLowerCase(),
      ) || dots[0];

    const threadId = randomUUID();
    workspace.bindThread(
      threadId,
      matchedDot.id,
      lastUserMessage.slice(0, 50) || 'API Conversation',
    );
    workspace.addMessage(threadId, 'user', lastUserMessage);

    const startTime = Date.now();
    try {
      const signal = AbortSignal.timeout(90_000);
      const response = await platform.turn(threadId, lastUserMessage, signal);
      workspace.addMessage(threadId, 'assistant', response);

      return c.json({
        id: `chatcmpl-${randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(startTime / 1000),
        model: matchedDot.name,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: lastUserMessage.length,
          completion_tokens: response.length,
          total_tokens: lastUserMessage.length + response.length,
        },
      });
    } catch (err) {
      return c.json(
        {
          error: {
            message:
              err instanceof Error ? err.message : 'Compute turn failed.',
            type: 'server_error',
          },
        },
        500,
      );
    }
  });

  // 4. Case Document Text Extractor (PDF, TXT, MD, CSV, JSON)
  app.post('/documents/parse', async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let filename = 'document.txt';
      let buffer: Buffer;

      if (contentType.includes('multipart/form-data')) {
        const body = await c.req.parseBody();
        const file = body['file'];
        if (!file || typeof file === 'string') {
          return c.json({ error: 'No file provided in form-data' }, 400);
        }
        filename = (file as any).name || 'document';
        const arrayBuffer = await (file as any).arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        const json = await c.req.json().catch(() => ({}));
        filename = json.filename || 'document.txt';
        if (json.base64) {
          buffer = Buffer.from(json.base64, 'base64');
        } else if (json.text) {
          return c.json({
            filename,
            size: json.text.length,
            text: json.text,
            charCount: json.text.length,
          });
        } else {
          return c.json(
            { error: 'Provide a multipart file or base64/text in JSON' },
            400,
          );
        }
      }

      let extractedText = '';
      if (filename.toLowerCase().endsWith('.pdf')) {
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        extractedText = result || '';
        await parser.destroy().catch(() => {});
      } else {
        extractedText = buffer.toString('utf-8');
      }

      return c.json({
        filename,
        size: buffer.length,
        text: extractedText.trim(),
        charCount: extractedText.length,
      });
    } catch (err) {
      return c.json(
        {
          error:
            err instanceof Error
              ? err.message
              : 'Failed to extract text from document.',
        },
        500,
      );
    }
  });

  return app;
}
