import React from 'react';
import { Eye, Shield } from 'lucide-react';
import { BrutalistTheme, THEMES } from '../lib/theme';
import { VibrationIntensity } from '../lib/haptics';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';

interface AccessibilityTabProps {
  selectedTheme: BrutalistTheme;
  setSelectedTheme: (theme: BrutalistTheme) => void;
  vibeEnabled: boolean;
  setVibeEnabled: (val: boolean) => void;
  vibeMessageIntensity: VibrationIntensity;
  setVibeMessageIntensity: (val: VibrationIntensity) => void;
  vibeLikeIntensity: VibrationIntensity;
  setVibeLikeIntensity: (val: VibrationIntensity) => void;
  sendShortcut: 'enter' | 'cmd-enter';
  setSendShortcut: (val: 'enter' | 'cmd-enter') => void;
  typingVisualStyle: 'pulse' | 'stealth' | 'minimal';
  setTypingVisualStyle: (val: 'pulse' | 'stealth' | 'minimal') => void;
  sessionCipherTtl: '5m' | '15m' | '1h' | 'infinite';
  setSessionCipherTtl: (val: '5m' | '15m' | '1h' | 'infinite') => void;
  chatLockEnabled: boolean;
  setChatLockEnabled: (val: boolean) => void;
  chatLockPin: string;
  setChatLockPin: (val: string) => void;
  applyTheme: (theme: BrutalistTheme) => void;
  isTaskMonitorEnabled: boolean;
  setIsTaskMonitorEnabled: (val: boolean) => void;
}

export function SettingsAccessibilityTab({
  selectedTheme,
  setSelectedTheme,
  vibeEnabled,
  setVibeEnabled,
  vibeMessageIntensity,
  setVibeMessageIntensity,
  vibeLikeIntensity,
  setVibeLikeIntensity,
  sendShortcut,
  setSendShortcut,
  typingVisualStyle,
  setTypingVisualStyle,
  sessionCipherTtl,
  setSessionCipherTtl,
  chatLockEnabled,
  setChatLockEnabled,
  chatLockPin,
  setChatLockPin,
  applyTheme,
  isTaskMonitorEnabled,
  setIsTaskMonitorEnabled
}: AccessibilityTabProps) {
  return (
    <div className="space-y-5">
      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <Eye className="w-4 h-4" /> AESTHETICS & HAPTOLOGY SETTINGS
      </h3>

      {/* Themes coordinates selection */}
      <div className="space-y-2">
        <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
          Brutalist Color Theme Accents
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['green', 'purple', 'white'] as BrutalistTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedTheme(t);
                playGlitchClickSound();
                applyTheme(t);
                if (vibeEnabled) triggerVibration('light');
              }}
              className={`py-2 text-[9px] font-mono uppercase tracking-wider border transition-all cursor-pointer font-black select-none ${
                selectedTheme === t
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] [box-shadow:2px_2px_0px_var(--neon-green)]'
                  : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {THEMES[t].name}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Task Monitor toggler */}
      <div className="flex items-start space-x-3 p-3 bg-zinc-950 border border-zinc-900">
        <input
          type="checkbox"
          id="taskMonitorEnabledSub"
          checked={isTaskMonitorEnabled}
          onChange={(e) => {
            const checked = e.target.checked;
            setIsTaskMonitorEnabled(checked);
            playGlitchClickSound();
            triggerVibration('medium');
          }}
          className="mt-1 accent-[var(--neon-green)] cursor-pointer"
        />
        <label htmlFor="taskMonitorEnabledSub" className="text-xs text-zinc-400 cursor-pointer select-none leading-snug">
          <span className="font-semibold block text-white font-mono uppercase text-[10px] tracking-wide mb-1">Enable Real-Time Task Monitor</span>
          Display floating background transmission and diagnostic monitoring spectrum in bottom-right.
        </label>
      </div>

      {/* Haptic properties checkbox */}
      <div className="flex items-start space-x-3 p-3 bg-zinc-950 border border-zinc-900">
        <input
          type="checkbox"
          id="vibrationHapticsSub"
          checked={vibeEnabled}
          onChange={(e) => {
            const checked = e.target.checked;
            setVibeEnabled(checked);
            if (checked) triggerVibration('medium');
          }}
          className="mt-1 accent-[var(--neon-green)] cursor-pointer"
        />
        <label htmlFor="vibrationHapticsSub" className="text-xs text-zinc-400 cursor-pointer select-none leading-snug">
          <span className="font-semibold block text-white font-mono uppercase text-[10px] tracking-wide mb-1">Physical Vibration Haptics Support</span>
          Toggle subtle mechanical haptic response for all buttons and likes.
        </label>
      </div>

      {/* Event specific intensity controller sliders */}
      <div className={`p-3 bg-black/60 border border-emerald-950/40 rounded-none space-y-3 transition-all duration-150 ${vibeEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
        {/* Messages intensity setting */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[9px] font-mono text-zinc-350 uppercase">
            <span>Message Received feedback</span>
            <span className="text-[var(--neon-green)] font-bold">{vibeMessageIntensity}</span>
          </div>
          <div className="flex gap-1">
            {(['off', 'light', 'medium', 'heavy', 'double'] as const).map((level) => (
              <button
                key={`msg-i-${level}`}
                type="button"
                onClick={() => {
                  setVibeMessageIntensity(level);
                  playGlitchClickSound();
                  if (level !== 'off') triggerVibration(level === 'double' ? 'light' : level);
                }}
                className={`flex-1 py-1 text-[8px] font-mono uppercase border cursor-pointer ${
                  vibeMessageIntensity === level
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]'
                    : 'border-zinc-900 bg-zinc-950 text-zinc-500 hover:border-zinc-850'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Like actions intensity setting */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[9px] font-mono text-zinc-350 uppercase">
            <span>Like Action feedback</span>
            <span className="text-[var(--neon-green)] font-bold">{vibeLikeIntensity}</span>
          </div>
          <div className="flex gap-1">
            {(['off', 'light', 'medium', 'heavy', 'double'] as const).map((level) => (
              <button
                key={`like-i-${level}`}
                type="button"
                onClick={() => {
                  setVibeLikeIntensity(level);
                  playGlitchClickSound();
                  if (level !== 'off') triggerVibration(level === 'double' ? 'light' : level);
                }}
                className={`flex-1 py-1 text-[8px] font-mono uppercase border cursor-pointer ${
                  vibeLikeIntensity === level
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]'
                    : 'border-zinc-900 bg-zinc-950 text-zinc-500 hover:border-zinc-850'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Send shortcut coordinates config */}
      <div className="space-y-1.5 border-t border-[var(--neon-green)]/20 pt-3">
        <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
          Msg Dispatch Keybind Protocol
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['enter', 'cmd-enter'].map((sh) => (
            <button
              key={sh}
              type="button"
              onClick={() => {
                setSendShortcut(sh as any);
                playGlitchClickSound();
              }}
              className={`py-1.5 text-[8.5px] font-mono uppercase border transition-all cursor-pointer font-bold ${
                sendShortcut === sh
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]'
                  : 'border-zinc-900 bg-black text-zinc-500 hover:border-zinc-805'
              }`}
            >
              {sh === 'enter' ? 'Enter [Standard]' : 'Cmd + Enter [Stealth]'}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time typing status visualization and key session TTL settings */}
      <div className="grid grid-cols-2 gap-3.5 border-t border-[var(--neon-green)]/20 pt-3">
        <div className="space-y-1.5">
          <label className="text-[8.5px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">Typing status Indicator</label>
          <select
            value={typingVisualStyle}
            onChange={(e) => {
              setTypingVisualStyle(e.target.value as any);
              playGlitchClickSound();
            }}
            className="w-full bg-black border border-zinc-800 px-2 py-1 text-[10px] font-mono text-[var(--neon-green)] focus:outline-none"
          >
            <option value="pulse">Pulse effect</option>
            <option value="stealth">Stealth (Minimal info)</option>
            <option value="minimal">Simple bullet</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[8.5px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">Session Keys TTL</label>
          <select
            value={sessionCipherTtl}
            onChange={(e) => {
              setSessionCipherTtl(e.target.value as any);
              playGlitchClickSound();
            }}
            className="w-full bg-black border border-zinc-800 px-2 py-1 text-[10px] font-mono text-[var(--neon-green)] focus:outline-none"
          >
            <option value="5m">5 Minutes timeout</option>
            <option value="15m">15 Minutes timeout</option>
            <option value="1h">1 Hour timeout</option>
            <option value="infinite">Infinite cache duration</option>
          </select>
        </div>
      </div>

      {/* SECURE CHAT LOCK SYSTEM PANEL */}
      <div className="border-t border-[var(--neon-green)]/20 pt-3.5 space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider font-bold text-rose-500 font-mono flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-rose-500" /> SECURE APP/CHAT PASS-LOCK COORDINATES
        </h4>
        
        <div className="flex items-start space-x-3 p-3 bg-rose-950/10 border border-rose-900/15">
          <input
            type="checkbox"
            id="lockEnabledOptSub"
            checked={chatLockEnabled}
            onChange={(e) => {
              playGlitchClickSound();
              triggerVibration('medium');
              setChatLockEnabled(e.target.checked);
            }}
            className="mt-1 accent-rose-500 cursor-pointer"
          />
          <label htmlFor="lockEnabledOptSub" className="text-xs text-zinc-400 cursor-pointer select-none leading-snug">
            <span className="font-semibold block text-white font-mono uppercase text-[10px] tracking-wide mb-1">Enable Secure PIN Chat Lock</span>
            Require a custom cryptographic PIN security screen when opening private discussions.
          </label>
        </div>

        {chatLockEnabled && (
          <div className="p-3.5 bg-black border border-rose-950/40 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold">Construct secure 4-digit PIN:</label>
              <span className="text-[9px] font-mono text-rose-450 font-bold uppercase">{chatLockPin ? '[SET]' : '[NOT SET]'}</span>
            </div>
            <input
              type="text"
              maxLength={4}
              placeholder="E.g., 9051"
              value={chatLockPin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setChatLockPin(val);
                if (val.length === 4) {
                  triggerVibration('heavy');
                  playLikeSound();
                }
              }}
              className="w-full bg-zinc-950 border border-neutral-800 text-neutral-100 placeholder-zinc-700 px-3 py-1.5 font-mono text-xs text-center focus:border-rose-500 outline-none"
            />
            <p className="text-[8px] text-zinc-650 leading-normal font-sans">
              🔒 Secure Pin hashes are stored in encrypted client space and never reach transit logs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
