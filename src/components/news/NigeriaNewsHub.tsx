import React, { useState } from 'react';
import { MapPin, Filter, Globe2, Building2, Landmark, Briefcase, Cpu, GraduationCap, Trophy, Film } from 'lucide-react';
import { playGlitchClickSound } from '../../lib/sounds';

interface NigeriaNewsHubProps {
  activeSubCategory: string;
  onSelectSubCategory: (sub: string) => void;
}

const NIGERIA_SUBCATEGORIES = [
  { id: 'all', label: 'All Nigeria', icon: <Globe2 className="w-3 h-3" /> },
  { id: 'national', label: 'National', icon: <Landmark className="w-3 h-3" /> },
  { id: 'lagos', label: 'Lagos', icon: <Building2 className="w-3 h-3 text-emerald-400" /> },
  { id: 'abuja', label: 'Abuja (FCT)', icon: <Building2 className="w-3 h-3 text-amber-400" /> },
  { id: 'ogun', label: 'Ogun', icon: <MapPin className="w-3 h-3 text-blue-400" /> },
  { id: 'politics', label: 'Politics', icon: <Landmark className="w-3 h-3" /> },
  { id: 'business', label: 'Business & Economy', icon: <Briefcase className="w-3 h-3" /> },
  { id: 'technology', label: 'Tech & Fintech', icon: <Cpu className="w-3 h-3" /> },
  { id: 'education', label: 'Education & ASUU', icon: <GraduationCap className="w-3 h-3" /> },
  { id: 'sports', label: 'Sports / Super Eagles', icon: <Trophy className="w-3 h-3" /> },
  { id: 'entertainment', label: 'Nollywood & Music', icon: <Film className="w-3 h-3" /> }
];

export const NigeriaNewsHub: React.FC<NigeriaNewsHubProps> = ({
  activeSubCategory,
  onSelectSubCategory
}) => {
  return (
    <div className="w-full bg-emerald-950/30 border border-emerald-800/40 p-3 sm:p-4 mb-4 font-mono select-none">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">🇳🇬</span>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              NIGERIA-FIRST NEWS WIRE
            </h2>
            <p className="text-[10px] text-emerald-400/80">
              Verified local coverage from Punch, Vanguard, Premium Times & The Guardian
            </p>
          </div>
        </div>
      </div>

      {/* Subcategory Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
        {NIGERIA_SUBCATEGORIES.map((sub) => {
          const isActive = (activeSubCategory || 'all') === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => {
                playGlitchClickSound();
                onSelectSubCategory(sub.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono whitespace-nowrap border transition cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-emerald-500 text-black font-extrabold border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-800 hover:border-emerald-800'
              }`}
            >
              {sub.icon}
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
