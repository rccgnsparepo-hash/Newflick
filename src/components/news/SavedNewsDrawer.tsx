import React, { useState } from 'react';
import { Bookmark, Clock, Trash2, ExternalLink, MessageSquare, ArrowRight } from 'lucide-react';
import { NewsArticle } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound } from '../../lib/sounds';

interface SavedNewsDrawerProps {
  savedArticles: NewsArticle[];
  viewedArticles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  onRemoveSaved: (articleId: string) => void;
  onClearHistory: () => void;
}

export const SavedNewsDrawer: React.FC<SavedNewsDrawerProps> = ({
  savedArticles,
  viewedArticles,
  onSelectArticle,
  onRemoveSaved,
  onClearHistory
}) => {
  const [subTab, setSubTab] = useState<'saved' | 'history'>('saved');

  return (
    <div className="w-full space-y-4 font-mono select-none">
      {/* Sub tabs */}
      <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playGlitchClickSound();
              setSubTab('saved');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
              subTab === 'saved'
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Bookmarks ({savedArticles.length})</span>
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              setSubTab('history');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
              subTab === 'history'
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Reading History ({viewedArticles.length})</span>
          </button>
        </div>

        {subTab === 'history' && viewedArticles.length > 0 && (
          <button
            onClick={() => {
              playGlitchClickSound();
              onClearHistory();
            }}
            className="text-[10px] text-zinc-500 hover:text-rose-400 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* List items */}
      <div className="space-y-2.5">
        {subTab === 'saved' ? (
          savedArticles.length === 0 ? (
            <div className="text-center py-16 bg-zinc-950 border border-zinc-850 text-zinc-500">
              <Bookmark className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
              <p className="text-xs font-bold">No saved articles yet.</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Tap the bookmark icon on any news card to save for later reading.
              </p>
            </div>
          ) : (
            savedArticles.map((art) => (
              <div
                key={art.id}
                onClick={() => {
                  playGlitchClickSound();
                  onSelectArticle(art);
                }}
                className="p-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                    <span className="font-bold text-zinc-300">{art.sourceName}</span>
                    <span>·</span>
                    <span className="text-[var(--neon-green)]">{art.category}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-200 group-hover:text-[var(--neon-green)] line-clamp-2 leading-snug">
                    {art.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {art.imageUrl && (
                    <img
                      src={newsService.getHighResImageUrl(art.imageUrl, art.category)}
                      alt=""
                      className="w-14 h-14 object-cover border border-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playGlitchClickSound();
                      onRemoveSaved(art.id);
                    }}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 bg-zinc-900 border border-zinc-800"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          viewedArticles.length === 0 ? (
            <div className="text-center py-16 bg-zinc-950 border border-zinc-850 text-zinc-500">
              <Clock className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
              <p className="text-xs font-bold">No reading history.</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Articles you open will be remembered here for easy retrieval.
              </p>
            </div>
          ) : (
            viewedArticles.map((art) => (
              <div
                key={art.id}
                onClick={() => {
                  playGlitchClickSound();
                  onSelectArticle(art);
                }}
                className="p-3 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                    <span className="font-bold text-zinc-300">{art.sourceName}</span>
                    <span>·</span>
                    <span>{art.category}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-300 group-hover:text-[var(--neon-green)] line-clamp-2 leading-snug">
                    {art.title}
                  </h4>
                </div>

                {art.imageUrl && (
                  <img
                    src={art.imageUrl}
                    alt=""
                    className="w-12 h-12 object-cover border border-zinc-800 shrink-0"
                  />
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
