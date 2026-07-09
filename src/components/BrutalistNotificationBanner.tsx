import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertOctagon, Terminal, X, ChevronRight, Play } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { deepLinkManager } from '../lib/deepLinkManager';

export interface BrutalistNotification {
  id: string;
  title: string;
  body: string;
  type?: 'news' | 'chat' | 'announcement' | 'alert' | 'generic';
  data?: any;
  showPopup?: boolean;
  popupDuration?: number;
}

export default function BrutalistNotificationBanner() {
  const [activeNotif, setActiveNotif] = useState<BrutalistNotification | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(3);

  useEffect(() => {
    // 1. Listen for custom Capacitor/OneSignal foreground push events
    const handleForegroundPush = (e: Event) => {
      const customEvent = e as CustomEvent;
      const notification = customEvent.detail;
      if (!notification) return;

      console.log('[Brutalist Banner] Received notification detail payload:', notification);

      // Extract details
      const title = notification.title || notification.caption || 'INCOMING TRANSMISSION';
      const body = notification.body || notification.message || '';
      const data = notification.data || {};
      const type = data.type || 'generic';
      const showPopup = data.showPopup === true || data.showPopup === 'true' || type === 'news';
      const popupDuration = Number(data.popupDuration || data.popup_duration || 3000);

      // Trigger brutalist notification
      setActiveNotif({
        id: notification.id || `${Date.now()}`,
        title,
        body,
        type,
        data,
        showPopup,
        popupDuration
      });

      // Play tactical audio prompt
      try {
        playLikeSound();
      } catch (err) {
        console.warn('Audio alert failed:', err);
      }
    };

    window.addEventListener('faraflick-foreground-push', handleForegroundPush);
    return () => {
      window.removeEventListener('faraflick-foreground-push', handleForegroundPush);
    };
  }, []);

  // Countdown timer for automatic dismissal
  useEffect(() => {
    if (!activeNotif) return;

    // Use popupDuration if specified (default to 3000ms / 3 seconds)
    const durationMs = activeNotif.popupDuration || 3000;
    const initialSeconds = Math.max(1, Math.round(durationMs / 1000));
    setSecondsLeft(initialSeconds);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Dismiss notification with mechanical animation
          setActiveNotif(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeNotif]);

  if (!activeNotif) return null;

  const handleActionClick = () => {
    playGlitchClickSound();
    if (activeNotif.data) {
      console.log('[Brutalist Banner] Action clicked! Parsing payload to deepLinkManager:', activeNotif.data);
      const parsed = deepLinkManager.parsePayload(activeNotif.data);
      if (parsed) {
        deepLinkManager.queueDeepLink(parsed);
      }
    }
    setActiveNotif(null);
  };

  const getThemeStyles = () => {
    if (activeNotif.type === 'news' || activeNotif.data?.priority === 'high') {
      return {
        bg: 'bg-red-500',
        text: 'text-black',
        border: 'border-black',
        iconColor: 'text-black',
        accentText: 'text-red-950',
        title: 'CRITICAL INTEL BROADCAST'
      };
    }
    if (activeNotif.type === 'chat') {
      return {
        bg: 'bg-[var(--neon-green)]',
        text: 'text-black',
        border: 'border-black',
        iconColor: 'text-black',
        accentText: 'text-emerald-950',
        title: 'SECURE TUNNEL TRANSMISSION'
      };
    }
    return {
      bg: 'bg-amber-400',
      text: 'text-black',
      border: 'border-black',
      iconColor: 'text-black',
      accentText: 'text-amber-950',
      title: 'NETWORK INFRA SIGNAL'
    };
  };

  const theme = getThemeStyles();

  return (
    <div className="fixed top-6 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none font-mono">
      <AnimatePresence mode="wait">
        <motion.div
          id="brutalist-foreground-push-banner"
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 12, stiffness: 220 }}
          className={`pointer-events-auto w-full max-w-lg border-4 ${theme.border} ${theme.bg} ${theme.text} p-4 shadow-[8px_8px_0px_0px_#000000] flex flex-col space-y-3 relative overflow-hidden`}
        >
          {/* Diagnostic Grid Accents */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 -mr-10 -mt-10 rotate-45 pointer-events-none border border-black/10" />

          {/* Banner Header */}
          <div className="flex items-center justify-between border-b-2 border-black/20 pb-2">
            <div className="flex items-center space-x-2">
              <AlertOctagon className={`w-5 h-5 ${theme.iconColor} animate-bounce`} />
              <span className="text-xs uppercase font-black tracking-widest">{theme.title}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-black text-white text-[9px] px-1.5 py-0.5 font-bold animate-pulse">
                AUTO-DISMISS IN {secondsLeft}S
              </span>
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setActiveNotif(null);
                }}
                className="hover:bg-black hover:text-white p-0.5 border border-transparent hover:border-black transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Banner Body */}
          <div className="flex flex-col space-y-1.5">
            <h4 className="text-sm font-serif font-black uppercase tracking-tight line-clamp-1">
              ⚡ {activeNotif.title}
            </h4>
            <p className="text-xs font-sans font-bold leading-relaxed line-clamp-2 opacity-90">
              {activeNotif.body}
            </p>
          </div>

          {/* Interactive Action Controls */}
          <div className="flex items-center justify-between pt-1 border-t border-black/15">
            <div className="flex items-center space-x-1.5 text-[9px] font-black uppercase opacity-75">
              <Terminal className="w-3.5 h-3.5" />
              <span>PAYLOAD_TYPE: {activeNotif.type}</span>
            </div>

            <button
              onClick={handleActionClick}
              className="bg-black text-white hover:bg-zinc-900 active:translate-x-0.5 active:translate-y-0.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.35)] hover:shadow-none"
            >
              <span>DECRYPT CHANNEL</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
