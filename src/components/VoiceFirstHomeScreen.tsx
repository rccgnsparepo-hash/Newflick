import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types';
import { FlickVoiceRecorder, VoiceRecordingState } from '../lib/voiceEngine';
import {
  saveLocalMessage,
  retrieveAndCacheAudio,
  toggleSaveLocalMessage,
  getRecentVoiceConversations,
  checkMediaStatus,
  LocalMessageRecord,
  MediaIndexStatus
} from '../lib/localMessageStore';
import {
  saveVoiceNoteToVault,
  getSavedVoiceMemories,
  computeWaveformFromAudio,
  LocalVoiceNote
} from '../lib/voiceVault';
import { sendE2EEMessage, subscribeToUsers, getDeterministicChatId } from '../lib/services';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';
import { DeviceVaultTransferModal } from './DeviceVaultTransferModal';
import { NewDeviceWelcomeBanner } from './NewDeviceWelcomeBanner';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Send,
  Sparkles,
  Lock,
  Unlock,
  Radio,
  Bookmark,
  Volume2,
  Users,
  Clock,
  PhoneCall,
  Video,
  Layers,
  Flame,
  ChevronRight,
  ShieldCheck,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft
} from 'lucide-react';

interface VoiceFirstHomeScreenProps {
  onOpenDirectChat?: (peerId: string) => void;
  onOpenCall?: (peerId: string, peerName: string, peerPhoto: string, type: 'voice' | 'video') => void;
  onOpenNews?: () => void;
  onOpenNetworkMap?: () => void;
}

export default function VoiceFirstHomeScreen({
  onOpenDirectChat = () => {},
  onOpenCall = () => {},
  onOpenNews = () => {},
  onOpenNetworkMap = () => {}
}: VoiceFirstHomeScreenProps) {
  const { profile } = useAuth();

  // Peer nodes state
  const [peers, setPeers] = useState<UserProfile[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<UserProfile | null>(null);

  // Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [isLockedRecording, setIsLockedRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioStreamLevel, setAudioStreamLevel] = useState<number[]>(Array(24).fill(0.15));
  const [voiceFx, setVoiceFx] = useState<'normal' | 'cyber' | 'studio' | 'echo'>('normal');

  // Recorded Audio preview
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Recent Voice Conversations & Memories
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [voiceMemories, setVoiceMemories] = useState<LocalVoiceNote[]>([]);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [activePlayingUrl, setActivePlayingUrl] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showVaultTransferModal, setShowVaultTransferModal] = useState(false);

  // Recording engine refs
  const recorderRef = useRef<FlickVoiceRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const animationFrameRef = useRef<any>(null);

  // Subscribe to peers in network
  useEffect(() => {
    const unsub = subscribeToUsers((users) => {
      const filtered = users.filter((u) => u.uid !== profile?.uid);
      setPeers(filtered);
      if (filtered.length > 0 && !selectedPeer) {
        setSelectedPeer(filtered[0]);
      }
    });
    return () => unsub();
  }, [profile?.uid]);

  // Load recent local voice conversations & memories
  const loadLocalVoiceData = async () => {
    if (!profile?.uid) return;
    try {
      const recents = await getRecentVoiceConversations(profile.uid);
      setRecentConversations(recents);

      const memories = await getSavedVoiceMemories();
      setVoiceMemories(memories);
    } catch (err) {
      console.warn('[VoiceFirstHome] Error loading voice data:', err);
    }
  };

  useEffect(() => {
    loadLocalVoiceData();
  }, [profile?.uid]);

  // Cleanup audio objects on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (recorderRef.current) recorderRef.current.cleanup();
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  // Handle Recording Start
  const handleStartRecording = async (lock = false) => {
    playGlitchClickSound();
    triggerVibration('medium');

    // Clean previous preview
    setRecordedBlobUrl(null);
    setRecordedBlob(null);
    setRecordedWaveform([]);
    setRecordDuration(0);
    setIsLockedRecording(lock);

    try {
      recorderRef.current = new FlickVoiceRecorder((state: VoiceRecordingState) => {
        setRecordDuration(state.durationSeconds);
        if (state.liveAmplitudes && state.liveAmplitudes.length > 0) {
          setAudioStreamLevel(state.liveAmplitudes.slice(-24));
        }
      });

      await recorderRef.current.startRecording();
      setIsRecording(true);
      showBrutalistToast('FLICK RECORDING', 'Voice channel open. Speak now...', 'info');
    } catch (err: any) {
      console.warn('[VoiceEngine] Mic start error:', err);
    }
  };

  // Handle Recording Stop
  const handleStopRecording = async () => {
    if (!isRecording || !recorderRef.current) return;
    playGlitchClickSound();
    triggerVibration('heavy');

    try {
      const result = await recorderRef.current.stop();
      setIsRecording(false);
      setIsLockedRecording(false);

      if (result && result.blob) {
        setRecordedBlob(result.blob);
        setRecordedBlobUrl(result.audioDataUrl);

        const wf = await computeWaveformFromAudio(result.audioDataUrl, 32);
        setRecordedWaveform(wf);
        showBrutalistToast('FLICK CAPTURED', `Voice burst recorded (${Math.round(result.duration)}s)`, 'success');
      }
    } catch (err) {
      console.warn('[VoiceEngine] Stop error:', err);
      setIsRecording(false);
      setIsLockedRecording(false);
    }
  };

  // Handle Dispatch / Send Recorded Voice Burst
  const handleDispatchVoiceFlick = async () => {
    if (!recordedBlobUrl || !profile) return;
    playGlitchClickSound();
    triggerVibration('medium');

    const duration = recordDuration || 1;
    const messageId = `msg_voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const conversationId = selectedPeer ? getDeterministicChatId(profile.uid, selectedPeer.uid) : getDeterministicChatId(profile.uid, profile.uid);

    try {
      // 1. SAVE TO LOCAL MESSAGE STORE (Smart Local Media Index = LOCAL / SAVED)
      const localRecord: LocalMessageRecord = {
        messageId,
        conversationId,
        senderId: profile.uid,
        senderName: profile.displayName || 'You',
        recipientId: selectedPeer ? selectedPeer.uid : profile.uid,
        createdAt: Date.now(),
        duration,
        messageType: 'voice',
        mediaStatus: 'LOCAL',
        deliveryStatus: selectedPeer ? 'sent' : 'delivered',
        playbackStatus: 'unplayed',
        transcriptStatus: 'unavailable',
        waveform: recordedWaveform,
        saved: false,
        temporary: true,
        expiresAt: Date.now() + 86400 * 1000 * 7, // 7-day default temporary lifespan
      };

      await saveLocalMessage(localRecord, recordedBlobUrl);

      // Save to local voice vault as well
      await saveVoiceNoteToVault({
        messageId,
        chatId: conversationId,
        audioData: recordedBlobUrl,
        duration,
        waveform: recordedWaveform,
        senderId: profile.uid,
        senderName: profile.displayName || 'You',
        isMe: true,
      });

      // 2. DISPATCH TINY METADATA TO FIRESTORE (NO AUDIO BLOBS OR LARGE WAVEFORMS!)
      if (selectedPeer && selectedPeer.uid) {
        const payloadText = JSON.stringify({
          type: 'voice_flick',
          voiceMessageId: messageId,
          duration,
          expiresAt: Date.now() + 86400 * 1000 * 7,
        });

        try {
          await sendE2EEMessage({
            chatId: conversationId,
            senderId: profile.uid,
            senderDisplayName: profile.displayName || 'You',
            receiverId: selectedPeer.uid,
            plainText: payloadText,
            recipientPublicKeyJwk: selectedPeer.publicKey || '',
            senderPublicKeyJwk: profile.publicKey || '',
            lifespanSeconds: 86400 * 7,
          });
        } catch (syncErr) {
          console.warn('[VoiceFirstHome] Cloud sync metadata notice:', syncErr);
        }
      }

      showBrutalistToast('FLICK DISPATCHED', `Voice burst sent to ${selectedPeer ? selectedPeer.displayName : 'Vault'}`, 'success');

      // Reset record state
      setRecordedBlobUrl(null);
      setRecordedBlob(null);
      setRecordedWaveform([]);
      setRecordDuration(0);
      loadLocalVoiceData();
    } catch (err: any) {
      console.warn('[VoiceFirstHome] Dispatch error:', err);
      showBrutalistToast('DISPATCH FAILED', err.message || 'Could not send voice burst', 'error');
    }
  };

  // Save current recorded audio as personal Voice Memory
  const handleSaveAsMemory = async () => {
    if (!recordedBlobUrl || !profile) return;
    playLikeSound();
    triggerVibration('light');

    try {
      const memoryId = `mem_${Date.now()}`;
      await saveVoiceNoteToVault({
        messageId: memoryId,
        chatId: `conv_self_${profile.uid}`,
        audioData: recordedBlobUrl,
        duration: recordDuration || 1,
        waveform: recordedWaveform,
        senderId: profile.uid,
        senderName: profile.displayName || 'You',
        isMe: true,
        isSaved: true,
      });

      showBrutalistToast('SAVED TO VAULT', 'Pinned to your permanent voice memories', 'success');
      loadLocalVoiceData();
    } catch (err) {
      console.warn('[VoiceMemory] Save error:', err);
    }
  };

  // Play audio from recent list
  const handlePlayVoiceMessage = async (msg: LocalMessageRecord) => {
    if (activePlayingId === msg.messageId && activeAudioRef.current) {
      if (activeAudioRef.current.paused) {
        activeAudioRef.current.play();
        setActivePlayingId(msg.messageId);
      } else {
        activeAudioRef.current.pause();
        setActivePlayingId(null);
      }
      return;
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    playGlitchClickSound();
    triggerVibration('light');

    // Smart Local Media Index check: retrieve and cache audio locally
    const { audioUrl, status } = await retrieveAndCacheAudio(msg.messageId);
    if (!audioUrl) {
      showBrutalistToast('MEDIA STATUS', `Audio is ${status}. Cannot play.`, 'warning');
      return;
    }

    setActivePlayingUrl(audioUrl);
    setActivePlayingId(msg.messageId);

    const audio = new Audio(audioUrl);
    activeAudioRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.onended = () => {
      setActivePlayingId(null);
      setPlaybackProgress(0);
    };

    audio.play().catch((e) => {
      console.warn('Audio play error:', e);
      setActivePlayingId(null);
    });
  };

  // Toggle Save / Pin for a local message
  const handleToggleSave = async (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playLikeSound();
    triggerVibration('light');
    await toggleSaveLocalMessage(msgId);
    loadLocalVoiceData();
  };

  return (
    <div 
      className="flex-1 w-full h-full overflow-y-auto bg-[var(--color-background)] text-[var(--color-text)] font-mono p-3 md:p-6 space-y-6 select-text"
      style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      
      {/* NEW DEVICE WELCOME / LOCAL-FIRST ORIENTATION BANNER */}
      <NewDeviceWelcomeBanner
        onOpenTransfer={() => setShowVaultTransferModal(true)}
        onOpenRestore={() => setShowVaultTransferModal(true)}
      />

      {/* ========================================================================= */}
      {/* SECTION 1: HEADER & LIVE STATUS                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--neon-green-border)] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--neon-green)] animate-pulse shadow-[0_0_10px_var(--neon-green)]"></span>
            <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-[var(--neon-green)]">
              VOICE FLICK STUDIO
            </h1>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/30 font-bold">
              LOCAL-FIRST E2EE
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">
            Zero cloud audio exposure • Ephemeral peer conduit • Crystal WebRTC audio
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => {
              playGlitchClickSound();
              setShowVaultTransferModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-[var(--neon-green-border)] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition transform active:scale-95 text-xs font-bold shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>VAULT SYNC</span>
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              if (selectedPeer) {
                onOpenCall(selectedPeer.uid, selectedPeer.displayName || 'Peer', selectedPeer.photoURL || '', 'voice');
              } else {
                showBrutalistToast('SELECT PEER', 'Choose an available peer node below to start a live voice call', 'info');
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black transition transform active:scale-95 text-xs font-bold shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>START LIVE FLOW</span>
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              onOpenNetworkMap();
            }}
            className="px-3 py-1.5 rounded-xl bg-[var(--color-surface)] border border-[var(--neon-green-border)] text-zinc-300 hover:text-[var(--neon-green)] text-xs font-bold transition"
          >
            NODE MAP
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: CENTRAL INTERACTIVE FLICK DECK (THE HEART OF THE HOME SCREEN)    */}
      {/* ========================================================================= */}
      <div className="glass-panel border-2 border-[var(--neon-green)]/40 rounded-3xl p-5 md:p-8 relative overflow-hidden bg-gradient-to-b from-[#09140f] via-[#050b08] to-[#020504] shadow-[0_10px_30px_rgba(0,255,102,0.05)]">
        
        {/* Glow radar rings */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--neon-green)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-xl mx-auto flex flex-col items-center text-center space-y-6 relative z-10">
          
          {/* Target Peer Selector Header */}
          <div className="w-full flex items-center justify-between bg-black/40 border border-[var(--neon-green-border)] rounded-2xl p-2.5 px-4 backdrop-blur-md">
            <div className="flex items-center space-x-2.5">
              <span className="text-[9px] text-zinc-500 font-bold uppercase">TARGET NODE:</span>
              {selectedPeer ? (
                <div className="flex items-center space-x-2">
                  <img
                    src={selectedPeer.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100'}
                    alt=""
                    className="w-5 h-5 rounded-full border border-[var(--neon-green)] object-cover"
                  />
                  <span className="text-xs font-black text-[var(--neon-green)] truncate max-w-[130px] sm:max-w-[200px]">
                    @{selectedPeer.displayName || selectedPeer.username}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
              ) : (
                <span className="text-xs text-zinc-400 italic">Personal Vault / Memo</span>
              )}
            </div>

            <div className="text-[10px] text-zinc-400 font-mono">
              {isRecording ? (
                <span className="text-red-400 font-black animate-pulse flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  REC 00:{recordDuration < 10 ? `0${recordDuration}` : recordDuration}
                </span>
              ) : (
                <span className="text-zinc-500">READY</span>
              )}
            </div>
          </div>

          {/* Live Waveform Stream Visualizer */}
          <div className="w-full h-24 bg-black/50 border border-[var(--neon-green-border)] rounded-2xl p-3 flex items-center justify-center gap-1.5 overflow-hidden relative shadow-inner">
            {isRecording ? (
              audioStreamLevel.map((lvl, idx) => (
                <motion.div
                  key={idx}
                  className="w-1.5 rounded-full bg-gradient-to-t from-[var(--neon-green)] to-emerald-300"
                  animate={{ height: `${Math.max(12, lvl * 80)}px` }}
                  transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                />
              ))
            ) : recordedWaveform.length > 0 ? (
              recordedWaveform.map((lvl, idx) => (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-[var(--neon-green)]"
                  style={{ height: `${Math.max(8, lvl * 70)}px` }}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-600 space-y-1">
                <Mic className="w-6 h-6 text-zinc-700 animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">
                  PRESS FLICK TO SPEAK • ZERO DELAY RECORDING
                </span>
              </div>
            )}
          </div>

          {/* DSP Voice Filter Selectors */}
          <div className="flex items-center gap-2 flex-wrap justify-center text-[9px] font-bold">
            <span className="text-zinc-500 uppercase text-[8px]">VOICE DSP:</span>
            {[
              { id: 'normal', label: 'PURE VOICE' },
              { id: 'studio', label: 'STUDIO WARMTH' },
              { id: 'cyber', label: 'CYBERPUNK' },
              { id: 'echo', label: 'SPACE ECHO' },
            ].map((fx) => (
              <button
                key={fx.id}
                onClick={() => {
                  playGlitchClickSound();
                  setVoiceFx(fx.id as any);
                }}
                className={`px-2.5 py-1 rounded-lg border transition ${
                  voiceFx === fx.id
                    ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                    : 'bg-black/40 text-zinc-400 border-[var(--neon-green-border)] hover:text-white'
                }`}
              >
                {fx.label}
              </button>
            ))}
          </div>

          {/* MAIN BIG FLICK BUTTON / TRIGGER */}
          <div className="relative flex flex-col items-center justify-center my-2">
            
            {/* Pulsing ring when active */}
            {isRecording && (
              <motion.div
                className="absolute w-36 h-36 rounded-full border-2 border-red-500 pointer-events-none"
                animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
            )}

            {!isRecording && !recordedBlobUrl ? (
              <button
                onMouseDown={() => handleStartRecording(false)}
                onMouseUp={() => !isLockedRecording && handleStopRecording()}
                onTouchStart={() => handleStartRecording(false)}
                onTouchEnd={() => !isLockedRecording && handleStopRecording()}
                className="w-28 h-28 rounded-full bg-gradient-to-tr from-[var(--neon-green)] via-emerald-400 to-[#7affb2] text-black font-black text-sm flex flex-col items-center justify-center shadow-[0_0_35px_rgba(0,255,102,0.4)] hover:scale-105 active:scale-95 transition transform cursor-pointer border-4 border-black"
                title="Hold or tap to Flick"
              >
                <Mic className="w-8 h-8 text-black mb-1" />
                <span className="text-[11px] font-black tracking-wider uppercase">FLICK</span>
              </button>
            ) : isRecording ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsLockedRecording(!isLockedRecording)}
                  className={`p-3.5 rounded-2xl border ${
                    isLockedRecording
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-black/60 text-zinc-300 border-[var(--neon-green-border)]'
                  }`}
                  title={isLockedRecording ? 'Unlock recording' : 'Lock hands-free recording'}
                >
                  {isLockedRecording ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleStopRecording}
                  className="w-28 h-28 rounded-full bg-red-600 text-white font-black text-sm flex flex-col items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 transition transform cursor-pointer border-4 border-black animate-pulse"
                >
                  <Square className="w-7 h-7 text-white mb-1 fill-white" />
                  <span className="text-[10px] font-black tracking-wider uppercase">DONE</span>
                </button>
              </div>
            ) : (
              /* Recorded Preview Actions Deck */
              <div className="flex flex-col items-center space-y-3 w-full animate-fade-in">
                <div className="flex items-center gap-3">
                  {/* Play preview */}
                  <button
                    onClick={() => {
                      if (!recordedBlobUrl) return;
                      if (isPlayingPreview && previewAudioRef.current) {
                        previewAudioRef.current.pause();
                        setIsPlayingPreview(false);
                      } else {
                        const audio = new Audio(recordedBlobUrl);
                        previewAudioRef.current = audio;
                        audio.onended = () => setIsPlayingPreview(false);
                        audio.play();
                        setIsPlayingPreview(true);
                      }
                    }}
                    className="p-3.5 rounded-2xl bg-[var(--neon-green)] text-black font-bold hover:scale-105 transition"
                  >
                    {isPlayingPreview ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-black" />}
                  </button>

                  {/* Dispatch Button */}
                  <button
                    onClick={handleDispatchVoiceFlick}
                    className="px-6 py-3.5 rounded-2xl bg-[var(--neon-green)] text-black font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:bg-white transition"
                  >
                    <Send className="w-4 h-4" />
                    <span>DISPATCH FLICK</span>
                  </button>

                  {/* Save to vault */}
                  <button
                    onClick={handleSaveAsMemory}
                    className="p-3.5 rounded-2xl bg-black/60 border border-[var(--neon-green-border)] text-amber-400 hover:text-white transition"
                    title="Save to Personal Voice Vault"
                  >
                    <Bookmark className="w-5 h-5" />
                  </button>

                  {/* Retake */}
                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      setRecordedBlobUrl(null);
                      setRecordedBlob(null);
                      setRecordedWaveform([]);
                    }}
                    className="px-3.5 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-red-400 text-xs font-bold hover:text-white transition"
                  >
                    RETAKE
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick instructions */}
          <p className="text-[10px] text-zinc-500 font-mono">
            {isRecording
              ? isLockedRecording
                ? 'Recording locked. Tap DONE when finished.'
                : 'Hold down or tap Lock for hands-free thought capture.'
              : 'Press & hold to record a voice burst. Dispatches instantly with zero cloud audio storage.'}
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: PEER RADAR RING (TAP TO QUICK-SELECT OR CALL)                  */}
      {/* ========================================================================= */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[var(--neon-green)]" />
            <span className="text-[10px] font-black uppercase text-[var(--neon-green)] tracking-wider">
              ACTIVE PEER CONDUITS ({peers.length})
            </span>
          </div>
          <span className="text-[8px] text-zinc-500 uppercase">Tap node to target</span>
        </div>

        <div className="flex items-center space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {/* Self Vault Option */}
          <button
            onClick={() => {
              playGlitchClickSound();
              setSelectedPeer(null);
            }}
            className={`flex flex-col items-center space-y-1 shrink-0 p-2 rounded-2xl border transition ${
              selectedPeer === null
                ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 shadow-[0_0_15px_rgba(0,255,102,0.15)]'
                : 'border-[var(--neon-green-border)] bg-black/40 hover:border-[var(--neon-green)]/40'
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold text-amber-400 max-w-[60px] truncate">Self Vault</span>
            <span className="text-[7.5px] text-zinc-500 font-mono">Pinned</span>
          </button>

          {peers.map((peer) => {
            const isSelected = selectedPeer?.uid === peer.uid;
            return (
              <div
                key={peer.uid}
                onClick={() => {
                  playGlitchClickSound();
                  setSelectedPeer(peer);
                }}
                className={`flex flex-col items-center space-y-1 shrink-0 p-2 rounded-2xl border cursor-pointer transition ${
                  isSelected
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 shadow-[0_0_15px_rgba(0,255,102,0.15)]'
                    : 'border-[var(--neon-green-border)] bg-black/40 hover:border-[var(--neon-green)]/40'
                }`}
              >
                <div className="relative">
                  <img
                    src={peer.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100'}
                    alt={peer.displayName}
                    className="w-11 h-11 rounded-full object-cover border border-black"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black"></span>
                </div>
                <span className="text-[9px] font-black text-white max-w-[65px] truncate">
                  {peer.displayName?.split(' ')[0] || peer.username}
                </span>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCall(peer.uid, peer.displayName || 'Peer', peer.photoURL || '', 'voice');
                    }}
                    className="p-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black transition"
                    title="Live Voice Call"
                  >
                    <PhoneCall className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDirectChat(peer.uid);
                    }}
                    className="p-1 rounded-full bg-[var(--neon-green)]/20 hover:bg-[var(--neon-green)] text-[var(--neon-green)] hover:text-black transition"
                    title="Open Chat"
                  >
                    <Send className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: RECENT VOICE CONVERSATIONS WITH SMART MEDIA STATUS             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Column: Recent Voice Conversations */}
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />
              <span className="text-[10px] font-black uppercase text-[var(--neon-green)] tracking-wider">
                RECENT VOICE FLOWS
              </span>
            </div>
            <span className="text-[8px] text-zinc-500 uppercase">Local Storage Indexed</span>
          </div>

          {recentConversations.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono italic">
              No recent voice bursts recorded. Tap FLICK to start your first voice transmission!
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentConversations.map((conv) => (
                <div
                  key={conv.conversationId}
                  className="p-3 bg-black/40 border border-[var(--neon-green-border)] hover:border-[var(--neon-green)]/60 rounded-xl space-y-2 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--neon-green)]"></span>
                      <span className="text-xs font-black text-white">{conv.peerName}</span>
                      {conv.savedCount > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                          📌 {conv.savedCount} SAVED
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onOpenDirectChat(conv.peerId)}
                      className="text-[9px] text-[var(--neon-green)] hover:underline font-bold"
                    >
                      OPEN CONDUIT →
                    </button>
                  </div>

                  {/* Voice Note Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {conv.voiceNotes.map((note: LocalMessageRecord) => {
                      const isPlaying = activePlayingId === note.messageId;
                      return (
                        <div
                          key={note.messageId}
                          onClick={() => handlePlayVoiceMessage(note)}
                          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-[10px] cursor-pointer shrink-0 transition ${
                            isPlaying
                              ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[0_0_15px_rgba(0,255,102,0.3)]'
                              : 'bg-[var(--color-surface)] border-[var(--neon-green-border)] text-zinc-300 hover:border-[var(--neon-green)]'
                          }`}
                        >
                          {isPlaying ? (
                            <Pause className="w-3 h-3 fill-black" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                          <span className="font-mono font-bold">
                            🎙️ 0:{note.duration < 10 ? `0${note.duration}` : note.duration}
                          </span>

                          {/* SMART LOCAL MEDIA INDEX BADGE */}
                          {note.mediaStatus === 'SAVED' ? (
                            <span title="Pinned to Local Vault">📌</span>
                          ) : note.mediaStatus === 'LOCAL' ? (
                            <span title="Stored locally on this device">💾</span>
                          ) : note.mediaStatus === 'REMOTE_ONLY' ? (
                            <span title="Available in temporary cloud relay">☁️</span>
                          ) : (
                            <span title="Expired temporary copy">⚠️</span>
                          )}

                          <button
                            onClick={(e) => handleToggleSave(note.messageId, e)}
                            className="text-zinc-500 hover:text-amber-400 transition"
                            title="Toggle Save"
                          >
                            <Bookmark className={`w-3 h-3 ${note.saved ? 'text-amber-400 fill-amber-400' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Personal Voice Vault / Starred Memories */}
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                PERSONAL VOICE VAULT ({voiceMemories.length})
              </span>
            </div>
            <button
              onClick={() => {
                playGlitchClickSound();
                setShowVaultTransferModal(true);
              }}
              className="text-[8px] font-mono text-[var(--neon-green)] hover:underline flex items-center gap-1 uppercase"
            >
              <ArrowRightLeft className="w-2.5 h-2.5" /> Sync / Export
            </button>
          </div>

          {voiceMemories.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono italic">
              No saved voice thoughts in vault. Star any voice note or tap Save Memory to pin your thoughts here!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {voiceMemories.map((mem) => {
                const isPlaying = activePlayingId === mem.id;
                return (
                  <div
                    key={mem.id}
                    className="p-3 bg-black/40 border border-amber-500/30 rounded-xl flex items-center justify-between hover:border-amber-400 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          if (isPlaying && activeAudioRef.current) {
                            activeAudioRef.current.pause();
                            setActivePlayingId(null);
                          } else {
                            if (activeAudioRef.current) activeAudioRef.current.pause();
                            const audio = new Audio(mem.audioData);
                            activeAudioRef.current = audio;
                            audio.onended = () => setActivePlayingId(null);
                            audio.play();
                            setActivePlayingId(mem.id);
                          }
                        }}
                        className="p-2.5 rounded-xl bg-amber-400 text-black font-bold hover:scale-105 transition"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                      </button>

                      <div>
                        <span className="text-xs font-black text-zinc-200 block">
                          {mem.transcript || `Voice Thought ${new Date(mem.createdAt).toLocaleDateString()}`}
                        </span>
                        <span className="text-[8px] text-zinc-500">
                          {new Date(mem.createdAt).toLocaleDateString()} • 0:{mem.duration < 10 ? `0${mem.duration}` : mem.duration}s
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-[9px] font-bold text-amber-400">
                      <span>📌 VAULTED</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* DEVICE VAULT TRANSFER & BACKUP MODAL */}
      {showVaultTransferModal && (
        <DeviceVaultTransferModal
          isOpen={showVaultTransferModal}
          onClose={() => setShowVaultTransferModal(false)}
          onDataRestored={() => loadLocalVoiceData()}
        />
      )}

    </div>
  );
}
