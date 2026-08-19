import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ArrowRightLeft, Upload, X, HardDrive, Sparkles } from 'lucide-react';
import { getDeviceStorageStats } from '../lib/deviceStorageEngine';
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

  useEffect(() => {
    const checkIsNewDevice = async () => {
      const dismissed = localStorage.getItem('flick_new_device_banner_dismissed');
      if (dismissed === 'true') return;

      try {
        const stats = await getDeviceStorageStats();
        // If device has 0 conversations, show the friendly local-first orientation banner
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-2"
      >
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-black border border-[var(--neon-green-border)] shadow-xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--neon-green)]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start space-x-3.5 max-w-2xl">
              <div className="w-10 h-10 rounded-2xl bg-[var(--neon-green)]/15 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)] shrink-0 mt-0.5">
                <Shield className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
                    Welcome to this Device
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30 font-bold">
                    Local-First Security
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your Flick conversations and voice recordings live strictly on your devices. Firebase acts only as an encrypted delivery bridge.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                onClick={() => {
                  playGlitchClickSound();
                  onOpenTransfer();
                }}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[var(--neon-green)] text-black font-black text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,255,102,0.15)]"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Sync Device
              </button>

              <button
                onClick={() => {
                  playGlitchClickSound();
                  onOpenRestore();
                }}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-[11px] uppercase tracking-wider hover:bg-zinc-700 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                Restore Backup
              </button>

              <button
                onClick={handleDismiss}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0"
                title="Dismiss and Start Fresh on this device"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
