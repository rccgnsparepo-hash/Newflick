import React, { useState, useEffect } from 'react';
import { Bell, Clock, Smartphone, Zap, ShieldAlert, Volume2, VolumeX, Keyboard, Send, CheckCheck, Sparkles, Activity, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { 
  playGroupNotificationSound,
  playTypingSound,
  playSendMessageSound,
  playReceiveMessageSound,
  playMessageReadSound,
  getTypingSoundStyle,
  setTypingSoundStyle,
  isTypingSoundEnabled,
  isSendMessageSoundEnabled,
  isReceiveMessageSoundEnabled,
  isReadMessageSoundEnabled,
  setSoundSetting,
  TypingSoundStyle,
  playGlitchClickSound
} from '../lib/sounds';
import { NativePushDebugger } from './NativePushDebugger';
import { NotificationDiagnosticModal } from './NotificationDiagnosticModal';
import {
  getHapticPatternForMessageType,
  setHapticPatternForMessageType,
  triggerPatternVibration,
  VibrationPattern,
  MessageType
} from '../lib/haptics';
import {
  getQuietHoursConfig,
  setQuietHoursConfig,
  isCurrentlyInQuietHours
} from '../lib/pushNotifications';
import { showBrutalistToast } from '../lib/toast';

interface NotificationsTabProps {
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  notifMessagesAll: boolean;
  setNotifMessagesAll: (val: boolean) => void;
  notifGroups: boolean;
  setNotifGroups: (val: boolean) => void;
  notifCalls: boolean;
  setNotifCalls: (val: boolean) => void;
  notifSocialFeed: boolean;
  setNotifSocialFeed: (val: boolean) => void;
  notifNewsAlerts: boolean;
  setNotifNewsAlerts: (val: boolean) => void;
  notifSilentMode: boolean;
  setNotifSilentMode: (val: boolean) => void;
  notifPriorityChatsOnly: boolean;
  setNotifPriorityChatsOnly: (val: boolean) => void;
  notifMessagesFrom: string[];
  systemUsers: UserProfile[];
  toggleAllowedSender: (uid: string) => void;
  profile?: UserProfile;
}

export function SettingsNotificationsTab({
  soundEnabled,
  setSoundEnabled,
  notifMessagesAll,
  setNotifMessagesAll,
  notifGroups,
  setNotifGroups,
  notifCalls,
  setNotifCalls,
  notifSocialFeed,
  setNotifSocialFeed,
  notifNewsAlerts,
  setNotifNewsAlerts,
  notifSilentMode,
  setNotifSilentMode,
  notifPriorityChatsOnly,
  setNotifPriorityChatsOnly,
  notifMessagesFrom,
  systemUsers,
  toggleAllowedSender,
  profile
}: NotificationsTabProps) {
  const [, setSoundsUpdateToken] = useState(0);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

  // Message Audio & Typing local state
  const [typingSoundEnabled, setTypingSoundEnabledState] = useState<boolean>(isTypingSoundEnabled);
  const [typingSoundStyle, setTypingSoundStyleState] = useState<TypingSoundStyle>(getTypingSoundStyle);
  const [sendSoundEnabled, setSendSoundEnabledState] = useState<boolean>(isSendMessageSoundEnabled);
  const [receiveSoundEnabled, setReceiveSoundEnabledState] = useState<boolean>(isReceiveMessageSoundEnabled);
  const [readSoundEnabled, setReadSoundEnabledState] = useState<boolean>(isReadMessageSoundEnabled);

  // Quiet Hours local state
  const [quietConfig, setQuietConfig] = useState(getQuietHoursConfig);
  const [inQuietHours, setInQuietHours] = useState(isCurrentlyInQuietHours);

  // Message Haptics local state
  const [directHaptic, setDirectHaptic] = useState<VibrationPattern>(() => getHapticPatternForMessageType('direct'));
  const [groupHaptic, setGroupHaptic] = useState<VibrationPattern>(() => getHapticPatternForMessageType('group'));
  const [systemHaptic, setSystemHaptic] = useState<VibrationPattern>(() => getHapticPatternForMessageType('system'));

  useEffect(() => {
    const handleUpdate = () => {
      setSoundsUpdateToken(prev => prev + 1);
      setTypingSoundEnabledState(isTypingSoundEnabled());
      setTypingSoundStyleState(getTypingSoundStyle());
      setSendSoundEnabledState(isSendMessageSoundEnabled());
      setReceiveSoundEnabledState(isReceiveMessageSoundEnabled());
      setReadSoundEnabledState(isReadMessageSoundEnabled());
      setQuietConfig(getQuietHoursConfig());
      setInQuietHours(isCurrentlyInQuietHours());
      setDirectHaptic(getHapticPatternForMessageType('direct'));
      setGroupHaptic(getHapticPatternForMessageType('group'));
      setSystemHaptic(getHapticPatternForMessageType('system'));
    };

    window.addEventListener('flick_sounds_updated', handleUpdate);
    window.addEventListener('flick_notifications_updated', handleUpdate);
    window.addEventListener('flick_haptics_updated', handleUpdate);
    return () => {
      window.removeEventListener('flick_sounds_updated', handleUpdate);
      window.removeEventListener('flick_notifications_updated', handleUpdate);
      window.removeEventListener('flick_haptics_updated', handleUpdate);
    };
  }, []);

  const handleToggleTypingSound = (enabled: boolean) => {
    setSoundSetting('flick_sound_typing_enabled', enabled);
    setTypingSoundEnabledState(enabled);
    if (enabled) {
      playTypingSound('a', typingSoundStyle);
    }
    showBrutalistToast('TYPING AUDIO UPDATED', enabled ? 'Keyboard typing sounds enabled.' : 'Keyboard typing sounds muted.', 'info');
  };

  const handleChangeTypingStyle = (style: TypingSoundStyle) => {
    setTypingSoundStyle(style);
    setTypingSoundStyleState(style);
    playTypingSound('Enter', style);
    showBrutalistToast('TYPING SOUND THEME', `Switch style set to [${style.toUpperCase()}]`, 'success');
  };

  const handleToggleSendSound = (enabled: boolean) => {
    setSoundSetting('flick_sound_send_enabled', enabled);
    setSendSoundEnabledState(enabled);
    if (enabled) {
      playSendMessageSound();
    }
    showBrutalistToast('SENT AUDIO UPDATED', enabled ? 'Message sent chimes enabled.' : 'Message sent chimes muted.', 'info');
  };

  const handleToggleReceiveSound = (enabled: boolean) => {
    setSoundSetting('flick_sound_receive_enabled', enabled);
    setReceiveSoundEnabledState(enabled);
    if (enabled) {
      playReceiveMessageSound();
    }
    showBrutalistToast('RECEIVE AUDIO UPDATED', enabled ? 'Incoming message sounds enabled.' : 'Incoming message sounds muted.', 'info');
  };

  const handleToggleReadSound = (enabled: boolean) => {
    setSoundSetting('flick_sound_read_enabled', enabled);
    setReadSoundEnabledState(enabled);
    if (enabled) {
      playMessageReadSound();
    }
    showBrutalistToast('READ RECEIPTS AUDIO', enabled ? 'Read receipt delivery chimes enabled.' : 'Read receipt chimes muted.', 'info');
  };

  const handleQuietToggle = (enabled: boolean) => {
    setQuietHoursConfig({ enabled });
    setQuietConfig(prev => ({ ...prev, enabled }));
    setInQuietHours(isCurrentlyInQuietHours());
    showBrutalistToast('QUIET HOURS UPDATED', enabled ? 'Quiet Hours schedule activated.' : 'Quiet Hours disabled.', 'info');
  };

  const handleQuietStartChange = (startTime: string) => {
    setQuietHoursConfig({ startTime });
    setQuietConfig(prev => ({ ...prev, startTime }));
    setInQuietHours(isCurrentlyInQuietHours());
  };

  const handleQuietEndChange = (endTime: string) => {
    setQuietHoursConfig({ endTime });
    setQuietConfig(prev => ({ ...prev, endTime }));
    setInQuietHours(isCurrentlyInQuietHours());
  };

  const handleAllowPriorityChange = (allowPrioritySenders: boolean) => {
    setQuietHoursConfig({ allowPrioritySenders });
    setQuietConfig(prev => ({ ...prev, allowPrioritySenders }));
    showBrutalistToast('PRIORITY FILTER UPDATED', allowPrioritySenders ? 'Priority senders will bypass Quiet Hours.' : 'All notifications suppressed in Quiet Hours.', 'info');
  };

  const handleHapticChange = (type: MessageType, pattern: VibrationPattern) => {
    setHapticPatternForMessageType(type, pattern);
    if (type === 'direct') setDirectHaptic(pattern);
    if (type === 'group') setGroupHaptic(pattern);
    if (type === 'system') setSystemHaptic(pattern);
    triggerPatternVibration(pattern);
    showBrutalistToast('HAPTIC SIGNATURE SET', `Updated ${type.toUpperCase()} message vibration pattern to [${pattern.toUpperCase()}]`, 'success');
  };

  return (
    <div className="space-y-5">
      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <Bell className="w-4 h-4" /> GRANULAR NOTIFICATION ENDPOINTS
      </h3>

      {/* Global sound chimes toggle */}
      <div className="flex items-start space-x-3 p-3 bg-[var(--color-background)] border border-[var(--neon-green-border)]">
        <input
          type="checkbox"
          id="soundEnabledSub"
          checked={soundEnabled}
          onChange={(e) => setSoundEnabled(e.target.checked)}
          className="mt-1 accent-[var(--neon-green)] cursor-pointer"
        />
        <label htmlFor="soundEnabledSub" className="text-xs text-zinc-400 cursor-pointer select-none leading-snug">
          <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-1">Global sound chimes</span>
          Enable fluid digital sound synthesis when interacting, typing, dispatching, and receiving.
        </label>
      </div>

      {/* Granular message interaction & typing sound FX suite */}
      {soundEnabled && (
        <div className="space-y-4 border-t border-dashed border-[var(--neon-green)]/20 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest font-extrabold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[var(--neon-green)]" /> Message Audio & Interaction FX
            </label>
            <span className="text-[8px] font-mono text-[var(--neon-green)]/70 uppercase">Zero-Latency Synthesized</span>
          </div>

          <div className="space-y-2.5">
            {/* 1. Keyboard typing sound */}
            <div className="p-3 bg-[var(--color-surface)] border border-[var(--neon-green-border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="typingSoundToggle"
                    checked={typingSoundEnabled}
                    onChange={(e) => handleToggleTypingSound(e.target.checked)}
                    className="accent-[var(--neon-green)] cursor-pointer"
                  />
                  <label htmlFor="typingSoundToggle" className="text-xs font-mono text-white font-bold cursor-pointer flex items-center gap-1.5">
                    <Keyboard className="w-3.5 h-3.5 text-[var(--neon-green)]" /> Keyboard Typing Sounds
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => playTypingSound('Enter', typingSoundStyle)}
                  className="px-2 py-0.5 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-mono text-[8.5px] uppercase hover:bg-[var(--neon-green)]/25 transition cursor-pointer"
                  title="Test typing sound"
                >
                  ▶ Test Key
                </button>
              </div>
              <p className="text-[9px] text-zinc-400 font-sans pl-6">
                Hear realistic mechanical, pop, or cyber feedback as you type into chat dialogues.
              </p>
              {typingSoundEnabled && (
                <div className="pl-6 pt-1 flex items-center space-x-2">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">Switch Theme:</span>
                  <select
                    value={typingSoundStyle}
                    onChange={(e) => handleChangeTypingStyle(e.target.value as TypingSoundStyle)}
                    className="bg-[var(--color-background)] border border-[var(--neon-green-border)] text-[9px] font-mono text-[var(--neon-green)] px-2 py-1 uppercase focus:outline-none cursor-pointer"
                  >
                    <option value="modern">Modern Tactile Click</option>
                    <option value="thock">Mechanical Thock</option>
                    <option value="bubble">Bubble Pop</option>
                    <option value="cyber">Cyber Zap</option>
                    <option value="clack">Classic Clack</option>
                  </select>
                </div>
              )}
            </div>

            {/* 2. Message Sent sound */}
            <div className="p-3 bg-[var(--color-surface)] border border-[var(--neon-green-border)] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  id="sendSoundToggle"
                  checked={sendSoundEnabled}
                  onChange={(e) => handleToggleSendSound(e.target.checked)}
                  className="accent-[var(--neon-green)] cursor-pointer"
                />
                <div>
                  <label htmlFor="sendSoundToggle" className="text-xs font-mono text-white font-bold cursor-pointer flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[var(--neon-green)]" /> Outgoing Message Sent
                  </label>
                  <p className="text-[8.5px] text-zinc-400 font-sans">
                    Ascending swoop & digital chime upon cryptographic payload transmission.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => playSendMessageSound()}
                className="px-2 py-0.5 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-mono text-[8.5px] uppercase hover:bg-[var(--neon-green)]/25 transition cursor-pointer shrink-0"
                title="Test sent sound"
              >
                ▶ Test
              </button>
            </div>

            {/* 3. Message Received sound */}
            <div className="p-3 bg-[var(--color-surface)] border border-[var(--neon-green-border)] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  id="receiveSoundToggle"
                  checked={receiveSoundEnabled}
                  onChange={(e) => handleToggleReceiveSound(e.target.checked)}
                  className="accent-[var(--neon-green)] cursor-pointer"
                />
                <div>
                  <label htmlFor="receiveSoundToggle" className="text-xs font-mono text-white font-bold cursor-pointer flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[var(--neon-green)]" /> Incoming Message Alert
                  </label>
                  <p className="text-[8.5px] text-zinc-400 font-sans">
                    Melodic dual chime tone when a peer or group broadcasts a message.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => playReceiveMessageSound()}
                className="px-2 py-0.5 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-mono text-[8.5px] uppercase hover:bg-[var(--neon-green)]/25 transition cursor-pointer shrink-0"
                title="Test receive sound"
              >
                ▶ Test
              </button>
            </div>

            {/* 4. Read & Delivery Receipts sound */}
            <div className="p-3 bg-[var(--color-surface)] border border-[var(--neon-green-border)] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  id="readSoundToggle"
                  checked={readSoundEnabled}
                  onChange={(e) => handleToggleReadSound(e.target.checked)}
                  className="accent-[var(--neon-green)] cursor-pointer"
                />
                <div>
                  <label htmlFor="readSoundToggle" className="text-xs font-mono text-white font-bold cursor-pointer flex items-center gap-1.5">
                    <CheckCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" /> Read & Delivery Receipts
                  </label>
                  <p className="text-[8.5px] text-zinc-400 font-sans">
                    Crisp double-tick confirmation when recipient opens and reads your message.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => playMessageReadSound()}
                className="px-2 py-0.5 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-mono text-[8.5px] uppercase hover:bg-[var(--neon-green)]/25 transition cursor-pointer shrink-0"
                title="Test read receipt sound"
              >
                ▶ Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom notification sounds configuration panel */}
      {soundEnabled && (
        <div className="space-y-3.5 border-t border-dashed border-[var(--neon-green)]/20 pt-4">
          <label className="text-[10px] uppercase tracking-widest font-extrabold text-[var(--neon-green)] font-mono block">
            Custom notification sounds (by group)
          </label>
          <p className="text-[8.5px] text-zinc-500 font-mono leading-normal">
            Upload custom audio files or select from our digital synthesis presets to distinguish incoming alerts.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'vip', label: '1. VIP Priority Senders' },
              { key: 'direct', label: '2. Direct Chats' },
              { key: 'group', label: '3. Group Chats' },
              { key: 'other', label: '4. Other Alerts' }
            ].map((grp) => {
              const currentType = localStorage.getItem(`flick_sound_type_${grp.key}`) || 'default';
              const customFileName = localStorage.getItem(`flick_sound_filename_${grp.key}`) || '';

              const handleTypeChange = (type: string) => {
                localStorage.setItem(`flick_sound_type_${grp.key}`, type);
                playGroupNotificationSound(grp.key as any);
                window.dispatchEvent(new Event('flick_sounds_updated'));
              };

              const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                  const base64 = event.target?.result as string;
                  localStorage.setItem(`flick_sound_data_${grp.key}`, base64);
                  localStorage.setItem(`flick_sound_filename_${grp.key}`, file.name);
                  localStorage.setItem(`flick_sound_type_${grp.key}`, 'custom');
                  
                  const audio = new Audio(base64);
                  audio.volume = 0.5;
                  audio.play().catch(err => console.warn("Failed previewing uploaded file:", err));

                  window.dispatchEvent(new Event('flick_sounds_updated'));
                };
                reader.readAsDataURL(file);
              };

              const playPreview = () => {
                playGroupNotificationSound(grp.key as any);
              };

              return (
                <div key={grp.key} className="bg-[var(--color-surface)]/55 border border-[var(--neon-green-border)] p-3 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] text-[var(--color-text)] font-mono font-bold uppercase tracking-wide">
                      {grp.label}
                    </span>
                    <button
                      type="button"
                      onClick={playPreview}
                      className="px-1.5 py-0.5 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/5 text-[var(--neon-green)] font-mono text-[8px] uppercase hover:bg-[var(--neon-green)]/15 transition cursor-pointer"
                      title="Preview sound"
                    >
                      ▶ Play
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={currentType}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] text-[9px] font-mono text-zinc-300 p-1 uppercase focus:border-[var(--neon-green)] outline-none cursor-pointer"
                    >
                      <option value="default">Pulse Beacon (Default)</option>
                      <option value="cosmic">Cosmic Ping</option>
                      <option value="glitch">Glitch Echo</option>
                      <option value="ring">Resonance Ring</option>
                      <option value="custom">Custom Uploaded</option>
                    </select>

                    <div className="relative">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        id={`file-upload-${grp.key}`}
                      />
                      <label
                        htmlFor={`file-upload-${grp.key}`}
                        className="w-full text-center block p-1 border border-[var(--neon-green-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface)] text-zinc-400 text-[8px] font-mono uppercase tracking-wider transition cursor-pointer select-none leading-normal truncate"
                      >
                        {currentType === 'custom' && customFileName
                          ? customFileName
                          : '↑ Upload File'}
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed channels toggles */}
      <div className="space-y-2.5 border-t border-dashed border-[var(--neon-green)]/20 pt-4">
        <label className="text-[10px] uppercase tracking-widest font-extrabold text-[var(--neon-green)] font-mono block">
          Sync Alerts Channels (Granular)
        </label>

        {/* Direct chat alerts */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)]">
          <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wide">1. Direct Chats alerts</span>
          <input
            type="checkbox"
            checked={notifMessagesAll}
            onChange={(e) => setNotifMessagesAll(e.target.checked)}
            className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
        </div>

        {/* Groups alert sync */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)]">
          <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wide">2. Group Messages alerts</span>
          <input
            type="checkbox"
            checked={notifGroups}
            onChange={(e) => setNotifGroups(e.target.checked)}
            className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
        </div>

        {/* Video/Voice Calls alert sync */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)]">
          <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wide">3. Voice & Video Calls alerts</span>
          <input
            type="checkbox"
            checked={notifCalls}
            onChange={(e) => setNotifCalls(e.target.checked)}
            className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
        </div>

        {/* Chronicles Feed alerts */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)]">
          <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wide">4. Social Chronicles alerts</span>
          <input
            type="checkbox"
            checked={notifSocialFeed}
            onChange={(e) => setNotifSocialFeed(e.target.checked)}
            className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
        </div>

        {/* News Flash alerts */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)]">
          <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wide">5. News Flash & Critical Signals</span>
          <input
            type="checkbox"
            checked={notifNewsAlerts}
            onChange={(e) => setNotifNewsAlerts(e.target.checked)}
            className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
        </div>

        {/* Total Stealth Silent Mode */}
        <div className="flex items-center justify-between p-2.5 bg-rose-950/10 border border-rose-900/35">
          <span className="text-xs text-rose-400 font-mono font-bold uppercase tracking-wide">6. Do Not Disturb (Total Silent Mode)</span>
          <input
            type="checkbox"
            checked={notifSilentMode}
            onChange={(e) => setNotifSilentMode(e.target.checked)}
            className="accent-rose-500 cursor-pointer h-4 w-4"
          />
        </div>

        {/* VIP Priority Senders only toggle */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)]">
          <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wide">7. VIP Priority Senders Alerts Only</span>
          <input
            type="checkbox"
            checked={notifPriorityChatsOnly}
            onChange={(e) => setNotifPriorityChatsOnly(e.target.checked)}
            className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
        </div>
      </div>

      {/* Quiet Hours & Priority Sender Schedule Configurator */}
      <div className="space-y-3.5 border-t border-dashed border-[var(--neon-green)]/20 pt-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-widest font-extrabold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> QUIET HOURS & PRIORITY SENDER SCHEDULE
          </label>
          <span className={`text-[8px] font-mono uppercase px-2 py-0.5 font-bold border ${
            inQuietHours
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
              : 'border-[var(--neon-green-border)] text-zinc-500'
          }`}>
            {inQuietHours ? '● ACTIVE NOW' : '○ INACTIVE'}
          </span>
        </div>

        <p className="text-[8.5px] text-zinc-500 font-mono leading-normal">
          Suppress non-urgent push notifications and alerts during scheduled hours. Option to allow VIP Priority Senders through.
        </p>

        {/* Toggle Quiet Hours */}
        <div className="flex items-start space-x-3 p-3 bg-[var(--color-surface)]/60 border border-[var(--neon-green-border)]">
          <input
            type="checkbox"
            id="quietHoursToggleCheck"
            checked={quietConfig.enabled}
            onChange={(e) => handleQuietToggle(e.target.checked)}
            className="mt-1 accent-[var(--neon-green)] cursor-pointer h-4 w-4"
          />
          <label htmlFor="quietHoursToggleCheck" className="text-xs text-zinc-300 cursor-pointer select-none leading-snug">
            <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-0.5">
              Enable Scheduled Quiet Hours
            </span>
            Automatically block push notifications during designated sleep or focus periods.
          </label>
        </div>

        {quietConfig.enabled && (
          <div className="p-3 bg-black/40 border border-[var(--neon-green-border)] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-mono text-zinc-400 block uppercase mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={quietConfig.startTime}
                  onChange={(e) => handleQuietStartChange(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] text-xs text-[var(--neon-green)] font-mono p-1.5 focus:border-[var(--neon-green)] outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono text-zinc-400 block uppercase mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={quietConfig.endTime}
                  onChange={(e) => handleQuietEndChange(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] text-xs text-[var(--neon-green)] font-mono p-1.5 focus:border-[var(--neon-green)] outline-none"
                />
              </div>
            </div>

            {/* Priority Sender Bypass Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--neon-green-border)]/30">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                <span className="text-[9.5px] font-mono text-zinc-300 uppercase">
                  Allow VIP Priority Senders
                </span>
              </div>
              <input
                type="checkbox"
                checked={quietConfig.allowPrioritySenders}
                onChange={(e) => handleAllowPriorityChange(e.target.checked)}
                className="accent-[var(--neon-green)] cursor-pointer h-4 w-4"
              />
            </div>
          </div>
        )}
      </div>

      {/* Haptic Pattern Selector by Message Type */}
      <div className="space-y-3.5 border-t border-dashed border-[var(--neon-green)]/20 pt-4">
        <label className="text-[10px] uppercase tracking-widest font-extrabold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> TACTILE HAPTIC SIGNATURES (BY MESSAGE TYPE)
        </label>
        <p className="text-[8.5px] text-zinc-500 font-mono leading-normal">
          Assign distinct vibration tactile rhythms to Direct messages, Group conversations, and System alerts.
        </p>

        <div className="space-y-2.5">
          {[
            { type: 'direct' as MessageType, label: '1. Direct Messages', value: directHaptic },
            { type: 'group' as MessageType, label: '2. Group Conversations', value: groupHaptic },
            { type: 'system' as MessageType, label: '3. System & Security Alerts', value: systemHaptic }
          ].map((item) => (
            <div key={item.type} className="bg-[var(--color-surface)]/60 border border-[var(--neon-green-border)] p-2.5 flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-200 uppercase font-bold">
                  {item.label}
                </span>
                <span className="text-[8px] font-mono text-zinc-500">
                  Pattern: {item.value.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={item.value}
                  onChange={(e) => handleHapticChange(item.type, e.target.value as VibrationPattern)}
                  className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] text-[9.5px] font-mono text-[var(--neon-green)] p-1 uppercase focus:border-[var(--neon-green)] outline-none cursor-pointer"
                >
                  <option value="off">Off (Silent Vibe)</option>
                  <option value="subtle">Subtle Tick (10ms)</option>
                  <option value="light">Light Tap (20ms)</option>
                  <option value="medium">Medium Pulse (45ms)</option>
                  <option value="heavy">Heavy Thump (90ms)</option>
                  <option value="double">Double Burst [40-60-40]</option>
                  <option value="triple">Triple Flutter [30x3]</option>
                  <option value="pulse">Rhythmic Wave [80-50-20]</option>
                  <option value="sos">SOS Urgent Pattern</option>
                </select>

                <button
                  type="button"
                  onClick={() => triggerPatternVibration(item.value)}
                  className="px-2 py-1 bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black font-mono text-[8.5px] uppercase font-bold transition cursor-pointer flex items-center gap-1"
                  title="Test vibration signature on device"
                >
                  <Zap className="w-3 h-3" /> Test
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Allow-listed secure contacts filter */}
      <div className="space-y-2 border-t border-[var(--neon-green)]/20 pt-4">
        <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block">
          Allowed Dispatchers List ({notifMessagesFrom.length} users whitelist)
        </label>
        <p className="text-[8.5px] text-zinc-500 leading-normal mb-2 font-mono">
          Select specific peers who can alert your device when whitelisting is active:
        </p>
        <div className="max-h-24 overflow-y-auto border border-[var(--neon-green-border)] bg-[var(--color-surface)]/40 p-2 space-y-1.5 scrollbar-thin">
          {systemUsers.length === 0 ? (
            <div className="text-[9px] text-zinc-600 font-mono italic">No communication peers registered.</div>
          ) : (
            systemUsers.map((u) => {
              const isAllowed = notifMessagesFrom.includes(u.uid);
              return (
                <div key={u.uid} className="flex items-center justify-between p-1.5 bg-[var(--color-surface)]/60 border border-zinc-950">
                  <span className="text-[10px] font-mono text-zinc-300">@{u.displayName || 'Anonymous'}</span>
                  <button
                    type="button"
                    onClick={() => toggleAllowedSender(u.uid)}
                    className={`px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider border cursor-pointer transition ${
                      isAllowed
                        ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-[var(--neon-green)]'
                        : 'border-[var(--neon-green-border)] text-zinc-500 hover:border-zinc-700'
                    }`}
                  >
                    {isAllowed ? '[Allowed]' : '[Blocked]'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Native Push Diagnostic & Push Test Dispatcher */}
      <div className="space-y-3 border-t border-dashed border-[var(--neon-green)]/20 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-extrabold text-[var(--neon-green)] font-mono block">
              ⚡ NATIVE PUSH ARCHITECTURE & DISPATCHER
            </label>
            <p className="text-[8.5px] text-zinc-500 leading-normal font-mono">
              Audit Android 13+ background tokens, OneSignal synchronization, and FCM routing:
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setIsDiagnosticOpen(true);
            }}
            className="px-3 py-1.5 bg-[var(--neon-green)]/15 border border-[var(--neon-green)] hover:bg-[var(--neon-green)] text-[var(--neon-green)] hover:text-black font-mono text-[9px] font-black uppercase transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.15)]"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Run Push Diagnostic
          </button>
        </div>

        <NativePushDebugger 
          uid={profile?.uid} 
          oneSignalSubscriptionId={profile?.oneSignalSubscriptionId || profile?.oneSignalId} 
        />
      </div>

      {/* Diagnostic Modal */}
      <NotificationDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        uid={profile?.uid}
      />
    </div>
  );
}
