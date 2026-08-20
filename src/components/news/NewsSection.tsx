import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, AlertCircle, Sparkles, Flame, Check, Bookmark, ArrowUp, ChevronDown } from 'lucide-react';
import { NewsArticle, NewsCategoryTab } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound, playLikeSound } from '../../lib/sounds';

import { NewsHeader } from './NewsHeader';
import { BreakingNewsBanner } from './BreakingNewsBanner';
import { NewsCard } from './NewsCard';
import { TrendingSidebar } from './TrendingSidebar';
import { NigeriaNewsHub } from './NigeriaNewsHub';
import { CampusNewsHub } from './CampusNewsHub';
import { NewsDetailModal } from './NewsDetailModal';
import { NewsDiscussionModal } from './NewsDiscussionModal';
import { NewsSearchModal } from './NewsSearchModal';
import { NewsSettingsModal } from './NewsSettingsModal';
import { NewsVideoFeed } from './NewsVideoFeed';
import { SavedNewsDrawer } from './SavedNewsDrawer';
import { NewsRealtimeLoader } from './NewsRealtimeLoader';

interface NewsSectionProps {
  currentUser?: any;
  onShareToTimeline?: (article: NewsArticle, comment?: string) => void;
}

export const NewsSection: React.FC<NewsSectionProps> = ({
  currentUser,
  onShareToTimeline
}) => {
  const [activeTab, setActiveTab] = useState<NewsCategoryTab>('for-you');
  const [activeNigeriaSub, setActiveNigeriaSub] = useState('all');
  const [selectedCampus, setSelectedCampus] = useState('all');
  
  // Articles state
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [breakingNews, setBreakingNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Saved and Followed cache
  const [savedIds, setSavedIds] = useState<Set<string>>(() => newsService.getLocalSavedIds());
  const [followedSources, setFollowedSources] = useState<Set<string>>(() => newsService.getLocalFollowed());
  const [followedCampuses, setFollowedCampuses] = useState<Set<string>>(new Set(['unilag', 'oau']));
  const [viewedHistory, setViewedHistory] = useState<string[]>(() => newsService.getViewedHistory());

  // Active Modals state
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [discussionArticle, setDiscussionArticle] = useState<NewsArticle | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Load feed based on active tab and filters
  const loadFeed = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let catParam = '';
      let subParam = '';
      let campusParam = '';
      let tabParam = activeTab;

      if (activeTab === 'nigeria') {
        catParam = 'nigeria';
        if (activeNigeriaSub && activeNigeriaSub !== 'all') {
          subParam = activeNigeriaSub;
        }
      } else if (activeTab === 'campus') {
        catParam = 'campus';
        if (selectedCampus && selectedCampus !== 'all') {
          campusParam = selectedCampus;
        }
      } else if (!['for-you', 'trending', 'following', 'latest', 'saved', 'video'].includes(activeTab)) {
        catParam = activeTab;
      }

      const res = await newsService.getFeed({
        category: catParam || undefined,
        subCategory: subParam || undefined,
        campus: campusParam || undefined,
        tab: tabParam,
        page: pageNum,
        limit: 14,
        userId: currentUser?.id
      });

      if (append) {
        setArticles(prev => [...prev, ...res.articles]);
      } else {
        setArticles(res.articles);
      }
      setPage(res.page);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.warn('Error loading news feed:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, activeNigeriaSub, selectedCampus, currentUser?.id]);

  // Initial load & breaking news poll
  useEffect(() => {
    loadFeed(1);
    newsService.getBreakingNews().then(setBreakingNews);
  }, [loadFeed]);

  // Refresh trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/news/refresh', { method: 'POST' });
    } catch (err) {}
    await Promise.all([
      loadFeed(1),
      newsService.getBreakingNews().then(setBreakingNews)
    ]);
    setIsRefreshing(false);
  };

  // Toggle Save
  const handleToggleSave = async (articleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlySaved = savedIds.has(articleId);
    const updated = await newsService.toggleSave(articleId, currentUser?.id, isCurrentlySaved);
    
    setSavedIds(prev => {
      const next = new Set(prev);
      if (updated) next.add(articleId);
      else next.delete(articleId);
      return next;
    });
  };

  // React to article
  const handleReact = async (articleId: string, reactionType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await newsService.reactToArticle(articleId, reactionType, currentUser?.id);
    if (res.success && res.article) {
      setArticles(prev => prev.map(a => a.id === articleId ? res.article! : a));
    }
  };

  // Toggle follow source
  const handleToggleFollow = async (sourceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isNowFollowing = await newsService.toggleFollow(sourceId, currentUser?.id);
    setFollowedSources(prev => {
      const next = new Set(prev);
      if (isNowFollowing) next.add(sourceId.toLowerCase());
      else next.delete(sourceId.toLowerCase());
      return next;
    });
  };

  // Toggle follow campus
  const handleToggleFollowCampus = (campusId: string) => {
    setFollowedCampuses(prev => {
      const next = new Set(prev);
      if (next.has(campusId)) next.delete(campusId);
      else next.add(campusId);
      return next;
    });
    newsService.toggleFollow(`campus-${campusId}`, currentUser?.id);
  };

  // Share article
  const handleShare = (article: NewsArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playGlitchClickSound();
    newsService.recordShare(article.id);

    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt,
        url: article.articleUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(article.articleUrl);
      alert('Article link copied to clipboard!');
    }
  };

  // Select article for detail view
  const handleSelectArticle = (article: NewsArticle) => {
    playGlitchClickSound();
    setSelectedArticle(article);
    setViewedHistory(newsService.getViewedHistory());
  };

  // Filter saved articles
  const savedArticlesList = articles.filter(a => savedIds.has(a.id));
  const viewedArticlesList = articles.filter(a => viewedHistory.includes(a.id));

  // Compute trending and most discussed deterministically
  const trendingArticles = [...articles].sort((a, b) => (b.viewCount + b.shareCount * 2) - (a.viewCount + a.shareCount * 2));
  const mostDiscussedArticles = [...articles].sort((a, b) => b.commentCount - a.commentCount);

  // Hero Lead Article calculation
  const heroArticle = articles.length > 0 && activeTab !== 'saved' && activeTab !== 'video' ? articles[0] : null;
  const feedArticles = heroArticle ? articles.slice(1) : articles;

  return (
    <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col font-mono select-none pb-20">
      {/* Sticky Header with Real Category Navigation */}
      <NewsHeader
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setPage(1);
        }}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        savedCount={savedIds.size}
      />

      {/* Main Content Body */}
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-3 flex-1">
        {/* Real Live Breaking News Ticker */}
        <BreakingNewsBanner
          breakingArticles={breakingNews}
          onSelectArticle={handleSelectArticle}
        />

        {/* Dedicated 🇳🇬 Nigeria Hub Filter Bar when on Nigeria or For You */}
        {activeTab === 'nigeria' && (
          <NigeriaNewsHub
            activeSubCategory={activeNigeriaSub}
            onSelectSubCategory={(sub) => {
              setActiveNigeriaSub(sub);
              setPage(1);
            }}
          />
        )}

        {/* Dedicated 🎓 Campus Dispatch Hub when on Campus or For You */}
        {activeTab === 'campus' && (
          <CampusNewsHub
            selectedCampus={selectedCampus}
            onSelectCampus={(camp) => {
              setSelectedCampus(camp);
              setPage(1);
            }}
            followedCampuses={followedCampuses}
            onToggleFollowCampus={handleToggleFollowCampus}
          />
        )}

        {/* 3-Column Responsive Layout: Editorial Feed + Desktop Trending/Discussion Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Feed Column (8 cols on desktop) */}
          <div className="lg:col-span-8 min-w-0">
            {isLoading ? (
              <div className="py-4">
                <NewsRealtimeLoader statusText="SYNCHRONIZING VERIFIED WIRE & HIGH-RES IMAGERY..." />
              </div>
            ) : activeTab === 'saved' ? (
              <SavedNewsDrawer
                savedArticles={savedArticlesList}
                viewedArticles={viewedArticlesList}
                onSelectArticle={handleSelectArticle}
                onRemoveSaved={(id) => handleToggleSave(id, { stopPropagation: () => {} } as any)}
                onClearHistory={() => {
                  localStorage.removeItem('flick_news_viewed_history');
                  setViewedHistory([]);
                }}
              />
            ) : activeTab === 'video' ? (
              <NewsVideoFeed
                articles={articles}
                onSelectArticle={handleSelectArticle}
                onOpenDiscussion={(art) => setDiscussionArticle(art)}
                savedIds={savedIds}
                onToggleSave={handleToggleSave}
                onShare={handleShare}
              />
            ) : articles.length === 0 ? (
              <div className="text-center py-16 bg-zinc-950 border border-zinc-800">
                <AlertCircle className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <h3 className="text-sm font-bold text-zinc-300 uppercase">NO REAL-TIME STORIES FOUND</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Try switching categories or tap refresh to synchronize live RSS wires.
                </p>
                <button
                  onClick={handleManualRefresh}
                  className="mt-4 px-4 py-1.5 bg-[var(--neon-green)] text-black font-black text-xs uppercase"
                >
                  Refresh Feeds
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {/* 1. Hero Lead Article */}
                {heroArticle && (
                  <NewsCard
                    key={`hero-${heroArticle.id}`}
                    article={heroArticle}
                    layout="hero"
                    onSelect={handleSelectArticle}
                    onOpenDiscussion={(art) => setDiscussionArticle(art)}
                    onToggleSave={handleToggleSave}
                    onReact={handleReact}
                    onShare={handleShare}
                    onToggleFollowSource={handleToggleFollow}
                    isSaved={savedIds.has(heroArticle.id)}
                    isFollowingSource={followedSources.has(heroArticle.sourceId)}
                  />
                )}

                {/* 2. Standard Editorial & Compact Cards */}
                {feedArticles.map((article, idx) => {
                  // Varied editorial rhythm: standard card vs compact every 4th
                  const isCompact = idx % 4 === 3;
                  return (
                    <NewsCard
                      key={article.id}
                      article={article}
                      layout={isCompact ? 'compact' : 'standard'}
                      onSelect={handleSelectArticle}
                      onOpenDiscussion={(art) => setDiscussionArticle(art)}
                      onToggleSave={handleToggleSave}
                      onReact={handleReact}
                      onShare={handleShare}
                      onToggleFollowSource={handleToggleFollow}
                      isSaved={savedIds.has(article.id)}
                      isFollowingSource={followedSources.has(article.sourceId)}
                    />
                  );
                })}

                {/* Infinite Scroll / Load More */}
                {page < totalPages && (
                  <div className="pt-4 text-center">
                    <button
                      onClick={() => loadFeed(page + 1, true)}
                      disabled={isLoadingMore}
                      className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] border border-zinc-700 hover:border-[var(--neon-green)] text-xs font-mono font-bold uppercase transition cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingMore ? 'Synchronizing Wire...' : 'Load More News Articles ▾'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Right Column: Trending, Most Discussed & Verified Outlets (4 cols) */}
          <div className="hidden lg:block lg:col-span-4 space-y-4">
            <TrendingSidebar
              trendingArticles={trendingArticles}
              mostDiscussedArticles={mostDiscussedArticles}
              onSelectArticle={handleSelectArticle}
              onOpenDiscussion={(art) => setDiscussionArticle(art)}
              followedSources={followedSources}
              onToggleFollow={handleToggleFollow}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. News Detail Reader Modal */}
      {selectedArticle && (
        <NewsDetailModal
          article={selectedArticle}
          allArticles={articles}
          onClose={() => setSelectedArticle(null)}
          onSelectRelatedArticle={handleSelectArticle}
          relatedArticles={articles.filter(a => a.category === selectedArticle.category && a.id !== selectedArticle.id)}
          isSaved={savedIds.has(selectedArticle.id)}
          onToggleSave={handleToggleSave}
          onShare={handleShare}
          onShareToTimeline={onShareToTimeline}
          currentUser={currentUser}
          followedSources={followedSources}
          onToggleFollow={handleToggleFollow}
        />
      )}

      {/* 2. Discuss on FLICK Modal */}
      {discussionArticle && (
        <NewsDiscussionModal
          article={discussionArticle}
          onClose={() => setDiscussionArticle(null)}
          currentUser={currentUser}
          onShareToTimeline={onShareToTimeline}
        />
      )}

      {/* 3. Search & Quick Filters Modal */}
      {showSearchModal && (
        <NewsSearchModal
          onClose={() => setShowSearchModal(false)}
          onSelectArticle={handleSelectArticle}
        />
      )}

      {/* 4. News Notification Settings Modal */}
      {showSettingsModal && (
        <NewsSettingsModal
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
