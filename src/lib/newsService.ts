import { NewsArticle, NewsComment, NewsNotificationSettings, FullArticleContent, InAppReaderPreferences } from '../types/news';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

// Local storage key constants for instant optimistic response and offline support
const SAVED_NEWS_KEY = 'flick_saved_news_ids';
const FOLLOWED_SOURCES_KEY = 'flick_followed_news_targets';
const NEWS_NOTIFS_KEY = 'flick_news_notification_prefs';
const VIEWED_HISTORY_KEY = 'flick_news_viewed_history';
const READER_PREFS_KEY = 'flick_news_reader_prefs';

export const newsService = {
  // Extract and fetch full original article content for in-app reader (no redirection)
  async getFullArticleContent(articleUrl: string, id?: string): Promise<FullArticleContent | null> {
    try {
      const url = new URL(`${getBaseUrl()}/api/news/article-content`);
      if (articleUrl) url.searchParams.set('url', articleUrl);
      if (id) url.searchParams.set('id', id);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[NewsService getFullArticleContent Error]', err);
      return null;
    }
  },

  // High-Resolution Image Helper
  getHighResImageUrl(rawUrl?: string, category = 'General'): string {
    if (!rawUrl) {
      const cat = (category || '').toLowerCase();
      if (cat.includes('tech')) return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=85';
      if (cat.includes('nigeria')) return 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1600&q=85';
      if (cat.includes('business')) return 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1600&q=85';
      if (cat.includes('sport')) return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=85';
      if (cat.includes('science')) return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=85';
      if (cat.includes('campus')) return 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=85';
      if (cat.includes('entertainment')) return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=85';
      return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1600&q=85';
    }

    let url = rawUrl.trim();
    // BBC High Res rewrite
    url = url.replace(/\/news\/\d+\/(cpsprodpb|cpsdevpb)\//i, '/news/1600/$1/');
    url = url.replace(/\/news\/world-africa-\d+-(\d+x\d+)\./i, '/news/world-africa-1600.');
    // Strip WordPress thumbnail dimensions
    url = url.replace(/-\d{2,4}x\d{2,4}(\.[a-zA-Z]{3,4})/i, '$1');

    // Upgrade downscaled query params
    if (url.includes('unsplash.com')) {
      url = url.replace(/(\?|&)w=\d+/g, '$1w=1600');
      url = url.replace(/(\?|&)q=\d+/g, '$1q=85');
      if (!url.includes('w=')) {
        url += (url.includes('?') ? '&' : '?') + 'auto=format&fit=crop&w=1600&q=85';
      }
    }

    return url;
  },

  // Reader Preferences
  getInAppReaderPreferences(): InAppReaderPreferences {
    try {
      const raw = localStorage.getItem(READER_PREFS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      fontSize: 'base',
      theme: 'pitch',
      speechRate: 1,
      viewMode: 'reader'
    };
  },

  saveInAppReaderPreferences(prefs: Partial<InAppReaderPreferences>): InAppReaderPreferences {
    try {
      const current = this.getInAppReaderPreferences();
      const next = { ...current, ...prefs };
      localStorage.setItem(READER_PREFS_KEY, JSON.stringify(next));
      return next;
    } catch {
      return {
        fontSize: 'base',
        theme: 'pitch',
        speechRate: 1,
        viewMode: 'reader'
      };
    }
  },

  // Fetch news feed with filters and pagination
  async getFeed(params: {
    category?: string;
    subCategory?: string;
    campus?: string;
    search?: string;
    tab?: string;
    sortBy?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ articles: NewsArticle[]; total: number; page: number; totalPages: number }> {
    try {
      const url = new URL(`${getBaseUrl()}/api/news`);
      if (params.category) url.searchParams.set('category', params.category);
      if (params.subCategory) url.searchParams.set('subCategory', params.subCategory);
      if (params.campus) url.searchParams.set('campus', params.campus);
      if (params.search) url.searchParams.set('search', params.search);
      if (params.tab) url.searchParams.set('tab', params.tab);
      if (params.sortBy) url.searchParams.set('sortBy', params.sortBy);
      if (params.userId) url.searchParams.set('userId', params.userId);
      if (params.page) url.searchParams.set('page', params.page.toString());
      if (params.limit) url.searchParams.set('limit', params.limit.toString());

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[NewsService Feed Fetch Error]', err);
      // Fallback empty structure
      return { articles: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  // Fetch breaking news
  async getBreakingNews(): Promise<NewsArticle[]> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/news/breaking`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[NewsService Breaking Fetch Error]', err);
      return [];
    }
  },

  // Fetch single article
  async getArticle(id: string, userId?: string): Promise<NewsArticle | null> {
    try {
      const url = new URL(`${getBaseUrl()}/api/news/story/${id}`);
      if (userId) url.searchParams.set('userId', userId);
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  },

  // Record view
  async recordView(id: string): Promise<void> {
    try {
      // Add to local viewed history
      const hist = this.getViewedHistory();
      if (!hist.includes(id)) {
        hist.unshift(id);
        localStorage.setItem(VIEWED_HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
      }
      fetch(`${getBaseUrl()}/api/news/${id}/view`, { method: 'POST' }).catch(() => {});
    } catch (err) {}
  },

  // Record share
  async recordShare(id: string): Promise<void> {
    try {
      fetch(`${getBaseUrl()}/api/news/${id}/share`, { method: 'POST' }).catch(() => {});
    } catch (err) {}
  },

  // Save / Bookmark article
  async toggleSave(id: string, userId?: string, currentSavedState = false): Promise<boolean> {
    try {
      const method = currentSavedState ? 'DELETE' : 'POST';
      const res = await fetch(`${getBaseUrl()}/api/news/${id}/save`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'local' })
      });
      const data = await res.json();
      
      // Update local storage
      const saved = this.getLocalSavedIds();
      if (data.saved) {
        saved.add(id);
      } else {
        saved.delete(id);
      }
      localStorage.setItem(SAVED_NEWS_KEY, JSON.stringify(Array.from(saved)));
      return !!data.saved;
    } catch (err) {
      // Local optimistic toggle
      const saved = this.getLocalSavedIds();
      let newState = false;
      if (saved.has(id)) {
        saved.delete(id);
        newState = false;
      } else {
        saved.add(id);
        newState = true;
      }
      localStorage.setItem(SAVED_NEWS_KEY, JSON.stringify(Array.from(saved)));
      return newState;
    }
  },

  getLocalSavedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(SAVED_NEWS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  },

  getViewedHistory(): string[] {
    try {
      const raw = localStorage.getItem(VIEWED_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // React to article
  async reactToArticle(id: string, reactionType: string, userId?: string): Promise<{ success: boolean; article?: NewsArticle }> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/news/${id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'local', reactionType })
      });
      return await res.json();
    } catch (err) {
      return { success: false };
    }
  },

  // Follow / Unfollow source, category, or campus
  async toggleFollow(targetId: string, userId?: string): Promise<boolean> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/news/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'local', targetId })
      });
      const data = await res.json();
      
      // Sync local cache
      const local = this.getLocalFollowed();
      if (data.isFollowing) local.add(targetId.toLowerCase());
      else local.delete(targetId.toLowerCase());
      localStorage.setItem(FOLLOWED_SOURCES_KEY, JSON.stringify(Array.from(local)));

      return !!data.isFollowing;
    } catch (err) {
      const local = this.getLocalFollowed();
      const clean = targetId.toLowerCase();
      let newState = false;
      if (local.has(clean)) {
        local.delete(clean);
        newState = false;
      } else {
        local.add(clean);
        newState = true;
      }
      localStorage.setItem(FOLLOWED_SOURCES_KEY, JSON.stringify(Array.from(local)));
      return newState;
    }
  },

  getLocalFollowed(): Set<string> {
    try {
      const raw = localStorage.getItem(FOLLOWED_SOURCES_KEY);
      return new Set(raw ? JSON.parse(raw) : ['punch-ng', 'techcrunch', 'bbc-world', 'nigeria', 'campus']);
    } catch {
      return new Set(['punch-ng', 'techcrunch', 'bbc-world', 'nigeria', 'campus']);
    }
  },

  // Get comments
  async getComments(articleId: string): Promise<NewsComment[]> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/news/${articleId}/comments`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  },

  // Post comment
  async postComment(articleId: string, commentData: {
    userId: string;
    userName: string;
    userUsername?: string;
    userPhoto?: string;
    userVerified?: boolean;
    content: string;
    replyToId?: string;
    replyToUserName?: string;
  }): Promise<NewsComment | null> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/news/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  },

  // Report article / comment
  async reportContent(articleId: string, reason: string, userId?: string, commentId?: string): Promise<boolean> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/news/${articleId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'local', reason, commentId })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  },

  // Notification Preferences
  getNotificationSettings(): NewsNotificationSettings {
    try {
      const raw = localStorage.getItem(NEWS_NOTIFS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      breakingNews: true,
      following: true,
      nigeria: true,
      technology: true,
      sports: false,
      campus: true,
      business: false
    };
  },

  saveNotificationSettings(settings: NewsNotificationSettings): void {
    try {
      localStorage.setItem(NEWS_NOTIFS_KEY, JSON.stringify(settings));
    } catch {}
  }
};
