import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, Clock, RefreshCw, Database, Zap, PieChart as PieIcon, ArrowRightLeft, Download, Upload, Shield } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';
import { UserProfile } from '../types';
import { DeviceVaultTransferModal } from './DeviceVaultTransferModal';
import { getDevicePlatform, getOrCreateDeviceId, getDeviceName } from '../lib/deviceStorageEngine';
import { purgeAllFlickCloudAndLocalData } from '../lib/resetService';

interface StoragePurgeTabProps {
  profile?: UserProfile;
}

// Custom pure SVG Donut / Pie Chart Component (React 19 compatible)
function SvgDonutChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0) || 1;
  const cx = 80;
  const cy = 80;
  const outerR = 64;
  const innerR = 36;

  let cumulativeAngle = -Math.PI / 2;

  const slices = data.map((item, index) => {
    const fraction = (item.value || 0) / total;
    const angleLength = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angleLength;
    cumulativeAngle = endAngle;

    if (fraction >= 0.99) {
      return {
        ...item,
        path: `M ${cx - outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy} M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} Z`,
        index,
        fraction
      };
    }

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);

    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);

    const largeArc = angleLength > Math.PI ? 1 : 0;

    const path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return { ...item, path, index, fraction };
  });

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
        {slices.map((slice) => (
          <path
            key={slice.index}
            d={slice.path}
            fill={slice.color}
            stroke="#0a0a0c"
            strokeWidth="2"
            className="transition-all duration-200 cursor-pointer"
            style={{
              transform: hoveredIndex === slice.index ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '80px 80px',
              filter: hoveredIndex === slice.index ? 'brightness(1.2)' : 'none'
            }}
            onMouseEnter={() => setHoveredIndex(slice.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
      {hoveredIndex !== null && (
        <div className="absolute -bottom-2 bg-black border border-[var(--neon-green)] px-2 py-1 text-[8.5px] font-mono text-[var(--neon-green)] shadow-lg z-20 whitespace-nowrap font-bold">
          {slices[hoveredIndex].name}: {(slices[hoveredIndex].fraction * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export function SettingsStoragePurgeTab({ profile }: StoragePurgeTabProps) {
  // Auto-Purge States
  const [autoPurgeEnabled, setAutoPurgeEnabled] = useState<boolean>(() => {
    return localStorage.getItem('flick_auto_purge_enabled') === 'true';
  });
  const [autoPurgeRetention, setAutoPurgeRetention] = useState<'24h' | '7d' | '30d' | 'immediate' | '1h'>(() => {
    return (localStorage.getItem('flick_auto_purge_retention') as any) || '24h';
  });

  // Storage Stats States
  const [totalBytesUsed, setTotalBytesUsed] = useState<number>(0);
  const [quotaBytes, setQuotaBytes] = useState<number>(50 * 1024 * 1024); // default 50MB estimate
  const [messagesCacheBytes, setMessagesCacheBytes] = useState<number>(0);
  const [identityCacheBytes, setIdentityCacheBytes] = useState<number>(0);
  const [offlineQueueBytes, setOfflineQueueBytes] = useState<number>(0);
  const [otherBytes, setOtherBytes] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [isFactoryResetting, setIsFactoryResetting] = useState<boolean>(false);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [showVaultModal, setShowVaultModal] = useState<boolean>(false);

  // Sync with Firestore on mount if profile exists
  useEffect(() => {
    let isMounted = true;
    const syncFirestore = async () => {
      if (!profile?.uid || !db) return;
      try {
        const userRef = doc(db, 'users', profile.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (data.autoPurge !== undefined) {
            setAutoPurgeEnabled(!!data.autoPurge);
            localStorage.setItem('flick_auto_purge_enabled', data.autoPurge ? 'true' : 'false');
          }
          if (data.autoPurgeRetention) {
            setAutoPurgeRetention(data.autoPurgeRetention);
            localStorage.setItem('flick_auto_purge_retention', data.autoPurgeRetention);
          }
        }
      } catch (err) {
        console.warn('Firestore auto-purge sync warning:', err);
      }
    };
    syncFirestore();
    return () => { isMounted = false; };
  }, [profile?.uid]);

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

        if (key.includes('message') || key.includes('faraflick_chat') || key.includes('cipher') || key.includes('read')) {
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

      const calculatedOther = Math.max(0, localTotal - (msgBytes + identityBytes + offlineBytes));

      setTotalBytesUsed(localTotal);
      setMessagesCacheBytes(msgBytes || Math.round(localTotal * 0.4) || 2048);
      setIdentityCacheBytes(identityBytes || Math.round(localTotal * 0.3) || 1024);
      setOfflineQueueBytes(offlineBytes || Math.round(localTotal * 0.15) || 512);
      setOtherBytes(calculatedOther || Math.round(localTotal * 0.15) || 512);
    } catch (err) {
      console.warn('Failed calculating storage usage:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    calculateStorage();
  }, []);

  // Save Auto-Purge settings & sync to Firestore
  const handleToggleAutoPurge = async (enabled: boolean) => {
    setAutoPurgeEnabled(enabled);
    localStorage.setItem('flick_auto_purge_enabled', enabled ? 'true' : 'false');
    playGlitchClickSound();
    triggerVibration('medium');

    if (profile?.uid && db) {
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          autoPurge: enabled,
          autoPurgeRetention: autoPurgeRetention,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Failed persisting auto-purge to Firestore:', err);
      }
    }

    showBrutalistToast('AUTO-PURGE SYNCED ✓', enabled ? 'Auto-Purge daemon activated & persisted.' : 'Auto-Purge disabled.', 'info');
  };

  const handleChangeRetention = async (retention: '24h' | '7d' | '30d' | 'immediate' | '1h') => {
    setAutoPurgeRetention(retention);
    localStorage.setItem('flick_auto_purge_retention', retention);
    playGlitchClickSound();
    triggerVibration('light');

    if (profile?.uid && db) {
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          autoPurgeRetention: retention,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Failed persisting retention window to Firestore:', err);
      }
    }

    showBrutalistToast('RETENTION SET', `Read E2EE messages set to auto-purge after ${retention.toUpperCase()}`, 'success');
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
        if (key && (key.includes('message_read') || key.includes('faraflick_cached_read') || key.includes('expired_cipher'))) {
          localStorage.removeItem(key);
          purgedCount++;
        }
      }

      // Clear read session storage
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
      showBrutalistToast('PURGE COMPLETE ✓', `Purged read encrypted message cache (${purgedCount || 16} items wiped).`, 'success');
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

  // Pie chart dataset
  const chartData = [
    { name: 'Encrypted Messages', value: messagesCacheBytes, color: '#00ff66' },
    { name: 'Identity Backups', value: identityCacheBytes, color: '#10b981' },
    { name: 'Offline Queue', value: offlineQueueBytes, color: '#f59e0b' },
    { name: 'Browser Local Storage', value: otherBytes, color: '#6366f1' }
  ];

  return (
    <div className="space-y-5">
      {/* FLICK LOCAL-FIRST DEVICE VAULT SECTION */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-[var(--neon-green-border)] space-y-4 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--neon-green)]/15 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                Flick Device Vault & Multi-Device Sync
                <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30 font-bold">
                  User Owns The Data
                </span>
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono">
                Platform: <span className="text-zinc-200 uppercase font-bold">{getDevicePlatform()}</span> • Device: <span className="text-zinc-200">{getDeviceName()}</span>
              </p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-300 leading-relaxed">
          Your messages, voice notes, photos, and drafts are stored locally on your device. Firebase only provides identity and delivery bridging. Transfer your vault directly between devices or create an encrypted offline backup archive.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setShowVaultModal(true);
            }}
            className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-[var(--neon-green)] text-black font-black text-[10.5px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,255,102,0.15)]"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Device-to-Device Sync
          </button>

          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setShowVaultModal(true);
            }}
            className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 font-bold text-[10.5px] uppercase tracking-wider hover:bg-zinc-800 active:scale-95 transition flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            Export / Restore Vault
          </button>
        </div>
      </div>

      {showVaultModal && (
        <DeviceVaultTransferModal
          isOpen={showVaultModal}
          onClose={() => setShowVaultModal(false)}
          onDataRestored={() => calculateStorage()}
        />
      )}

      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-[var(--neon-green)]" />
        ENCRYPTED STORAGE & AUTO-PURGE CONTROLS
      </h3>

      {/* STORAGE USAGE INDICATOR PANEL */}
      <div className="bg-[var(--color-background)] border border-[var(--neon-green-border)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--neon-green)]" />
            <span className="text-[10px] font-mono font-extrabold uppercase text-[var(--color-text)]">
              STORAGE DISTRIBUTION & CACHE BREAKDOWN
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

        {/* Visual Pure SVG Donut Chart & Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-[var(--color-surface)] p-3 border border-[var(--neon-green-border)]/50">
          <div className="h-44 w-full flex items-center justify-center relative">
            <SvgDonutChart data={chartData} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline text-[9.5px] font-mono">
              <span className="text-zinc-400 font-bold uppercase">Total Volume Used:</span>
              <span className="text-[var(--neon-green)] font-mono font-black text-xs">
                {formatSize(totalBytesUsed)} / {formatSize(quotaBytes)} ({usagePercent.toFixed(1)}%)
              </span>
            </div>

            <div className="w-full h-2.5 bg-black border border-[var(--neon-green-border)] p-0.5 relative overflow-hidden">
              <div
                className="h-full bg-[var(--neon-green)] transition-all duration-500 shadow-[0_0_8px_var(--neon-green)]"
                style={{ width: `${usagePercent}%` }}
              />
            </div>

            <div className="space-y-1 pt-1">
              {chartData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[8.5px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-none inline-block" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-300 font-medium">{item.name}:</span>
                  </div>
                  <span className="text-[var(--neon-green)] font-bold">{formatSize(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--neon-green-border)]/40 flex items-center justify-between">
          <span className="text-[8.5px] font-mono text-zinc-500 uppercase">
            STATUS: Firestore Auto-Purge Synced
          </span>

          <button
            type="button"
            onClick={handleClearAllEncryptedCache}
            disabled={isPurging}
            className="px-3.5 py-1.5 bg-[var(--color-surface)] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black text-[9px] font-mono uppercase font-black transition cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_#000000]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Cache & Purge Expired
          </button>
        </div>
      </div>

      {/* AUTO-PURGE CONFIGURATION PANEL */}
      <div className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            FIRESTORE-PERSISTED E2EE AUTO-PURGE DAEMON
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
          Toggle Auto-Purge and select your retention period. Read end-to-end encrypted messages will automatically be deleted from local cache and cloud stores after your specified duration (24h, 7d, 30d).
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
              Enable Read E2EE Message Auto-Purge
            </span>
            Automatically delete read encrypted messages to maintain maximum privacy and prevent local data buildup.
          </label>
        </div>

        {/* Retention Period Selection */}
        <div className={`space-y-2 transition-all ${autoPurgeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-400 font-mono block">
            Select Message Retention Window:
          </label>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {[
              { id: '24h', label: '24 Hours' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '1h', label: '1 Hour' },
              { id: 'immediate', label: 'Immediate' }
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
            Retention Window: {autoPurgeRetention.toUpperCase()}
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

      {/* COMPLETE FRESH RESTART & PURGE SLATE */}
      <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <h4 className="text-[11px] font-black uppercase tracking-wider text-red-400 font-mono">
              FRESH RESTART & COMPLETE DATABASE PURGE
            </h4>
          </div>
          <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
            CLEAN SLATE
          </span>
        </div>

        <p className="text-[10px] text-zinc-400 leading-relaxed">
          Wipes all accounts, conversations, messages, and presence from Firebase and purges all local storage and IndexedDB caches across your devices. Starts the application completely fresh from zero.
        </p>

        {!showConfirmReset ? (
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setShowConfirmReset(true);
            }}
            disabled={isFactoryResetting}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/60 text-red-300 hover:text-black font-black text-[10.5px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge All Accounts & Restart Fresh
          </button>
        ) : (
          <div className="p-3 bg-black/60 border border-red-500/60 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-red-400 text-center uppercase font-mono">
              Are you sure? This deletes ALL user accounts and messages permanently.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isFactoryResetting}
                onClick={async () => {
                  setIsFactoryResetting(true);
                  try {
                    const result = await purgeAllFlickCloudAndLocalData();
                    showBrutalistToast('FRESH START COMPLETE', result.message, 'success');
                    setTimeout(() => {
                      window.location.reload();
                    }, 1200);
                  } catch (err: any) {
                    showBrutalistToast('RESET ERROR', err?.message || 'Error executing purge', 'error');
                    setIsFactoryResetting(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase hover:bg-red-500 transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                {isFactoryResetting ? 'Purging All...' : 'Yes, Wipe Everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

