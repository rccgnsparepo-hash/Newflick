import React from 'react';
import { NewsArticle } from '../../types/news';
import { InAppArticleReader } from './InAppArticleReader';

interface NewsDetailModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  onSelectRelatedArticle?: (article: NewsArticle) => void;
  relatedArticles?: NewsArticle[];
  allArticles?: NewsArticle[];
  isSaved: boolean;
  onToggleSave: (articleId: string, e: React.MouseEvent) => void;
  onShare: (article: NewsArticle) => void;
  onShareToTimeline?: (article: NewsArticle, comment?: string) => void;
  currentUser?: any;
  followedSources: Set<string>;
  onToggleFollow: (sourceId: string) => void;
  showToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({
  article,
  onClose,
  onSelectRelatedArticle,
  relatedArticles = [],
  allArticles = [],
  isSaved,
  onToggleSave,
  onShare,
  onShareToTimeline,
  currentUser,
  followedSources,
  onToggleFollow,
  showToast
}) => {
  if (!article) return null;

  // Pass either allArticles or relatedArticles so user can read news in one go
  const storyList = allArticles.length > 0 ? allArticles : (relatedArticles.length > 0 ? [article, ...relatedArticles] : [article]);

  return (
    <InAppArticleReader
      article={article}
      allArticles={storyList}
      onNavigateArticle={(nextArticle) => {
        if (onSelectRelatedArticle) {
          onSelectRelatedArticle(nextArticle);
        }
      }}
      onClose={onClose}
      isSaved={isSaved}
      onToggleSave={onToggleSave}
      onShare={onShare}
      onShareToTimeline={onShareToTimeline}
      currentUser={currentUser}
      followedSources={followedSources}
      onToggleFollow={onToggleFollow}
      showToast={showToast}
    />
  );
};
