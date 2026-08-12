import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'motion/react';
import { playGlitchClickSound } from '../../lib/sounds';
import { triggerVibration } from '../../lib/haptics';
import { showBrutalistToast } from '../../lib/toast';
import {
  School,
  Search,
  Radio,
  Briefcase,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Sliders,
  User,
  PlusCircle,
  Bell
} from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: 'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace';
  setActiveTab: (tab: 'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace') => void;
  unreadE2EECount?: number;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenCreate?: () => void;
}

export default function DesktopSidebar({
  activeTab,
  setActiveTab,
  unreadE2EECount = 0,
  onOpenSearch,
  onOpenSettings,
  onOpenCreate
}: DesktopSidebarProps) {
  const { profile } = useAuth();

  // Collapsible sidebar state (persisted in localStorage)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem('flick_sidebar_expanded') !== 'false';
  });

  // Auto-compact state for tablet viewport (between 768px and 1199px)
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1200;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsCompactViewport(window.innerWidth >= 768 && window.innerWidth < 1200);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isEffectiveExpanded = sidebarExpanded && !isCompactViewport;

  const [soundMuted, setSoundMuted] = useState(() => {
    return localStorage.getItem('flick_sound_enabled') === 'false';
  });

  const handleToggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    localStorage.setItem('flick_sound_enabled', next ? 'false' : 'true');
    if (!next) {
      playGlitchClickSound();
    }
    triggerVibration('light');
    showBrutalistToast('SPECTRUM LOG', next ? 'AUDIO TRANSMISSION MUTED' : 'AUDIO TRANSMISSION ONLINE', 'info');
  };

  const handleQuickTacticalDownload = () => {
    playGlitchClickSound();
    triggerVibration('heavy');
    showBrutalistToast('DIAGNOSTICS', 'DIAGNOSTICS DUMP COMPLETE: 0x7FFF PACKETS STABLE', 'success');
  };

  return (
    <aside className={`hidden md:flex flex-col justify-between shrink-0 h-full z-40 select-none border-r border-[var(--neon-green-border)]/30 bg-[#0a0a0c] py-5 transition-all duration-300 ease-in-out relative ${
      isEffectiveExpanded ? 'w-64 px-4' : 'w-20 px-2'
    }`}>
      {/* Toggle Collapse Button on right margin */}
      <button
        onClick={() => {
          playGlitchClickSound();
          triggerVibration('light');
          const next = !sidebarExpanded;
          setSidebarExpanded(next);
          localStorage.setItem('flick_sidebar_expanded', String(next));
        }}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] flex items-center justify-center text-zinc-400 hover:text-[var(--color-text)] hover:border-[var(--neon-green)] hover:scale-110 hover:shadow-[0_0_10px_rgba(0,255,102,0.3)] transition-all duration-200 cursor-pointer shadow-md z-[60]"
        title={isEffectiveExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${isEffectiveExpanded ? 'rotate-180 text-red-500' : 'text-[var(--neon-green)]'}`} />
      </button>

      {/* TOP BLOCK: LOGO & PROFILE CAPSULE */}
      <div className="w-full space-y-4">
        {/* Cyber Logo Capsule */}
        <div className={`flex items-center gap-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--neon-green-border)] p-2 shadow-sm hover:border-[var(--neon-green)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)] transition-all duration-300 ${
          isEffectiveExpanded ? 'px-3 py-2.5' : 'justify-center'
        }`}>
          <div className="w-9 h-9 border border-[var(--neon-green)] flex items-center justify-center font-serif text-sm font-black bg-[var(--color-surface)] text-[var(--neon-green)] shadow-[1px_1px_0px_var(--neon-green)] rounded-full animate-pulse shrink-0">
            F
          </div>
          {isEffectiveExpanded && (
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono font-black text-[var(--color-text)] block tracking-widest leading-none uppercase">FLICK SOCIAL</span>
              <span className="text-[6.5px] font-mono text-zinc-500 uppercase tracking-widest block mt-0.5">E2EE NETWORK</span>
            </div>
          )}
        </div>

        {/* User Profile Card Capsule */}
        <button
          onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('profile'); }}
          className={`w-full bg-[var(--color-surface)]/90 border transition-all duration-300 flex items-center shadow-md cursor-pointer hover:scale-[1.02] ${
            activeTab === 'profile'
              ? 'border-red-500/50 bg-[#1e1416]/40 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
              : 'border-[var(--neon-green-border)]/60 hover:border-[var(--neon-green)] hover:bg-[var(--color-background)] hover:shadow-[0_0_16px_rgba(0,255,102,0.15)]'
          } ${
            isEffectiveExpanded ? 'p-2.5 rounded-2xl gap-3' : 'py-2.5 rounded-[24px] flex-col justify-center gap-1.5'
          }`}
          title="Profile Options"
        >
          <div className="relative shrink-0">
            <img
              src={profile?.photoURL || 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120'}
              alt={profile?.displayName || 'User'}
              className={`rounded-full object-cover border ${
                activeTab === 'profile' ? 'border-red-500' : 'border-[var(--neon-green-border)]'
              } ${isEffectiveExpanded ? 'w-8 h-8' : 'w-7 h-7'}`}
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-black rounded-full animate-pulse" />
          </div>

          {isEffectiveExpanded ? (
            <div className="text-left min-w-0 flex-1">
              <h5 className="text-[10px] font-mono font-black text-[var(--color-text)] truncate uppercase leading-tight">
                {profile?.displayName || 'OPERATOR'}
              </h5>
              <span className="text-[6.5px] font-mono text-emerald-400 uppercase tracking-wider block font-bold mt-0.5">
                ONLINE // VERIFIED
              </span>
            </div>
          ) : (
            <span className="text-[6px] font-mono uppercase tracking-widest font-extrabold text-zinc-400">
              ME
            </span>
          )}
        </button>

        {/* MIDDLE BLOCK: NAVIGATION ITEMS */}
        <div className="space-y-4 pt-1">
          <div className="space-y-1">
            {isEffectiveExpanded && (
              <span className="text-[7px] text-zinc-600 font-mono font-black uppercase tracking-widest px-2 block mb-1">
                CONDUIT CORE
              </span>
            )}

            {/* Home Tab */}
            <button
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('home'); }}
              className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'home'
                  ? 'text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-bold shadow-[0_0_12px_rgba(0,255,102,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)]'
              } ${isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'}`}
              title="Home Feed"
            >
              <School className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 text-[var(--neon-green)]" />
              {isEffectiveExpanded && (
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase">HOME FEED</span>
              )}
            </button>

            {/* Search Action */}
            {onOpenSearch && (
              <button
                onClick={() => { playGlitchClickSound(); triggerVibration('light'); onOpenSearch(); }}
                className={`relative flex items-center w-full text-zinc-400 hover:text-[var(--neon-green)] hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer rounded-xl group ${
                  isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'
                }`}
                title="Search Registry"
              >
                <Search className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {isEffectiveExpanded && (
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase">SEARCH</span>
                )}
              </button>
            )}

            {/* Create Post Action */}
            {onOpenCreate && (
              <button
                onClick={() => { playGlitchClickSound(); triggerVibration('light'); onOpenCreate(); }}
                className={`relative flex items-center w-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer rounded-xl group ${
                  isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'
                }`}
                title="Create Post / Story"
              >
                <PlusCircle className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {isEffectiveExpanded && (
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase">CREATE</span>
                )}
              </button>
            )}

            {/* News / Radio Tab */}
            <button
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('news'); }}
              className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'news'
                  ? 'text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-bold shadow-[0_0_12px_rgba(0,255,102,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)]'
              } ${isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'}`}
              title="News Wire"
            >
              <Radio className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {isEffectiveExpanded && (
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase">NEWS WIRE</span>
              )}
            </button>

            {/* Messages / Chat Tab */}
            <button
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('chat'); }}
              className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'chat'
                  ? 'text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-bold shadow-[0_0_12px_rgba(0,255,102,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)]'
              } ${isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'}`}
              title="Secured Messages"
            >
              <div className="relative shrink-0">
                <MessageSquare className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                {unreadE2EECount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-mono font-black text-[6px] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-black animate-pulse">
                    {unreadE2EECount}
                  </span>
                )}
              </div>
              {isEffectiveExpanded && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase truncate">MESSAGES</span>
                  {unreadE2EECount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-600/20 text-red-400 border border-red-500/30 text-[7px] font-mono font-black rounded uppercase animate-pulse">
                      {unreadE2EECount} NEW
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Peer Matcher Tab */}
            <button
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('match'); }}
              className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'match'
                  ? 'text-pink-500 bg-pink-500/10 font-bold shadow-[0_0_12px_rgba(236,72,153,0.25)]'
                  : 'text-zinc-400 hover:text-pink-400 hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(236,72,153,0.15)]'
              } ${isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'}`}
              title="Peer Matcher"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-pink-500 transition-transform duration-200 group-hover:scale-110" />
              {isEffectiveExpanded && (
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-pink-500">PEER MATCHER</span>
              )}
            </button>

            {/* Workspace Hub Tab */}
            <button
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('workspace'); }}
              className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'workspace'
                  ? 'text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-bold shadow-[0_0_12px_rgba(0,255,102,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)]'
              } ${isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'}`}
              title="Google Workspace"
            >
              <Briefcase className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {isEffectiveExpanded && (
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase">WORKSPACE</span>
              )}
            </button>

            {/* Profile Tab */}
            <button
              onClick={() => { playGlitchClickSound(); triggerVibration('light'); setActiveTab('profile'); }}
              className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'profile'
                  ? 'text-[var(--neon-green)] bg-[var(--neon-green)]/10 font-bold shadow-[0_0_12px_rgba(0,255,102,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)]'
              } ${isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'}`}
              title="My Profile"
            >
              <User className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {isEffectiveExpanded && (
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase">PROFILE</span>
              )}
            </button>

            {/* Settings Trigger */}
            {onOpenSettings && (
              <button
                onClick={() => { playGlitchClickSound(); triggerVibration('light'); onOpenSettings(); }}
                className={`relative flex items-center w-full text-zinc-400 hover:text-[var(--neon-green)] hover:bg-[var(--color-background)]/60 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer rounded-xl group ${
                  isEffectiveExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center h-10 w-10 mx-auto'
                }`}
                title="Settings & Preferences"
              >
                <Sliders className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {isEffectiveExpanded && (
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase">SETTINGS</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM UTILITY BLOCK */}
      <div className="w-full space-y-3 pt-3 border-t border-[var(--neon-green-border)]/20">
        <div className={`bg-[var(--color-surface)]/90 border border-[var(--neon-green-border)] rounded-2xl p-1.5 flex shadow-inner relative hover:border-[var(--neon-green)] hover:shadow-[0_0_12px_rgba(0,255,102,0.12)] transition-all duration-200 ${
          isEffectiveExpanded ? 'flex-row items-center justify-between px-3 py-1.5' : 'flex-col items-center gap-2'
        }`}>
          {isEffectiveExpanded && (
            <span className="text-[8px] text-zinc-500 font-mono font-black uppercase">AUDIO TUNNEL</span>
          )}

          <div
            onClick={handleToggleSound}
            className="w-10 h-5 bg-[var(--color-background)] rounded-full p-0.5 border border-[var(--neon-green-border)] cursor-pointer relative transition-colors duration-200 select-none hover:scale-105"
            title="Toggle Audio Feedback"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all duration-200 flex items-center justify-center text-[5px] font-black ${
                soundMuted
                  ? 'left-0.5 bg-zinc-800 text-zinc-500'
                  : 'left-5 bg-red-600 text-white shadow-[0_0_8px_#ef4444]'
              }`}
            >
              {soundMuted ? 'OFF' : 'ON'}
            </div>
          </div>
        </div>

        <button
          onClick={handleQuickTacticalDownload}
          className={`w-full bg-gradient-to-b from-red-600 to-rose-750 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(225,29,72,0.35)] hover:shadow-[0_6px_18px_rgba(225,29,72,0.55)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-red-500/20 ${
            isEffectiveExpanded ? 'px-3 py-2 rounded-xl gap-2 text-[9px] font-mono font-bold uppercase tracking-wider' : 'h-9 w-9 rounded-full'
          }`}
          title="Run System Diagnostics"
        >
          <ChevronRight className="w-3.5 h-3.5 text-white shrink-0 transform rotate-90" />
          {isEffectiveExpanded && <span>SYSTEM DUMP</span>}
        </button>
      </div>
    </aside>
  );
}

