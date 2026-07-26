import React from 'react';
import { Eye, Shield, Laptop, Cpu } from 'lucide-react';
import { BrutalistTheme, THEMES } from '../lib/theme';
import { VibrationIntensity } from '../lib/haptics';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { useTheme, DesignSystemTheme, ColorScheme, AccentColor } from '../contexts/ThemeContext';

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
  const { theme, colorScheme, accentColor, setTheme, setColorScheme, setAccentColor } = useTheme();

  const [isElectron, setIsElectron] = useState(false);
  const [startOnLogin, setStartOnLogin] = useState(false);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    const checkElectron = typeof window !== 'undefined' && (window as any).require;
    if (checkElectron) {
      try {
        const electron = (window as any).require('electron');
        const { ipcRenderer } = electron;
        if (ipcRenderer) {
          setIsElectron(true);
          ipcRenderer.invoke('get-start-on-login').then((val: boolean) => {
            setStartOnLogin(val);
          }).catch((err: any) => console.warn('Failed to get start on login:', err));
          
          ipcRenderer.invoke('get-app-version').then((ver: string) => {
            setAppVersion(ver);
          }).catch(() => setAppVersion('1.0.0'));
        }
      } catch (e) {
        console.warn('Not in Electron context:', e);
      }
    }
  }, []);

  const handleToggleStartOnLogin = async (checked: boolean) => {
    if (!isElectron) return;
    try {
      const { ipcRenderer } = (window as any).require('electron');
      setDesktopLoading(true);
      const newVal = await ipcRenderer.invoke('toggle-start-on-login', checked);
      setStartOnLogin(newVal);
      playLikeSound();
    } catch (e) {
      console.warn('Failed to toggle start on login:', e);
    } finally {
      setDesktopLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <Eye className="w-4 h-4" /> AESTHETICS & HAPTOLOGY SETTINGS
      </h3>

      {/* Design System Theme Picker */}
      <div className="space-y-2.5 border-b border-[var(--neon-green-border)] pb-4">
        <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
          Aesthetic Design System
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'brutalism', name: 'Brutalism' },
            { id: 'neobrutalism', name: 'Neo-Brutalism' },
            { id: 'glassmorphism', name: 'Glassmorphism' },
            { id: 'neumorphism', name: 'Neumorphism' },
            { id: 'claymorphism', name: 'Claymorphism' },
            { id: 'minimalism', name: 'Minimalism' },
            { id: 'materialyou', name: 'Material You' },
            { id: 'fluent', name: 'Fluent Design' },
            { id: 'softui', name: 'Soft UI' }
          ] as { id: DesignSystemTheme; name: string }[]).map((ds) => (
            <button
              key={ds.id}
              type="button"
              onClick={() => {
                setTheme(ds.id);
                // Also trigger legacy compatibility for components relying on state values
                const legacyMapping: Record<DesignSystemTheme, BrutalistTheme> = {
                  brutalism: 'green', neobrutalism: 'green', glassmorphism: 'purple',
                  neumorphism: 'white', claymorphism: 'purple', minimalism: 'white',
                  materialyou: 'green', fluent: 'white', softui: 'purple'
                };
                setSelectedTheme(legacyMapping[ds.id]);
                applyTheme(legacyMapping[ds.id]);
                playGlitchClickSound();
                if (vibeEnabled) triggerVibration('medium');
              }}
              className={`py-2 text-[9px] font-mono uppercase tracking-wider border transition-all cursor-pointer font-black select-none rounded-none ${
                theme === ds.id
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] [box-shadow:2px_2px_0px_var(--neon-green)]'
                  : 'border-[var(--neon-green-border)] bg-[var(--color-surface)] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {ds.name}
            </button>
          ))}
        </div>
      </div>

      {/* Color Palette Scheme Selector */}
      <div className="space-y-2.5 border-b border-[var(--neon-green-border)] pb-4">
        <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
          Color Scheme Modality
        </label>
        <div className="grid grid-cols-4 gap-2">
          {([
            { id: 'dark', name: 'Dark Mode' },
            { id: 'light', name: 'Light Mode' },
            { id: 'auto', name: 'System Auto' },
            { id: 'highcontrast', name: 'High Contrast' }
          ] as { id: ColorScheme; name: string }[]).map((cs) => (
            <button
              key={cs.id}
              type="button"
              onClick={() => {
                setColorScheme(cs.id);
                playGlitchClickSound();
                if (vibeEnabled) triggerVibration('light');
              }}
              className={`py-2 text-[8.5px] font-mono uppercase tracking-wider border transition-all cursor-pointer font-black select-none rounded-none ${
                colorScheme === cs.id
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] [box-shadow:2px_2px_0px_var(--neon-green)]'
                  : 'border-[var(--neon-green-border)] bg-[var(--color-surface)] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {cs.name}
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color Theme selection */}
      <div className="space-y-2 border-b border-[var(--neon-green-border)] pb-4">
        <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
          Dynamic Accent Palette
        </label>
        <div className="grid grid-cols-5 gap-2">
          {([
            { id: 'green', name: 'Neon Green' },
            { id: 'purple', name: 'Cyber Purple' },
            { id: 'white', name: 'Monochrome' },
            { id: 'blue', name: 'Digital Blue' },
            { id: 'amber', name: 'Amber Gold' }
          ] as { id: AccentColor; name: string }[]).map((ac) => (
            <button
              key={ac.id}
              type="button"
              onClick={() => {
                setAccentColor(ac.id);
                // Maintain full compatibility with legacy code
                const legacyMapping: Record<AccentColor, BrutalistTheme> = {
                  green: 'green', purple: 'purple', white: 'white', blue: 'purple', amber: 'green'
                };
                setSelectedTheme(legacyMapping[ac.id]);
                applyTheme(legacyMapping[ac.id]);
                playGlitchClickSound();
                if (vibeEnabled) triggerVibration('light');
              }}
              className={`py-2 text-[8px] font-mono uppercase tracking-wider border transition-all cursor-pointer font-black select-none rounded-none leading-none ${
                accentColor === ac.id
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] [box-shadow:2px_2px_0px_var(--neon-green)]'
                  : 'border-[var(--neon-green-border)] bg-[var(--color-surface)] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {ac.name}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Task Monitor toggler */}
      <div className="flex items-start space-x-3 p-3 bg-[var(--color-background)] border border-[var(--neon-green-border)]">
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
          <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-1">Enable Real-Time Task Monitor</span>
          Display floating background transmission and diagnostic monitoring spectrum in bottom-right.
        </label>
      </div>

      {/* Haptic properties checkbox */}
      <div className="flex items-start space-x-3 p-3 bg-[var(--color-background)] border border-[var(--neon-green-border)]">
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
          <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-1">Physical Vibration Haptics Support</span>
          Toggle subtle mechanical haptic response for all buttons and likes.
        </label>
      </div>

      {/* Event specific intensity controller sliders */}
      <div className={`p-3 bg-[var(--color-surface)]/60 border border-emerald-950/40 rounded-none space-y-3 transition-all duration-150 ${vibeEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
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
                    : 'border-[var(--neon-green-border)] bg-[var(--color-background)] text-zinc-500 hover:border-zinc-850'
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
                    : 'border-[var(--neon-green-border)] bg-[var(--color-background)] text-zinc-500 hover:border-zinc-850'
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
                  : 'border-[var(--neon-green-border)] bg-[var(--color-surface)] text-zinc-500 hover:border-zinc-805'
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
            className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] px-2 py-1 text-[10px] font-mono text-[var(--neon-green)] focus:outline-none"
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
            className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] px-2 py-1 text-[10px] font-mono text-[var(--neon-green)] focus:outline-none"
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
            <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-1">Enable Secure PIN Chat Lock</span>
            Require a custom cryptographic PIN security screen when opening private discussions.
          </label>
        </div>

        {chatLockEnabled && (
          <div className="p-3.5 bg-[var(--color-surface)] border border-rose-950/40 space-y-2 animate-fade-in">
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
              className="w-full bg-[var(--color-background)] border border-neutral-800 text-neutral-100 placeholder-zinc-700 px-3 py-1.5 font-mono text-xs text-center focus:border-rose-500 outline-none"
            />
            <p className="text-[8px] text-zinc-650 leading-normal font-sans">
              🔒 Secure Pin hashes are stored in encrypted client space and never reach transit logs.
            </p>
          </div>
        )}
      </div>

      {/* DESKTOP CLIENT SUITE (ELECTRON INTEGRATIONS) */}
      <div className="border-t border-[var(--neon-green)]/20 pt-3.5 space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
          <Laptop className="w-3.5 h-3.5 text-[var(--neon-green)]" /> DESKTOP ENVIRONMENT COUPLING
        </h4>

        {isElectron ? (
          <div className="space-y-3.5 animate-fade-in">
            {/* Start on Login control */}
            <div className="flex items-start space-x-3 p-3 bg-[var(--color-background)] border border-[var(--neon-green-border)]">
              <input
                type="checkbox"
                id="startOnLoginSub"
                checked={startOnLogin}
                disabled={desktopLoading}
                onChange={(e) => handleToggleStartOnLogin(e.target.checked)}
                className="mt-1 accent-[var(--neon-green)] cursor-pointer"
              />
              <label htmlFor="startOnLoginSub" className="text-xs text-zinc-400 cursor-pointer select-none leading-snug">
                <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-1">
                  Start on Login {desktopLoading && '(Allying...)'}
                </span>
                Launch Flick automatically when your computer system boots up.
              </label>
            </div>

            {/* Desktop Status Deck */}
            <div className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-3 rounded-none space-y-2">
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-zinc-500">CLIENT ARCHITECTURE:</span>
                <span className="text-[var(--neon-green)] font-bold uppercase">Electron Native Client</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-zinc-500">CLIENT APP VERSION:</span>
                <span className="text-zinc-300 font-bold font-mono">{appVersion || '1.0.0'}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-zinc-500">DEEP LINK PROTOCOL:</span>
                <span className="text-emerald-400 font-bold">flick:// REGISTERED</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-zinc-500">SYSTEM TRAY DECK:</span>
                <span className="text-emerald-400 font-bold">ACTIVE & MINIMIZABLE</span>
              </div>
            </div>

            {/* Desktop keyboard shortcuts table */}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
                Desktop Accelerator Keybinds
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { keys: 'Ctrl + N', desc: 'New Post' },
                  { keys: 'Ctrl + Shift + S', desc: 'Add Story' },
                  { keys: 'Ctrl + M', desc: 'Direct Message' },
                  { keys: 'Ctrl + R', desc: 'Refresh Feed' }
                ].map((item, idx) => (
                  <div key={idx} className="p-2 bg-[var(--color-background)] border border-zinc-950 flex flex-col justify-between">
                    <span className="text-[8.5px] font-bold text-zinc-400 font-sans">{item.desc}</span>
                    <span className="text-[9px] text-[var(--neon-green)] font-mono font-bold">{item.keys}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[var(--color-background)]/40 border border-[var(--neon-green-border)]/60 text-zinc-500 text-center space-y-1.5">
            <Cpu className="w-5 h-5 mx-auto text-zinc-650 animate-pulse" />
            <p className="text-[9px] font-mono uppercase tracking-wide text-zinc-400">Web Sandbox Sandbox Detected</p>
            <p className="text-[8.5px] font-sans text-zinc-650 max-w-xs mx-auto leading-normal">
              Native traits like Start on Login, minimize-to-tray, and system accelerators are fully functional in our desktop standalone application.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
