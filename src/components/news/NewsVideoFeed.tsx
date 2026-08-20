import React, { useState } from 'react';
import { Play, MessageSquare, Share2, Bookmark, BookmarkCheck, ExternalLink, Volume2, VolumeX, CheckCircle2 } from 'lucide-react';
import { NewsArticle } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound, playLikeSound } from '../../lib/sounds';

interface NewsVideoFeedProps {
  articles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  onOpenDiscussion: (article: NewsArticle) => void;
  savedIds: Set<string>;
  onToggleSave: (articleId: string, e: React.MouseEvent) => void;
  onShare: (article: NewsArticle, e: React.MouseEvent) => void;
}

export const NewsVideoFeed: React.FC<NewsVideoFeedProps> = ({
  articles,
  onSelectArticle,
  onOpenDiscussion,
  savedIds,
  onToggleSave,
  onShare
}) => {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const videoArticles = articles.filter(a => a.isVideo || a.videoUrl || a.category === 'video');
  const displayArticles = videoArticles.length > 0 ? videoArticles : articles;

  return (
    <div className="w-full space-y-4 font-mono select-none">
      <div className="p-3 bg-zinc-950 border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
            FLICK VIDEO DISPATCH · VERIFIED BROADCASTS
          </h2>
        </div>
        <span className="text-[10px] text-zinc-500">{displayArticles.length} Video Reports</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayArticles.map((art) => {
          const isSaved = savedIds.has(art.id);
          const isPlaying = activeVideoId === art.id;

          return (
            <div
              key={art.id}
              className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between"
            >
              {/* Media Container */}
              <div className="relative w-full aspect-video bg-black overflow-hidden group">
                {isPlaying && art.videoUrl ? (
                  <video
                    src={art.videoUrl}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    <img
                      src={newsService.getHighResImageUrl(art.imageUrl, art.category)}
                      alt={art.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div 
                      onClick={() => {
                        playGlitchClickSound();
                        if (art.videoUrl) {
                          setActiveVideoId(art.id);
                        } else {
                          onSelectArticle(art);
                        }
                      }}
                      className="absolute inset-0 bg-black/40 hover:bg-black/20 transition flex items-center justify-center cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-[var(--neon-green)] text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.6)] group-hover:scale-110 transition">
                        <Play className="w-5 h-5 fill-black ml-0.5" />
                      </div>
                    </div>
                  </>
                )}

                {art.duration && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/90 text-[10px] text-white border border-zinc-700">
                    {art.duration}
                  </div>
                )}
              </div>

              {/* Text Info */}
              <div className="p-3">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-300">{art.sourceName}</span>
                    {art.verified && <CheckCircle2 className="w-3 h-3 text-[var(--neon-green)] fill-black" />}
                  </div>
                  <span>{art.category}</span>
                </div>

                <h3
                  onClick={() => onSelectArticle(art)}
                  className="text-xs sm:text-sm font-bold text-zinc-100 hover:text-[var(--neon-green)] line-clamp-2 cursor-pointer leading-snug mb-2"
                >
                  {art.title}
                </h3>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-xs">
                  <button
                    onClick={() => onOpenDiscussion(art)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-[var(--neon-green)] cursor-pointer text-[11px]"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discuss ({art.commentCount})</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => onShare(art, e)}
                      className="p-1 text-zinc-400 hover:text-white"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => onToggleSave(art.id, e)}
                      className="p-1 text-zinc-400 hover:text-white"
                    >
                      {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
