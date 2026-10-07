import { ComputerService } from './computer-service.js';
import { PageService } from './page-service.js';
import { randomUUID } from 'node:crypto';
import {
  CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotHonoHandler,
  type CopilotHonoApp,
} from '@copilotkit/runtime/v2';
import { createSlackChannel } from './slack-channel.js';
export { slackIdentity } from './slack-channel.js';
import { Store } from './store.js';
import { WorkspaceStore } from './workspace.js';
import { DotAgent } from './dot-agent.js';
import { runThreadTurn } from './headless.js';
import { setupStatus, type PlatformConfig } from './platform-config.js';
import { validateRuntimeScope } from './runtime-scope.js';
import { learningSelector } from './learning.js';
export class Platform {
  private channelStartupFailed = false;
  readonly pages: PageService;
  readonly computers: ComputerService;
  readonly intelligence?: CopilotKitIntelligence;
  readonly handler?: CopilotHonoApp;
  constructor(
    readonly store: Store,
    readonly workspace: WorkspaceStore,
    readonly config: PlatformConfig,
  ) {
    this.computers = new ComputerService(
      workspace,
      config,
      () => store.settings().paused,
    );
    this.pages = new PageService(workspace, () => {
      this.requireReady();
      if (this.intelligence) return this.intelligence;
      return {
        getOrCreateThread: async (input) => {
          return this.workspace.bindThread(input.threadId, input.agentId, input.name);
        },
        getThreadMessages: async (input) => {
          const messages = this.workspace.threadMessages(input.threadId);
          return { messages };
        },
      };
    });
    if (config.intelligenceKey && config.intelligenceKey !== 'local' && !config.intelligenceKey.startsWith('ck_pub_')) {
      try {
        this.intelligence = new CopilotKitIntelligence({
          apiKey: config.intelligenceKey,
          apiUrl: config.intelligenceApiUrl,
          wsUrl: config.intelligenceWsUrl,
          getLearningContainerId: learningSelector(
            workspace,
            config.slackDotId ?? workspace.dots()[0]?.id,
          ),
        });
      } catch {
        this.intelligence = undefined;
      }
    }
    const channels = [];
    if (config.slackChannel && config.slackTeam && config.slackUsers.length && this.intelligence) {
      const dotId = config.slackDotId ?? workspace.dots()[0].id;
      if (!workspace.dot(dotId))
        throw new Error('SLACK_DOT_ID does not identify an existing Dot.');
      const slack = createSlackChannel({
        name: config.slackChannel,
        config,
        ownerId: workspace.ownerId,
        paused: () => store.settings().paused,
        agent: () => new DotAgent(store, workspace, config, dotId, true),
      });
      channels.push(slack);
    }
    const agents = async () =>
      Object.fromEntries(
        workspace
          .dots()
          .map((dot) => [
            dot.id,
            new DotAgent(store, workspace, config, dot.id),
          ]),
      );
    const runtime = this.intelligence
      ? new CopilotRuntime({
          intelligence: this.intelligence,
          identifyUser: async () => ({
            id: workspace.ownerId,
            name: 'Midearth Labs owner',
          }),
          agents,
          channels,
          generateThreadNames: true,
        })
      : new CopilotRuntime({
          agents,
        });
    this.handler = createCopilotHonoHandler({
      runtime,
      basePath: '/api/copilotkit',
      cors: { origin: [] },
    });
  }
  setup() {
    return setupStatus(
      this.config,
      this.handler?.channels?.status().overall ??
        (this.config.slackChannel ? 'setup_required' : 'not_configured'),
      this.channelStartupFailed,
    );
  }
  requireReady() {
    const missing = this.setup().missing;
    if (missing.length)
      throw new Error(
        `Setup required: ${missing.join(', ')}.`,
      );
  }
  async start() {
    if (this.handler?.channels) {
      try {
        await this.handler.channels.ready({ timeoutMs: 15000 });
        this.channelStartupFailed = false;
      } catch (error) {
        this.channelStartupFailed = true;
        throw error;
      }
    }
  }
  async stop() {
    await this.handler?.channels?.stop();
  }
  async createConversation(dotId: string, title: string) {
    this.requireReady();
    if (!this.workspace.dot(dotId)) throw new Error('Dot not found.');
    const id = randomUUID();
    if (this.intelligence) {
      try {
        await this.intelligence.createThread({
          threadId: id,
          userId: this.workspace.ownerId,
          agentId: dotId,
          name: title,
        });
      } catch {
        // Fallback to local SQLite thread persistence
      }
    }
    return this.workspace.bindThread(id, dotId, title);
  }
  async history(threadId: string): Promise<string> {
    this.requireReady();
    this.workspace.requireThread(threadId);
    if (this.intelligence) {
      try {
        const history = await this.intelligence.getThreadMessages({
          threadId,
          userId: this.workspace.ownerId,
        });
        return history.messages
          .filter((message) => ['user', 'assistant'].includes(message.role))
          .slice(-12)
          .map(
            (message) =>
              `${message.role}: ${typeof message.content === 'string' ? message.content : ''}`,
          )
          .join('\n')
          .slice(-12000);
      } catch {
        // Fallback to local messages
      }
    }
    const messages = this.workspace.threadMessages(threadId);
    return messages
      .filter((message) => ['user', 'assistant'].includes(message.role))
      .slice(-12)
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
      .slice(-12000);
  }
  async handle(request: Request): Promise<Response> {
    if (!this.handler)
      return Response.json(
        { error: 'Setup required: Handler not initialized.' },
        { status: 503 },
      );
    let body: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD')
      body = await request
        .clone()
        .json()
        .catch(() => null);
    try {
      validateRuntimeScope(request, this.workspace, body);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Conversation scope denied.',
        },
        { status: 403 },
      );
    }
    return this.handler.fetch(request);
  }
  async turn(
    threadId: string,
    prompt: string,
    signal: AbortSignal,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    this.requireReady();
    const thread = this.workspace.requireThread(threadId);
    return runThreadTurn(
      this.config.runtimeUrl,
      this.config.ownerToken
        ? { Authorization: `Bearer ${this.config.ownerToken}` }
        : {},
      thread.dotId,
      threadId,
      prompt,
      signal,
      metadata,
    );
  }
}
