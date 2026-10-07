import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Maximize2,
  Send,
} from 'lucide-react';
import { Mascot } from './Mascot';
import type { Dot } from '../shared/types';
import type { useVoice } from './useVoice';

export function CallView({
  dot,
  voice,
}: {
  dot: Dot;
  voice: ReturnType<typeof useVoice>;
}) {
  const [minimized, setMinimized] = useState(false);
  const [talkInput, setTalkInput] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (voice.status !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [voice.status]);

  if (voice.status === 'idle') return null;

  const seconds = voice.startedAt
    ? Math.max(0, Math.floor((now - voice.startedAt) / 1000))
    : 0;
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const label =
    voice.status === 'connecting'
      ? 'Connecting…'
      : voice.status === 'ending'
        ? 'Saving call…'
        : voice.muted
          ? 'Microphone muted'
          : voice.phase === 'speaking'
            ? `${dot.name} is speaking`
            : voice.phase === 'thinking'
              ? 'Working on it…'
              : 'Listening';

  const handleSpeak = (text?: string) => {
    const query = (text ?? talkInput).trim();
    if (!query) return;
    void voice.sendMessage(query);
    if (!text) setTalkInput('');
  };

  return (
    <section
      className={`call-view ${minimized ? 'minimized' : ''}`}
      aria-label={`Voice call with ${dot.name}`}
    >
      <div className="call-heading">
        <span>
          <span className="call-live-dot" /> Voice call
        </span>
        <button
          className="call-minimize"
          aria-label={minimized ? 'Expand call view' : 'Minimize call view'}
          onClick={() => setMinimized(!minimized)}
        >
          {minimized ? <Maximize2 size={18} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className={`call-persona ${voice.phase}`}>
        <Mascot identity={dot.id} name={dot.name} />
        <h2>{dot.name}</h2>
        <span className="call-timer" aria-label="Call duration">
          {duration}
        </span>
        <p role="status">{label}</p>
      </div>

      {!minimized && (
        <div className="call-caption" aria-live="polite">
          {voice.userCaption && (
            <p className="call-user-caption">
              <small>You</small>
              {voice.userCaption}
            </p>
          )}
          <p>
            <small>{dot.name}</small>
            {voice.caption || 'Speak naturally, or use the prompt bar below.'}
          </p>
        </div>
      )}

      {!minimized && voice.status === 'active' && (
        <div className="call-speak-bar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSpeak();
            }}
            className="call-speak-form"
          >
            <input
              type="text"
              placeholder="Say or type to Dot..."
              value={talkInput}
              onChange={(e) => setTalkInput(e.target.value)}
              disabled={voice.phase === 'thinking'}
              aria-label="Speak or send text into voice call"
            />
            <button
              type="submit"
              disabled={!talkInput.trim() || voice.phase === 'thinking'}
              className="call-speak-submit"
              aria-label="Send to Dot"
            >
              <Send size={15} />
              <span>Talk</span>
            </button>
          </form>
          <div className="call-quick-prompts">
            <button
              type="button"
              onClick={() => handleSpeak('Hello Dot! How are you today?')}
              disabled={voice.phase === 'thinking'}
            >
              "Hello Dot!"
            </button>
            <button
              type="button"
              onClick={() => handleSpeak('What can you help me with?')}
              disabled={voice.phase === 'thinking'}
            >
              "What can you do?"
            </button>
            <button
              type="button"
              onClick={() => handleSpeak('Tell me a short thought or idea.')}
              disabled={voice.phase === 'thinking'}
            >
              "Share an idea"
            </button>
          </div>
        </div>
      )}

      {voice.error && (
        <p className="call-warning" role="alert">
          {voice.error}
        </p>
      )}

      <div className="call-controls">
        <button
          aria-label={
            voice.speakerMuted ? 'Enable call audio' : 'Mute call audio'
          }
          aria-pressed={voice.speakerMuted}
          onClick={voice.toggleSpeaker}
          disabled={voice.status !== 'active'}
        >
          <span>{voice.speakerMuted ? <VolumeX /> : <Volume2 />}</span>
          <small>Speaker</small>
        </button>
        <button
          className="call-end"
          aria-label="End voice call"
          onClick={() => void voice.end()}
          disabled={voice.status === 'ending'}
        >
          <span>
            <PhoneOff />
          </span>
          <small>End</small>
        </button>
        <button
          aria-label={voice.muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={voice.muted}
          onClick={voice.toggleMute}
          disabled={voice.status !== 'active'}
        >
          <span>{voice.muted ? <MicOff /> : <Mic />}</span>
          <small>{voice.muted ? 'Unmute' : 'Mute'}</small>
        </button>
      </div>

      {!minimized && (
        <p className="call-footer">Text and voice share this conversation</p>
      )}
    </section>
  );
}
