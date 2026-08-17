import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  Search, 
  Star, 
  HardDrive, 
  Trash2, 
  Download, 
  Play, 
  Pause, 
  Sparkles, 
  Clock, 
  Filter, 
  FileAudio,
  Check,
  ShieldCheck
} from 'lucide-react';
import { 
  LocalVoiceNote, 
  searchLocalVoiceVault, 
  getSavedVoiceMemories, 
  toggleSaveVoiceMemory, 
  getVoiceVaultStats, 
  purgeUnsavedVoiceNotes,
  exportVoiceNoteToDevice 
} from '../lib/voiceVault';
import { triggerVibration } from '../lib/haptics';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface VoiceMemoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string;
  chatTitle?: string;
}

export function VoiceMemoriesModal({
  isOpen,
  onClose,
  chatId,
  chatTitle,
}: VoiceMemoriesModalProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'starred' | 'chat'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<LocalVoiceNote[]>([]);
  const [stats, setStats] = useState<{
    totalNotes: number;
    totalSavedMemories: number;
    totalSizeBytes: number;
    totalDurationSeconds: number;
  }>({
    totalNotes: 0,
    totalSavedMemories: 0,
    totalSizeBytes: 0,
    totalDurationSeconds: 0,
  });

  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const activeAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const loadData = async () => {
    try {
      const currentStats = await getVoiceVaultStats();
      setStats(currentStats);

      let fetchedNotes: LocalVoiceNote[] = [];
      if (activeFilter === 'starred') {
        fetchedNotes = await getSavedVoiceMemories();
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          fetchedNotes = fetchedNotes.filter(n => 
            (n.transcript && n.transcript.toLowerCase().includes(q)) ||
            (n.senderName && n.senderName.toLowerCase().includes(q))
          );
        }
      } else if (activeFilter === 'chat' && chatId) {
        fetchedNotes = await searchLocalVoiceVault(searchQuery, chatId);
      } else {
        fetchedNotes = await searchLocalVoiceVault(searchQuery);
      }

      setNotes(fetchedNotes);
    } catch (e) {
      console.warn('Failed to load voice vault items:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        setActivePlayingId(null);
      }
    }
  }, [isOpen, activeFilter, searchQuery]);

  const togglePlayNote = (note: LocalVoiceNote) => {
    playGlitchClickSound();
    triggerVibration('light');

    if (activePlayingId === note.id) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        setActivePlayingId(null);
      }
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const audio = new Audio(note.audioData);
      audio.playbackRate = audioSpeed;
      activeAudioRef.current = audio;
      audio.onended = () => setActivePlayingId(null);
      audio.play().then(() => {
        setActivePlayingId(note.id);
      }).catch(err => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const handleToggleStar = async (noteId: string) => {
    playLikeSound();
    triggerVibration('medium');
    await toggleSaveVoiceMemory(noteId);
    await loadData();
  };

  const handlePurge = async () => {
    if (window.confirm('Clear unsaved temporary voice notes from local device cache? Starred memories will be preserved.')) {
      triggerVibration('heavy');
      await purgeUnsavedVoiceNotes(true);
      await loadData();
    }
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md font-mono">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-3xl bg-[var(--color-surface)] border-2 border-[var(--neon-green)] shadow-[0_0_30px_rgba(0,255,102,0.2)] flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 bg-black border-b border-[var(--neon-green)]/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[var(--neon-green)] text-black font-black">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif font-black text-base text-[var(--color-text)] uppercase tracking-wider flex items-center gap-2">
                  LOCAL VOICE VAULT & MEMORIES
                </h2>
                <p className="text-[9.5px] text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-[var(--neon-green)]" />
                  100% Device-Owned Storage • 0% Cloud Dependency
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 border border-zinc-800 hover:border-white text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="px-4 py-2.5 bg-black/50 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[9px] text-zinc-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-[var(--neon-green)]" />
                <span>VAULT SIZE: <strong className="text-white">{formatBytes(stats.totalSizeBytes)}</strong></span>
              </span>
              <span>TOTAL CLIPS: <strong className="text-white">{stats.totalNotes}</strong></span>
              <span>SAVED MEMORIES: <strong className="text-amber-400">{stats.totalSavedMemories}</strong></span>
              <span>TOTAL AIRTIME: <strong className="text-cyan-400">{formatSecs(stats.totalDurationSeconds)}</strong></span>
            </div>

            <button
              type="button"
              onClick={handlePurge}
              className="px-2 py-1 text-[8.5px] font-bold uppercase border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-400 transition cursor-pointer flex items-center gap-1"
              title="Clear temporary voice cache while keeping starred memories"
            >
              <Trash2 className="w-2.5 h-2.5" />
              PURGE UNSAVED CACHE
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-3 bg-zinc-950/80 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 text-[9px] font-black uppercase border transition cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                ALL VOICE CLIPS
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('starred')}
                className={`px-3 py-1.5 text-[9px] font-black uppercase border transition cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'starred'
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <Star className="w-2.5 h-2.5 fill-current" />
                STARRED MEMORIES
              </button>
              {chatId && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('chat')}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase border transition cursor-pointer ${
                    activeFilter === 'chat'
                      ? 'bg-cyan-400 text-black border-cyan-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  THIS CONDUIT
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search speech transcripts or contact names..."
                className="w-full pl-8 pr-3 py-1.5 bg-black border border-zinc-800 focus:border-[var(--neon-green)] text-xs text-white placeholder-zinc-500 outline-none"
              />
            </div>
          </div>

          {/* List of Voice Notes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--color-background)]">
            {notes.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 space-y-2">
                <FileAudio className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-xs uppercase font-bold tracking-wider">No voice recordings located in vault</p>
                <p className="text-[9px] text-zinc-600">Start talking in any conversation tunnel to build your local-first audio archive.</p>
              </div>
            ) : (
              notes.map((note) => {
                const isPlaying = activePlayingId === note.id;

                return (
                  <div
                    key={note.id}
                    className={`p-3 border transition-all ${
                      isPlaying 
                        ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] shadow-[0_0_12px_rgba(0,255,102,0.15)]' 
                        : 'bg-black/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Play Button + Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => togglePlayNote(note)}
                          className={`w-9 h-9 shrink-0 flex items-center justify-center border transition-all cursor-pointer ${
                            isPlaying
                              ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                              : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:border-[var(--neon-green)]'
                          }`}
                        >
                          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
                        </button>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase text-white truncate">
                              {note.senderName || 'Anonymous Node'}
                            </span>
                            <span className="text-[8px] font-bold px-1 py-0.2 border border-zinc-700 text-zinc-400">
                              {formatSecs(note.duration)}
                            </span>
                            <span className="text-[8px] text-zinc-500">
                              {formatBytes(note.sizeBytes)}
                            </span>
                          </div>

                          {/* Mini Waveform preview */}
                          <div className="h-4 flex items-center gap-[1px] w-32 sm:w-48">
                            {note.waveform.slice(0, 24).map((amp, i) => (
                              <div
                                key={i}
                                style={{ height: `${Math.max(20, Math.round(amp * 100))}%` }}
                                className={`w-full ${isPlaying ? 'bg-[var(--neon-green)]' : 'bg-zinc-700'}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions (Star / Export) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleStar(note.id)}
                          className={`p-1.5 border transition cursor-pointer ${
                            note.isSaved
                              ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                          title="Star to local memories"
                        >
                          <Star className={`w-3.5 h-3.5 ${note.isSaved ? 'fill-amber-400' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => exportVoiceNoteToDevice(note.audioData, `flick-memory-${note.id}.webm`)}
                          className="p-1.5 border border-zinc-800 hover:border-[var(--neon-green)] text-zinc-400 hover:text-[var(--neon-green)] transition cursor-pointer"
                          title="Export voice note file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Speech Transcript */}
                    {note.transcript && (
                      <div className="mt-2 pt-2 border-t border-zinc-850 text-[9.5px] text-zinc-300 font-sans italic">
                        "{note.transcript}"
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-black border-t border-zinc-800 flex items-center justify-between text-[8.5px] text-zinc-500">
            <span>FLICK LOCAL-FIRST VOICE PROTOCOL</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold uppercase cursor-pointer"
            >
              CLOSE VAULT
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
