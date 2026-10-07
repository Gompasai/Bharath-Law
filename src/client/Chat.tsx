import { PageReviewCard } from './PageReviewCard';
import { pageReviewSchema, pageReviewTool } from '../shared/page-review';
import { contextualMessage, type PageContext } from './page-context';
import { api } from './api';
import type { Page } from '../server/pages';
import { useEffect, useRef, useState } from 'react';
import {
  CopilotChatToolCallsView,
  useRenderTool,
  useHumanInTheLoop,
  useAgent,
  useCopilotKit,
} from '@copilotkit/react-core/v2';
import {
  FilePlus,
  ArrowUp,
  Clock3,
  Link2,
  Paperclip,
  FileText,
  Phone,
  PhoneOff,
  Square,
  X,
} from 'lucide-react';
import {
  ComputerToolCard,
  type ComputerToolRenderProps,
} from './ComputerToolCard';
import { ChatTranscript, isInternalVoiceReceipt } from './ChatTranscript';
import type { CallReceipt, Conversation, Dot } from '../shared/types';
import { Mascot } from './Mascot';
import { useVoice } from './useVoice';
import { CallView } from './CallView';
export function Chat({
  thread,
  dot,
  initialPrompt,
  onConsumed,
  voiceReady,
  calls,
  paused,
  onSaved,
  onSchedule,
  onComputer,
}: {
  thread: Conversation;
  dot: Dot;
  initialPrompt?: string;
  onConsumed: () => void;
  voiceReady: boolean;
  calls: CallReceipt[];
  paused: boolean;
  onSaved: () => void;
  onSchedule: () => void;
  onComputer?: () => void;
}) {
  const { agent, isReady } = useAgent({
    agentId: `chat-${thread.id}`,
    runtimeAgentId: dot.id,
    threadId: thread.id,
  });
  const { copilotkit } = useCopilotKit();
  const [pageContext, setPageContext] = useState<PageContext | null>();
  const [contextError, setContextError] = useState('');
  const [contextAttempt, setContextAttempt] = useState(0);
  const contextReady = pageContext !== undefined;
  useEffect(() => {
    let active = true;
    setPageContext(undefined);
    setContextError('');
    void api<PageContext | null>(
      `/conversations/${thread.id}/page-context`,
      'GET',
      undefined,
      AbortSignal.timeout(10000),
    )
      .then((page) => {
        if (active) setPageContext(page);
      })
      .catch(() => {
        if (active)
          setContextError(
            'Conversation context could not load. Retry before sending your message.',
          );
      });
    return () => {
      active = false;
    };
  }, [thread.id, contextAttempt]);
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [attachment, setAttachment] = useState<{
    name: string;
    size: number;
    text: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 38), 240)}px`;
  }, [draft]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/v1/documents/parse', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(`Document parsing failed: HTTP ${res.status}`);
        const data = (await res.json()) as { text?: string };
        setAttachment({
          name: file.name,
          size: file.size,
          text: data.text || '',
        });
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = (event.target?.result as string) || '';
          setAttachment({
            name: file.name,
            size: file.size,
            text,
          });
          setUploading(false);
        };
        reader.onerror = () => {
          setError('Failed to read document file.');
          setUploading(false);
        };
        reader.readAsText(file);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const voice = useVoice(thread.id, onSaved, agent.messages.at(-1)?.id);
  const sent = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const subscription = copilotkit.subscribe({
      onError: ({ error }) => setError(error.message),
    });
    const events = agent.subscribe({
      onRunErrorEvent: ({ event }) => setError(event.message),
    });
    return () => {
      subscription.unsubscribe();
      events.unsubscribe();
    };
  }, [agent, copilotkit]);
  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void copilotkit
      .connectAgent({ agent })
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Conversation could not connect.',
          );
      });
    return () => {
      active = false;
    };
  }, [agent, copilotkit, isReady]);
  const send = async (text: string) => {
    if (!text.trim() || running || !loaded || !contextReady || paused) return;
    setError('');
    setRunning(true);
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: contextualMessage(text, pageContext),
    });
    setDraft('');
    setSource('');
    setSourceOpen(false);
    try {
      const result = await copilotkit.runAgent({ agent });
      if (!result.newMessages.some((message) => message.role === 'assistant'))
        throw new Error(
          'The current turn returned no response. Check the runtime connection and retry.',
        );
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The turn failed. Your conversation remains saved.',
      );
    } finally {
      setRunning(false);
    }
  };

  const handleSendMessage = () => {
    if (running || !loaded || !contextReady || paused) return;
    const userText = draft.trim();
    if (!userText && !attachment) return;

    const docContext = attachment
      ? `[Attached Case Document: ${attachment.name}]\n` +
        `\`\`\`text\n${attachment.text.slice(0, 10000)}\n\`\`\`\n\n`
      : '';
    const messageToSend =
      userText ||
      'Please analyze this attached case document: identify key parties, legal cause of action, applicable statutory provisions, and strategic advice.';
    const fullMessage = `${source ? `From ${source}:\n\n` : ''}${docContext}${messageToSend}`;

    setAttachment(null);
    setDraft('');
    setSource('');
    setSourceOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    void send(fullMessage);
  };
  useEffect(() => {
    if (loaded && contextReady && !paused && initialPrompt && !sent.current) {
      sent.current = true;
      onConsumed();
      void send(initialPrompt);
    }
  }, [loaded, contextReady, paused, initialPrompt]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, [agent.messages.length, running]);
  useEffect(() => {
    if (paused && voice.status !== 'idle') void voice.end();
  }, [paused]);
  useHumanInTheLoop(
    {
      name: pageReviewTool.name,
      description: pageReviewTool.description,
      parameters: pageReviewSchema,
      render: (props) => (
        <PageReviewCard {...props} threadId={thread.id} onSaved={onSaved} />
      ),
    },
    [thread.id, onSaved],
  );
  const computerCalls = agent.messages.flatMap((message) =>
    message.role === 'assistant' ? (message.toolCalls ?? []) : [],
  );
  const latestBrowserCall = computerCalls.findLast((call) =>
    [
      'navigate',
      'snapshot',
      'read',
      'screenshot',
      'click',
      'type',
      'key',
      'scroll',
    ].some((action) => call.function.name === `computer_${action}`),
  );
  useRenderTool(
    {
      name: '*',
      render: (props: ComputerToolRenderProps) =>
        props.name.startsWith('computer_') ? (
          <ComputerToolCard
            {...props}
            dotId={dot.id}
            dotName={dot.name}
            running={running}
            showScreen={props.toolCallId === latestBrowserCall?.id}
            onExpand={onComputer}
          />
        ) : null,
    },
    [dot.id, dot.name, running, latestBrowserCall?.id, onComputer],
  );
  const visible = agent.messages.filter(
    (message) =>
      !isInternalVoiceReceipt(message) &&
      ['user', 'assistant'].includes(message.role) &&
      ((typeof message.content === 'string' && message.content.trim()) ||
        (message.role === 'assistant' &&
          message.toolCalls?.some(
            (call) =>
              call.function.name.startsWith('computer_') ||
              call.function.name === pageReviewTool.name,
          ))),
  );
  return (
    <div className="live-chat">
      <header className="chat-persona">
        <Mascot
          identity={dot.id}
          name={dot.name}
          small
          state={running ? 'working' : paused ? 'paused' : 'idle'}
        />
        <div>
          <strong>{dot.name}</strong>
          <span>
            {paused
              ? 'Paused'
              : running
                ? 'Thinking…'
                : loaded && contextReady
                  ? 'Here with you'
                  : 'Connecting to your conversation…'}
          </span>
        </div>
        <div className="chat-persona-actions">
          <button
            className="icon-button"
            aria-label="Save conversation as page"
            disabled={running}
            onClick={async () => {
              const title = window.prompt('Page title', thread.title);
              if (!title) return;
              try {
                const page = await api<Page>(
                  `/conversations/${thread.id}/page`,
                  'POST',
                  { title },
                );
                location.hash = `/spaces/${page.spaceId}/pages/${page.id}`;
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'Could not save conversation.',
                );
              }
            }}
          >
            <FilePlus size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Schedule a task in this conversation"
            onClick={onSchedule}
          >
            <Clock3 size={18} />
          </button>
          <button
            className={`icon-button ${voice.status === 'active' ? 'on-call' : ''}`}
            aria-label={
              voice.status === 'idle' ? 'Start voice call' : 'End voice call'
            }
            title={
              voiceReady
                ? 'Talk with your Dot'
                : 'Voice setup requires VOICE_API_KEY and VOICE_MODEL'
            }
            disabled={!voiceReady || paused || !loaded || !contextReady}
            onClick={() =>
              voice.status === 'idle' ? void voice.start() : void voice.end()
            }
          >
            {voice.status === 'idle' ? (
              <Phone size={18} />
            ) : (
              <PhoneOff size={18} />
            )}
          </button>
        </div>
      </header>
      {pageContext && (
        <div className="page-chat-context">
          Working on{' '}
          <a href={`/#/spaces/${pageContext.spaceId}/pages/${pageContext.id}`}>
            {pageContext.title}
          </a>
        </div>
      )}
      <div className="chat-transcript">
        {!visible.length && (
          <div className="chat-welcome">
            <div className="chat-welcome-emblem">⚖️</div>
            <span className="eyebrow">CHAMBERS OF BHARATH LAW · INDIAN LEGAL AI</span>
            <h1>{dot.name}</h1>
            <p className="chat-welcome-subtitle">{dot.instructions}</p>
            <div className="chat-quick-actions">
              <span className="quick-actions-title">Suggested Inquiries & Legal Briefs:</span>
              <div className="quick-action-pills">
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() =>
                    setDraft(
                      'Please provide a comprehensive comparative legal analysis between Section 420 IPC and Section 318(4) BNS 2023, detailing changes in bailability, compoundability, and punishment.',
                    )
                  }
                >
                  ⚖️ Compare BNS vs IPC
                </button>
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() =>
                    setDraft(
                      'Draft an Urgent Anticipatory Bail Application under Section 482 BNSS 2023 before the Sessions Court setting out standard grounds, facts, and legal precedents.',
                    )
                  }
                >
                  📜 Draft Bail Application
                </button>
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() =>
                    setDraft(
                      'Draft a statutory Legal Demand Notice under Section 138 of the Negotiable Instruments Act, 1881 for dishonour of a cheque of INR 10,00,000 with 15-day cure period.',
                    )
                  }
                >
                  📑 Sec 138 NI Act Notice
                </button>
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() =>
                    setDraft(
                      'What are the established Supreme Court parameters and grounds to quash an FIR / Criminal Proceedings under Section 528 BNSS (former Section 482 CrPC)?',
                    )
                  }
                >
                  🏛️ Quash FIR Grounds
                </button>
              </div>
            </div>
            <p className="muted">
              Secure Chambers Consultation · Autonomous Indian Legal AI Intelligence
            </p>
          </div>
        )}
        <ChatTranscript
          messages={visible}
          calls={calls}
          renderTools={(message) => (
            <CopilotChatToolCallsView
              message={message}
              messages={agent.messages}
            />
          )}
        />
        {running && (
          <div className="thinking">
            <span />
            <span />
            <span />
            <span>{dot.name} is thinking</span>
          </div>
        )}
        <div ref={bottom} />
      </div>
      {contextError && (
        <div className="chat-error" role="alert">
          {contextError}
          <button onClick={() => setContextAttempt((value) => value + 1)}>
            Retry context
          </button>
        </div>
      )}
      {(error || voice.error) && (
        <div className="chat-error" role="alert">
          {error || voice.error}
          {error && (
            <button
              onClick={() => {
                setError('');
                void copilotkit
                  .connectAgent({ agent })
                  .then(() => setLoaded(true))
                  .catch((e) => setError(e.message));
              }}
            >
              Reconnect
            </button>
          )}
        </div>
      )}
      <CallView
        key={voice.status === 'idle' ? 'idle' : 'call'}
        dot={dot}
        voice={voice}
      />
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        {attachment && (
          <div
            className="case-attachment-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              margin: '0 12px 8px 12px',
              backgroundColor: 'rgba(212, 175, 55, 0.12)',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}
          >
            <FileText size={16} color="#B8860B" />
            <span style={{ fontWeight: 600, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {attachment.name}
            </span>
            <span style={{ color: '#666', fontSize: '0.78rem' }}>
              ({(attachment.size / 1024).toFixed(1)} KB)
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Remove document"
              onClick={() => setAttachment(null)}
              style={{ marginLeft: 'auto', padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {uploading && (
          <div style={{ margin: '0 12px 8px 12px', fontSize: '0.8rem', color: '#B8860B' }}>
            Extracting text from case document…
          </div>
        )}
        {sourceOpen && (
          <div className="source-input">
            <Link2 size={15} />
            <input
              aria-label="Source page URL"
              type="url"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://example.com/page"
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Remove source"
              onClick={() => {
                setSourceOpen(false);
                setSource('');
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="chat-compose-row">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.txt,.md,.rtf,.json,.csv"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Upload case document"
            title="Upload case document (FIR, Petition, Agreement, Notice)"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={19} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Add source page link"
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            <Link2 size={19} />
          </button>
          <textarea
            ref={textareaRef}
            aria-label="Message your Dot"
            placeholder={`Message ${dot.name}… (Enter to send, Shift+Enter for new line)`}
            rows={1}
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          {running ? (
            <button
              type="button"
              className="send-button"
              aria-label="Stop response"
              onClick={() => copilotkit.stopAgent({ agent })}
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="send-button"
              aria-label="Send message"
              disabled={(!draft.trim() && !attachment) || !loaded || !contextReady || paused}
              onClick={handleSendMessage}
            >
              <ArrowUp size={19} />
            </button>
          )}
        </div>
        <div className="chat-compose-note">
          {voiceReady
            ? 'Text and voice, one conversation.'
            : 'Text is ready. Voice needs separate server configuration.'}
        </div>
      </form>
    </div>
  );
}
