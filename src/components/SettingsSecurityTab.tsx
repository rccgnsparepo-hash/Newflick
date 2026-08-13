import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Laptop, Smartphone, Globe, LogOut, Key, Lock, RefreshCw, History } from 'lucide-react';
import {
  getUserDeviceSessions,
  logoutDeviceSession,
  logoutAllOtherDevices,
  getSecurityEvents,
  UserDeviceSession,
  SecurityEvent
} from '../lib/securityService';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { showBrutalistToast } from '../lib/toast';

interface SettingsSecurityTabProps {
  userId: string;
}

export function SettingsSecurityTab({ userId }: SettingsSecurityTabProps) {
  const [sessions, setSessions] = useState<UserDeviceSession[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [chatLock, setChatLock] = useState<boolean>(() => localStorage.getItem('flick_chat_lock') === 'true');
  const [pin, setPin] = useState<string>(() => localStorage.getItem('flick_chat_lock_pin') || '');

  const loadData = async () => {
    if (!userId) return;
    setLoadingSessions(true);
    setLoadingEvents(true);

    const activeSessions = await getUserDeviceSessions(userId);
    setSessions(activeSessions);
    setLoadingSessions(false);

    const logs = await getSecurityEvents(userId);
    setEvents(logs);
    setLoadingEvents(false);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleLogoutDevice = async (deviceId: string) => {
    playGlitchClickSound();
    await logoutDeviceSession(userId, deviceId);
    showBrutalistToast('SUCCESS ✓', 'Device session revoked successfully.', 'success');
    loadData();
  };

  const handleLogoutAllOthers = async () => {
    playGlitchClickSound();
    await logoutAllOtherDevices(userId);
    showBrutalistToast('SUCCESS ✓', 'All other device sessions revoked.', 'success');
    loadData();
  };

  const handleToggleChatLock = (enabled: boolean) => {
    playGlitchClickSound();
    setChatLock(enabled);
    localStorage.setItem('flick_chat_lock', enabled ? 'true' : 'false');
    showBrutalistToast('SECURITY SETTING', enabled ? 'App & Chat Lock ENABLED' : 'App & Chat Lock DISABLED', 'info');
  };

  const handleSavePin = (newPin: string) => {
    setPin(newPin);
    localStorage.setItem('flick_chat_lock_pin', newPin);
  };

  return (
    <div className="space-y-6 text-[var(--color-text)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--neon-green)]/30 pb-3">
        <Shield className="w-5 h-5 text-[var(--neon-green)]" />
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider">SECURITY & DEVICE MANAGEMENT</h3>
      </div>

      {/* App & Chat Lock */}
      <div className="bg-[var(--color-background)] border border-[var(--neon-green-border)] p-4 rounded-none space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--neon-green)]" />
            <div>
              <p className="font-mono text-xs font-bold uppercase">Passcode / Chat Lock</p>
              <p className="text-[10px] text-zinc-400">Require a PIN code when launching or unlocking sensitive chats</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggleChatLock(!chatLock)}
            className={`px-3 py-1 text-[10px] font-mono uppercase font-bold border transition-all ${
              chatLock
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            {chatLock ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {chatLock && (
          <div className="pt-2 border-t border-zinc-800 flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-400 uppercase shrink-0">Security PIN Code:</span>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => handleSavePin(e.target.value)}
              placeholder="1234"
              className="bg-black border border-[var(--neon-green)]/50 px-3 py-1 text-xs font-mono w-28 text-center text-[var(--neon-green)] tracking-widest focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Active Device Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-mono text-xs font-bold uppercase flex items-center gap-2 text-zinc-300">
            <Laptop className="w-4 h-4 text-[var(--neon-green)]" />
            ACTIVE SIGNED-IN DEVICES
          </h4>
          {sessions.length > 1 && (
            <button
              type="button"
              onClick={handleLogoutAllOthers}
              className="text-[10px] font-mono uppercase text-red-400 hover:text-red-300 underline flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Log Out All Other Devices
            </button>
          )}
        </div>

        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`p-3 border flex items-center justify-between transition-all ${
                s.isCurrent
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10'
                  : 'border-zinc-800 bg-[var(--color-background)]'
              }`}
            >
              <div className="flex items-center gap-3">
                {s.deviceType === 'mobile' ? (
                  <Smartphone className="w-5 h-5 text-[var(--neon-green)] shrink-0" />
                ) : s.deviceType === 'desktop' ? (
                  <Laptop className="w-5 h-5 text-[var(--neon-green)] shrink-0" />
                ) : (
                  <Globe className="w-5 h-5 text-[var(--neon-green)] shrink-0" />
                )}
                <div>
                  <p className="font-mono text-xs font-bold uppercase flex items-center gap-2">
                    {s.deviceName}
                    {s.isCurrent && (
                      <span className="bg-[var(--neon-green)] text-black text-[8px] px-1.5 py-0.5 font-bold uppercase">
                        CURRENT DEVICE
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">Last active: {s.lastActive}</p>
                </div>
              </div>

              {!s.isCurrent && (
                <button
                  type="button"
                  onClick={() => handleLogoutDevice(s.id)}
                  className="px-2 py-1 text-[9px] font-mono uppercase text-red-400 hover:bg-red-500/10 border border-red-500/30 cursor-pointer"
                >
                  Log Out
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Security History Log */}
      <div className="space-y-3 pt-2 border-t border-[var(--neon-green)]/20">
        <h4 className="font-mono text-xs font-bold uppercase flex items-center gap-2 text-zinc-300">
          <History className="w-4 h-4 text-[var(--neon-green)]" />
          SECURITY EVENT HISTORY
        </h4>

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-[10px] font-mono text-zinc-500 italic">No security alerts logged.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="p-2 border border-zinc-800 bg-black/40 text-[10px] font-mono flex items-center justify-between">
                <div>
                  <span className="text-[var(--neon-green)] font-bold uppercase">{ev.title}</span>
                  {ev.details && <span className="text-zinc-400 ml-2">— {ev.details}</span>}
                </div>
                <span className="text-zinc-500 text-[9px] shrink-0">{new Date(ev.timestamp).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
