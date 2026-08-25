import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { showPushNotification } from '../lib/pushNotifications';
import { newsService } from '../lib/newsService';
import { BadgeService } from '../lib/notificationSystem';

export default function LiveNewsScheduler() {
  const { profile } = useAuth();

  useEffect(() => {
    let intervalId: any;
    
    const fetchAndPushNews = async () => {
      try {
        const notifPrefs = newsService.getNotificationSettings();
        const seenBreaking: string[] = JSON.parse(localStorage.getItem('flick_seen_breaking_news') || '[]');

        // 1. Check Real Breaking News Wire
        if (notifPrefs.breakingNews) {
          try {
            const breaking = await newsService.getBreakingNews();
            if (breaking && breaking.length > 0) {
              const newBreaking = breaking.filter(b => !seenBreaking.includes(b.id));

              if (newBreaking.length > 0) {
                const item = newBreaking[0];
                seenBreaking.push(item.id);
                localStorage.setItem('flick_seen_breaking_news', JSON.stringify(seenBreaking.slice(-60)));

                // Trigger in-app broadcast banner
                window.dispatchEvent(
                  new CustomEvent('faraflick-foreground-push', {
                    detail: {
                      id: item.id,
                      title: `🔴 BREAKING: ${item.title}`,
                      body: item.excerpt,
                      data: {
                        type: 'news',
                        showPopup: 'true',
                        popupDuration: 7000,
                        link: item.articleUrl
                      }
                    }
                  })
                );

                // Native desktop / web push
                showPushNotification(
                  `🔴 BREAKING [${item.sourceName}]`,
                  item.title,
                  'https://api.dicebear.com/7.x/shapes/png?seed=news-break',
                  'news-alert'
                );

                // Sync badge on desktop
                const currentBadge = BadgeService.getLocalBadgeCount();
                BadgeService.updateBadgeCount(currentBadge + 1, profile?.uid);
              }
            }
          } catch (e) {
            console.warn('[LiveNewsScheduler] Breaking news check error:', e);
          }
        }

        // 2. Check Top Real Feed Updates if user enabled any category notifications
        const categoryKeys = ['technology', 'sports', 'nigeria', 'business', 'campus'] as const;
        const hasCategoryAlerts = categoryKeys.some(k => notifPrefs[k]);
        if (hasCategoryAlerts) {
          try {
            const feedRes = await newsService.getFeed({
              page: 1,
              limit: 5,
              sortBy: 'latest'
            });

            if (feedRes && feedRes.articles && feedRes.articles.length > 0) {
              const matching = feedRes.articles.filter(a => {
                if (seenBreaking.includes(a.id)) return false;
                const cat = a.category?.toLowerCase() || '';
                return (
                  (notifPrefs.technology && cat.includes('tech')) ||
                  (notifPrefs.sports && cat.includes('sport')) ||
                  (notifPrefs.nigeria && (cat.includes('nigeria') || cat.includes('local') || cat.includes('politics'))) ||
                  (notifPrefs.business && (cat.includes('biz') || cat.includes('business') || cat.includes('finance'))) ||
                  (notifPrefs.campus && cat.includes('campus'))
                );
              });

              if (matching.length > 0) {
                const item = matching[0];
                seenBreaking.push(item.id);
                localStorage.setItem('flick_seen_breaking_news', JSON.stringify(seenBreaking.slice(-60)));

                showPushNotification(
                  `📰 ${item.sourceName} • ${item.category}`,
                  item.title,
                  item.imageUrl || 'https://api.dicebear.com/7.x/shapes/png?seed=flick-news',
                  'news-category'
                );

                const currentBadge = BadgeService.getLocalBadgeCount();
                BadgeService.updateBadgeCount(currentBadge + 1, profile?.uid);
              }
            }
          } catch (e) {
            console.warn('[LiveNewsScheduler] Category news check error:', e);
          }
        }
      } catch (err) {
        console.error('[Live News Scheduler] Error in background cycle:', err);
      }
    };

    // Execute immediately on load
    fetchAndPushNews();

    // 2 minute interval (120,000ms) for timely push alerts
    intervalId = setInterval(fetchAndPushNews, 120000);

    return () => {
      clearInterval(intervalId);
    };
  }, [profile]);

  return null;
}

