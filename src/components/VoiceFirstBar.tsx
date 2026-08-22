import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Send, 
  Trash2, 
  Lock, 
  Unlock, 
  Pause, 
  Play, 
  Sparkles, 
  Paperclip, 
  Type, 
  Radio, 
  RotateCcw, 
  Bookmark 
} from 'lucide-react';
import { 
  FlickVoiceRecorder, 
  VoiceRecordingState 
} from '../lib/voiceEngine';
import { 
  saveVoiceNoteToVault, 
  saveVoiceDraft, 
  getVoiceDraft, 
  clearVoiceDraft 
} from '../lib/voiceVault';
import { triggerVibration } from '../lib/haptics';
import { 
  playGlitchClickSound, 
  playLikeSound, 
  playTypingSound,
  playSendMessageSound
} from '../lib/sounds';
import { showBrutalistToast } from '../lib/toast';
import { microphoneService } from '../lib/microphoneService';
import { MicrophoneDiagnosticPanel } from './MicrophoneDiagnosticPanel';

interface VoiceFirstBarProps {
  chatId: string;
  recipientName: string;
  senderId: string;
  senderName: string;
  onSendVoiceMessage: (params: {
    audioDataUrl: string;
    duration: number;
    waveform: number[];
    transcript?: string;
  }) => Promise<void>;
  onSendTextMessage?: (text: string) => Promise<void>;
  onPickAttachment?: () => void;
  onTypingStatusChange?: (isTyping: boolean, type?: string) => void;
  disabled?: boolean;
}

export function VoiceFirstBar({
  chatId,
  recipientName,
  senderId,
  senderName,
  onSendVoiceMessage,
  onSendTextMessage,
  onPickAttachment,
  onTypingStatusChange,
  disabled = false,
}: VoiceFirstBarProps) {
  const [recorderState, setRecorderState] = useState<VoiceRecordingState>({
    isRecording: false,
    isPaused: false,
    isLocked: false,
    durationSeconds: 0,
    liveAmplitudes: Array(36).fill(0.15),
    currentTranscript: '',
    interimTranscript: '',
    effect: 'natural',
  });

  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number>(0);
  const [previewWaveform, setPreviewWaveform] = useState<number[]>([]);
  const [previewTranscript, setPreviewTranscript] = useState<string>('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [previewPlaybackRate, setPreviewPlaybackRate] = useState<number>(1.0);
  const [isSavedToVault, setIsSavedToVault] = useState<boolean>(false);

  const [auxiliaryText, setAuxiliaryText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Gesture tracking for Slide-To-Cancel and Slide-Up-To-Lock
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCancelTargeted, setIsCancelTargeted] = useState<boolean>(false);
  const [isLockTargeted, setIsLockTargeted] = useState<boolean>(false);

  const recorderRef = useRef<FlickVoiceRecorder | null>(null);
  const holdStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const previewAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Initialize recorder
  useEffect(() => {
    const rec = new FlickVoiceRecorder((state) => {
      setRecorderState(state);
    });
    recorderRef.current = rec;

    // Check for existing voice drafts for this chat
    getVoiceDraft(chatId).then(draft => {
      if (draft && draft.audioData) {
        setPreviewAudioUrl(draft.audioData);
        setPreviewDuration(draft.duration);
      }
    });

    return () => {
      rec.cancel();
    };
  }, [chatId]);

  // Notify peer of voice recording status via presence
  useEffect(() => {
    if (onTypingStatusChange) {
      if (recorderState.isRecording) {
        onTypingStatusChange(true, 'audio');
      } else if (!auxiliaryText.trim()) {
        onTypingStatusChange(false);
      }
    }
  }, [recorderState.isRecording, onTypingStatusChange, auxiliaryText]);

  // Track audio preview playback time
  useEffect(() => {
    const el = previewAudioElRef.current;
    if (!el) return;

    const handleTimeUpdate = () => {
      setPreviewCurrentTime(el.currentTime);
    };

    const handleEnded = () => {
      setIsPreviewPlaying(false);
      setPreviewCurrentTime(0);
    };

    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);

    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
    };
  }, [previewAudioUrl]);

  // Audio Preview Play / Pause Toggle
  const togglePreviewPlay = () => {
    if (!previewAudioElRef.current) return;
    if (isPreviewPlaying) {
      previewAudioElRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioElRef.current.playbackRate = previewPlaybackRate;
      previewAudioElRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  // Waveform Scrubber
  const handleScrub = (fraction: number) => {
    if (!previewAudioElRef.current || previewDuration <= 0) return;
    const targetTime = fraction * previewDuration;
    previewAudioElRef.current.currentTime = targetTime;
    setPreviewCurrentTime(targetTime);
    triggerVibration('light');
  };

  // Cycle playback speed
  const cyclePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(previewPlaybackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPreviewPlaybackRate(nextRate);
    if (previewAudioElRef.current) {
      previewAudioElRef.current.playbackRate = nextRate;
    }
    triggerVibration('light');
    playGlitchClickSound();
  };

  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);

  // Request physical microphone permission
  const handleRequestMicPermission = async () => {
    try {
      const res = await microphoneService.requestMicrophonePermission();
      if (res.granted && res.stream) {
        res.stream.getTracks().forEach(t => t.stop());
        setMicPermissionDenied(false);
        showBrutalistToast('MIC GRANTED', 'Microphone access is enabled for voice recording.', 'success');
      } else {
        setMicPermissionDenied(true);
        setIsDiagnosticOpen(true);
        showBrutalistToast('MIC PERMISSION', res.error || 'Please allow microphone access or use synthetic audio mode.', 'info');
      }
    } catch (e) {
      setMicPermissionDenied(true);
      setIsDiagnosticOpen(true);
    }
  };

  // Start voice recording
  const handleStartRecording = async (lockMode = false) => {
    if (disabled || isSending) return;
    triggerVibration('medium');
    playGlitchClickSound();
    
    // Clear any previous preview
    if (previewAudioUrl) {
      setPreviewAudioUrl(null);
      await clearVoiceDraft(chatId);
    }

    try {
      const rec = recorderRef.current;
      if (rec) {
        await rec.startRecording();
        if (lockMode) {
          rec.setLocked(true);
        }
      }
    } catch (err: any) {
      console.warn('[VoiceFirstBar] Recording notice:', err?.message || err);
      setMicPermissionDenied(true);
    }
  };

  // Pointer / Touch Hold Handlers for Push-to-Talk + Gestures
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (recorderState.isRecording || previewAudioUrl) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    holdStartTimeRef.current = Date.now();
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: 0, y: 0 });
    setIsCancelTargeted(false);
    setIsLockTargeted(false);
    handleStartRecording(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!recorderState.isRecording || recorderState.isLocked) return;
    const deltaX = e.clientX - touchStartPosRef.current.x;
    const deltaY = e.clientY - touchStartPosRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });

    // Cancel threshold: drag left > 80px
    const isCancel = deltaX < -80;
    if (isCancel !== isCancelTargeted) {
      setIsCancelTargeted(isCancel);
      triggerVibration('medium');
    }

    // Lock threshold: drag up > 60px
    const isLock = deltaY < -60;
    if (isLock !== isLockTargeted) {
      setIsLockTargeted(isLock);
      triggerVibration('light');
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!recorderState.isRecording) return;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    // Check gesture outcomes
    if (isCancelTargeted) {
      await handleCancelRecording();
      return;
    }

    if (isLockTargeted) {
      if (recorderRef.current) {
        recorderRef.current.setLocked(true);
      }
      setDragOffset({ x: 0, y: 0 });
      setIsLockTargeted(false);
      triggerVibration('heavy');
      playGlitchClickSound();
      showBrutalistToast('HANDS-FREE LOCKED', 'Recording continues hands-free.', 'info');
      return;
    }

    // If hands-free locked was previously engaged, do nothing on release
    if (recorderState.isLocked) return;

    const holdDuration = Date.now() - holdStartTimeRef.current;
    // If hold was less than 350ms, lock into hands-free mode for user convenience
    if (holdDuration < 350) {
      if (recorderRef.current) {
        recorderRef.current.setLocked(true);
      }
      showBrutalistToast('TAP RECORD ACTIVE', 'Hands-free recording mode engaged.', 'info');
      return;
    }

    await handleStopAndSend();
  };

  // Stop recording and package for sending
  const handleStopAndSend = async () => {
    const rec = recorderRef.current;
    if (!rec) return;

    try {
      setIsSending(true);
      triggerVibration('medium');
      const result = await rec.stop();

      if (result.duration >= 0.4 && result.audioDataUrl) {
        await onSendVoiceMessage({
          audioDataUrl: result.audioDataUrl,
          duration: result.duration,
          waveform: result.waveform,
          transcript: result.transcript,
        });

        playSendMessageSound();
      }
    } catch (err) {
      console.error('Failed to finalize voice message:', err);
    } finally {
      setIsSending(false);
      setDragOffset({ x: 0, y: 0 });
      clearVoiceDraft(chatId);
    }
  };

  // Stop recording and preview before sending
  const handleStopAndPreview = async () => {
    const rec = recorderRef.current;
    if (!rec) return;

    try {
      const result = await rec.stop();
      if (result.audioDataUrl) {
        setPreviewAudioUrl(result.audioDataUrl);
        setPreviewDuration(result.duration);
        setPreviewWaveform(result.waveform);
        setPreviewTranscript(result.transcript);
        saveVoiceDraft(chatId, result.audioDataUrl, result.duration);
        triggerVibration('light');
        playGlitchClickSound();
      }
    } catch (e) {
      console.error('Failed to preview recording:', e);
    }
  };

  // Cancel & Discard
  const handleCancelRecording = async () => {
    triggerVibration('heavy');
    playGlitchClickSound();
    if (recorderRef.current) {
      recorderRef.current.cancel();
    }
    setPreviewAudioUrl(null);
    setDragOffset({ x: 0, y: 0 });
    setIsCancelTargeted(false);
    setIsLockTargeted(false);
    await clearVoiceDraft(chatId);
  };

  // Save to Voice Vault
  const handleSaveToVault = async () => {
    if (!previewAudioUrl || isSavedToVault) return;
    try {
      await saveVoiceNoteToVault({
        messageId: `draft_${Date.now()}`,
        chatId,
        senderId,
        senderName,
        audioData: previewAudioUrl,
        duration: previewDuration,
        waveform: previewWaveform,
        transcript: previewTranscript,
        isSaved: true,
        tags: ['Draft', 'Voice Note']
      });
      setIsSavedToVault(true);
      triggerVibration('medium');
      playLikeSound();
      showBrutalistToast('VAULT ARCHIVED', 'Voice note preserved in offline vault.', 'success');
    } catch (e) {
      console.error('Vault save error:', e);
    }
  };

  // Send previewed audio draft
  const handleSendPreviewedVoice = async () => {
    if (!previewAudioUrl || isSending) return;
    try {
      setIsSending(true);
      triggerVibration('medium');
      await onSendVoiceMessage({
        audioDataUrl: previewAudioUrl,
        duration: previewDuration,
        waveform: previewWaveform,
        transcript: previewTranscript,
      });
      setPreviewAudioUrl(null);
      await clearVoiceDraft(chatId);
      playSendMessageSound();
    } catch (e) {
      console.error('Error sending previewed voice note:', e);
    } finally {
      setIsSending(false);
    }
  };

  // Send auxiliary text message with instant input clearing and failure draft preservation
  const handleSendAuxText = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const textToSubmit = auxiliaryText.trim();
    if (!textToSubmit || !onSendTextMessage || isSending) return;

    // 1. Immediately reset the input field so UI clears on the very same frame
    setAuxiliaryText('');
    setIsSending(true);

    try {
      if (onTypingStatusChange) {
        onTypingStatusChange(false);
      }
      await onSendTextMessage(textToSubmit);
    } catch (err: any) {
      // 2. If transmission fails, safely restore draft into input box
      setAuxiliaryText(textToSubmit);
      showBrutalistToast('SEND FAILED', 'Could not transmit dialogue packet. Message draft restored.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-[var(--color-surface)] border-t border-[var(--neon-green)]/20 font-mono select-none relative transition-all">
      
      {/* Microphone Fallback / Permission Notice Banner */}
      {(recorderState.isSynthetic || micPermissionDenied) && (
        <div className="px-3 py-1.5 bg-amber-950/90 border-b border-amber-500/40 flex items-center justify-between gap-2 text-[9px] text-amber-200">
          <div className="flex items-center gap-1.5 truncate">
            <Radio className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">
              SYNTHETIC AUDIO MODE • Real mic access restricted in this browser session.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRequestMicPermission}
              className="px-2 py-0.5 bg-amber-400 hover:bg-white text-black font-black text-[8px] uppercase tracking-wider transition cursor-pointer"
            >
              ENABLE MIC
            </button>
            <button
              type="button"
              onClick={() => setIsDiagnosticOpen(true)}
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-black text-[8px] uppercase tracking-wider border border-amber-500/30 transition cursor-pointer"
            >
              DIAGNOSE
            </button>
          </div>
        </div>
      )}

      {/* Main Bar Content */}
      <div className="p-2.5 sm:p-3">
        
        {/* CASE 1: AUDITION / PREVIEW DRAFT MODE */}
        {previewAudioUrl ? (
          <div className="p-3.5 bg-black/95 rounded-2xl border-2 border-[var(--neon-green)]/70 shadow-[0_0_20px_rgba(0,255,102,0.2)] space-y-3">
            <audio 
              ref={previewAudioElRef} 
              src={previewAudioUrl} 
            />

            {/* Header info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--neon-green)] text-black text-[9px] font-black uppercase tracking-wider">
                  VOICE NOTE DRAFT
                </span>
                <span className="text-[11px] font-black text-white font-mono">
                  {formatSecs(previewCurrentTime)} / {formatSecs(previewDuration)}
                </span>
              </div>

              {/* Speed Controller & Vault button */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  className="px-2.5 py-1 rounded-lg border border-zinc-700 hover:border-[var(--neon-green)] bg-zinc-900 text-zinc-300 hover:text-[var(--neon-green)] text-[9px] font-black uppercase transition cursor-pointer"
                  title="Cycle playback speed"
                >
                  {previewPlaybackRate}x
                </button>

                <button
                  type="button"
                  onClick={handleSaveToVault}
                  disabled={isSavedToVault}
                  className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase flex items-center gap-1 transition cursor-pointer ${
                    isSavedToVault
                      ? 'border-purple-500 bg-purple-950 text-purple-300'
                      : 'border-zinc-700 hover:border-purple-500 bg-zinc-900 text-zinc-300 hover:text-purple-300'
                  }`}
                  title="Save to Encrypted Vault"
                >
                  <Bookmark className="w-2.5 h-2.5" />
                  {isSavedToVault ? 'VAULTED' : 'VAULT'}
                </button>
              </div>
            </div>

            {/* Interactive Scrubbing Waveform */}
            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const frac = Math.max(0, Math.min(1, clickX / rect.width));
                handleScrub(frac);
              }}
              className="h-12 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-[var(--neon-green)]/60 px-2 flex items-center justify-between gap-[2px] cursor-pointer relative group overflow-hidden"
            >
              {/* Playback progress cursor line */}
              <div 
                style={{ 
                  left: `${previewDuration > 0 ? (previewCurrentTime / previewDuration) * 100 : 0}%` 
                }}
                className="absolute top-0 bottom-0 w-[2px] bg-white z-10 pointer-events-none shadow-[0_0_8px_#ffffff]"
              />

              {Array.from({ length: 48 }).map((_, idx) => {
                const ampVal = previewWaveform[idx % previewWaveform.length] || (0.2 + (Math.sin(idx * 0.4) * 0.3 + 0.3));
                const barHeight = Math.max(15, Math.min(100, Math.round(ampVal * 100)));
                const playedPct = previewDuration > 0 ? (previewCurrentTime / previewDuration) * 48 : 0;
                const isPassed = idx <= playedPct;

                return (
                  <div
                    key={idx}
                    style={{ height: `${barHeight}%` }}
                    className={`w-full transition-all duration-75 rounded-[1px] ${
                      isPassed 
                        ? 'bg-[var(--neon-green)] shadow-[0_0_6px_rgba(0,255,102,0.8)]' 
                        : 'bg-zinc-700 group-hover:bg-zinc-600'
                    }`}
                  />
                );
              })}
            </div>

            {/* Audition Studio Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Play / Pause Toggle Button */}
                <button
                  type="button"
                  onClick={togglePreviewPlay}
                  className="px-4 py-2 rounded-xl bg-[var(--neon-green)] text-black border border-[var(--neon-green)] hover:bg-white font-black text-xs uppercase flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_12px_rgba(0,255,102,0.3)]"
                >
                  {isPreviewPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />}
                  <span>{isPreviewPlaying ? 'PAUSE' : 'PLAY'}</span>
                </button>

                {/* Discard / Re-record Button */}
                <button
                  type="button"
                  onClick={handleCancelRecording}
                  className="px-3 py-2 rounded-xl border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-400 text-[10px] font-black uppercase flex items-center gap-1 transition cursor-pointer"
                  title="Discard voice draft"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RE-RECORD
                </button>
              </div>

              {/* Transmit Button */}
              <button
                type="button"
                onClick={handleSendPreviewedVoice}
                disabled={isSending}
                className="px-5 py-2 rounded-xl bg-[var(--neon-green)] text-black font-black text-xs uppercase hover:bg-white shadow-[0_0_15px_rgba(0,255,102,0.35)] transition cursor-pointer flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                TRANSMIT
              </button>
            </div>
          </div>
        ) : recorderState.isRecording ? (
          
          /* CASE 2: ACTIVE VOICE RECORDING STUDIO (Live Waveform & Hands-Free) */
          <div className="p-3.5 bg-black/95 rounded-2xl border-2 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.25)] space-y-3 animate-fadeIn relative overflow-hidden">
            
            {/* Ambient Background Matrix Grid */}
            <div className="absolute top-0 right-0 w-32 h-full bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:8px_8px] opacity-15 pointer-events-none" />

            <div className="flex items-center justify-between">
              {/* Recording indicator & timer */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-black uppercase text-red-400 tracking-wider">
                  RECORDING
                </span>
                <span className="text-xs font-black text-white px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700">
                  {formatSecs(recorderState.durationSeconds)}
                </span>
              </div>

              {/* Hands-Free Lock Status & Codec */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 uppercase">
                  OPUS HD
                </span>
                {recorderState.isLocked ? (
                  <span className="px-2.5 py-0.5 rounded-full border border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--neon-green)]/15 flex items-center gap-1 text-[9px] font-bold">
                    <Lock className="w-2.5 h-2.5" />
                    HANDS-FREE
                  </span>
                ) : (
                  <span className="text-zinc-500 flex items-center gap-1 text-[9px] font-bold">
                    <Unlock className="w-2.5 h-2.5" />
                    HOLDING
                  </span>
                )}
              </div>
            </div>

            {/* Dynamic Real-Time Live Waveform Visualizer */}
            <div className="h-12 px-2.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between gap-[2px] overflow-hidden">
              {recorderState.liveAmplitudes.map((amp, i) => {
                const heightPct = Math.max(12, Math.min(100, Math.round(amp * 100)));
                const isPeak = heightPct > 75;
                return (
                  <div
                    key={i}
                    style={{ height: `${heightPct}%` }}
                    className={`w-full transition-all duration-75 rounded-[1px] ${
                      isPeak 
                        ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]' 
                        : 'bg-[var(--neon-green)] shadow-[0_0_6px_rgba(0,255,102,0.6)]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Studio Action Controls */}
            <div className="flex items-center justify-between pt-1">
              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCancelRecording}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-400 text-[10px] font-black uppercase flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                CANCEL
              </button>

              <div className="flex items-center gap-2">
                {/* Pause/Resume (in locked mode) */}
                {recorderState.isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      if (recorderState.isPaused) {
                        recorderRef.current?.resume();
                      } else {
                        recorderRef.current?.pause();
                      }
                      triggerVibration('light');
                    }}
                    className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer hover:border-zinc-500"
                  >
                    {recorderState.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {recorderState.isPaused ? 'RESUME' : 'PAUSE'}
                  </button>
                )}

                {/* Review/Audition Draft Button */}
                <button
                  type="button"
                  onClick={handleStopAndPreview}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--neon-green)]/60 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/15 text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Square className="w-3.5 h-3.5" />
                  AUDITION
                </button>

                {/* Transmit Immediately Button */}
                <button
                  type="button"
                  onClick={handleStopAndSend}
                  disabled={isSending}
                  className="px-5 py-1.5 rounded-xl bg-[var(--neon-green)] text-black font-black text-xs uppercase hover:bg-white shadow-[0_0_15px_rgba(0,255,102,0.35)] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  TRANSMIT
                </button>
              </div>
            </div>
          </div>
        ) : (

          /* CASE 3: TEXT-FIRST UNIFIED CHAT INPUT BAR WITH INTEGRATED HOLD TO TALK / TAP TO RECORD */
          <div className="flex items-center gap-2">
            
            {/* Supporting Accessories (Left Side) */}
            <div className="flex items-center gap-1">
              {/* Attachment Picker */}
              {onPickAttachment && (
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    onPickAttachment();
                  }}
                  className="p-2.5 rounded-xl border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 transition cursor-pointer"
                  title="Attach Media or Documents"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* TEXT INPUT FIELD (Primary Text-First Interface) */}
            <form onSubmit={handleSendAuxText} className="flex-1 flex items-center relative">
              <input
                type="text"
                value={auxiliaryText}
                onChange={(e) => {
                  setAuxiliaryText(e.target.value);
                  playTypingSound(e.target.value.slice(-1));
                  if (onTypingStatusChange) onTypingStatusChange(true, 'text');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendAuxText(e);
                  }
                }}
                placeholder="Type a message or hold mic to talk..."
                className="w-full px-4 py-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-700/60 focus:border-[var(--neon-green)] text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none font-sans transition-all duration-200 shadow-inner"
              />
            </form>

            {/* RIGHT SIDE: SEND BUTTON (When typing) OR HOLD TO TALK / TAP TO RECORD (When idle) */}
            {auxiliaryText.trim().length > 0 ? (
              <button
                type="button"
                onClick={handleSendAuxText}
                disabled={isSending}
                className="px-4 py-2.5 rounded-2xl bg-[var(--neon-green)] hover:bg-white text-black font-black text-xs uppercase shadow-[0_0_15px_rgba(0,255,102,0.4)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">SEND</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* THE MIC BUTTON: HOLD TO TALK / TAP TO RECORD */}
                <button
                  type="button"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="py-2.5 px-3.5 sm:px-4 rounded-2xl bg-[var(--neon-green)] hover:bg-white text-black border border-[var(--neon-green)] hover:border-white shadow-[0_0_15px_rgba(0,255,102,0.3)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer group touch-none select-none"
                  aria-label="Hold to Talk or Tap to Record Voice"
                >
                  <div className="relative">
                    <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider leading-none">
                    <span className="hidden sm:inline">HOLD TO TALK</span>
                    <span className="sm:hidden">TALK</span>
                  </span>
                </button>

                {/* Hands-Free 1-Tap Lock Button */}
                <button
                  type="button"
                  onClick={() => handleStartRecording(true)}
                  className="p-2.5 rounded-2xl border border-zinc-800 hover:border-[var(--neon-green)] text-zinc-400 hover:text-[var(--neon-green)] bg-zinc-900/60 transition cursor-pointer"
                  title="Tap for Hands-Free Recording Studio"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Hardware & Microphone Diagnostic Suite Modal */}
      <MicrophoneDiagnosticPanel
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
      />
    </div>
  );
}
