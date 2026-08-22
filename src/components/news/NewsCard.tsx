import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  BookmarkCheck, 
  BookOpen, 
  CheckCircle2, 
  MoreHorizontal, 
  Eye, 
  Play, 
  Layers, 
  Clock, 
  Flag, 
  UserPlus, 
  UserCheck, 
  Repeat2,
  Copy,
  Check,
  Flame,
  Volume2
} from 'lucide-react';
import { NewsArticle } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound, playLikeSound } from '../../lib/sounds';
import { StoryGroupCluster } from './StoryGroupCluster';

interface NewsCardProps {
  article: NewsArticle;
  layout?: 'hero' | 'standard' | 'compact' | 'video';
  onSelect: (article: NewsArticle) => void;
  onOpenDiscussion: (article: NewsArticle) => void;
  onToggleSave: (articleId: string, e: React.MouseEvent) => void;
  onReact: (articleId: string, reactionType: string, e: React.MouseEvent) => void;
  onShare: (article: NewsArticle, e: React.MouseEvent) => void;
  onToggleFollowSource?: (sourceId: string, e: React.MouseEvent) => void;
  onReport?: (article: NewsArticle) => void;
  isSaved?: boolean;
  isFollowingSource?: boolean;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  layout = 'standard',
  onSelect,
  onOpenDiscussion,
  onToggleSave,
  onReact,
  onShare,
  onToggleFollowSource,
  onReport,
  isSaved = false,
  isFollowingSource = false
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  // Format relative time
  const getRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    playGlitchClickSound();
    navigator.clipboard.writeText(article.articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMoreMenu(false);
  };

  // Format number counts nicely (e.g. 1.4K)
  const formatCount = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return num.toString();
  };

  // =========================================================================
  // 1. HERO / FEATURED LAYOUT
  // =========================================================================
  if (layout === 'hero') {
    return (
      <div 
        onClick={() => onSelect(article)}
        className="w-full bg-zinc-950 border border-zinc-800 hover:border-[var(--neon-green)]/60 transition-all p-3 sm:p-4 mb-4 select-none cursor-pointer group shadow-[4px_4px_0_0_#18181b]"
      >
        {/* Source & Verified Indicator */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            {article.sourceLogo ? (
              <img 
                src={article.sourceLogo} 
                alt={article.sourceName} 
                className="w-4 h-4 object-contain rounded-none"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : null}
            <span className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1">
              {article.sourceName}
              {article.verified && <CheckCircle2 className="w-3 h-3 text-[var(--neon-green)] fill-black" />}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">· {getRelativeTime(article.publishedAt)}</span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-[var(--neon-green)] uppercase">
              {article.category}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onToggleFollowSource && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollowSource(article.sourceId, e);
                }}
                className={`text-[10px] font-mono px-2 py-0.5 border transition ${
                  isFollowingSource
                    ? 'bg-zinc-900 text-zinc-400 border-zinc-700'
                    : 'bg-zinc-900 text-[var(--neon-green)] border-[var(--neon-green)]/60 hover:bg-[var(--neon-green)] hover:text-black font-bold'
                }`}
              >
                {isFollowingSource ? 'Following' : '+ Follow'}
              </button>
            )}
          </div>
        </div>

        {/* Hero Image */}
        {article.imageUrl && (
          <div className="w-full h-48 sm:h-64 bg-zinc-900 overflow-hidden relative mb-3 border border-zinc-800">
            <img 
              src={newsService.getHighResImageUrl(article.imageUrl, article.category)} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = newsService.getHighResImageUrl('', article.category);
                if (target.src !== fallback) target.src = fallback;
              }}
            />
            {article.readTime && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-md text-[10px] font-mono text-zinc-300 border border-zinc-700 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{article.readTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Headline */}
        <h2 className="text-base sm:text-lg font-black font-mono text-white leading-snug group-hover:text-[var(--neon-green)] transition mb-2">
          {article.title}
        </h2>

        {/* Excerpt */}
        <p className="text-xs sm:text-sm text-zinc-400 font-sans line-clamp-2 leading-relaxed mb-3">
          {article.excerpt}
        </p>

        {/* Story Grouping Cluster if present */}
        {article.clusterSources && article.clusterSources.length > 0 && (
          <StoryGroupCluster sources={article.clusterSources} />
        )}

        {/* Discuss on FLICK Prominent Button */}
        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              playGlitchClickSound();
              onOpenDiscussion(article);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-[var(--neon-green)] border border-[var(--neon-green)] text-xs font-mono font-bold uppercase transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>DISCUSS ON FLICK</span>
            {article.commentCount > 0 && (
              <span className="text-[10px] bg-black px-1.5 py-0.5 text-white border border-[var(--neon-green)]/40">
                {article.commentCount}
              </span>
            )}
          </button>

          {/* Social Action Pills */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                playLikeSound();
                onReact(article.id, 'like', e);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono border transition ${
                article.userReacted
                  ? 'bg-rose-950/80 text-rose-400 border-rose-500 font-bold'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${article.userReacted ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{formatCount(article.reactionCount)}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(article, e);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white transition"
              title="Share article or repost to FLICK"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{formatCount(article.shareCount)}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playGlitchClickSound();
                onToggleSave(article.id, e);
              }}
              className={`p-1.5 border transition ${
                isSaved
                  ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
              title={isSaved ? "Saved" : "Save article"}
            >
              {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playGlitchClickSound();
                onSelect(article);
              }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] hover:text-white border border-zinc-800 hover:border-[var(--neon-green)]/60 transition cursor-pointer"
              title="Read full article in-app (No redirection)"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. VIDEO NEWS LAYOUT
  // =========================================================================
  if (layout === 'video') {
    return (
      <div 
        onClick={() => onSelect(article)}
        className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition p-3 mb-3 select-none cursor-pointer group"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-red-950 text-red-400 border border-red-800 uppercase flex items-center gap-1">
              <Play className="w-2.5 h-2.5 fill-red-400" /> NEWS VIDEO
            </span>
            <span className="text-xs font-mono font-bold text-zinc-300">{article.sourceName}</span>
            <span className="text-[10px] text-zinc-500 font-mono">· {getRelativeTime(article.publishedAt)}</span>
          </div>
          {article.duration && (
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 border border-zinc-800">
              {article.duration}
            </span>
          )}
        </div>

        {/* Video Thumbnail with Play Button */}
        <div className="w-full h-44 sm:h-52 bg-zinc-900 relative overflow-hidden mb-2.5 border border-zinc-800">
          {article.imageUrl && (
            <img 
              src={newsService.getHighResImageUrl(article.imageUrl, article.category)} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-102 transition"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = newsService.getHighResImageUrl('', article.category);
                if (target.src !== fallback) target.src = fallback;
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--neon-green)] text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.6)] group-hover:scale-110 transition">
              <Play className="w-5 h-5 fill-black ml-0.5" />
            </div>
          </div>
        </div>

        <h3 className="text-sm sm:text-base font-bold font-mono text-white leading-snug group-hover:text-[var(--neon-green)] transition mb-2">
          {article.title}
        </h3>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDiscussion(article);
            }}
            className="text-[11px] font-mono text-zinc-400 hover:text-[var(--neon-green)] flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Discuss ({article.commentCount})</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(article.id, e);
              }}
              className="p-1 text-zinc-400 hover:text-white"
            >
              {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <Bookmark className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(article, e);
              }}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(article);
              }}
              className="p-1 text-zinc-400 hover:text-[var(--neon-green)]"
              title="Read full story in-app"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. COMPACT SIDE-BY-SIDE LAYOUT
  // =========================================================================
  if (layout === 'compact') {
    return (
      <div 
        onClick={() => onSelect(article)}
        className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 transition p-2.5 mb-2 select-none cursor-pointer flex gap-3 group"
      >
        {article.imageUrl && (
          <div className="w-24 h-20 sm:w-28 sm:h-24 bg-zinc-900 shrink-0 overflow-hidden border border-zinc-800">
            <img 
              src={newsService.getHighResImageUrl(article.imageUrl, article.category)} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = newsService.getHighResImageUrl('', article.category);
                if (target.src !== fallback) target.src = fallback;
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 mb-1">
              <span className="font-bold text-zinc-300">{article.sourceName}</span>
              <span>· {getRelativeTime(article.publishedAt)}</span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold font-mono text-zinc-100 group-hover:text-[var(--neon-green)] transition line-clamp-2 leading-tight">
              {article.title}
            </h4>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
            <span className="text-[var(--neon-green)]/80">{article.category}</span>
            <div className="flex items-center gap-2">
              <span>❤️ {formatCount(article.reactionCount)}</span>
              <span>💬 {formatCount(article.commentCount)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. STANDARD EDITORIAL SOCIAL CARD (DEFAULT)
  // =========================================================================
  return (
    <div 
      onClick={() => onSelect(article)}
      className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all p-3 sm:p-4 mb-3 select-none cursor-pointer group relative"
    >
      {/* Top Header: Source, Time, Category, More Menu */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {article.sourceLogo ? (
            <img 
              src={article.sourceLogo} 
              alt={article.sourceName} 
              className="w-3.5 h-3.5 object-contain"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : null}
          <span className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-1">
            {article.sourceName}
            {article.verified && <CheckCircle2 className="w-3 h-3 text-[var(--neon-green)] fill-black" />}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">· {getRelativeTime(article.publishedAt)}</span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase">
            {article.category}
          </span>
        </div>

        {/* Quick More Actions Menu Trigger */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              playGlitchClickSound();
              setShowMoreMenu(!showMoreMenu);
            }}
            className="p-1 text-zinc-400 hover:text-white transition"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Context Dropdown Menu */}
          <AnimatePresence>
            {showMoreMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-6 w-44 bg-zinc-900 border border-zinc-700 shadow-xl z-20 py-1 font-mono text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                {onToggleFollowSource && (
                  <button
                    onClick={(e) => {
                      onToggleFollowSource(article.sourceId, e);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-2"
                  >
                    {isFollowingSource ? <UserCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{isFollowingSource ? 'Unfollow' : 'Follow'} {article.sourceName}</span>
                  </button>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-2"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
                {onReport && (
                  <button
                    onClick={() => {
                      onReport(article);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-rose-400 flex items-center gap-2 border-t border-zinc-800 mt-1"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report Article</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area: Title + Excerpt + Right Thumbnail */}
      <div className="flex gap-3 items-start mb-2.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold font-mono text-white leading-snug group-hover:text-[var(--neon-green)] transition mb-1.5">
            {article.title}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 font-sans line-clamp-2 leading-relaxed">
            {article.excerpt}
          </p>
        </div>

        {article.imageUrl && (
          <div className="w-20 h-20 sm:w-28 sm:h-24 bg-zinc-900 shrink-0 overflow-hidden border border-zinc-800 relative">
            <img 
              src={newsService.getHighResImageUrl(article.imageUrl, article.category)} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = newsService.getHighResImageUrl('', article.category);
                if (target.src !== fallback) target.src = fallback;
              }}
            />
          </div>
        )}
      </div>

      {/* Story Grouping Cluster if available */}
      {article.clusterSources && article.clusterSources.length > 0 && (
        <StoryGroupCluster sources={article.clusterSources} />
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-900 gap-2 flex-wrap">
        {/* Discuss on FLICK CTA */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            playGlitchClickSound();
            onOpenDiscussion(article);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] border border-zinc-800 hover:border-[var(--neon-green)]/60 text-[11px] font-mono font-bold transition cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Discuss on FLICK</span>
          {article.commentCount > 0 && (
            <span className="text-[10px] text-zinc-400">({article.commentCount})</span>
          )}
        </button>

        {/* Engagement Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              playLikeSound();
              onReact(article.id, 'like', e);
            }}
            className={`flex items-center gap-1 px-2 py-0.8 text-[11px] font-mono border transition ${
              article.userReacted
                ? 'bg-rose-950/80 text-rose-400 border-rose-500 font-bold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <Heart className={`w-3 h-3 ${article.userReacted ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{formatCount(article.reactionCount)}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(article, e);
            }}
            className="flex items-center gap-1 px-2 py-0.8 text-[11px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white transition"
            title="Share article"
          >
            <Share2 className="w-3 h-3" />
            <span>{formatCount(article.shareCount)}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              playGlitchClickSound();
              onToggleSave(article.id, e);
            }}
            className={`p-1.5 border transition ${
              isSaved
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
            title={isSaved ? "Saved" : "Save article"}
          >
            {isSaved ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              playGlitchClickSound();
              onSelect(article);
            }}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] hover:text-white border border-zinc-800 hover:border-[var(--neon-green)]/60 transition cursor-pointer"
            title="Read full article in-app (No redirection)"
          >
            <BookOpen className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
