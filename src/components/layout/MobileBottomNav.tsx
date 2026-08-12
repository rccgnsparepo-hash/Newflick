import React from 'react';
import { motion } from 'motion/react';
import { playGlitchClickSound } from '../../lib/sounds';
import { triggerVibration } from '../../lib/haptics';
import {
  School,
  Radio,
  MessageSquare,
  Sparkles,
  User
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace';
  setActiveTab: (tab: 'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace') => void;
  unreadE2EECount?: number;
}

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  unreadE2EECount = 0
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: School,
      color: 'text-[var(--neon-green)]'
    },
    {
      id: 'news' as const,
      label: 'Radio',
      icon: Radio,
      color: 'text-[var(--neon-green)]'
    },
    {
      id: 'chat' as const,
      label: 'Tunnels',
      icon: MessageSquare,
      color: 'text-[var(--neon-green)]',
      badge: unreadE2EECount
    },
    {
      id: 'match' as const,
      label: 'Match',
      icon: Sparkles,
      color: 'text-pink-500'
    },
    {
      id: 'profile' as const,
      label: 'Profile',
      icon: User,
      color: 'text-[var(--neon-green)]'
    }
  ];

  return (
    <nav className="hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0c]/95 backdrop-blur-lg border-t border-[var(--neon-green-border)]/40 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                playGlitchClickSound();
                triggerVibration('light');
                setActiveTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1 px-3 min-w-[56px] min-h-[44px] cursor-pointer rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-[var(--color-text)]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileActiveTabGlow"
                  className="absolute inset-0 bg-[var(--neon-green)]/15 rounded-xl border border-[var(--neon-green-border)]/50 pointer-events-none"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                />
              )}

              <div className="relative shrink-0 z-10">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 ' + tab.color : ''}`} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-600 text-white font-mono font-black text-[7px] w-4 h-4 rounded-full flex items-center justify-center border border-black animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className={`text-[9px] font-mono font-bold tracking-tight mt-0.5 z-10 uppercase ${
                isActive ? tab.color : 'text-zinc-500'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
