import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Zap, 
  RotateCcw, 
  Volume2, 
  ShieldAlert, 
  Check, 
  MessageSquare, 
  PhoneIncoming, 
  MousePointerClick, 
  Heart,
  Sliders,
  Activity
} from 'lucide-react';
import {
  isVibrationEnabled,
  setVibrationEnabled,
  isHapticTriggerEnabled,
  setHapticTriggerEnabled,
  HAPTIC_TRIGGER_DEFINITIONS,
  HapticTriggerEvent,
  triggerEventHaptic,
  VibrationIntensity,
  getVibrationIntensity,
  setVibrationIntensity,
  triggerVibration
} from '../lib/haptics';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface SettingsHapticsTabProps {
  onNotifyChange?: () => void;
}

export const SettingsHapticsTab: React.FC<SettingsHapticsTabProps> = ({ onNotifyChange }) => {
  const [masterEnabled, setMasterEnabled] = useState(() => isVibrationEnabled());
  const [triggersState, setTriggersState] = useState<Record<HapticTriggerEvent, boolean>>(() => {
    const map = {} as Record<HapticTriggerEvent, boolean>;
    HAPTIC_TRIGGER_DEFINITIONS.forEach(def => {
      map[def.id] = isHapticTriggerEnabled(def.id);
    });
    return map;
  });

  const [messageIntensity, setMessageIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('message'));
  const [callIntensity, setCallIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('call_incoming'));
  const [buttonIntensity, setButtonIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('button_click'));
  const [likeIntensity, setLikeIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('like'));
  const [globalIntensity, setGlobalIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('global'));

  const [testedEvent, setTestedEvent] = useState<string | null>(null);
  const [waveformActive, setWaveformActive] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      setMasterEnabled(isVibrationEnabled());
      const map = {} as Record<HapticTriggerEvent, boolean>;
      HAPTIC_TRIGGER_DEFINITIONS.forEach(def => {
        map[def.id] = isHapticTriggerEnabled(def.id);
      });
      setTriggersState(map);
      setMessageIntensity(getVibrationIntensity('message'));
      setCallIntensity(getVibrationIntensity('call_incoming'));
      setButtonIntensity(getVibrationIntensity('button_click'));
      setLikeIntensity(getVibrationIntensity('like'));
      setGlobalIntensity(getVibrationIntensity('global'));
    };

    window.addEventListener('flick_haptics_updated', handleUpdate);
    return () => window.removeEventListener('flick_haptics_updated', handleUpdate);
  }, []);

  const triggerVisualFeedback = () => {
    setWaveformActive(true);
    setTimeout(() => setWaveformActive(false), 500);
  };

  const handleMasterToggle = (val: boolean) => {
    setMasterEnabled(val);
    setVibrationEnabled(val);
    playGlitchClickSound();
    triggerVisualFeedback();
    if (val) {
      triggerVibration('medium');
    }
    onNotifyChange?.();
  };

  const handleToggleTrigger = (id: HapticTriggerEvent, enabled: boolean) => {
    setHapticTriggerEnabled(id, enabled);
    setTriggersState(prev => ({ ...prev, [id]: enabled }));
    playGlitchClickSound();
    triggerVisualFeedback();
    if (enabled) {
      triggerEventHaptic(id);
    }
    onNotifyChange?.();
  };

  const handleTestTrigger = (id: HapticTriggerEvent) => {
    setTestedEvent(id);
    playLikeSound();
    triggerVisualFeedback();
    triggerEventHaptic(id);
    setTimeout(() => {
      setTestedEvent(null);
    }, 600);
  };

  const handleSetIntensity = (
    action: 'message' | 'call_incoming' | 'button_click' | 'like' | 'global',
    intensity: VibrationIntensity
  ) => {
    setVibrationIntensity(action, intensity);
    playGlitchClickSound();
    triggerVisualFeedback();

    if (action === 'message') setMessageIntensity(intensity);
    if (action === 'call_incoming') setCallIntensity(intensity);
    if (action === 'button_click') setButtonIntensity(intensity);
    if (action === 'like') setLikeIntensity(intensity);
    if (action === 'global') {
      setGlobalIntensity(intensity);
      setMessageIntensity(intensity);
      setCallIntensity(intensity === 'subtle' ? 'light' : intensity);
      setButtonIntensity(intensity === 'heavy' || intensity === 'double' ? 'medium' : intensity);
      setLikeIntensity(intensity === 'double' ? 'heavy' : intensity);
      setVibrationIntensity('message', intensity);
      setVibrationIntensity('call_incoming', intensity === 'subtle' ? 'light' : intensity);
      setVibrationIntensity('button_click', intensity === 'heavy' || intensity === 'double' ? 'medium' : intensity);
      setVibrationIntensity('like', intensity === 'double' ? 'heavy' : intensity);
    }

    if (intensity !== 'off' && masterEnabled) {
      triggerVibration(intensity);
    }
    onNotifyChange?.();
  };

  const handleResetDefaults = () => {
    playGlitchClickSound();
    triggerVisualFeedback();
    setMasterEnabled(true);
    setVibrationEnabled(true);
    HAPTIC_TRIGGER_DEFINITIONS.forEach(def => {
      setHapticTriggerEnabled(def.id, def.defaultEnabled);
    });
    const map = {} as Record<HapticTriggerEvent, boolean>;
    HAPTIC_TRIGGER_DEFINITIONS.forEach(def => {
      map[def.id] = def.defaultEnabled;
    });
    setTriggersState(map);

    setVibrationIntensity('message', 'medium');
    setVibrationIntensity('call_incoming', 'heavy');
    setVibrationIntensity('button_click', 'subtle');
    setVibrationIntensity('like', 'light');
    setVibrationIntensity('global', 'medium');

    setMessageIntensity('medium');
    setCallIntensity('heavy');
    setButtonIntensity('subtle');
    setLikeIntensity('light');
    setGlobalIntensity('medium');

    triggerVibration('medium');
    onNotifyChange?.();
  };

  const isVibrationSupported = typeof navigator !== 'undefined' && Boolean(navigator.vibrate);

  const intensityLevels: VibrationIntensity[] = ['off', 'subtle', 'light', 'medium', 'heavy', 'double'];

  return (
    <div className="space-y-6 font-mono text-[var(--color-text)]">
      {/* Header Overview */}
      <div className="border-b border-[var(--neon-green-border)] pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[var(--neon-green)]" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--neon-green)] flex items-center gap-2">
                <span>Haptic Feedback</span>
                <span className="text-[9px] px-2 py-0.5 border border-[var(--neon-green-border)] text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-bold">
                  v2.0
                </span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-[9px] uppercase px-2.5 py-1.5 border border-zinc-700 bg-zinc-900/80 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition cursor-pointer font-bold"
            title="Reset haptic feedback settings to system defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
          Configure tactile vibrations for core interactions across Flick. Toggle vibration response per action (messages, calls, button presses) and fine-tune tactile intensity.
        </p>
      </div>

      {/* Hardware Status & Live Tactile Waveform Monitor */}
      <div className="p-3.5 border border-[var(--neon-green-border)] bg-[var(--color-surface)]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${isVibrationSupported ? 'bg-[var(--neon-green)] animate-pulse' : 'bg-amber-400'}`} />
          <div className="text-[10px] space-y-0.5">
            <div className="font-bold uppercase tracking-wider flex items-center gap-2">
              <span>{isVibrationSupported ? 'Device Vibration Engine: Active' : 'Desktop Preview: Visual Haptics Engaged'}</span>
            </div>
            <p className="text-zinc-500 text-[9px]">
              {isVibrationSupported 
                ? 'Direct W3C Vibration API connection confirmed.' 
                : 'Native vibration operates on supported mobile PWA and Android devices.'}
            </p>
          </div>
        </div>

        {/* Live Tactile Pulse Visualizer */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-black/60 border border-zinc-800 rounded">
          <Activity className={`w-3.5 h-3.5 ${waveformActive ? 'text-[var(--neon-green)] animate-spin' : 'text-zinc-500'}`} />
          <div className="flex items-end gap-0.5 h-4 w-16">
            <span className={`w-1 transition-all duration-100 bg-[var(--neon-green)] ${waveformActive ? 'h-4' : 'h-1.5 opacity-40'}`} />
            <span className={`w-1 transition-all duration-100 bg-[var(--neon-green)] ${waveformActive ? 'h-3' : 'h-1 opacity-30'}`} />
            <span className={`w-1 transition-all duration-100 bg-[var(--neon-green)] ${waveformActive ? 'h-4' : 'h-2 opacity-50'}`} />
            <span className={`w-1 transition-all duration-100 bg-[var(--neon-green)] ${waveformActive ? 'h-2' : 'h-1 opacity-30'}`} />
            <span className={`w-1 transition-all duration-100 bg-[var(--neon-green)] ${waveformActive ? 'h-4' : 'h-1.5 opacity-40'}`} />
          </div>
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest pl-1">
            {waveformActive ? 'PULSE' : 'IDLE'}
          </span>
        </div>
      </div>

      {/* Master Vibration Switch */}
      <div className="p-4 border-2 border-[var(--neon-green-border)] bg-[var(--color-surface)]/80 flex items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--color-text)]">
              Master Haptic Feedback
            </span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase border ${
              masterEnabled 
                ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]' 
                : 'border-zinc-700 bg-zinc-800 text-zinc-400'
            }`}>
              {masterEnabled ? 'ACTIVE' : 'MUTED'}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal">
            Master kill-switch for all tactile vibration patterns and physics responses across the app.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleMasterToggle(!masterEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            masterEnabled ? 'bg-[var(--neon-green)]' : 'bg-zinc-800'
          }`}
          role="switch"
          aria-checked={masterEnabled}
          title={masterEnabled ? "Mute all haptics" : "Enable all haptics"}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
              masterEnabled ? 'translate-x-5 bg-black' : 'translate-x-0 bg-zinc-400'
            }`}
          />
        </button>
      </div>

      {/* CORE ACTION TOGGLES & INTENSITY CONTROLS */}
      <div className={`space-y-4 transition-opacity duration-200 ${masterEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        
        {/* ACTION 1: MESSAGES (Inbound & Outbound) */}
        <div className="p-4 border border-[var(--neon-green-border)] bg-[var(--color-surface)]/50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-[var(--neon-green)] shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text)] block">
                  Messages Vibration
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  Tactile alert for incoming transmissions and sent confirmations.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleTestTrigger('message_received')}
                disabled={!triggersState['message_received']}
                className="px-2 py-1 text-[9px] uppercase font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3 h-3 text-[var(--neon-green)]" />
                <span>Test</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const nextState = !triggersState['message_received'];
                  handleToggleTrigger('message_received', nextState);
                  handleToggleTrigger('message_sent', nextState);
                }}
                className={`px-2.5 py-1 text-[9px] font-black uppercase border cursor-pointer transition ${
                  triggersState['message_received']
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                {triggersState['message_received'] ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Intensity selector for messages */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400">
              <span>Message Intensity</span>
              <span className="text-[var(--neon-green)] font-bold">{messageIntensity}</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {intensityLevels.map((lvl) => (
                <button
                  key={`msg-lvl-${lvl}`}
                  type="button"
                  onClick={() => handleSetIntensity('message', lvl)}
                  className={`py-1.5 text-[9px] font-bold uppercase border transition cursor-pointer text-center ${
                    messageIntensity === lvl
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-black'
                      : 'border-zinc-800 bg-black/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ACTION 2: CALL INCOMING */}
        <div className="p-4 border border-[var(--neon-green-border)] bg-[var(--color-surface)]/50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PhoneIncoming className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text)] block">
                  Incoming Call Cadence
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  Rhythmic haptic pulsing during peer-to-peer audio and video calls.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleTestTrigger('call_incoming')}
                disabled={!triggersState['call_incoming']}
                className="px-2 py-1 text-[9px] uppercase font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3 h-3 text-[var(--neon-green)]" />
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleTrigger('call_incoming', !triggersState['call_incoming'])}
                className={`px-2.5 py-1 text-[9px] font-black uppercase border cursor-pointer transition ${
                  triggersState['call_incoming']
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                {triggersState['call_incoming'] ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Intensity selector for calls */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400">
              <span>Call Intensity</span>
              <span className="text-[var(--neon-green)] font-bold">{callIntensity}</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {intensityLevels.map((lvl) => (
                <button
                  key={`call-lvl-${lvl}`}
                  type="button"
                  onClick={() => handleSetIntensity('call_incoming', lvl)}
                  className={`py-1.5 text-[9px] font-bold uppercase border transition cursor-pointer text-center ${
                    callIntensity === lvl
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-black'
                      : 'border-zinc-800 bg-black/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ACTION 3: BUTTON CLICKS */}
        <div className="p-4 border border-[var(--neon-green-border)] bg-[var(--color-surface)]/50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MousePointerClick className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text)] block">
                  Button Clicks & Keypresses
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  Tactile feedback when tapping navigation tabs, action buttons, and switches.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleTestTrigger('button_click')}
                disabled={!triggersState['button_click']}
                className="px-2 py-1 text-[9px] uppercase font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3 h-3 text-[var(--neon-green)]" />
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleTrigger('button_click', !triggersState['button_click'])}
                className={`px-2.5 py-1 text-[9px] font-black uppercase border cursor-pointer transition ${
                  triggersState['button_click']
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                {triggersState['button_click'] ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Intensity selector for button clicks */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400">
              <span>Click Intensity</span>
              <span className="text-[var(--neon-green)] font-bold">{buttonIntensity}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['off', 'subtle', 'light', 'medium'] as const).map((lvl) => (
                <button
                  key={`btn-lvl-${lvl}`}
                  type="button"
                  onClick={() => handleSetIntensity('button_click', lvl)}
                  className={`py-1.5 text-[9px] font-bold uppercase border transition cursor-pointer text-center ${
                    buttonIntensity === lvl
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-black'
                      : 'border-zinc-800 bg-black/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ACTION 4: LIKES & REACTIONS */}
        <div className="p-4 border border-[var(--neon-green-border)] bg-[var(--color-surface)]/50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Heart className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text)] block">
                  Likes & Reactions
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  Tactile feedback when liking dispatches, stories, or applying emoji reactions.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleTestTrigger('like')}
                disabled={!triggersState['like']}
                className="px-2 py-1 text-[9px] uppercase font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3 h-3 text-[var(--neon-green)]" />
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextState = !triggersState['like'];
                  handleToggleTrigger('like', nextState);
                  handleToggleTrigger('reaction', nextState);
                }}
                className={`px-2.5 py-1 text-[9px] font-black uppercase border cursor-pointer transition ${
                  triggersState['like']
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                {triggersState['like'] ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Intensity selector for likes */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400">
              <span>Reaction Intensity</span>
              <span className="text-[var(--neon-green)] font-bold">{likeIntensity}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(['off', 'subtle', 'light', 'medium', 'heavy'] as const).map((lvl) => (
                <button
                  key={`like-lvl-${lvl}`}
                  type="button"
                  onClick={() => handleSetIntensity('like', lvl)}
                  className={`py-1.5 text-[9px] font-bold uppercase border transition cursor-pointer text-center ${
                    likeIntensity === lvl
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-black'
                      : 'border-zinc-800 bg-black/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
