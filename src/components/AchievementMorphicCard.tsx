import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, ChevronDown, Flame, Shield, Zap } from 'lucide-react';
import ThreeDCardTilt from './ThreeDCardTilt';

interface AchievementProps {
  title: string;
  category: string;
  description: string;
  level: string;
  score: number;
  maxScore: number;
  unlocked: boolean;
  accentColor: string;
  icon: 'shield' | 'flame' | 'zap' | 'award';
}

export default function AchievementMorphicCard({
  title,
  category,
  description,
  level,
  score,
  maxScore,
  unlocked,
  accentColor,
  icon
}: AchievementProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = () => {
    switch (icon) {
      case 'shield': return <Shield className="w-5 h-5" />;
      case 'flame': return <Flame className="w-5 h-5 animate-pulse" />;
      case 'zap': return <Zap className="w-5 h-5" />;
      default: return <Award className="w-5 h-5" />;
    }
  };

  const pct = Math.min(100, Math.round((score / maxScore) * 100));

  return (
    <ThreeDCardTilt maxTilt={8} scale={1.03} className="h-full">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative h-full bg-[var(--color-surface)]/90 backdrop-blur-xl border p-4.5 rounded-[28px] cursor-pointer transition-all duration-300 flex flex-col justify-between select-none ${
          unlocked 
            ? 'border-[var(--neon-green-border)]/80 hover:border-red-500/30' 
            : 'border-[var(--neon-green-border)] opacity-60'
        }`}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div 
              className="p-2.5 rounded-2xl border flex items-center justify-center shadow-lg"
              style={{ 
                color: accentColor, 
                borderColor: `${accentColor}30`,
                background: `${accentColor}08`
              }}
            >
              {getIcon()}
            </div>
            <div className="text-right">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-wider block">
                {category}
              </span>
              <span 
                className="px-1.5 py-0.5 text-[6.5px] font-mono font-black uppercase rounded"
                style={{ 
                  color: unlocked ? '#ffffff' : '#a1a1aa',
                  background: unlocked ? `${accentColor}25` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${unlocked ? `${accentColor}40` : 'rgba(255,255,255,0.1)'}`
                }}
              >
                {level}
              </span>
            </div>
          </div>

          {/* Title / Description */}
          <div className="space-y-1">
            <h5 className="text-[11.5px] font-mono font-black text-[var(--color-text)] uppercase leading-none tracking-tight flex items-center gap-1">
              {title}
            </h5>
            <p className="text-[9.5px] text-zinc-400 font-sans leading-tight">
              {description}
            </p>
          </div>
        </div>

        {/* Expansion / Progress indicator */}
        <div className="mt-4 space-y-2">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[7px] font-mono text-zinc-500 font-bold">
              <span>SYNC FACTOR</span>
              <span style={{ color: accentColor }}>{pct}%</span>
            </div>
            <div className="w-full bg-[var(--color-surface)]/60 h-1.5 rounded-full overflow-hidden border border-[var(--neon-green-border)]">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accentColor}, #000000)`
                }}
              />
            </div>
          </div>

          {/* Interactive Collapse details */}
          <div className="flex justify-center text-zinc-600 hover:text-zinc-400 transition pt-1 border-t border-[var(--neon-green-border)]/40">
            <ChevronDown 
              className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-red-500' : ''}`} 
            />
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="pt-2 text-[8px] font-mono text-zinc-500 leading-normal space-y-1"
              >
                <div className="flex justify-between">
                  <span>METRIC SCORE:</span>
                  <span className="text-zinc-300">{score} / {maxScore} PTS</span>
                </div>
                <div className="flex justify-between">
                  <span>SECURITY ENVELOPE:</span>
                  <span className="text-zinc-300">ECDSA-P256-SIGN</span>
                </div>
                <div className="flex justify-between">
                  <span>RELAY RELIABILITY:</span>
                  <span className="text-emerald-500 font-bold">STABLE ✓</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ThreeDCardTilt>
  );
}
