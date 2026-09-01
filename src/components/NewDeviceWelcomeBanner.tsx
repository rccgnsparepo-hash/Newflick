import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRightLeft, Upload, X, AlertTriangle } from 'lucide-react';
import { getDeviceStorageStats, getDevicePlatform } from '../lib/deviceStorageEngine';
import { playGlitchClickSound } from '../lib/sounds';

interface NewDeviceWelcomeBannerProps {
  onOpenTransfer: () => void;
  onOpenRestore: () => void;
}

export function NewDeviceWelcomeBanner({
  onOpenTransfer,
  onOpenRestore,
}: NewDeviceWelcomeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState('device');

  useEffect(() => {
    const checkIsNewDevice = async () => {
      const dismissed = localStorage.getItem('flick_new_device_banner_dismissed');
      if (dismissed === 'true') return;

      try {
        setPlatform(getDevicePlatform());
        const stats = await getDeviceStorageStats();
        // If device has 0 local conversations or messages, trigger the unfamiliar device orientation warning
        if (stats.totalConversations === 0 && stats.totalMessages === 0) {
          setIsVisible(true);
        }
      } catch {}
    };

    checkIsNewDevice();
  }, []);

  const handleDismiss = () => {
    playGlitchClickSound();
    localStorage.setItem('flick_new_device_banner_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="w-full max-w-2xl mx-auto p-3 sm:p-4 my-2"
      >
        <div className="p-4 rounded-xl bg-black/90 border-2 border-amber-500/60 shadow-[4px_4px_0px_0px_#f59e0b] relative overflow-hidden font-mono">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    ⚠️ New System Detected
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Hardware Local Storage
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed font-sans font-medium">
                  Flick stores your chats and voice logs strictly on this device (zero-knowledge offline vault). If you used Flick on another phone or computer, you can restore your chat history here:
                </p>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      onOpenRestore();
                    }}
                    className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-black font-black text-[11px] uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import .flick File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      onOpenTransfer();
                    }}
                    className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-[11px] uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    <span>Device-to-Device Sync</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 underline uppercase ml-1 cursor-pointer py-1"
                  >
                    Dismiss & Start Fresh
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

