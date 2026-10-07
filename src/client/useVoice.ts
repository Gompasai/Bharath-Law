import { useCallback, useEffect, useRef, useState } from 'react';
import { api, authHeaders } from './api';

type VoiceSession =
  | {
      mode: 'webrtc';
      pc: RTCPeerConnection;
      stream?: MediaStream;
      audio: HTMLAudioElement;
      id?: string;
      channel: RTCDataChannel;
      transcript: string[];
      timer?: ReturnType<typeof setTimeout>;
      cancelled: boolean;
    }
  | {
      mode: 'local';
      id?: string;
      stream?: MediaStream;
      recognition?: any;
      micDenied?: boolean;
      transcript: string[];
      timer?: ReturnType<typeof setTimeout>;
      computeTimer?: ReturnType<typeof setTimeout>;
      cancelled: boolean;
    };

export function useVoice(
  threadId: string,
  onSaved: () => void,
  anchorMessageId?: string,
) {
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'active' | 'ending'
  >('idle');
  const generation = useRef(0);
  const connecting = useRef(false);
  const ending = useRef(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [hasMic, setHasMic] = useState(true);
  const mutedRef = useRef(false);
  const speakerMutedRef = useRef(false);
  const [startedAt, setStartedAt] = useState<number>();
  const [phase, setPhase] = useState<'listening' | 'speaking' | 'thinking'>(
    'listening',
  );
  const [caption, setCaption] = useState('');
  const [userCaption, setUserCaption] = useState('');
  const session = useRef<VoiceSession | undefined>(undefined);
  const anchor = useRef(anchorMessageId);
  anchor.current = anchorMessageId;

  const closeMedia = useCallback(() => {
    const current = session.current;
    if (!current) return;
    current.cancelled = true;
    current.stream?.getTracks().forEach((track) => track.stop());
    clearTimeout(current.timer);

    if (current.mode === 'webrtc') {
      current.channel.close();
      current.pc.close();
      current.audio.pause();
      current.audio.srcObject = null;
    } else {
      clearTimeout(current.computeTimer);
      if (current.recognition) {
        try {
          current.recognition.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, []);

  const end = useCallback(async () => {
    if (ending.current) return;
    generation.current++;
    connecting.current = false;
    const current = session.current;
    if (!current) {
      setStatus('idle');
      return;
    }

    current.cancelled = true;
    current.stream?.getTracks().forEach((track) => {
      track.enabled = false;
    });
    if (current.mode === 'webrtc') {
      current.audio.pause();
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(current.timer);
    ending.current = true;
    setStatus('ending');

    try {
      if (current.id) {
        const transcriptText = current.transcript.join('\n').slice(0, 20000);
        await api(`/voice/calls/${current.id}/end`, 'POST', {
          transcript: transcriptText,
          anchorMessageId: anchor.current,
        });
      }
      onSaved();
    } catch (e) {
      console.warn('Call end error:', e);
    } finally {
      closeMedia();
      session.current = undefined;
      ending.current = false;
      setStatus('idle');
    }
  }, [closeMedia, onSaved]);

  useEffect(
    () => () => {
      generation.current++;
      const current = session.current;
      closeMedia();
      if (current?.id && !ending.current) {
        const transcriptText = current.transcript.join('\n').slice(0, 20000);
        void fetch(`/api/voice/calls/${current.id}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            transcript: transcriptText,
            anchorMessageId: anchor.current,
          }),
          keepalive: true,
        }).catch(() => {});
      }
    },
    [closeMedia],
  );

  useEffect(() => {
    if (status !== 'active') return;
    let failedPolls = 0;
    const timer = setInterval(() => {
      const current = session.current;
      const id = current?.id;
      if (id)
        void api<{ endedAt: number | null }>(`/voice/calls/${id}`)
          .then((call) => {
            failedPolls = 0;
            if (session.current === current && call.endedAt) void end();
          })
          .catch(() => {
            if (session.current !== current) return;
            failedPolls++;
            if (failedPolls >= 4) {
              void end();
            }
          });
    }, 3000);
    return () => clearInterval(timer);
  }, [status, closeMedia, onSaved, end]);

  const sendMessage = useCallback(async (text: string) => {
    const current = session.current;
    if (!text.trim() || !current || current.cancelled) return;
    const callId = current.id;
    if (!callId) return;

    current.transcript.push(`You: ${text}`);
    setUserCaption(text);
    setPhase('thinking');
    setCaption('');
    setError('');

    try {
      const res = await api<{ text: string }>(
        `/voice/calls/${callId}/compute`,
        'POST',
        {
          toolCallId: `voice-${Date.now()}`,
          request: text,
          transcript: current.transcript.slice(-6).join('\n'),
        },
      );
      if (current.cancelled) return;
      const agentReply = res.text;
      current.transcript.push(`Dot: ${agentReply}`);
      setCaption(agentReply);
      setPhase('speaking');

      if ('speechSynthesis' in window && !speakerMutedRef.current) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(agentReply);
        utterance.lang = navigator.language || 'en-US';
        utterance.rate = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Neural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Zira') ||
              v.name.includes('Jenny')),
        );
        if (matchedVoice) utterance.voice = matchedVoice;

        utterance.onend = () => {
          if (!current.cancelled) setPhase('listening');
        };
        utterance.onerror = () => {
          if (!current.cancelled) setPhase('listening');
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => {
          if (!current.cancelled) setPhase('listening');
        }, 2500);
      }
    } catch (err) {
      if (!current.cancelled) {
        setError(
          err instanceof Error ? err.message : 'Compute turn failed.',
        );
        setPhase('listening');
      }
    }
  }, []);

  const start = async () => {
    if (session.current || connecting.current || ending.current) return;
    connecting.current = true;
    const attempt = ++generation.current;
    setStatus('connecting');
    setError('');
    setMuted(false);
    mutedRef.current = false;
    setSpeakerMuted(false);
    speakerMutedRef.current = false;
    setHasMic(true);
    setStartedAt(undefined);
    setPhase('listening');
    setCaption('');
    setUserCaption('');
    let stream: MediaStream | undefined;

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (mediaErr) {
          console.warn('Microphone permission not granted or device missing:', mediaErr);
          setHasMic(false);
        }
      } else {
        setHasMic(false);
      }

      if (attempt !== generation.current) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      const response = await api<{ id: string; sdp?: string; mode?: string }>(
        '/voice/calls',
        'POST',
        { threadId, sdp: 'local' },
      );

      if (attempt !== generation.current) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      // Mark call as active on backend
      await api(`/voice/calls/${response.id}/active`, 'POST', {}).catch(() => {});

      // Midearth In-House Voice Engine
      const current: VoiceSession = {
        mode: 'local',
        id: response.id,
        stream,
        transcript: [],
        cancelled: false,
        timer: undefined,
        computeTimer: undefined,
      };
      session.current = current;

      setStatus('active');
      setStartedAt(Date.now());
      setPhase('listening');

      // Browser-native speech recognition if supported
      const SpeechRecognitionClass =
        typeof window !== 'undefined'
          ? (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition
          : null;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = navigator.language || 'en-US';
          current.recognition = recognition;

          let accumulatedFinal = '';

          recognition.onresult = (event: any) => {
            if (current.cancelled) return;
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                accumulatedFinal += ' ' + res[0].transcript;
              } else {
                interim += res[0].transcript;
              }
            }
            const currentPreview = (accumulatedFinal + ' ' + interim).trim();
            if (currentPreview) {
              setUserCaption(currentPreview);
              setPhase('listening');
              clearTimeout(current.computeTimer);
              current.computeTimer = setTimeout(() => {
                const toSend = accumulatedFinal.trim() || currentPreview;
                accumulatedFinal = '';
                void sendMessage(toSend);
              }, 1200);
            }
          };

          recognition.onerror = (e: any) => {
            if (current.cancelled) return;
            if (
              e.error === 'not-allowed' ||
              e.error === 'service-not-allowed' ||
              e.error === 'audio-capture'
            ) {
              current.micDenied = true;
              setHasMic(false);
              console.warn('Speech recognition access denied or not available:', e.error);
            } else if (e.error !== 'no-speech') {
              console.warn('Speech recognition status:', e.error);
            }
          };

          recognition.onend = () => {
            if (!current.cancelled && !mutedRef.current && !current.micDenied) {
              try {
                recognition.start();
              } catch {
                // Already active
              }
            }
          };

          try {
            recognition.start();
          } catch (err) {
            console.warn('Recognition start caught:', err);
          }
        } catch (recognitionInitErr) {
          console.warn('Speech recognition init error:', recognitionInitErr);
          setHasMic(false);
        }
      } else {
        setHasMic(false);
      }

      current.timer = setTimeout(() => void end(), 15 * 60_000);
    } catch (e) {
      if (attempt !== generation.current) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      const current = session.current;
      const id = current?.id;
      if (id)
        void api(`/voice/calls/${id}/end`, 'POST', {
          transcript: '',
          anchorMessageId: anchor.current,
        }).catch(() => {});
      stream?.getTracks().forEach((track) => track.stop());
      closeMedia();
      session.current = undefined;
      setStatus('idle');
      setError(e instanceof Error ? e.message : 'Could not connect the call.');
    } finally {
      if (attempt === generation.current) connecting.current = false;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    const current = session.current;
    if (current) {
      current.stream?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      if (current.mode === 'local' && current.recognition) {
        if (next) {
          try {
            current.recognition.stop();
          } catch {}
        } else if (!current.micDenied) {
          try {
            current.recognition.start();
          } catch {}
        }
      }
    }
  };

  const toggleSpeaker = () => {
    const next = !speakerMuted;
    speakerMutedRef.current = next;
    setSpeakerMuted(next);
    const current = session.current;
    if (current) {
      if (current.mode === 'webrtc') {
        current.audio.muted = next;
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && next) {
        window.speechSynthesis.cancel();
      }
    }
  };

  return {
    status,
    error,
    start,
    end,
    muted,
    speakerMuted,
    hasMic,
    startedAt,
    phase,
    caption,
    userCaption,
    toggleMute,
    toggleSpeaker,
    sendMessage,
  };
}
