import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Keyboard, 
  Send, 
  CheckCheck, 
  Sparkles, 
  Radio, 
  Sliders, 
  Headphones, 
  Flame, 
  Zap, 
  Play,
  Mic,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { 
  isInteractionSoundsEnabled, 
  setInteractionSoundsEnabled,
  isTypingSoundEnabled,
  isSendMessageSoundEnabled,
  isReceiveMessageSoundEnabled,
  isReadMessageSoundEnabled,
  getTypingSoundStyle,
  setTypingSoundStyle,
  setSoundSetting,
  playTypingSound,
  playSendMessageSound,
  playReceiveMessageSound,
  playMessageReadSound,
  playGlitchClickSound,
  playLikeSound,
  TypingSoundStyle
} from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { MicrophoneDiagnosticPanel } from './MicrophoneDiagnosticPanel';
import { microphoneService, MicrophoneStatusInfo } from '../lib/microphoneService';

interface SettingsAudioTabProps {
  interactionSoundsEnabled: boolean;
  setInteractionSoundsEnabled: (val: boolean) => void;
}

export function SettingsAudioTab({
  interactionSoundsEnabled,
  setInteractionSoundsEnabled: setParentInteractionSounds
}: SettingsAudioTabProps) {
  const [interactionSounds, setInteractionSounds] = useState<boolean>(() => isInteractionSoundsEnabled());
  const [typingSoundEnabled, setTypingSoundEnabled] = useState<boolean>(() => isTypingSoundEnabled());
  const [typingSoundStyle, setTypingSoundStyleState] = useState<TypingSoundStyle>(() => getTypingSoundStyle());
  const [sendSoundEnabled, setSendSoundEnabled] = useState<boolean>(() => isSendMessageSoundEnabled());
  const [receiveSoundEnabled, setReceiveSoundEnabled] = useState<boolean>(() => isReceiveMessageSoundEnabled());
  const [readSoundEnabled, setReadSoundEnabled] = useState<boolean>(() => isReadMessageSoundEnabled());
  const [showDiagModal, setShowDiagModal] = useState<boolean>(false);
  const [micStatus, setMicStatus] = useState<MicrophoneStatusInfo>(microphoneService.getStatus());

  useEffect(() => {
    const unsub = microphoneService.subscribe((status) => {
      setMicStatus(status);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      setInteractionSounds(isInteractionSoundsEnabled());
      setTypingSoundEnabled(isTypingSoundEnabled());
      setTypingSoundStyleState(getTypingSoundStyle());
      setSendSoundEnabled(isSendMessageSoundEnabled());
      setReceiveSoundEnabled(isReceiveMessageSoundEnabled());
      setReadSoundEnabled(isReadMessageSoundEnabled());
    };
    window.addEventListener('flick_sounds_updated', handleUpdate);
    return () => window.removeEventListener('flick_sounds_updated', handleUpdate);
  }, []);

  const handleToggleInteractionSounds = (enabled: boolean) => {
    setInteractionSounds(enabled);
    setParentInteractionSounds(enabled);
    setInteractionSoundsEnabled(enabled);
    if (enabled) {
      setTimeout(() => playGlitchClickSound(), 50);
      triggerVibration('light');
    }
  };

  const handleToggleTyping = (enabled: boolean) => {
    setTypingSoundEnabled(enabled);
    setSoundSetting('typing', enabled);
    if (enabled) {
      playTypingSound('a');
      triggerVibration('light');
    }
  };

  const handleStyleChange = (style: TypingSoundStyle) => {
    setTypingSoundStyleState(style);
    setTypingSoundStyle(style);
    playTypingSound('a');
    triggerVibration('light');
  };

  const handleToggleSend = (enabled: boolean) => {
    setSendSoundEnabled(enabled);
    setSoundSetting('send', enabled);
    if (enabled) {
      playSendMessageSound();
      triggerVibration('light');
    }
  };

  const handleToggleReceive = (enabled: boolean) => {
    setReceiveSoundEnabled(enabled);
    setSoundSetting('receive', enabled);
    if (enabled) {
      playReceiveMessageSound();
      triggerVibration('light');
    }
  };

  const handleToggleRead = (enabled: boolean) => {
    setReadSoundEnabled(enabled);
    setSoundSetting('read', enabled);
    if (enabled) {
      playMessageReadSound();
      triggerVibration('light');
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Info */}
      <div className="border-b border-[var(--neon-green)]/20 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-serif font-black uppercase text-sm text-[var(--color-text)] flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />
            AUDIO & INTERACTION FREQUENCIES
          </h3>
          <p className="text-[9px] text-zinc-400 uppercase tracking-widest mt-0.5">
            Configure real-time haptic & audio acoustics for typing, transmissions and receipts
          </p>
        </div>
      </div>

      {/* Master Interaction Sounds Toggle */}
      <div className={`p-4 border transition-all ${
        interactionSounds 
          ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] shadow-[0_0_15px_rgba(0,255,102,0.15)]' 
          : 'bg-black/60 border-zinc-800'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider ${
                interactionSounds ? 'text-[var(--neon-green)]' : 'text-zinc-400'
              }`}>
                ENABLE INTERACTION SOUNDS
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${
                interactionSounds 
                  ? 'border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--neon-green)]/10' 
                  : 'border-zinc-700 text-zinc-500'
              }`}>
                {interactionSounds ? 'ACTIVE' : 'MUTED'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed max-w-md">
              Master control for all user interface audio feedback including keypresses, glitch clicks, like reactions, outgoing sends, and incoming message chimes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleToggleInteractionSounds(!interactionSounds)}
            className={`px-4 py-2 text-[10px] font-black uppercase border transition-all cursor-pointer shrink-0 ${
              interactionSounds
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] hover:bg-white shadow-[2px_2px_0px_#ffffff]'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {interactionSounds ? 'ON / ENABLED' : 'OFF / DISABLED'}
          </button>
        </div>
      </div>

      {/* Sub-toggles Section */}
      <div className={`space-y-4 transition-opacity ${interactionSounds ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        
        {/* Keyboard Typing Sounds & Switch Style */}
        <div className="p-3.5 bg-black/40 border border-[var(--neon-green-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5 text-[var(--neon-green)]" />
              <span className="text-[11px] font-bold uppercase text-[var(--color-text)]">
                Keyboard Typing Feedback
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleTyping(!typingSoundEnabled)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase border cursor-pointer ${
                typingSoundEnabled 
                  ? 'bg-[var(--neon-green)]/20 border-[var(--neon-green)] text-[var(--neon-green)]' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              {typingSoundEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
          <p className="text-[9px] text-zinc-400">
            Produces subtle, responsive acoustic clicks while typing encrypted dialogues in the message input field.
          </p>

          {typingSoundEnabled && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
              <span className="text-[8px] uppercase tracking-wider text-zinc-500 block">
                SWITCH ACOUSTIC PROFILE
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {[
                  { id: 'modern', label: 'Modern (Soft)' },
                  { id: 'thock', label: 'Thock (Deep)' },
                  { id: 'bubble', label: 'Bubble (Pop)' },
                  { id: 'cyber', label: 'Cyber (Laser)' },
                  { id: 'clack', label: 'Clack (Crisp)' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleStyleChange(st.id as TypingSoundStyle)}
                    className={`p-1.5 text-[8.5px] uppercase font-bold border text-center transition cursor-pointer ${
                      typingSoundStyle === st.id
                        ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-extrabold shadow-[1px_1px_0px_#ffffff]'
                        : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Status Sound Transitions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Sent Sound */}
          <div className="p-3 bg-black/40 border border-[var(--neon-green-border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-[var(--neon-green)] flex items-center gap-1.5">
                  <Send className="w-3 h-3" />
                  Sent Chime
                </span>
                <input
                  type="checkbox"
                  checked={sendSoundEnabled}
                  onChange={(e) => handleToggleSend(e.target.checked)}
                  className="accent-[var(--neon-green)] cursor-pointer"
                />
              </div>
              <p className="text-[8.5px] text-zinc-400 leading-tight">
                Plays an energetic upward frequency when your message is broadcast.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { playSendMessageSound(); triggerVibration('light'); }}
              className="w-full py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[8px] uppercase font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Play className="w-2.5 h-2.5 text-[var(--neon-green)]" />
              Audition Sent
            </button>
          </div>

          {/* Received Sound */}
          <div className="p-3 bg-black/40 border border-[var(--neon-green-border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-cyan-400 flex items-center gap-1.5">
                  <Radio className="w-3 h-3" />
                  Received Chime
                </span>
                <input
                  type="checkbox"
                  checked={receiveSoundEnabled}
                  onChange={(e) => handleToggleReceive(e.target.checked)}
                  className="accent-cyan-400 cursor-pointer"
                />
              </div>
              <p className="text-[8.5px] text-zinc-400 leading-tight">
                Plays a dual-tone whistle when a remote node transmits a message.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { playReceiveMessageSound(); triggerVibration('light'); }}
              className="w-full py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[8px] uppercase font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Play className="w-2.5 h-2.5 text-cyan-400" />
              Audition Receive
            </button>
          </div>

          {/* Read Sound */}
          <div className="p-3 bg-black/40 border border-[var(--neon-green-border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                  <CheckCheck className="w-3 h-3" />
                  Read Receipts
                </span>
                <input
                  type="checkbox"
                  checked={readSoundEnabled}
                  onChange={(e) => handleToggleRead(e.target.checked)}
                  className="accent-emerald-400 cursor-pointer"
                />
              </div>
              <p className="text-[8.5px] text-zinc-400 leading-tight">
                Plays crisp dual-ticks when a recipient opens and reads your message.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { playMessageReadSound(); triggerVibration('light'); }}
              className="w-full py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[8px] uppercase font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Play className="w-2.5 h-2.5 text-emerald-400" />
              Audition Read
            </button>
          </div>

        </div>

        {/* UI Interaction Audition Deck */}
        <div className="p-3 bg-black/40 border border-[var(--neon-green-border)] space-y-2">
          <span className="text-[9px] font-bold uppercase text-zinc-400 block">
            System Interaction Sound Bank Audition
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => { playTypingSound('a'); triggerVibration('light'); }}
              className="py-1.5 px-2 bg-zinc-900 border border-zinc-750 hover:border-[var(--neon-green)] text-[8.5px] text-zinc-300 uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Keyboard className="w-3 h-3 text-[var(--neon-green)]" />
              Typing Key
            </button>
            <button
              type="button"
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); }}
              className="py-1.5 px-2 bg-zinc-900 border border-zinc-750 hover:border-[var(--neon-green)] text-[8.5px] text-zinc-300 uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              Glitch Click
            </button>
            <button
              type="button"
              onClick={() => { playLikeSound(); triggerVibration('medium'); }}
              className="py-1.5 px-2 bg-zinc-900 border border-zinc-750 hover:border-[var(--neon-green)] text-[8.5px] text-zinc-300 uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-pink-400" />
              Like Reaction
            </button>
            <button
              type="button"
              onClick={() => { playSendMessageSound(); triggerVibration('medium'); }}
              className="py-1.5 px-2 bg-zinc-900 border border-zinc-750 hover:border-[var(--neon-green)] text-[8.5px] text-zinc-300 uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3 h-3 text-[var(--neon-green)]" />
              Send Sound
            </button>
          </div>
        </div>

        {/* Hardware Microphone & Media Bridge Diagnostic Launcher */}
        <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-[var(--neon-green)]" />
              <span className="text-[10px] font-black uppercase text-white tracking-wider">
                Microphone Hardware & Permissions Suite
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
              micStatus.state === 'granted'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : micStatus.isBlocked
                ? 'bg-red-950 text-red-300 border border-red-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {micStatus.state}
            </span>
          </div>
          <p className="text-[9px] text-zinc-400 leading-relaxed">
            Test active audio input frequencies, view platform security policies, detect connected input devices, or reset blocked browser/Electron microphone states.
          </p>
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setShowDiagModal(true);
            }}
            className="w-full py-2 bg-[var(--neon-green)] text-black font-black uppercase text-[9.5px] tracking-wider rounded-lg hover:bg-white transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(0,255,102,0.2)]"
          >
            <Activity className="w-3.5 h-3.5" />
            Launch Hardware & Mic Diagnostic Test
          </button>
        </div>

      </div>

      {showDiagModal && (
        <MicrophoneDiagnosticPanel
          isOpen={showDiagModal}
          onClose={() => setShowDiagModal(false)}
        />
      )}
    </div>
  );
}
