import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { showPushNotification } from '../lib/pushNotifications';
import { newsService } from '../lib/newsService';

export default function LiveNewsScheduler() {
  const { profile } = useAuth();

  useEffect(() => {
    let intervalId: any;
    
    const fetchAndPushNews = async () => {
      try {
        const notifPrefs = newsService.getNotificationSettings();

        // 1. Check Real Breaking News Wire
        if (notifPrefs.breakingNews) {
          try {
            const breaking = await newsService.getBreakingNews();
            if (breaking && breaking.length > 0) {
              const seenBreaking = JSON.parse(localStorage.getItem('flick_seen_breaking_news') || '[]');
              const newBreaking = breaking.filter(b => !seenBreaking.includes(b.id));

              if (newBreaking.length > 0) {
                const item = newBreaking[0];
                seenBreaking.push(item.id);
                localStorage.setItem('flick_seen_breaking_news', JSON.stringify(seenBreaking.slice(-50)));

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
                        popupDuration: 6000,
                        link: item.articleUrl
                      }
                    }
                  })
                );

                // Native web push
                showPushNotification(
                  `🔴 BREAKING [${item.sourceName}]`,
                  item.title
                );
              }
            }
          } catch (e) {
            console.warn('[LiveNewsScheduler] Breaking news check error:', e);
          }
        }
      } catch (err) {
        console.error('[Live News Scheduler] Error in background cycle:', err);
      }
    };

    // Execute immediately on load
    fetchAndPushNews();

    // 3 minute interval
    intervalId = setInterval(fetchAndPushNews, 180000);

    return () => {
      clearInterval(intervalId);
    };
  }, [profile]);

  return null;
}

