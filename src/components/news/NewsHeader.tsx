import React from 'react';
import { motion } from 'motion/react';
import { 
  Flame, 
  Clock, 
  Globe, 
  Cpu, 
  Briefcase, 
  Trophy, 
  Film, 
  Atom, 
  GraduationCap, 
  Bookmark, 
  Video, 
  Search, 
  RefreshCw, 
  SlidersHorizontal,
  Bell,
  Users
} from 'lucide-react';
import { NewsCategoryTab } from '../../types/news';
import { playGlitchClickSound } from '../../lib/sounds';

interface NewsHeaderProps {
  activeTab: NewsCategoryTab;
  onSelectTab: (tab: NewsCategoryTab) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  savedCount: number;
}

const CATEGORY_TABS: { id: NewsCategoryTab; label: string; icon: React.ReactNode; isBadge?: string }[] = [
  { id: 'for-you', label: 'For You', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'trending', label: 'Trending', icon: <Flame className="w-3.5 h-3.5 text-amber-400" /> },
  { id: 'following', label: 'Following', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'latest', label: 'Latest', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'nigeria', label: 'Nigeria', icon: <span className="text-xs">🇳🇬</span>, isBadge: 'LOCAL' },
  { id: 'world', label: 'World', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'technology', label: 'Technology', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'campus', label: 'Campus', icon: <GraduationCap className="w-3.5 h-3.5" />, isBadge: 'STUDENT' },
  { id: 'business', label: 'Business', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'sports', label: 'Sports', icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: 'entertainment', label: 'Entertainment', icon: <Film className="w-3.5 h-3.5" /> },
  { id: 'science', label: 'Science', icon: <Atom className="w-3.5 h-3.5" /> },
  { id: 'video', label: 'Video', icon: <Video className="w-3.5 h-3.5" /> },
  { id: 'saved', label: 'Saved', icon: <Bookmark className="w-3.5 h-3.5" /> }
];

export const NewsHeader: React.FC<NewsHeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenSearch,
  onOpenSettings,
  onRefresh,
  isRefreshing,
  savedCount
}) => {
  return (
    <div className="w-full bg-black/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-30 select-none">
      {/* Top Title & Utility Row */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 bg-[var(--neon-green)] animate-pulse" />
          <h1 className="text-base sm:text-lg font-black tracking-wider uppercase font-mono text-zinc-100 flex items-center gap-2">
            FLICK <span className="text-[var(--neon-green)]">NEWS</span>
          </h1>
          <span className="text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase hidden sm:inline-block">
            REAL WIRE · NO AI
          </span>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              playGlitchClickSound();
              onOpenSearch();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-mono transition cursor-pointer"
            title="Search verified news"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Search</span>
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              onRefresh();
            }}
            disabled={isRefreshing}
            className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-[var(--neon-green)] border border-zinc-800 transition cursor-pointer disabled:opacity-50"
            title="Refresh news wire"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[var(--neon-green)]' : ''}`} />
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              onOpenSettings();
            }}
            className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer"
            title="News notification alerts"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Category Bar */}
      <div className="flex items-center gap-1 px-3 sm:px-4 py-1.5 overflow-x-auto no-scrollbar border-t border-zinc-900">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playGlitchClickSound();
                onSelectTab(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-[var(--neon-green)] text-black font-extrabold border-[var(--neon-green)] shadow-[0_0_10px_rgba(0,255,102,0.25)]'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'saved' && savedCount > 0 && (
                <span className={`text-[9px] px-1 py-0.2 font-bold ${isActive ? 'bg-black text-[var(--neon-green)]' : 'bg-zinc-800 text-zinc-300'}`}>
                  {savedCount}
                </span>
              )}
              {tab.isBadge && (
                <span className={`text-[7px] px-1 font-black leading-none ${isActive ? 'bg-black text-[var(--neon-green)]' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'}`}>
                  {tab.isBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
