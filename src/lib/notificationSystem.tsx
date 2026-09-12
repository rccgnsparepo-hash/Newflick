/**
 * Flick Premium Inbound Notification & Messaging Architecture
 * Built to match WhatsApp/Telegram quality with strict separation of concerns.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playReceiveMessageSound } from './sounds';
import { deepLinkManager, DeepLinkPayload } from './deepLinkManager';
import { doc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from '../contexts/AuthContext';
import { markAllConversationsAsRead } from './conversationService';
export { useCachedUnreadCount, getStoredUnreadCount } from './hooks/useCachedUnreadCount';

// ==========================================
// 1. Types & Interfaces
// ==========================================
export interface InboundNotification {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
  chatId: string; // Used to group notifications by conversation
  type?: 'message' | 'call' | 'announcement' | 'marketing' | 'updates';
  mediaUrl?: string;
  mediaType?: 'image' | 'voice' | 'video' | 'document' | 'gif';
  count?: number; // How many merged messages are collapsed in this conversation
  messageHistory?: string[]; // Bulleted history array for WhatsApp-style expansion
}

export interface NotificationSystemContextType {
  activeBanners: InboundNotification[];
  triggerInAppNotification: (notif: Omit<InboundNotification, 'id' | 'timestamp'>) => void;
  dismissBanner: (id: string) => void;
  currentActiveChatId: string | null;
  setCurrentActiveChatId: (chatId: string | null) => void;
  badgeCount: number;
  incrementBadge: () => void;
  clearBadges: () => void;
  markAllMessagesAsRead: () => Promise<void>;
}

// ==========================================
// 2. React Context & Context Provider
// ==========================================
const NotificationSystemContext = createContext<NotificationSystemContextType | undefined>(undefined);

export function useNotificationSystem() {
  const context = useContext(NotificationSystemContext);
  if (!context) {
    throw new Error('useNotificationSystem must be used within a NotificationProvider');
  }
  return context;
}

// ==========================================
// 3. ConversationNotificationManager
// ==========================================
class ConversationNotificationManagerImpl {
  private activeChatId: string | null = null;
  private onChatFocusChangedCallbacks = new Set<(chatId: string | null) => void>();

  public setActiveChat(chatId: string | null) {
    this.activeChatId = chatId;
    this.onChatFocusChangedCallbacks.forEach(cb => cb(chatId));
  }

  public getActiveChat(): string | null {
    return this.activeChatId;
  }

  public isViewingConversation(chatId: string): boolean {
    return this.activeChatId === chatId;
  }

  public subscribe(cb: (chatId: string | null) => void) {
    this.onChatFocusChangedCallbacks.add(cb);
    return () => {
      this.onChatFocusChangedCallbacks.delete(cb);
    };
  }
}
export const ConversationNotificationManager = new ConversationNotificationManagerImpl();

// Helper to generate a crisp 32x32 PNG data URL for Windows Taskbar overlay and dock badges
export function generateBadgeDataUrl(count: number): string | null {
  if (typeof document === 'undefined' || count <= 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 32, 32);

    // High contrast black outer border ring (visible on all light & dark taskbars)
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Vibrant neon green core (#00ff66)
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff66';
    ctx.fill();

    // High contrast bold black text
    const text = count > 99 ? '99+' : String(count);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = text.length >= 3
      ? '900 11px system-ui, -apple-system, sans-serif'
      : (text.length === 2
        ? '900 14px system-ui, -apple-system, sans-serif'
        : '900 18px system-ui, -apple-system, sans-serif');
    ctx.fillText(text, 16, 16.5);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('[BadgeService] Canvas badge generation error:', e);
    return null;
  }
}

// Helper to update dynamic favicon with unread badge counter
export function updateFaviconWithBadge(count: number): void {
  if (typeof document === 'undefined') return;
  try {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (count <= 0) {
      link.href = '/icon.png';
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.onload = () => {
      ctx.drawImage(baseImg, 0, 0, 32, 32);
      const bx = 22, by = 22, br = 9;
      ctx.beginPath();
      ctx.arc(bx, by, br + 1, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff66';
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = '900 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), bx, by + 0.5);

      link.href = canvas.toDataURL('image/png');
    };
    baseImg.onerror = () => {
      const fallbackBadge = generateBadgeDataUrl(count);
      if (fallbackBadge) link.href = fallbackBadge;
    };
    baseImg.src = '/icon.png';
  } catch (e) {
    // Ignore in restricted environments
  }
}

// ==========================================
// 4. BadgeService
// ==========================================
export const BadgeService = {
  getLocalBadgeCount(): number {
    const stored = localStorage.getItem('flick_badge_count');
    return stored ? parseInt(stored, 10) : 0;
  },

  set(count: number, userId?: string) {
    return this.updateBadgeCount(count, userId);
  },

  async updateBadgeCount(count: number, userId?: string) {
    const normalizedCount = Math.max(0, count);
    localStorage.setItem('flick_badge_count', normalizedCount.toString());

    // Dispatch global event for in-app UI reactions
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flick-badge-updated', { detail: { count: normalizedCount } }));
    }

    // Standard Chromium / PWA / Electron badge API
    try {
      if (typeof navigator !== 'undefined') {
        const nav = navigator as any;
        if (normalizedCount > 0 && typeof nav.setAppBadge === 'function') {
          nav.setAppBadge(normalizedCount).catch(() => {});
        } else if (normalizedCount === 0 && typeof nav.clearAppBadge === 'function') {
          nav.clearAppBadge().catch(() => {});
        }
      }
    } catch {}

    // Sync to Firestore for multi-device harmony
    if (userId) {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          unreadBadgeCount: normalizedCount,
          updatedAt: new Date()
        });
      } catch (err) {
        console.warn('[BadgeService] Firestore sync skipped or failed:', err);
      }
    }

    // Dynamic icon/tab title updater for desktop fallback web browsers & Electron (.exe)
    if (typeof document !== 'undefined') {
      const cleanTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = normalizedCount > 0 ? `(${normalizedCount}) ${cleanTitle}` : cleanTitle;
      updateFaviconWithBadge(normalizedCount);
    }

    // Generate crisp 32x32 raster PNG for Electron Taskbar Overlay
    const dataUrl = generateBadgeDataUrl(normalizedCount);

    // Sync directly to Electron main process (Windows Taskbar overlay icon & Linux/macOS dock counters)
    try {
      if (typeof window !== 'undefined') {
        const uWin = window as any;
        const ipc = uWin?.electron?.ipcRenderer || uWin?.ipcRenderer || (uWin?.require ? uWin.require('electron')?.ipcRenderer : null);
        if (ipc?.send) {
          ipc.send('set-badge-count', {
            count: normalizedCount,
            dataUrl: dataUrl
          });
        }
      }
    } catch (err) {
      console.warn('[BadgeService] Electron set-badge-count IPC dispatch error:', err);
    }
  }
};

// ==========================================
// 5. DeepLinkService
// ==========================================
export const DeepLinkService = {
  parsePayload(data: any): { chatId: string; peerId?: string } | null {
    if (!data) return null;
    const chatId = data.chatId || data.channelId || data.chat_id;
    if (chatId) {
      return {
        chatId,
        peerId: data.senderId || data.sender_id || data.peerId
      };
    }
    return null;
  },

  executeDeepLink(target: { chatId: string; peerId?: string }) {
    console.log('[DeepLinkService] Navigating directly to target conversation conduit:', target);
    
    // Dispatch a global native listener trigger
    const customEvent = new CustomEvent('fara-flick-deeplink', { detail: { chatId: target.chatId, peerId: target.peerId, type: 'message' } });
    window.dispatchEvent(customEvent);

    // Sync to deepLinkManager using strict DeepLinkPayload structure
    const payload: DeepLinkPayload = {
      route: 'chat',
      senderId: target.peerId || target.chatId,
      params: { chatId: target.chatId }
    };
    deepLinkManager.queueDeepLink(payload);
  }
};

// ==========================================
// 6. PushService
// ==========================================
export const PushService = {
  async register(uid: string) {},
  async logout() {}
};

// ==========================================
// 7. NotificationQueue & Provider Wrapper
// ==========================================
export const NotificationProvider: React.FC<{ children: React.ReactNode, userId?: string }> = ({ children, userId }) => {
  const authContext = useAuth();
  const resolvedUserId = userId || authContext?.profile?.uid;

  const [activeBanners, setActiveBanners] = useState<InboundNotification[]>([]);
  const [currentActiveChatId, setLocalActiveChatId] = useState<string | null>(null);
  const [badgeCount, setLocalBadgeCount] = useState<number>(BadgeService.getLocalBadgeCount());

  // Track active chat changes from manager singleton
  useEffect(() => {
    const unsub = ConversationNotificationManager.subscribe((chatId) => {
      setLocalActiveChatId(chatId);
    });
    return unsub;
  }, []);

  // Update badge count
  const incrementBadge = () => {
    const nextBadge = badgeCount + 1;
    setLocalBadgeCount(nextBadge);
    BadgeService.updateBadgeCount(nextBadge, resolvedUserId);
  };

  const clearBadges = () => {
    setLocalBadgeCount(0);
    BadgeService.updateBadgeCount(0, resolvedUserId);
  };

  /**
   * Globally marks all messages as read:
   * - Dismisses in-app banners
   * - Zeros local badge count
   * - Clears taskbar/dock/favicon badges via BadgeService
   * - Zeros out localStorage and sessionStorage cache
   * - Dispatches global unread count update events across UI components
   * - Persists conversation and notification read statuses to Firestore
   */
  const markAllMessagesAsRead = async () => {
    // 1. Clear active notification popups immediately
    setActiveBanners([]);

    // 2. Clear local provider badge state
    setLocalBadgeCount(0);

    // 3. Clear system badges (Windows taskbar, macOS dock, browser favicon, tab title)
    try {
      await BadgeService.set(0, resolvedUserId);
    } catch (e) {
      console.warn('[NotificationProvider] BadgeService.set(0) error:', e);
    }

    // 4. Update localStorage and sessionStorage caches immediately
    try {
      if (typeof window !== 'undefined') {
        const cacheKey = resolvedUserId ? `flick_cached_unread_${resolvedUserId}` : 'flick_cached_unread_default';
        localStorage.setItem(cacheKey, '0');
        sessionStorage.setItem(cacheKey, '0');
        localStorage.setItem('flick_badge_count', '0');
      }
    } catch (e) {}

    // 5. Fire global events to immediately clear all badge counts across the application
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flick-unread-count-changed', {
        detail: { totalUnread: 0, userId: resolvedUserId }
      }));
      window.dispatchEvent(new CustomEvent('flick-badge-updated', {
        detail: { count: 0 }
      }));
      window.dispatchEvent(new CustomEvent('flick-all-messages-marked-read', {
        detail: { userId: resolvedUserId }
      }));
    }

    // 6. Asynchronously update Firestore conversations and notifications in batches
    if (resolvedUserId) {
      try {
        await markAllConversationsAsRead(resolvedUserId);
      } catch (err) {
        console.warn('[NotificationProvider] Failed to mark all conversations as read in Firestore:', err);
      }
    }
  };

  // Safe dismiss banner function
  const dismissBanner = (id: string) => {
    setActiveBanners((prev) => prev.filter((item) => item.id !== id));
  };

  /**
   * INTRINSIC INTELLIGENCE: triggerInAppNotification
   * Analyzes active route focus, groups chats, and schedules premium spring banners.
   */
  const triggerInAppNotification = (notif: Omit<InboundNotification, 'id' | 'timestamp'>) => {
    const chatId = notif.chatId;

    // RULE 1: Smart Context Check
    // If the user is actively viewing this conversation, suppress the visual banner!
    if (chatId && ConversationNotificationManager.isViewingConversation(chatId)) {
      console.log(`[SmartContext] User is already focused on chat: ${chatId}. Triggering physical subtle audio and animating.`);
      try {
        playReceiveMessageSound();
      } catch (err) {
        console.warn('Subtle local chirp trigger failed:', err);
      }
      return;
    }

    // Play premium high-quality in-app notification chirp
    try {
      playReceiveMessageSound();
    } catch (err) {
      console.warn('Notification audio failure:', err);
    }

    // Increment badges elegantly
    incrementBadge();

    // RULE 2: Grouping & Replacement Logic
    setActiveBanners((prev) => {
      const existingIndex = prev.findIndex((item) => item.chatId === chatId);
      const newNotifId = `inapp-notif-${Date.now()}`;

      if (existingIndex > -1) {
        // Conversation already exists! Merge & collapse WhatsApp style
        const existing = prev[existingIndex];
        const nextCount = (existing.count || 1) + 1;
        const currentHistory = existing.messageHistory || [existing.content];
        const updatedHistory = [...currentHistory, notif.content].slice(-4); // keep last 4 bullets max

        const updatedNotif: InboundNotification = {
          ...existing,
          id: newNotifId, // Give a fresh ID to re-trigger the entering slide animation
          count: nextCount,
          content: `${nextCount} new messages`,
          messageHistory: updatedHistory,
          timestamp: Date.now()
        };

        // Place at the top of the queue
        const filtered = prev.filter((item) => item.chatId !== chatId);
        return [updatedNotif, ...filtered].slice(0, 3); // Max 3 banners visible
      } else {
        // Completely new conversation notification
        const newNotif: InboundNotification = {
          ...notif,
          id: newNotifId,
          timestamp: Date.now(),
          count: 1,
          messageHistory: [notif.content]
        };

        return [newNotif, ...prev].slice(0, 3); // Max 3 banners visible
      }
    });
  };

  return (
    <NotificationSystemContext.Provider
      value={{
        activeBanners,
        triggerInAppNotification,
        dismissBanner,
        currentActiveChatId,
        setCurrentActiveChatId: (id) => {
          setLocalActiveChatId(id);
          ConversationNotificationManager.setActiveChat(id);
        },
        badgeCount,
        incrementBadge,
        clearBadges,
        markAllMessagesAsRead
      }}
    >
      {children}
      {/* 8. NotificationRenderer */}
      <NotificationRenderer activeBanners={activeBanners} onDismiss={dismissBanner} />
    </NotificationSystemContext.Provider>
  );
};

// ==========================================
// 8. NotificationRenderer Component
// ==========================================
interface RendererProps {
  activeBanners: InboundNotification[];
  onDismiss: (id: string) => void;
}

const NotificationRenderer: React.FC<RendererProps> = ({ activeBanners, onDismiss }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-[420px] px-4 pointer-events-none flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {activeBanners.map((banner, index) => {
          // Dynamic scale & opacity based on stack order to resemble premium iOS Stack
          const scale = 1 - index * 0.04;
          const opacity = 1 - index * 0.25;
          const yOffset = index * 8;

          return (
            <motion.div
              key={banner.id}
              layout
              initial={{ opacity: 0, y: -80, scale: 0.9 }}
              animate={{
                opacity,
                scale,
                y: yOffset,
                pointerEvents: index === 0 ? 'auto' : 'none' // Only top banner is interactive
              }}
              exit={{ opacity: 0, scale: 0.85, y: -20 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
                mass: 0.8
              }}
              drag="y"
              dragConstraints={{ top: -100, bottom: 0 }}
              dragElastic={{ top: 0.3, bottom: 0 }}
              onDragEnd={(e, info) => {
                // If swiped up significantly, dismiss!
                if (info.offset.y < -30) {
                  onDismiss(banner.id);
                }
              }}
              onClick={() => {
                // Handle Tap to Open Conversation Conduit
                DeepLinkService.executeDeepLink({ chatId: banner.chatId, peerId: banner.senderId });
                onDismiss(banner.id);
              }}
              className="w-full pointer-events-auto cursor-pointer rounded-2xl backdrop-blur-xl bg-[var(--color-surface)]/85 border border-[var(--neon-green-border)]/60 shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-4 flex gap-3 select-none active:scale-98 transition-transform duration-100 group overflow-hidden"
            >
              {/* Premium iOS Gloss Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none rounded-2xl" />

              {/* Avatar Frame with Smart Presence Node */}
              <div className="relative flex-shrink-0 w-11 h-11">
                <img
                  src={banner.senderAvatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${banner.senderName}`}
                  alt={banner.senderName}
                  className="w-full h-full rounded-full object-cover border border-zinc-700/50 bg-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--neon-green)] rounded-full border-2 border-[#121214] ring-1 ring-zinc-900" />
              </div>

              {/* Banner Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--color-text)] tracking-tight truncate">
                    {banner.senderName}
                  </h4>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    Just now
                  </span>
                </div>

                {/* Main Content */}
                <p className="text-xs text-zinc-300 mt-0.5 truncate leading-relaxed">
                  {banner.content}
                </p>

                {/* Expandable History (WhatsApp style) */}
                {banner.messageHistory && banner.messageHistory.length > 1 && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-2 pt-2 border-t border-[var(--neon-green-border)]/50 flex flex-col gap-1 text-[11px] text-zinc-400 font-mono"
                  >
                    {banner.messageHistory.map((msg, i) => (
                      <div key={i} className="flex gap-1.5 items-start truncate">
                        <span className="text-[var(--neon-green)]">•</span>
                        <span className="truncate">{msg}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Swipe Drag Indicator */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-zinc-800 rounded-full opacity-60" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
