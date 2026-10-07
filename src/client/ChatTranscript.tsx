import { openPageLink } from './page-navigation';
import { Fragment, useState, type ReactNode } from 'react';
import { PhoneOff, Scale, Copy, Check, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { AssistantMessage, Message } from '@ag-ui/core';
import type { CallReceipt } from '../shared/types';
import { voiceReceiptMessagePrefix } from '../shared/voice-receipt';

// These markers only control rendering; they do not confer trust or permissions.
export function isInternalVoiceReceipt(message: Message): boolean {
  const metadata = message.metadata;
  return (
    message.role === 'user' &&
    (message.id.startsWith(voiceReceiptMessagePrefix) ||
      (!!metadata &&
        typeof metadata === 'object' &&
        'opendotsSource' in metadata &&
        metadata.opendotsSource === 'voice_receipt'))
  );
}

function Receipt({ call }: { call: CallReceipt }) {
  return (
    <div className="call-receipt">
      <PhoneOff size={13} />
      <span>
        {call.status === 'failed'
          ? 'Call failed'
          : call.endedAt
            ? `${Math.round((call.endedAt - call.startedAt) / 1000)}s · Call ended`
            : 'Call in progress'}
      </span>
      {call.error && <small>{call.error}</small>}
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="chat-bubble assistant">
      <div className="counsel-card-header">
        <div className="counsel-identity">
          <div className="counsel-emblem-badge" aria-hidden="true">
            <Scale size={14} />
          </div>
          <div className="counsel-details">
            <span className="counsel-name">Bharath Law Counsel</span>
            <span className="counsel-title-badge">Verified Legal AI</span>
          </div>
        </div>
        <button
          type="button"
          className="counsel-copy-button"
          onClick={handleCopy}
          title="Copy legal advisory"
          aria-label="Copy legal advisory"
        >
          {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="counsel-card-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            table: ({ children }) => (
              <div className="legal-table-container">
                <table className="legal-table">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="legal-th">{children}</th>,
            td: ({ children }) => <td className="legal-td">{children}</td>,
            img: ({ alt }) => <span>{alt}</span>,
            a: ({ href, children }) => (
              <a
                onClick={(event) => {
                  if (href?.startsWith('/#/spaces/')) {
                    event.preventDefault();
                    openPageLink(href);
                  }
                }}
                href={href}
                target={href?.startsWith('/#/spaces/') ? undefined : '_blank'}
                rel="noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  const [showExtracted, setShowExtracted] = useState(false);
  const match = content.match(
    /\[Attached Case Document:\s*([^\]]+)\]\s*```text\n([\s\S]*?)\n```\s*\n\n?([\s\S]*)$/,
  );

  let docName = '';
  let docText = '';
  let displayMessage = content;

  if (match) {
    docName = match[1].trim();
    docText = match[2];
    displayMessage = match[3].trim() || 'Please analyze this attached case document.';
  }

  return (
    <div className="chat-bubble user">
      {docName ? (
        <div className="user-attached-card">
          <div className="attached-card-header">
            <FileText size={15} color="#d4af37" />
            <span className="attached-filename">{docName}</span>
            <span className="attached-badge">Case Docket Attached</span>
          </div>
          {docText && (
            <div className="attached-toggle-wrap">
              <button
                type="button"
                className="attached-toggle-btn"
                onClick={() => setShowExtracted(!showExtracted)}
              >
                {showExtracted
                  ? '▲ Hide extracted text'
                  : `▼ View extracted text (${Math.round(docText.length / 5)} words)`}
              </button>
              {showExtracted && (
                <div className="attached-preview-box">
                  <pre>{docText.slice(0, 4000)}{docText.length > 4000 ? '\n\n...[remaining text truncated in preview]' : ''}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      ) : content.includes('[Attached Case Document:') ? (
        <div className="user-attached-badge">
          <FileText size={13} />
          <span>Case Document Included</span>
        </div>
      ) : null}
      <div className="user-bubble-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            table: ({ children }) => (
              <div className="legal-table-container">
                <table className="legal-table">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="legal-th">{children}</th>,
            td: ({ children }) => <td className="legal-td">{children}</td>,
            img: ({ alt }) => <span>{alt}</span>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {displayMessage}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function ChatTranscript({
  messages,
  calls,
  renderTools,
}: {
  messages: Message[];
  calls: CallReceipt[];
  renderTools?: (message: AssistantMessage) => ReactNode;
}) {
  const ids = new Set(messages.map((message) => message.id));
  return (
    <>
      {calls
        .filter(
          (call) => !call.anchorMessageId || !ids.has(call.anchorMessageId),
        )
        .map((call) => (
          <Receipt key={call.id} call={call} />
        ))}
      {messages.map((message) => (
        <Fragment key={message.id}>
          {typeof message.content === 'string' && message.content.trim() && (
            message.role === 'assistant' ? (
              <AssistantBubble content={String(message.content)} />
            ) : (
              <UserBubble content={String(message.content)} />
            )
          )}
          {message.role === 'assistant' && renderTools?.(message)}
          {calls
            .filter((call) => call.anchorMessageId === message.id)
            .map((call) => (
              <Receipt key={call.id} call={call} />
            ))}
        </Fragment>
      ))}
    </>
  );
}
