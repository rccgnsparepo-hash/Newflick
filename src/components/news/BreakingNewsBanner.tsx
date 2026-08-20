import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ChevronRight, Zap, ExternalLink } from 'lucide-react';
import { NewsArticle } from '../../types/news';
import { playGlitchClickSound } from '../../lib/sounds';

interface BreakingNewsBannerProps {
  breakingArticles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
}

export const BreakingNewsBanner: React.FC<BreakingNewsBannerProps> = ({
  breakingArticles,
  onSelectArticle
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Automatically cycle through breaking items if multiple exist
  useEffect(() => {
    if (breakingArticles.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % breakingArticles.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [breakingArticles.length]);

  // If no breaking articles exist, component disappears completely
  if (!breakingArticles || breakingArticles.length === 0) {
    return null;
  }

  const currentStory = breakingArticles[currentIndex] || breakingArticles[0];

  return (
    <div className="w-full bg-red-950/80 border-y sm:border border-red-600/70 p-2.5 sm:p-3 my-2 sm:my-3 shadow-[0_0_15px_rgba(220,38,38,0.25)] select-none">
      <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Live Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-red-400 font-mono uppercase flex items-center gap-1">
            🔴 BREAKING NEWS
          </span>
          <span className="text-[10px] font-mono text-zinc-400 border-l border-red-800/80 pl-2 hidden md:inline">
            {currentStory.sourceName}
          </span>
        </div>

        {/* Story Title with Smooth Transition */}
        <div 
          onClick={() => {
            playGlitchClickSound();
            onSelectArticle(currentStory);
          }}
          className="flex-1 min-w-0 cursor-pointer hover:underline text-zinc-100 font-mono text-xs sm:text-sm font-bold truncate flex items-center gap-1.5"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStory.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="truncate"
            >
              {currentStory.title}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* View Action */}
        <button
          onClick={() => {
            playGlitchClickSound();
            onSelectArticle(currentStory);
          }}
          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-black text-[10px] sm:text-xs font-black uppercase font-mono tracking-wider shrink-0 transition flex items-center gap-1 cursor-pointer"
        >
          <span>READ</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
