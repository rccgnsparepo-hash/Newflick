import React, { useState, useEffect } from 'react';
import { Wifi, Server, WifiOff, RefreshCw, Settings2, CheckCircle2 } from 'lucide-react';
import { networkModeManager } from '../lib/lan/NetworkModeManager';
import { NetworkMode, ConnectionStatus } from '../lib/lan/types';

export const ConnectionStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('ONLINE');
  const [mode, setMode] = useState<NetworkMode>('AUTO');
  const [lanIp, setLanIp] = useState<string>('127.0.0.1');
  const [customIpInput, setCustomIpInput] = useState<string>('127.0.0.1');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = networkModeManager.addStatusListener((newStatus, newMode, info) => {
      setStatus(newStatus);
      setMode(newMode);
      setLanIp(info.lanIp);
      setCustomIpInput(info.lanIp);
    });
    return () => unsub();
  }, []);

  const handleModeSelect = (m: NetworkMode) => {
    networkModeManager.setMode(m);
  };

  const handleSaveLanIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (customIpInput.trim()) {
      networkModeManager.setManualLanIp(customIpInput.trim());
    }
  };

  const getBadgeConfig = () => {
    switch (status) {
      case 'ONLINE':
        return {
          label: 'ONLINE',
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
          icon: <Wifi className="w-3.5 h-3.5" />
        };
      case 'SCHOOL_LAN':
        return {
          label: 'SCHOOL LAN',
          colorClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20',
          dotClass: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
          icon: <Server className="w-3.5 h-3.5" />
        };
      case 'SYNCING':
        return {
          label: 'SYNCING',
          colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
          dotClass: 'bg-amber-400 animate-ping',
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        };
      case 'OFFLINE':
      default:
        return {
          label: 'OFFLINE',
          colorClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20',
          dotClass: 'bg-zinc-500',
          icon: <WifiOff className="w-3.5 h-3.5" />
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <div className="relative inline-block text-left z-50">
      {/* Subtle Badge Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold transition-all cursor-pointer ${badge.colorClass}`}
        title="Click to view network connection status"
      >
        <span className={`w-2 h-2 rounded-full ${badge.dotClass}`} />
        <span>{badge.label}</span>
      </button>

      {/* Connection Details Modal / Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 text-zinc-200 text-xs backdrop-blur-md">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
              <Settings2 className="w-4 h-4 text-emerald-400" />
              <span>CONNECTION MANAGER</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 font-mono text-sm"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Status overview */}
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800 space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Active Status:</span>
                <span className="font-mono font-bold text-zinc-100 flex items-center gap-1">
                  {badge.icon} {status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Target Backend:</span>
                <span className="font-mono text-cyan-400 font-medium">
                  {status === 'SCHOOL_LAN' ? `LAN Server (${lanIp}:47821)` : status === 'ONLINE' ? 'Firebase Cloud' : 'Local Offline Cache'}
                </span>
              </div>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-zinc-400 font-mono text-[11px] mb-1.5">CONNECTION MODE</label>
              <div className="grid grid-cols-4 gap-1">
                {(['AUTO', 'ONLINE', 'LAN', 'OFFLINE'] as NetworkMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeSelect(m)}
                    className={`py-1.5 px-2 rounded font-mono font-bold text-[10px] border text-center transition-all ${
                      mode === m
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-zinc-800/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual LAN Server IP Config */}
            <form onSubmit={handleSaveLanIp} className="pt-2 border-t border-zinc-800">
              <label className="block text-zinc-400 font-mono text-[11px] mb-1">LAN SERVER IP</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customIpInput}
                  onChange={(e) => setCustomIpInput(e.target.value)}
                  placeholder="e.g. 192.168.1.42"
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2.5 py-1 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 px-2.5 py-1 rounded font-mono font-bold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Set
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
