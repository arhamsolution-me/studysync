import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X, Send, Sparkles } from 'lucide-react';
import { voiceApi } from '../services/api';
import toast from 'react-hot-toast';
import TaskModal from './TaskModal';

interface VoiceModalProps {
  onClose: () => void;
  onSaved: () => void;
}

type VoiceState = 'idle' | 'recording' | 'processing' | 'preview';

export default function VoiceModal({ onClose, onSaved }: VoiceModalProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [extractedTask, setExtractedTask] = useState<any>(null);
  const [textCommand, setTextCommand] = useState('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSilenceDetected, setIsSilenceDetected] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioVisualizer();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopAudioVisualizer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setIsSilenceDetected(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsSilenceDetected(false);

      let hasSpoken = false;

      // Setup Web Audio API volume listener & Silence Detection
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(level);

            // Auto-Stop Silence Detection
            if (level > 12) {
              hasSpoken = true;
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
                setIsSilenceDetected(false);
              }
            } else if (hasSpoken && level <= 6) {
              // User has stopped speaking: wait 1.4s of silence then auto-send!
              if (!silenceTimerRef.current) {
                setIsSilenceDetected(true);
                silenceTimerRef.current = setTimeout(() => {
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    stopRecording();
                  }
                }, 1400);
              }
            }
          }
          animFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (audioErr) {
        console.warn('AudioContext volume metering not supported:', audioErr);
      }

      // Pick supported mime type
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stopAudioVisualizer();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'audio/webm' });
        if (blob.size < 500) {
          toast.error('No voice detected. Please speak louder into your microphone.');
          setState('idle');
          return;
        }
        await processAudio(blob);
      };

      // Collect audio chunks every 250ms
      recorder.start(250);
      setState('recording');

      // Auto-stop after 30 seconds max
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 30000);
    } catch {
      toast.error('Microphone access denied — please allow mic access in your browser settings.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('processing');
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      setState('processing');
      const { data } = await voiceApi.capture(blob);

      setTranscript(data.data.transcript || '');

      if (data.data.extracted && data.data.extracted.title) {
        setExtractedTask(data.data.extracted);
        setState('preview');
      } else {
        toast(data.message || 'Could not extract task details — please try again or type below.', {
          icon: '🎤',
        });
        setState('idle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Voice processing failed. Try typing your task below.');
      setState('idle');
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textCommand.trim()) return;

    try {
      setState('processing');
      const { data } = await voiceApi.textCommand(textCommand.trim());

      setTranscript(textCommand.trim());
      if (data.data?.extracted && data.data.extracted.title) {
        setExtractedTask(data.data.extracted);
        setState('preview');
      } else {
        toast.error('Could not extract task details. Please check title or deadline.');
        setState('idle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Processing failed. Try again.');
      setState('idle');
    }
  };

  // If we have extracted data, show the TaskModal for review
  if (state === 'preview' && extractedTask) {
    return (
      <TaskModal
        onClose={onClose}
        onSaved={onSaved}
        initialData={extractedTask}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ textAlign: 'center', maxWidth: 480, width: '92%' }}>
        {/* Header with Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
            <Sparkles size={16} /> AI Natural Voice & Text Capture
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <h3 style={{ marginBottom: 'var(--space-2)', fontSize: '1.25rem' }}>
          {state === 'idle' && 'Tap to Speak a Task'}
          {state === 'recording' && (isSilenceDetected ? 'Chup hone par auto-send ho raha hai...' : 'Listening to your voice...')}
          {state === 'processing' && 'AI is Analyzing Your Task...'}
        </h3>

        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)', minHeight: 40 }}>
          {state === 'idle' && 'Speak naturally in English or Urdu. Example: "Kal shaam paanch baje Database assignment submit karna hai"'}
          {state === 'recording' && (
            isSilenceDetected ? (
              <span style={{ color: '#6366F1', fontWeight: 600 }}>
                ⏳ Aawaz ruk gayi hai — auto-send ho raha hai...
              </span>
            ) : audioLevel > 5 ? (
              <span style={{ color: '#10B981', fontWeight: 600 }}>
                🎙️ Audio detected ({audioLevel}%) — Bolte rahein, chup honay par auto-send ho jayega!
              </span>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>
                Bolna shuru karein — microphone sun raha hai...
              </span>
            )
          )}
          {state === 'processing' && 'Whisper transcription & AI metadata extraction in progress...'}
        </p>

        {/* Mic Button & Wave Visualizer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-6)', position: 'relative' }}>
          {state === 'recording' && (
            <div
              style={{
                position: 'absolute',
                width: 100 + audioLevel * 0.8,
                height: 100 + audioLevel * 0.8,
                borderRadius: '50%',
                background: isSilenceDetected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(16, 185, 129, 0.22)',
                transition: 'all 0.12s ease-out',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
          )}

          {state === 'processing' ? (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <Loader2 size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <button
              className={`mic-btn ${state === 'recording' ? 'recording' : ''}`}
              style={{
                width: 80,
                height: 80,
                zIndex: 1,
                boxShadow: state === 'recording' ? '0 0 24px rgba(239, 68, 68, 0.5)' : 'var(--shadow-md)',
              }}
              onClick={state === 'recording' ? stopRecording : startRecording}
              title={state === 'recording' ? 'Click to Stop now (or just stop speaking)' : 'Click to Start Speaking'}
            >
              {state === 'recording' ? <Square size={28} /> : <Mic size={28} />}
            </button>
          )}

          <div style={{ marginTop: 12, fontSize: '0.8rem', color: isSilenceDetected ? 'var(--primary)' : state === 'recording' ? '#EF4444' : 'var(--text-muted)', fontWeight: 600 }}>
            {state === 'recording'
              ? (isSilenceDetected ? '⚡ Auto-sending...' : '🎙️ Bol kar chup ho jayein (Auto-Send on silence)')
              : 'Click microphone to record'}
          </div>
        </div>

        {/* Transcript preview */}
        {transcript && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-5)',
              textAlign: 'left',
              border: '1px solid var(--border-light)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
              Transcript:
            </span>
            "{transcript}"
          </div>
        )}

        {/* Alternative: Type task in Roman Urdu or English */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span>Or type your task directly in natural language:</span>
          </div>
          <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="input"
              style={{ flex: 1, fontSize: '0.85rem' }}
              placeholder="e.g. Kal shaam 5 baje DB assignment submit karna hai"
              value={textCommand}
              onChange={(e) => setTextCommand(e.target.value)}
              disabled={state === 'processing'}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!textCommand.trim() || state === 'processing'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', fontSize: '0.85rem' }}
            >
              <Send size={15} />
              Process
            </button>
          </form>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
