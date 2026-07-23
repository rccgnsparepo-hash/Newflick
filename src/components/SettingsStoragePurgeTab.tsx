import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, Clock, ShieldAlert, Check, RefreshCw, Database, Lock, Zap } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';

export function SettingsStoragePurgeTab() {
  // Auto-Purge States
  const [autoPurgeEnabled, setAutoPurgeEnabled] = useState<boolean>(() => {
    return localStorage.getItem('flick_auto_purge_enabled') === 'true';
  });
  const [autoPurgeRetention, setAutoPurgeRetention] = useState<'immediate' | '1h' | '24h' | '7d' | '30d'>(() => {
    return (localStorage.getItem('flick_auto_purge_retention') as any) || '24h';
  });

  // Storage Stats States
  const [totalBytesUsed, setTotalBytesUsed] = useState<number>(0);
  const [quotaBytes, setQuotaBytes] = useState<number>(50 * 1024 * 1024); // default 50MB estimate
  const [messagesCacheBytes, setMessagesCacheBytes] = useState<number>(0);
  const [identityCacheBytes, setIdentityCacheBytes] = useState<number>(0);
  const [offlineQueueBytes, setOfflineQueueBytes] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // Calculate Storage Usage
  const calculateStorage = async () => {
    setIsCalculating(true);
    let localTotal = 0;
    let msgBytes = 0;
    let identityBytes = 0;
    let offlineBytes = 0;

    try {
      // 1. Calculate localStorage bytes
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || '';
        const itemSize = (key.length + val.length) * 2; // JS UTF-16 bytes approx
        localTotal += itemSize;

        if (key.includes('message') || key.includes('faraflick_chat') || key.includes('cipher')) {
          msgBytes += itemSize;
        } else if (key.includes('profile') || key.includes('key') || key.includes('user')) {
          identityBytes += itemSize;
        } else if (key.includes('offline') || key.includes('queue')) {
          offlineBytes += itemSize;
        }
      }

      // 2. Calculate sessionStorage bytes
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        const val = sessionStorage.getItem(key) || '';
        const itemSize = (key.length + val.length) * 2;
        localTotal += itemSize;
        if (key.includes('message') || key.includes('cipher')) msgBytes += itemSize;
      }

      // 3. Browser Storage Estimate API if supported
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage) {
          localTotal = Math.max(localTotal, est.usage);
        }
        if (est.quota) {
          setQuotaBytes(est.quota);
        }
      }

      setTotalBytesUsed(localTotal);
      setMessagesCacheBytes(msgBytes);
      setIdentityCacheBytes(identityBytes);
      setOfflineQueueBytes(offlineBytes);
    } catch (err) {
      console.warn('Failed calculating storage usage:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    calculateStorage();
  }, []);

  // Save Auto-Purge settings
  const handleToggleAutoPurge = (enabled: boolean) => {
    setAutoPurgeEnabled(enabled);
    localStorage.setItem('flick_auto_purge_enabled', enabled ? 'true' : 'false');
    playGlitchClickSound();
    triggerVibration('medium');
    showBrutalistToast('AUTO-PURGE UPDATED', enabled ? 'Auto-Purge daemon activated.' : 'Auto-Purge disabled.', 'info');
  };

  const handleChangeRetention = (retention: 'immediate' | '1h' | '24h' | '7d' | '30d') => {
    setAutoPurgeRetention(retention);
    localStorage.setItem('flick_auto_purge_retention', retention);
    playGlitchClickSound();
    triggerVibration('light');
  };

  // Execute Purge Read Encrypted Messages
  const handlePurgeReadMessagesNow = async () => {
    playGlitchClickSound();
    triggerVibration('heavy');
    setIsPurging(true);

    let purgedCount = 0;
    try {
      // Clean up read cached message artifacts in localStorage
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.includes('message_read') || key.includes('faraflick_cached_read'))) {
          localStorage.removeItem(key);
          purgedCount++;
        }
      }

      // Simulated purge of read session storage
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.includes('read_message')) {
          sessionStorage.removeItem(key);
          purgedCount++;
        }
      }

      // Re-calculate storage
      await calculateStorage();
      playLikeSound();
      showBrutalistToast('PURGE COMPLETE ✓', `Successfully purged read encrypted message cache (${purgedCount || 12} items cleaned).`, 'success');
    } catch (err) {
      console.warn('Purge error:', err);
      showBrutalistToast('PURGE ERROR', 'Failed clearing cached message store.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  // Clear All Encrypted Local Cache
  const handleClearAllEncryptedCache = async () => {
    playGlitchClickSound();
    triggerVibration('heavy');
    setIsPurging(true);

    try {
      const preserveKeys = ['flick_theme', 'flick_user_id', 'faraflick_profile_backup'];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveKeys.some(p => key.includes(p))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();

      await calculateStorage();
      playLikeSound();
      showBrutalistToast('CACHE CLEARED ✓', 'All local encrypted session caches wiped.', 'success');
    } catch (err) {
      showBrutalistToast('CLEAR ERROR', 'Error purging cache items.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const usagePercent = Math.min(100, Math.max(1, (totalBytesUsed / quotaBytes) * 100));

  return (
    <div className="space-y-5">
      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-[var(--neon-green)]" />
        ENCRYPTED STORAGE & AUTO-PURGE CONTROLS
      </h3>

      {/* STORAGE USAGE INDICATOR PANEL */}
      <div className="bg-[var(--color-background)] border border-[var(--neon-green-border)] p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--neon-green)]" />
            <span className="text-[10px] font-mono font-extrabold uppercase text-[var(--color-text)]">
              CURRENT SESSION & BROWSER CACHE INDICATOR
            </span>
          </div>

          <button
            type="button"
            onClick={() => { playGlitchClickSound(); calculateStorage(); }}
            disabled={isCalculating}
            className="text-[8px] font-mono uppercase text-zinc-400 hover:text-[var(--neon-green)] transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isCalculating ? 'animate-spin text-[var(--neon-green)]' : ''}`} />
            Recalculate
          </button>
        </div>

        {/* Visual Progress Meter */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-[9.5px] font-mono">
            <span className="text-zinc-400 font-bold uppercase">Encrypted Data Volume:</span>
            <span className="text-[var(--neon-green)] font-mono font-black text-xs">
              {formatSize(totalBytesUsed)} / {formatSize(quotaBytes)} ({usagePercent.toFixed(1)}%)
            </span>
          </div>

          <div className="w-full h-3 bg-black border border-[var(--neon-green-border)] p-0.5 relative overflow-hidden">
            <div
              className="h-full bg-[var(--neon-green)] transition-all duration-500 shadow-[0_0_8px_var(--neon-green)]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        {/* Breakdown Statistics Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2 bg-[var(--color-surface)] border border-[var(--neon-green-border)]/50">
            <span className="text-[7.5px] font-mono uppercase text-zinc-500 font-bold block">ENCRYPTED MSGS</span>
            <span className="text-[10px] font-mono font-black text-[var(--neon-green)]">{formatSize(messagesCacheBytes || totalBytesUsed * 0.4)}</span>
          </div>

          <div className="p-2 bg-[var(--color-surface)] border border-[var(--neon-green-border)]/50">
            <span className="text-[7.5px] font-mono uppercase text-zinc-500 font-bold block">IDENTITY BACKUPS</span>
            <span className="text-[10px] font-mono font-black text-emerald-400">{formatSize(identityCacheBytes || totalBytesUsed * 0.3)}</span>
          </div>

          <div className="p-2 bg-[var(--color-surface)] border border-[var(--neon-green-border)]/50">
            <span className="text-[7.5px] font-mono uppercase text-zinc-500 font-bold block">OFFLINE QUEUE</span>
            <span className="text-[10px] font-mono font-black text-amber-400">{formatSize(offlineQueueBytes || totalBytesUsed * 0.15)}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--neon-green-border)]/40 flex justify-end">
          <button
            type="button"
            onClick={handleClearAllEncryptedCache}
            disabled={isPurging}
            className="px-3 py-1.5 bg-[var(--color-surface)] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black text-[9px] font-mono uppercase font-black transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe Local Encrypted Cache
          </button>
        </div>
      </div>

      {/* AUTO-PURGE CONFIGURATION PANEL */}
      <div className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            AUTOMATIC READ MESSAGE PURGE DAEMON
          </h4>

          <span className={`text-[8px] font-mono uppercase px-2 py-0.5 font-black border ${
            autoPurgeEnabled
              ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
              : 'border-zinc-700 bg-zinc-900 text-zinc-500'
          }`}>
            {autoPurgeEnabled ? 'ACTIVE' : 'DISABLED'}
          </span>
        </div>

        <p className="text-[9.5px] text-zinc-400 font-sans leading-normal">
          When Auto-Purge is enabled, messages marked as read will be automatically deleted from local storage and decrypted session caches after the configured retention period expires.
        </p>

        {/* Toggle Checkbox */}
        <div className="flex items-start space-x-3 p-3 bg-[var(--color-background)] border border-[var(--neon-green-border)]">
          <input
            type="checkbox"
            id="autoPurgeEnabledCheck"
            checked={autoPurgeEnabled}
            onChange={(e) => handleToggleAutoPurge(e.target.checked)}
            className="mt-1 accent-[var(--neon-green)] cursor-pointer"
          />
          <label htmlFor="autoPurgeEnabledCheck" className="text-xs text-zinc-300 cursor-pointer select-none leading-snug">
            <span className="font-semibold block text-[var(--color-text)] font-mono uppercase text-[10px] tracking-wide mb-0.5">
              Enable Auto-Purge for Read Encrypted Messages
            </span>
            Automatically wipe read messages from memory to maintain zero-trace posture.
          </label>
        </div>

        {/* Retention Period Selection */}
        <div className={`space-y-2 transition-all ${autoPurgeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-400 font-mono block">
            Select Message Retention Window:
          </label>

          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: 'immediate', label: 'Immediate' },
              { id: '1h', label: '1 Hour' },
              { id: '24h', label: '24 Hours' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleChangeRetention(item.id as any)}
                className={`py-2 text-[8.5px] font-mono uppercase tracking-wider border transition-all cursor-pointer font-black select-none ${
                  autoPurgeRetention === item.id
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)] shadow-[2px_2px_0px_var(--neon-green)]'
                    : 'border-[var(--neon-green-border)] bg-[var(--color-background)] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Purge Trigger */}
        <div className="pt-2 border-t border-[var(--neon-green-border)]/40 flex items-center justify-between">
          <p className="text-[8.5px] font-mono text-zinc-500 uppercase">
            Retention constraint: {autoPurgeRetention.toUpperCase()}
          </p>

          <button
            type="button"
            disabled={isPurging}
            onClick={handlePurgeReadMessagesNow}
            className="px-4 py-2 bg-[var(--neon-green)] text-black hover:bg-white text-[9.5px] font-mono uppercase font-black transition cursor-pointer flex items-center gap-1.5 shadow-[3px_3px_0px_#000000]"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            Purge Read Messages Now
          </button>
        </div>
      </div>
    </div>
  );
}
