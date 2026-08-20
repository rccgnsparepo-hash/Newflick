import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, X, Filter, Clock, Flame, MessageSquare, ArrowRight, ExternalLink } from 'lucide-react';
import { NewsArticle } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound } from '../../lib/sounds';

interface NewsSearchModalProps {
  onClose: () => void;
  onSelectArticle: (article: NewsArticle) => void;
}

const QUICK_FILTERS = [
  { label: 'All Wire', val: '' },
  { label: '🇳🇬 Nigeria', val: 'nigeria' },
  { label: 'Tech & AI', val: 'technology' },
  { label: '🎓 Campus', val: 'campus' },
  { label: 'Business & Crypto', val: 'business' },
  { label: 'Sports', val: 'sports' },
  { label: 'World', val: 'world' }
];

export const NewsSearchModal: React.FC<NewsSearchModalProps> = ({
  onClose,
  onSelectArticle
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [results, setResults] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, activeCategory, sortBy]);

  const handleSearch = async () => {
    setIsLoading(true);
    const data = await newsService.getFeed({
      search: searchTerm.trim() || undefined,
      category: activeCategory || undefined,
      sortBy,
      limit: 20
    });
    setResults(data.articles || []);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-start justify-center p-2 sm:p-4 pt-10 sm:pt-16 font-mono select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full max-w-2xl bg-zinc-950 border-2 border-zinc-800 shadow-[8px_8px_0_0_#000] flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Search Bar Input */}
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-[var(--neon-green)]" />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search verified news by keyword, publisher, or campus..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs uppercase"
          >
            ESC
          </button>
        </div>

        {/* Quick Filter Tags & Sorting */}
        <div className="p-2.5 bg-zinc-900/60 border-b border-zinc-850 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            {QUICK_FILTERS.map((qf) => (
              <button
                key={qf.label}
                onClick={() => {
                  playGlitchClickSound();
                  setActiveCategory(qf.val);
                }}
                className={`px-2 py-0.8 text-[10px] uppercase border transition ${
                  activeCategory === qf.val
                    ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-black'
                    : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {qf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-400">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-black text-zinc-200 border border-zinc-800 text-[10px] p-1 focus:outline-none"
            >
              <option value="latest">Latest</option>
              <option value="views">Most Viewed</option>
              <option value="comments">Most Discussed</option>
              <option value="shares">Most Shared</option>
            </select>
          </div>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-zinc-900">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-zinc-500">
              Querying verified news index...
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-600">
              No news articles match your search parameters.
            </div>
          ) : (
            results.map((art) => (
              <div
                key={art.id}
                onClick={() => {
                  playGlitchClickSound();
                  onSelectArticle(art);
                  onClose();
                }}
                className="py-3 px-1 hover:bg-zinc-900/60 transition cursor-pointer group flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                    <span className="font-bold text-zinc-300">{art.sourceName}</span>
                    <span>·</span>
                    <span className="text-[var(--neon-green)]">{art.category}</span>
                    <span>·</span>
                    <span>{new Date(art.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-200 group-hover:text-[var(--neon-green)] line-clamp-2 leading-snug">
                    {art.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                    {art.excerpt}
                  </p>
                </div>

                {art.imageUrl && (
                  <img
                    src={art.imageUrl}
                    alt=""
                    className="w-14 h-14 object-cover border border-zinc-800 shrink-0"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
