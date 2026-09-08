import React, { useState, useEffect } from 'react';
import { Smartphone, Zap, Check, RotateCcw, Volume2, ShieldAlert } from 'lucide-react';
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
  setVibrationIntensity
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
  const [likeIntensity, setLikeIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('like'));
  const [testedEvent, setTestedEvent] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setMasterEnabled(isVibrationEnabled());
      const map = {} as Record<HapticTriggerEvent, boolean>;
      HAPTIC_TRIGGER_DEFINITIONS.forEach(def => {
        map[def.id] = isHapticTriggerEnabled(def.id);
      });
      setTriggersState(map);
      setMessageIntensity(getVibrationIntensity('message'));
      setLikeIntensity(getVibrationIntensity('like'));
    };

    window.addEventListener('flick_haptics_updated', handleUpdate);
    return () => window.removeEventListener('flick_haptics_updated', handleUpdate);
  }, []);

  const handleMasterToggle = (val: boolean) => {
    setMasterEnabled(val);
    setVibrationEnabled(val);
    playGlitchClickSound();
    if (val) {
      triggerEventHaptic('button_click');
    }
    onNotifyChange?.();
  };

  const handleToggleTrigger = (id: HapticTriggerEvent, enabled: boolean) => {
    setHapticTriggerEnabled(id, enabled);
    setTriggersState(prev => ({ ...prev, [id]: enabled }));
    playGlitchClickSound();
    if (enabled) {
      triggerEventHaptic(id);
    }
    onNotifyChange?.();
  };

  const handleTestTrigger = (id: HapticTriggerEvent) => {
    setTestedEvent(id);
    playLikeSound();
    triggerEventHaptic(id);
    setTimeout(() => {
      setTestedEvent(null);
    }, 600);
  };

  const handleResetDefaults = () => {
    playGlitchClickSound();
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
    setVibrationIntensity('like', 'light');
    setMessageIntensity('medium');
    setLikeIntensity('light');
    triggerEventHaptic('reaction');
    onNotifyChange?.();
  };

  const isVibrationSupported = typeof navigator !== 'undefined' && Boolean(navigator.vibrate);

  return (
    <div className="space-y-5 font-mono text-[var(--color-text)]">
      {/* Header Overview */}
      <div className="border-b border-[var(--neon-green-border)] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[var(--neon-green)]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--neon-green)]">
              Tactile Haptic Triggers
            </h3>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-[9px] uppercase px-2.5 py-1 border border-zinc-700 bg-zinc-900/60 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition cursor-pointer"
            title="Reset haptic triggers to system defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
          Configure granular haptic feedback sequences. Customize which operational interactions trigger tactile vibration bursts across your device.
        </p>
      </div>

      {!isVibrationSupported && (
        <div className="p-3 border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase text-[10px] tracking-wider block">Desktop / Unaccelerated Browser Notice</span>
            <p className="text-[10px] text-amber-200/80 leading-normal">
              Your current environment does not expose the W3C Vibration API. Settings configured here will automatically engage when accessing Fara Flick on supported Android / iOS mobile PWA wrappers.
            </p>
          </div>
        </div>
      )}

      {/* Master Vibration Switch */}
      <div className="p-4 glass-panel border border-[var(--glass-border)] bg-[var(--color-surface)]/70 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
              Master Tactile Engine
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
            Global toggle for all tactile vibration patterns and physics responses.
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
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
              masterEnabled ? 'translate-x-5 bg-black' : 'translate-x-0 bg-zinc-400'
            }`}
          />
        </button>
      </div>

      {/* Granular Event Triggers Grid */}
      <div className={`space-y-2.5 transition-opacity duration-200 ${masterEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            Event-Specific Triggers ({HAPTIC_TRIGGER_DEFINITIONS.length})
          </span>
          <span className="text-[9px] text-zinc-500 font-mono">
            {Object.values(triggersState).filter(Boolean).length} / {HAPTIC_TRIGGER_DEFINITIONS.length} ENGAGED
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {HAPTIC_TRIGGER_DEFINITIONS.map((trigger) => {
            const isEnabled = triggersState[trigger.id] ?? trigger.defaultEnabled;
            const isTesting = testedEvent === trigger.id;

            return (
              <div
                key={trigger.id}
                className={`p-3 border transition-all duration-150 flex items-center justify-between gap-3 ${
                  isEnabled
                    ? 'border-[var(--neon-green-border)] bg-[var(--color-surface)]/50 hover:border-[var(--neon-green)]/40'
                    : 'border-zinc-900 bg-black/40 opacity-75'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`trigger-${trigger.id}`}
                      checked={isEnabled}
                      onChange={(e) => handleToggleTrigger(trigger.id, e.target.checked)}
                      className="accent-[var(--neon-green)] cursor-pointer w-3.5 h-3.5"
                    />
                    <label
                      htmlFor={`trigger-${trigger.id}`}
                      className="text-xs font-bold uppercase tracking-wide cursor-pointer text-[var(--color-text)] flex items-center gap-2"
                    >
                      <span>{trigger.label}</span>
                      <span className={`text-[8px] px-1 py-0.2 border uppercase ${
                        isEnabled
                          ? 'border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-black'
                          : 'border-zinc-800 text-zinc-600 bg-zinc-900/50'
                      }`}>
                        {isEnabled ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-400 pl-5 leading-normal">
                    {trigger.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestTrigger(trigger.id)}
                  disabled={!isEnabled}
                  className={`px-2.5 py-1.5 text-[9px] uppercase font-bold tracking-wider border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isTesting
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black scale-95'
                      : isEnabled
                        ? 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)]'
                        : 'border-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                  }`}
                  title={`Test ${trigger.label} vibration`}
                >
                  <Zap className={`w-3 h-3 ${isTesting ? 'animate-bounce text-black' : 'text-[var(--neon-green)]'}`} />
                  <span>{isTesting ? 'FIRING' : 'TEST'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Intensity Fine Tuning for Core Events */}
      <div className={`p-4 border border-[var(--neon-green-border)]/50 bg-[var(--color-surface)]/30 space-y-3.5 ${masterEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text)]">
            Intensity Profiles for Primary Signals
          </span>
        </div>

        {/* Message Intensity */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400">
            <span>Inbound Transmission Intensity</span>
            <span className="text-[var(--neon-green)] font-bold">{messageIntensity}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(['off', 'light', 'medium', 'heavy', 'double'] as const).map((level) => (
              <button
                key={`msg-${level}`}
                type="button"
                onClick={() => {
                  setMessageIntensity(level);
                  setVibrationIntensity('message', level);
                  playGlitchClickSound();
                  if (level !== 'off') triggerEventHaptic('message_received', level);
                }}
                className={`py-1.5 text-[9px] font-bold uppercase border transition cursor-pointer ${
                  messageIntensity === level
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-black'
                    : 'border-zinc-800 bg-black/60 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Like Intensity */}
        <div className="space-y-1.5 pt-1 border-t border-zinc-900">
          <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400">
            <span>Affirmation / Like Signal Intensity</span>
            <span className="text-[var(--neon-green)] font-bold">{likeIntensity}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(['off', 'light', 'medium', 'heavy', 'double'] as const).map((level) => (
              <button
                key={`like-${level}`}
                type="button"
                onClick={() => {
                  setLikeIntensity(level);
                  setVibrationIntensity('like', level);
                  playGlitchClickSound();
                  if (level !== 'off') triggerEventHaptic('like', level);
                }}
                className={`py-1.5 text-[9px] font-bold uppercase border transition cursor-pointer ${
                  likeIntensity === level
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-black'
                    : 'border-zinc-800 bg-black/60 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
