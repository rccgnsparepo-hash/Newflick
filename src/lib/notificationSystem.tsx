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

// ==========================================
// 4. BadgeService
// ==========================================
export const BadgeService = {
  getLocalBadgeCount(): number {
    const stored = localStorage.getItem('flick_badge_count');
    return stored ? parseInt(stored, 10) : 0;
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
    }

    // Sync directly to Electron main process (Windows Taskbar overlay icon & Linux/macOS dock counters)
    try {
      if (typeof window !== 'undefined') {
        const uWin = window as any;
        const ipc = uWin?.electron?.ipcRenderer || uWin?.ipcRenderer || (uWin?.require ? uWin.require('electron')?.ipcRenderer : null);
        if (ipc?.send) {
          ipc.send('set-badge-count', normalizedCount);
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
        clearBadges
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
