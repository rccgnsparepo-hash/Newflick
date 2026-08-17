import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Star, 
  FileText, 
  HardDrive, 
  Copy, 
  Check, 
  Sparkles,
  Volume2
} from 'lucide-react';
import { 
  toggleSaveVoiceMemory, 
  exportVoiceNoteToDevice, 
  getVoiceNoteByMessageId,
  saveVoiceNoteToVault,
  computeWaveformFromAudio
} from '../lib/voiceVault';
import { triggerVibration } from '../lib/haptics';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface VoicePlayerBubbleProps {
  messageId: string;
  chatId: string;
  audioUrl: string;
  duration?: number;
  waveform?: number[];
  transcript?: string;
  senderName?: string;
  senderId?: string;
  isMe?: boolean;
  timestamp?: string;
}

export function VoicePlayerBubble({
  messageId,
  chatId,
  audioUrl,
  duration = 0,
  waveform: initialWaveform,
  transcript: initialTranscript,
  senderName = 'Node',
  senderId = '',
  isMe = false,
  timestamp,
}: VoicePlayerBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isSaved, setIsSaved] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState(initialTranscript || '');
  const [copied, setCopied] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(() => {
    if (initialWaveform && initialWaveform.length > 0) return initialWaveform;
    return Array.from({ length: 32 }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin((i / 32) * Math.PI * 2)));
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  // Initialize and ensure audio is cached in local IndexedDB vault automatically
  useEffect(() => {
    let isMounted = true;

    async function checkAndCache() {
      if (!audioUrl) return;
      try {
        const local = await getVoiceNoteByMessageId(messageId);
        if (local) {
          if (isMounted) {
            setIsSaved(!!local.isSaved);
            if (local.waveform && local.waveform.length > 0) {
              setWaveform(local.waveform);
            }
            if (local.duration) {
              setTotalDuration(local.duration);
            }
            if (local.transcript) {
              setTranscript(local.transcript);
            }
          }
        } else {
          // Compute waveform and auto-store in local device IndexedDB vault
          const computedWave = (!initialWaveform || initialWaveform.length === 0) 
            ? await computeWaveformFromAudio(audioUrl, 32) 
            : initialWaveform;
          
          if (isMounted && computedWave) {
            setWaveform(computedWave);
          }

          await saveVoiceNoteToVault({
            messageId,
            chatId,
            audioData: audioUrl,
            duration: totalDuration || duration,
            waveform: computedWave,
            transcript: initialTranscript,
            senderId,
            senderName,
            isMe,
          });
        }
      } catch (err) {
        console.warn('[VoicePlayerBubble] Local vault cache check:', err);
      }
    }

    checkAndCache();

    return () => {
      isMounted = false;
    };
  }, [messageId, chatId, audioUrl]);

  // Audio element setup
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handleLoadedMetadata = () => {
      if (el.duration && !isNaN(el.duration) && el.duration !== Infinity) {
        setTotalDuration(Math.round(el.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(el.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    el.addEventListener('loadedmetadata', handleLoadedMetadata);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);

    return () => {
      el.removeEventListener('loadedmetadata', handleLoadedMetadata);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    playGlitchClickSound();
    triggerVibration('light');
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.playbackRate = playbackSpeed;
      el.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    playGlitchClickSound();
    triggerVibration('light');
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    const scrubber = scrubberRef.current;
    if (!el || !scrubber) return;

    const rect = scrubber.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * (totalDuration || el.duration || 1);
    el.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    playLikeSound();
    triggerVibration('medium');
    const local = await getVoiceNoteByMessageId(messageId);
    if (local) {
      const starred = await toggleSaveVoiceMemory(local.id);
      setIsSaved(starred);
    } else {
      setIsSaved(!isSaved);
    }
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    playGlitchClickSound();
    triggerVibration('light');
    exportVoiceNoteToDevice(audioUrl, `flick-voice-${senderName.replace(/\s+/g, '_')}-${Date.now()}.webm`);
  };

  const handleCopyTranscript = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    triggerVibration('light');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressRatio = totalDuration > 0 ? currentTime / totalDuration : 0;

  return (
    <div className={`p-3 border font-mono select-none w-full max-w-sm sm:max-w-md transition-all ${
      isMe 
        ? 'bg-black/80 border-[var(--neon-green)]/40 shadow-[0_0_12px_rgba(0,255,102,0.12)]' 
        : 'bg-zinc-950/90 border-zinc-700/80 shadow-[0_0_12px_rgba(0,0,0,0.5)]'
    }`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <Volume2 className="w-3.5 h-3.5 text-[var(--neon-green)] shrink-0" />
          <span className="text-[10px] font-black uppercase text-[var(--color-text)] truncate tracking-wider">
            {senderName}
          </span>
          <span className="text-[8px] font-bold px-1.5 py-0.2 border border-[var(--neon-green)]/30 text-[var(--neon-green)] bg-[var(--neon-green)]/10 shrink-0">
            VOICE FLICK
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Star / Save to local memory */}
          <button
            type="button"
            onClick={handleToggleStar}
            className={`p-1 border transition-all cursor-pointer ${
              isSaved
                ? 'bg-amber-400/20 border-amber-400 text-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                : 'border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300'
            }`}
            title={isSaved ? "Saved in Local Voice Memories" : "Star to Local Voice Memories"}
          >
            <Star className={`w-3 h-3 ${isSaved ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Export to OS download */}
          <button
            type="button"
            onClick={handleExport}
            className="p-1 border border-zinc-800 hover:border-[var(--neon-green)] text-zinc-500 hover:text-[var(--neon-green)] transition cursor-pointer"
            title="Export voice note file to device"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Player Body with Play Button + Interactive Waveform Scrubber */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Main Trigger */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 shrink-0 flex items-center justify-center border transition-all cursor-pointer ${
            isPlaying
              ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[0_0_12px_#00ff66]'
              : 'bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] border-[var(--neon-green)]/50'
          }`}
          aria-label={isPlaying ? 'Pause Voice Message' : 'Play Voice Message'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Dynamic Waveform Visualizer & Scrubber */}
        <div className="flex-1 space-y-1.5">
          <div
            ref={scrubberRef}
            onClick={handleScrubberClick}
            className="relative h-8 flex items-center justify-between gap-[2px] cursor-pointer group py-1"
            title="Click to seek voice position"
          >
            {waveform.map((amp, idx) => {
              const barRatio = idx / waveform.length;
              const isPast = barRatio <= progressRatio;
              const heightPct = Math.max(18, Math.round(amp * 100));

              return (
                <div
                  key={idx}
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-[1px] transition-all duration-75 ${
                    isPast
                      ? 'bg-[var(--neon-green)] shadow-[0_0_4px_rgba(0,255,102,0.5)]'
                      : 'bg-zinc-700/70 group-hover:bg-zinc-600'
                  }`}
                />
              );
            })}
          </div>

          {/* Time and Control Indicators */}
          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 tracking-wider">
            <span>
              {isPlaying || currentTime > 0 
                ? `${formatTime(currentTime)} / ${formatTime(totalDuration)}` 
                : formatTime(totalDuration)}
            </span>

            <div className="flex items-center gap-2">
              {/* Playback speed toggle */}
              <button
                type="button"
                onClick={cycleSpeed}
                className="px-1.5 py-0.5 text-[8.5px] font-black border border-zinc-800 hover:border-[var(--neon-green)] text-zinc-300 hover:text-[var(--neon-green)] bg-black/40 transition cursor-pointer"
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>

              {/* Transcript toggle if transcript exists */}
              {transcript && (
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setShowTranscript(!showTranscript);
                  }}
                  className={`px-1.5 py-0.5 text-[8.5px] font-black border transition cursor-pointer flex items-center gap-1 ${
                    showTranscript
                      ? 'bg-[var(--neon-green)]/20 border-[var(--neon-green)] text-[var(--neon-green)]'
                      : 'border-zinc-800 hover:border-zinc-600 text-zinc-400'
                  }`}
                  title="Speech-to-text transcript"
                >
                  <FileText className="w-2.5 h-2.5" />
                  TX
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Accordion */}
      {showTranscript && transcript && (
        <div className="mt-2.5 p-2 bg-black/70 border border-zinc-800 text-[10px] text-zinc-300 space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between text-[8px] text-zinc-500 font-bold uppercase tracking-widest border-b border-zinc-900 pb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[var(--neon-green)]" />
              VOICE TRANSCRIPT
            </span>
            <button
              type="button"
              onClick={handleCopyTranscript}
              className="text-zinc-400 hover:text-[var(--neon-green)] flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-[var(--neon-green)]" /> : <Copy className="w-2.5 h-2.5" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <p className="font-sans italic leading-relaxed text-zinc-200 select-text">
            "{transcript}"
          </p>
        </div>
      )}

      {/* Local-First Storage Badge */}
      <div className="mt-2 pt-1.5 border-t border-zinc-900 flex items-center justify-between text-[8px] text-zinc-500">
        <span className="flex items-center gap-1 text-[var(--neon-green)]/70">
          <HardDrive className="w-2.5 h-2.5" />
          DEVICE VAULT CACHED
        </span>
        {timestamp && <span>{timestamp}</span>}
      </div>
    </div>
  );
}
