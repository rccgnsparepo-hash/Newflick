import React from 'react';
import { Flame, TrendingUp, MessageSquare, Share2, Users, CheckCircle2, ChevronRight } from 'lucide-react';
import { NewsArticle } from '../../types/news';
import { playGlitchClickSound } from '../../lib/sounds';

interface TrendingSidebarProps {
  trendingArticles: NewsArticle[];
  mostDiscussedArticles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  onOpenDiscussion: (article: NewsArticle) => void;
  followedSources: Set<string>;
  onToggleFollow: (sourceId: string) => void;
}

const VERIFIED_OUTLETS = [
  { id: 'punch-ng', name: 'Punch Newspapers', category: 'Nigeria', logo: 'https://punchng.com/wp-content/uploads/2023/06/cropped-Punch-Logo-Icon-32x32.png' },
  { id: 'premium-times', name: 'Premium Times', category: 'Politics', logo: 'https://www.premiumtimesng.com/wp-content/themes/premiumtimes/assets/img/favicons/favicon-32x32.png' },
  { id: 'techcrunch', name: 'TechCrunch', category: 'Tech & Startups', logo: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png?w=32' },
  { id: 'bbc-world', name: 'BBC News', category: 'World', logo: 'https://www.bbc.co.uk/favicon.ico' },
  { id: 'theverge', name: 'The Verge', category: 'Gadgets', logo: 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7395359/ios-icon.0.png' },
  { id: 'nairametrics', name: 'Nairametrics', category: 'Finance', logo: 'https://nairametrics.com/wp-content/uploads/2021/09/cropped-favicon-32x32.png' }
];

export const TrendingSidebar: React.FC<TrendingSidebarProps> = ({
  trendingArticles,
  mostDiscussedArticles,
  onSelectArticle,
  onOpenDiscussion,
  followedSources,
  onToggleFollow
}) => {
  return (
    <div className="w-full flex flex-col gap-4 font-mono select-none">
      {/* 1. Top Trending Stories Box */}
      <div className="bg-zinc-950 border border-zinc-800 p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-[var(--neon-green)]" />
            <span>TOP TRENDING</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-bold">DETERMINISTIC RANK</span>
        </div>

        <div className="flex flex-col divide-y divide-zinc-900">
          {trendingArticles.slice(0, 5).map((article, idx) => (
            <div
              key={article.id}
              onClick={() => {
                playGlitchClickSound();
                onSelectArticle(article);
              }}
              className="py-2.5 group cursor-pointer hover:bg-zinc-900/50 transition px-1"
            >
              <div className="flex items-start gap-2.5">
                <span className={`text-base font-black shrink-0 ${idx === 0 ? 'text-[var(--neon-green)]' : idx === 1 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  0{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    <span className="font-bold text-zinc-400">{article.sourceName}</span>
                    <span>·</span>
                    <span>{article.category}</span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-[var(--neon-green)] line-clamp-2 leading-tight">
                    {article.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                    <span>{article.viewCount} views</span>
                    <span>·</span>
                    <span>{article.reactionCount} reactions</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Most Discussed Community Threads */}
      <div className="bg-zinc-950 border border-zinc-800 p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>COMMUNITY DISCUSSIONS</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-bold">ACTIVE</span>
        </div>

        <div className="flex flex-col divide-y divide-zinc-900">
          {mostDiscussedArticles.slice(0, 4).map((article) => (
            <div
              key={article.id}
              onClick={() => {
                playGlitchClickSound();
                onOpenDiscussion(article);
              }}
              className="py-2.5 group cursor-pointer hover:bg-zinc-900/50 transition px-1"
            >
              <h4 className="text-xs font-bold text-zinc-200 group-hover:text-amber-400 line-clamp-2 leading-tight mb-1">
                {article.title}
              </h4>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="text-zinc-400">{article.sourceName}</span>
                <span className="text-amber-400/90 font-bold flex items-center gap-1">
                  <MessageSquare className="w-2.5 h-2.5" />
                  {article.commentCount} discussions
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Verified Publishers (Follow Outlets) */}
      <div className="bg-zinc-950 border border-zinc-800 p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
            <Users className="w-4 h-4 text-[var(--neon-green)]" />
            <span>VERIFIED PUBLISHERS</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {VERIFIED_OUTLETS.map((outlet) => {
            const isFollowed = followedSources.has(outlet.id);
            return (
              <div
                key={outlet.id}
                className="flex items-center justify-between gap-2 p-1.5 hover:bg-zinc-900 border border-zinc-850 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img 
                    src={outlet.logo} 
                    alt={outlet.name} 
                    className="w-4 h-4 object-contain shrink-0"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1">
                      {outlet.name}
                      <CheckCircle2 className="w-3 h-3 text-[var(--neon-green)] fill-black shrink-0" />
                    </div>
                    <div className="text-[10px] text-zinc-500">{outlet.category}</div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playGlitchClickSound();
                    onToggleFollow(outlet.id);
                  }}
                  className={`px-2 py-0.8 text-[10px] font-mono uppercase tracking-wider border transition cursor-pointer shrink-0 ${
                    isFollowed
                      ? 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      : 'bg-zinc-900 text-[var(--neon-green)] border-[var(--neon-green)]/60 hover:bg-[var(--neon-green)] hover:text-black font-bold'
                  }`}
                >
                  {isFollowed ? 'Following' : '+ Follow'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
