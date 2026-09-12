import { useState, useEffect, useCallback } from 'react';

/**
 * Storage key helper for per-user unread badge persistence.
 */
function getStorageKey(userId?: string): string {
  return userId ? `flick_cached_unread_${userId}` : 'flick_cached_unread_default';
}

/**
 * Synchronously retrieves cached unread count from localStorage or sessionStorage.
 * This runs before any React effects or network promises, ensuring zero-latency badge display on reload.
 */
export function getStoredUnreadCount(userId?: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const key = getStorageKey(userId);
    
    // 1. Check user-specific localStorage
    const localVal = localStorage.getItem(key);
    if (localVal !== null) {
      const parsed = parseInt(localVal, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }

    // 2. Check global badge count in localStorage
    const badgeVal = localStorage.getItem('flick_badge_count');
    if (badgeVal !== null) {
      const parsed = parseInt(badgeVal, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }

    // 3. Fallback to sessionStorage
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal !== null) {
      const parsed = parseInt(sessionVal, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch (e) {
    console.warn('[useCachedUnreadCount] Error reading stored count:', e);
  }
  return 0;
}

/**
 * Custom React hook that caches the last known unread count in localStorage and sessionStorage.
 * Guarantees that on page reload or fresh tab launch, the unread badge displays immediately
 * before the Firestore snapshot subscription has time to connect.
 *
 * @param userId - The active user's UID (optional)
 * @returns [cachedCount, updateCachedCount]
 */
export function useCachedUnreadCount(userId?: string): [number, (count: number) => void] {
  const [unreadCount, setUnreadCountState] = useState<number>(() => {
    return getStoredUnreadCount(userId);
  });

  const updateCachedCount = useCallback((count: number) => {
    const normalized = Math.max(0, count);
    setUnreadCountState(normalized);
    try {
      if (typeof window !== 'undefined') {
        const key = getStorageKey(userId);
        localStorage.setItem(key, normalized.toString());
        sessionStorage.setItem(key, normalized.toString());
        localStorage.setItem('flick_badge_count', normalized.toString());
      }
    } catch (e) {
      console.warn('[useCachedUnreadCount] Error updating storage:', e);
    }
  }, [userId]);

  // Sync state if userId changes (e.g. login / profile ready)
  useEffect(() => {
    if (!userId) return;
    const stored = getStoredUnreadCount(userId);
    setUnreadCountState(stored);
  }, [userId]);

  // Listen for storage events across other browser tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      const key = getStorageKey(userId);
      if (e.key === key || e.key === 'flick_badge_count') {
        if (e.newValue !== null) {
          const parsed = parseInt(e.newValue, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            setUnreadCountState(parsed);
          }
        }
      }
    };

    // Also listen to internal application unread count events
    const handleUnreadChanged = (e: any) => {
      if (typeof e.detail?.totalUnread === 'number') {
        updateCachedCount(e.detail.totalUnread);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('flick-unread-count-changed' as any, handleUnreadChanged);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('flick-unread-count-changed' as any, handleUnreadChanged);
    };
  }, [userId, updateCachedCount]);

  return [unreadCount, updateCachedCount];
}
