import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { showPushNotification } from '../lib/pushNotifications';

export default function LiveNewsScheduler() {
  const { profile } = useAuth();

  useEffect(() => {
    let intervalId: any;
    
    const fetchAndPushNews = async () => {
      try {
        // 1. Check general user notification settings in localStorage
        const notifNewsAlerts = localStorage.getItem('flick_notif_news') !== 'false';
        if (!notifNewsAlerts) {
          console.log('[Live News Scheduler] News alerts are currently disabled in user settings.');
          return;
        }

        // 2. Load Firestore sports specific preferences if logged in
        let sportsPrefs = {
          kickoff: true,
          goals: true,
          redCards: true,
          varDecisions: false,
          halfTime: true,
          fullTime: true,
          transferNews: true
        };

        if (profile?.uid) {
          try {
            const db = getFirestore();
            const userSnap = await getDoc(doc(db, 'users', profile.uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              if (uData.sportsNotificationPrefs) {
                sportsPrefs = { ...sportsPrefs, ...uData.sportsNotificationPrefs };
              }
            }
          } catch (prefErr) {
            console.warn('[Live News Scheduler] Failed loading sports prefs from Firestore:', prefErr);
          }
        }

        // 3. Robust Fetch retry loop with exponential backoff
        let response: Response | undefined;
        let retries = 3;
        let delay = 3000; // start with 3s delay

        while (retries > 0) {
          try {
            response = await fetch('/api/sports/news');
            if (response.ok) {
              break;
            }
          } catch (e) {
            console.warn(`[Live News Scheduler] Network fetch failed, retrying... (${retries} attempts left)`);
          }
          retries--;
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff: 3s -> 6s -> 12s
          }
        }

        if (!response || !response.ok) {
          console.error('[Live News Scheduler] Could not retrieve live sports news feed after multiple attempts.');
          return;
        }

        const newsItems = await response.json();
        if (!Array.isArray(newsItems) || newsItems.length === 0) {
          return;
        }

        // 4. De-duplicate news using localStorage of seen ids
        const seenIdsString = localStorage.getItem('flick_seen_sports_news') || '[]';
        let seenIds: string[] = [];
        try {
          seenIds = JSON.parse(seenIdsString);
        } catch {
          seenIds = [];
        }

        // Filter out seen news items and match themes
        const freshItems = newsItems.filter((item) => {
          if (seenIds.includes(item.id)) return false;

          const text = (item.title + ' ' + (item.description || '')).toLowerCase();
          const isTransfer = text.includes('transfer') || text.includes('swoop') || text.includes('signing') || text.includes('sign');
          const isWorldCup = text.includes('world cup') || text.includes('fifa');
          const isFootball = text.includes('football') || text.includes('premier league') || text.includes('champions league') || text.includes('match') || text.includes('cup') || text.includes('goal');

          // Filter by transfer news preferences
          if (isTransfer && !sportsPrefs.transferNews) {
            return false;
          }

          return isTransfer || isWorldCup || isFootball;
        });

        if (freshItems.length > 0) {
          const targetNews = freshItems[0];

          // Store in seen IDs list (keep list size below 100 to avoid localStorage limits)
          seenIds.push(targetNews.id);
          if (seenIds.length > 100) {
            seenIds = seenIds.slice(seenIds.length - 100);
          }
          localStorage.setItem('flick_seen_sports_news', JSON.stringify(seenIds));

          console.log('[Live News Scheduler] Triggering new sports broadcast alert:', targetNews.title);

          // Dispatch foreground custom event for in-app banner popup
          window.dispatchEvent(
            new CustomEvent('faraflick-foreground-push', {
              detail: {
                id: targetNews.id,
                title: targetNews.title,
                body: targetNews.description || 'A new critical football news update has arrived.',
                data: {
                  type: 'news',
                  showPopup: 'true',
                  popupDuration: 5500,
                  link: targetNews.link
                }
              }
            })
          );

          // Trigger actual web push / browser native push notification
          showPushNotification(
            `⚽ FLICK SPORTS: ${targetNews.title}`,
            targetNews.description || 'A new critical football news update has arrived.'
          );
        }
      } catch (err) {
        console.error('[Live News Scheduler] Error in background news execution cycle:', err);
      }
    };

    // Execute immediately on load
    fetchAndPushNews();

    // 3 minute interval scheduler (180,000 milliseconds)
    intervalId = setInterval(fetchAndPushNews, 180000);

    return () => {
      clearInterval(intervalId);
    };
  }, [profile]);

  return null;
}
