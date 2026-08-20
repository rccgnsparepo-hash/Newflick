import React from 'react';
import { Layers, ExternalLink, Globe } from 'lucide-react';
import { NewsClusterSource } from '../../types/news';
import { playGlitchClickSound } from '../../lib/sounds';

interface StoryGroupClusterProps {
  sources?: NewsClusterSource[];
}

export const StoryGroupCluster: React.FC<StoryGroupClusterProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="w-full bg-zinc-950/70 border border-zinc-800/80 p-2.5 my-2.5 font-mono select-none">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">
        <Layers className="w-3.5 h-3.5 text-[var(--neon-green)]" />
        <span>SOURCES COVERING THIS STORY ({sources.length + 1} OUTLETS)</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sources.map((src, idx) => (
          <a
            key={idx}
            href={src.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              playGlitchClickSound();
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 hover:border-zinc-500 text-[11px] transition"
            title={`View ${src.sourceName}'s coverage`}
          >
            {src.sourceLogo ? (
              <img 
                src={src.sourceLogo} 
                alt={src.sourceName} 
                className="w-3.5 h-3.5 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe className="w-3 h-3 text-zinc-500" />
            )}
            <span className="font-semibold">{src.sourceName}</span>
            <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
          </a>
        ))}
      </div>
    </div>
  );
};
