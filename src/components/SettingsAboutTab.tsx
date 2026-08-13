import React from 'react';
import { Info, ShieldCheck, Wifi, Cpu, FileText } from 'lucide-react';

export function SettingsAboutTab() {
  return (
    <div className="space-y-6 text-[var(--color-text)] font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--neon-green)]/30 pb-3">
        <Info className="w-5 h-5 text-[var(--neon-green)]" />
        <h3 className="text-sm font-bold uppercase tracking-wider">ABOUT FLICK COMMUNICATIONS</h3>
      </div>

      {/* Hero Badge */}
      <div className="p-4 border border-[var(--neon-green)] bg-[var(--neon-green)]/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-base font-black text-[var(--neon-green)] uppercase tracking-wider">FLICK ENGINE</span>
          <span className="bg-[var(--neon-green)] text-black text-[9px] font-black px-2 py-0.5 uppercase">
            v3.2.0-STABLE
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Focused high-speed social communication application with zero-trust encryption, offline local sync, and real-time mesh connectivity.
        </p>
      </div>

      {/* Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)]">
          <p className="text-zinc-500 text-[10px] uppercase font-bold">CRYPTO PROTOCOL</p>
          <p className="font-bold text-[var(--neon-green)] mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--neon-green)]" />
            E2EE Session Cipher
          </p>
        </div>

        <div className="p-3 border border-zinc-800 bg-[var(--color-background)]">
          <p className="text-zinc-500 text-[10px] uppercase font-bold">NETWORK ARCHITECTURE</p>
          <p className="font-bold text-[var(--neon-green)] mt-1 flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-[var(--neon-green)]" />
            Hybrid Cloud + LAN Server
          </p>
        </div>

        <div className="p-3 border border-zinc-800 bg-[var(--color-background)]">
          <p className="text-zinc-500 text-[10px] uppercase font-bold">RUNTIME PIPELINE</p>
          <p className="font-bold text-zinc-300 mt-1 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-zinc-400" />
            React 18 + Vite + Electron
          </p>
        </div>

        <div className="p-3 border border-zinc-800 bg-[var(--color-background)]">
          <p className="text-zinc-500 text-[10px] uppercase font-bold">LICENSE</p>
          <p className="font-bold text-zinc-300 mt-1 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-zinc-400" />
            MIT Open Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
}
