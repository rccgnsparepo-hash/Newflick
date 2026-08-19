import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../lib/navigationService';
import { playGlitchClickSound } from '../../lib/sounds';
import { triggerVibration } from '../../lib/haptics';
import { showBrutalistToast } from '../../lib/toast';
import {
  Home as HomeIcon,
  MessageSquare,
  Newspaper,
  User,
  Search,
  Sliders,
  ChevronRight,
  Volume2,
  VolumeX,
  PlusCircle,
  Phone
} from 'lucide-react';

interface UnifiedNavigationProps {
  unreadE2EECount?: number;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenCreate?: () => void;
  onOpenCallHistory?: () => void;
}

export function UnifiedNavigation({
  unreadE2EECount = 0,
  onOpenSearch,
  onOpenSettings,
  onOpenCreate,
  onOpenCallHistory
}: UnifiedNavigationProps) {
  const { profile } = useAuth();
  const { activeTab, setActiveTab, setIsSettingsOpen, isChatScreenOpen } = useNavigation();

  // Collapsible desktop sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem('flick_sidebar_expanded') !== 'false';
  });

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
    showBrutalistToast('SPECTRUM LOG', next ? 'AUDIO MUTED' : 'AUDIO ONLINE', 'info');
  };

  const navItems = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: HomeIcon,
      color: 'text-[var(--neon-green)]'
    },
    {
      id: 'chat' as const,
      label: 'Chats',
      icon: MessageSquare,
      color: 'text-[var(--neon-green)]',
      badge: unreadE2EECount
    },
    {
      id: 'news' as const,
      label: 'Flick News',
      icon: Newspaper,
      color: 'text-emerald-400'
    },
    {
      id: 'profile' as const,
      label: 'Profile',
      icon: User,
      color: 'text-[var(--neon-green)]'
    }
  ];

  return (
    <>
      {/* DESKTOP SIDEBAR RAIL (md:flex) */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 h-full z-40 select-none glass-panel border-r border-[var(--glass-border)] py-5 transition-all duration-300 ease-in-out relative ${
          sidebarExpanded ? 'w-64 px-4' : 'w-20 px-2.5'
        }`}
      >
        {/* Toggle Collapse Arrow */}
        <button
          onClick={() => {
            playGlitchClickSound();
            triggerVibration('light');
            const next = !sidebarExpanded;
            setSidebarExpanded(next);
            localStorage.setItem('flick_sidebar_expanded', String(next));
          }}
          className="absolute -right-3 top-7 w-6 h-6 rounded-full glass-panel border border-[var(--glass-border)] flex items-center justify-center text-zinc-400 hover:text-[var(--color-text)] hover:scale-110 transition-all duration-200 cursor-pointer shadow-lg z-[60]"
          title={sidebarExpanded ? 'Collapse Navigation' : 'Expand Navigation'}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-300 ${
              sidebarExpanded ? 'rotate-180 text-rose-400' : 'text-[var(--neon-green)]'
            }`}
          />
        </button>

        {/* TOP SECTION: BRAND LOGO */}
        <div className="w-full space-y-4">
          <div
            className={`flex items-center gap-3 glass-panel p-2.5 transition-all duration-300 ${
              sidebarExpanded ? 'px-3.5 py-3' : 'justify-center'
            }`}
          >
            <div className="w-10 h-10 border border-[var(--neon-green)] flex items-center justify-center font-shamgod text-xl font-bold bg-[var(--neon-green)]/15 text-[var(--neon-green)] rounded-xl shadow-[0_0_12px_rgba(0,255,102,0.2)] shrink-0">
              F
            </div>
            {sidebarExpanded && (
              <div className="min-w-0 flex-1">
                <span className="text-sm font-shamgod tracking-wider text-[var(--color-text)] block leading-none">
                  FLICK SOCIAL
                </span>
                <span className="text-[9px] font-mono text-emerald-400/80 uppercase tracking-widest block mt-0.5">
                  ENCRYPTED MESH
                </span>
              </div>
            )}
          </div>

          {/* QUICK SEARCH BUTTON */}
          <button
            onClick={() => {
              playGlitchClickSound();
              if (onOpenSearch) onOpenSearch();
              else window.dispatchEvent(new CustomEvent('faraflick-trigger-search'));
            }}
            className={`w-full flex items-center gap-3 p-2.5 glass-panel text-zinc-400 hover:text-white hover:border-[var(--neon-green)]/40 transition-all cursor-pointer ${
              sidebarExpanded ? 'px-3.5' : 'justify-center'
            }`}
          >
            <Search className="w-4 h-4 text-[var(--neon-green)] shrink-0" />
            {sidebarExpanded && <span className="text-xs font-mono uppercase">Quick Search</span>}
          </button>

          {/* NAVIGATION LINKS */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    playGlitchClickSound();
                    triggerVibration('light');
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/40 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                  } ${sidebarExpanded ? '' : 'justify-center px-0'}`}
                >
                  <div className="relative shrink-0">
                    <Icon className={`w-5 h-5 ${isActive ? item.color : 'text-zinc-400'}`} />
                    {!!item.badge && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-red-600 text-white font-mono text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {sidebarExpanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}

            {/* Calls / Call History Trigger */}
            <button
              onClick={() => {
                playGlitchClickSound();
                triggerVibration('light');
                if (onOpenCallHistory) onOpenCallHistory();
                else window.dispatchEvent(new CustomEvent('faraflick-open-call-history'));
              }}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all cursor-pointer text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 ${
                sidebarExpanded ? '' : 'justify-center px-0'
              }`}
              title="Call History & Logs"
            >
              <Phone className="w-5 h-5 shrink-0 text-emerald-400" />
              {sidebarExpanded && <span className="truncate">Call Logs</span>}
            </button>
          </nav>
        </div>

        {/* BOTTOM SECTION: USER & SYSTEM ACTIONS */}
        <div className="w-full space-y-2 border-t border-[var(--glass-border)] pt-4">
          <div
            onClick={() => {
              playGlitchClickSound();
              triggerVibration('light');
              setActiveTab('profile');
            }}
            className={`flex items-center gap-3 glass-panel p-2 hover:border-[var(--neon-green)]/40 transition-all cursor-pointer ${
              sidebarExpanded ? 'px-3 py-2' : 'justify-center'
            }`}
            title="View Profile"
          >
            <div className="relative shrink-0">
              <img
                src={profile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-[var(--neon-green)]/50"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--neon-green)] border border-black" />
            </div>

            {sidebarExpanded && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-bold text-zinc-100 truncate">
                  {profile?.displayName || 'User'}
                </p>
                <p className="text-[10px] font-mono text-zinc-500 truncate">
                  @{profile?.username || 'handle'}
                </p>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1.5 ${sidebarExpanded ? '' : 'flex-col'}`}>
            <button
              onClick={() => {
                playGlitchClickSound();
                if (onOpenSettings) onOpenSettings();
                else setIsSettingsOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 p-2 glass-panel text-zinc-400 hover:text-[var(--neon-green)] transition-all cursor-pointer text-xs font-mono uppercase"
              title="Settings"
            >
              <Sliders className="w-4 h-4" />
              {sidebarExpanded && <span>Settings</span>}
            </button>

            <button
              onClick={handleToggleSound}
              className="p-2 glass-panel text-zinc-400 hover:text-white transition-all cursor-pointer"
              title={soundMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />}
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV BAR (< md) - Hidden when active chat conversation is open on mobile */}
      {!(activeTab === 'chat' && isChatScreenOpen) && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel rounded-t-2xl border-t border-[var(--glass-border)] px-2 py-2 md:hidden">
          <div className="flex items-center justify-around max-w-md mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    playGlitchClickSound();
                    triggerVibration('light');
                    setActiveTab(item.id);
                  }}
                  className={`relative flex flex-col items-center justify-center py-1 px-3 min-w-[56px] min-h-[44px] cursor-pointer rounded-xl transition-all duration-200 ${
                    isActive ? 'text-[var(--color-text)]' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveGlow"
                      className="absolute inset-0 bg-[var(--neon-green)]/15 rounded-xl border border-[var(--neon-green)]/40 pointer-events-none"
                      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    />
                  )}

                  <div className="relative shrink-0 z-10">
                    <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 ' + item.color : ''}`} />
                    {!!item.badge && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-red-600 text-white font-mono font-bold text-[8px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold tracking-tight mt-1 z-10 uppercase ${
                      isActive ? item.color : 'text-zinc-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
