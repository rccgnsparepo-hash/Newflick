import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, AlertTriangle, X, Play } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface HorizontalTickerProps {
  initialVisible?: boolean;
}

export default function HorizontalTicker({ initialVisible = true }: HorizontalTickerProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [tickerNews, setTickerNews] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(300); // 5 minutes countdown (300 seconds)

  // Dynamic news headlines that mimic active telemetry and cryptographic shards
  const headlines = [
    "CYBER CRITICAL: NIST standards finalize quantum-resistant Kyber nodes. Root servers migrating.",
    "NETWORK TRACE: Zero-click browser graphics buffer leak isolated in Chromium sandbox core.",
    "BGP ROUTE ALERT: Core lines rerouted via APAC ocean fiber gateways. Latency stable.",
    "INTELLIGENCE TRANS: Flick zero-knowledge authenticator proof processed in 8.4ms.",
    "E2EE SECURE: Direct communication session keys updated via perfect forward secrecy.",
    "HOST ATTACK SYSTEM: Inception-level sandbox VM bypass trace identified and neutralized."
  ];

  // Rotate a list of tickers representing "items added mins ago"
  useEffect(() => {
    // Generate simulated fresh posts "N mins/secs ago"
    const freshNews = headlines.map((h, i) => {
      const minsAgo = Math.floor(Math.random() * 4) + 1;
      return `[NEWLY RECOGNIZED // ${minsAgo}M AGO] — ${h}`;
    });
    setTickerNews(freshNews);
  }, []);

  // Timer interval to trigger active scroll banner every 5 minutes (300 seconds)
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger the banner to show up!
          setVisible(true);
          playLikeSound();
          // Reset countdown to 5 minutes (300 seconds)
          return 300; 
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, []);

  // Auto-dismiss the scrolling banner after 45 seconds of continuous playback to keep UI spacious
  useEffect(() => {
    if (visible) {
      const dismissTimer = setTimeout(() => {
        setVisible(false);
      }, 45000); // Show for 45s, then hide
      return () => clearTimeout(dismissTimer);
    }
  }, [visible]);

  const forceTrigger = () => {
    playGlitchClickSound();
    setVisible(true);
    setCountdown(300); // Reset timer
  };

  const minutesPart = Math.floor(countdown / 60);
  const secondsPart = countdown % 60;

  return (
    <div className="w-full space-y-2 mb-4">
      {/* Simulation status bar (keeps system state transparent and actionable) */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#FAF9F6] dark:bg-zinc-900 border border-black/10 dark:border-zinc-800 text-[10px] uppercase font-mono tracking-wider">
        <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Next Ticker Broadcast: {minutesPart}:{secondsPart < 10 ? `0${secondsPart}` : secondsPart}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={forceTrigger}
            className="flex items-center gap-1 text-neutral-800 dark:text-zinc-200 hover:text-amber-500 transition cursor-pointer font-bold leading-none"
          >
            <Play className="w-2.5 h-2.5 text-amber-500 uppercase fill-amber-500" />
            Trigger Broadcast
          </button>
        </div>
      </div>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden border border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 relative"
            style={{ width: '100%' }}
          >
            <div className="flex items-center h-9 relative">
              {/* Badge */}
              <div className="bg-amber-400 text-black px-3 py-1 h-full flex items-center font-mono text-[9px] font-black uppercase tracking-wider shrink-0 z-10 select-none gap-1.5 border-r border-amber-500">
                <Radio className="w-3.5 h-3.5 animate-pulse text-black" />
                BREAKING SECURITY LOGS
              </div>

              {/* Scrolling wrapper */}
              <div className="flex-1 overflow-hidden relative h-full flex items-center bg-amber-50/50 dark:bg-amber-950/5 cursor-default select-none">
                <motion.div
                  className="flex whitespace-nowrap gap-16 pr-8 text-[11px] font-mono leading-none font-bold"
                  animate={{ x: [0, -1500] }}
                  transition={{
                    ease: "linear",
                    duration: 35,
                    repeat: Infinity
                  }}
                >
                  {/* Render headlines twice to support smooth continuous loop wrap */}
                  {[...tickerNews, ...tickerNews].map((text, idx) => (
                    <span key={idx} className="flex items-center gap-2 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {text}
                    </span>
                  ))}
                </motion.div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setVisible(false);
                }}
                className="p-1 px-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition text-amber-700 dark:text-amber-300 shrink-0 h-full flex items-center cursor-pointer border-l border-amber-300/50"
                title="Dismiss ticker broadcast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
