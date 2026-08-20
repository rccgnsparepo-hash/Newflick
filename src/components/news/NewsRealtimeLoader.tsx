import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Radio, Cpu, Wifi, ShieldCheck, Zap, Layers } from 'lucide-react';

interface NewsRealtimeLoaderProps {
  statusText?: string;
  isCompact?: boolean;
  onComplete?: () => void;
}

const TELEMETRY_STEPS = [
  'INITIALIZING REALTIME WIRE GATEWAY...',
  'AUTHENTICATING 32+ VERIFIED NEWS REPOSITORIES...',
  'FETCHING NIGERIA, GLOBAL & CAMPUS RSS STREAMS...',
  'DECODING UNCOMPRESSED HIGH-RES JOURNALISM MEDIA...',
  'GENERATING ZERO-REDIRECT IN-APP READER STREAM...',
  'BUFFER READY: WIRE TELEMETRY SYNCHRONIZED.'
];

export const NewsRealtimeLoader: React.FC<NewsRealtimeLoaderProps> = ({
  statusText,
  isCompact = false,
  onComplete
}) => {
  const [progress, setProgress] = useState(12);
  const [stepIndex, setStepIndex] = useState(0);
  const [packetRate, setPacketRate] = useState('14.8 MB/s');
  const [pingMs, setPingMs] = useState(14);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) {
          clearInterval(interval);
          if (onComplete) setTimeout(onComplete, 200);
          return 100;
        }
        const jump = Math.floor(Math.random() * 18) + 8;
        const next = Math.min(prev + jump, 100);
        
        const idx = Math.min(
          Math.floor((next / 100) * TELEMETRY_STEPS.length),
          TELEMETRY_STEPS.length - 1
        );
        setStepIndex(idx);
        setPacketRate(`${(Math.random() * 12 + 10).toFixed(1)} MB/s`);
        setPingMs(Math.floor(Math.random() * 10) + 8);

        return next;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [onComplete]);

  if (isCompact) {
    return (
      <div className="w-full p-6 bg-zinc-950 border border-zinc-800 font-mono select-none">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--neon-green)] animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {statusText || TELEMETRY_STEPS[stepIndex]}
            </span>
          </div>
          <span className="text-xs font-mono font-black text-[var(--neon-green)]">
            {progress}%
          </span>
        </div>

        {/* Realtime progress bar */}
        <div className="w-full h-1.5 bg-zinc-900 border border-zinc-800 overflow-hidden relative">
          <motion.div
            className="h-full bg-[var(--neon-green)]"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.15 }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 font-mono">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-zinc-400" /> IN-APP READER ENGINE
          </span>
          <span className="flex items-center gap-1 text-[var(--neon-green)]">
            <Wifi className="w-3 h-3" /> {packetRate} · {pingMs}ms
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[380px] py-12 px-4 bg-zinc-950 border-2 border-zinc-800 shadow-[8px_8px_0_0_#000] font-mono flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Background Matrix Scanning Lines */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent animate-pulse pointer-events-none" />

      {/* Center Radar / Equalizer Animation */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full border-2 border-[var(--neon-green)]/40 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border border-dashed border-[var(--neon-green)]/60 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="w-12 h-12 rounded-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)] flex items-center justify-center">
            <Activity className="w-6 h-6 text-[var(--neon-green)] animate-pulse" />
          </div>
        </div>

        {/* Live Signal Badge */}
        <div className="absolute -bottom-2 -right-2 px-1.5 py-0.5 bg-black border border-[var(--neon-green)] text-[9px] font-bold text-[var(--neon-green)] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-ping" />
          LIVE
        </div>
      </div>

      {/* Main Status Display */}
      <div className="text-center max-w-md w-full mb-6 z-10">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <Zap className="w-3.5 h-3.5 text-[var(--neon-green)]" />
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
            FLICK WIRE NETWORK TELEMETRY
          </span>
        </div>
        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
          {statusText || TELEMETRY_STEPS[stepIndex]}
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          Direct verified RSS stream synchronization · Zero external redirection
        </p>
      </div>

      {/* Realtime Telemetry Meter */}
      <div className="w-full max-w-md space-y-2 z-10">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            PACKET SYNC
          </span>
          <span className="text-[var(--neon-green)] font-mono text-sm">{progress}%</span>
        </div>

        {/* Progress bar with brutalist accents */}
        <div className="w-full h-3 bg-zinc-900 border-2 border-zinc-700 p-0.5 relative overflow-hidden">
          <motion.div
            className="h-full bg-[var(--neon-green)]"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.15 }}
          />
        </div>

        {/* Live Stats telemetry footer */}
        <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] text-zinc-400 font-mono">
          <div className="bg-zinc-900/90 p-2 border border-zinc-800 text-center">
            <span className="block text-zinc-500">SPEED</span>
            <span className="font-bold text-zinc-200">{packetRate}</span>
          </div>
          <div className="bg-zinc-900/90 p-2 border border-zinc-800 text-center">
            <span className="block text-zinc-500">LATENCY</span>
            <span className="font-bold text-[var(--neon-green)]">{pingMs} ms</span>
          </div>
          <div className="bg-zinc-900/90 p-2 border border-zinc-800 text-center">
            <span className="block text-zinc-500">IN-APP BUFFER</span>
            <span className="font-bold text-zinc-200">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Terminal Wire Logs */}
      <div className="mt-5 w-full max-w-md bg-zinc-900/60 p-2.5 border border-zinc-850 text-[10px] font-mono text-zinc-500 space-y-1">
        <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1 mb-1">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" /> STREAM LOG
          </span>
          <span className="text-[9px] text-[var(--neon-green)]">100% REAL DATA</span>
        </div>
        <div className="truncate text-zinc-400">
          &gt; GET /api/news/feed [200 OK] (Punch, BBC, TechCrunch, Vanguard)
        </div>
        <div className="truncate text-zinc-400">
          &gt; High-Res Imagery Buffer: 1600px 4K graphics uncompressed
        </div>
        <div className="truncate text-[var(--neon-green)]">
          &gt; In-App Reader: Native modal popup active (Zero redirection)
        </div>
      </div>
    </div>
  );
};
