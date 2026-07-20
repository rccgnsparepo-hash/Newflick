import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConnectivityProvider, useConnectivity } from './contexts/ConnectivityContext';
import { OperationProvider } from './contexts/OperationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useScrollLock } from './hooks/useScrollLock';
import AuthScreen from './components/AuthScreen';
import ChatSection from './components/ChatSection';
import FeedSection from './components/FeedSection';
import SecureNewsFlow from './components/SecureNewsFlow';
import FeedbackModal from './components/FeedbackModal';
import OnboardingIntro from './components/OnboardingIntro';
import AppTour from './components/AppTour';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import HorizontalTicker from './components/HorizontalTicker';
import UserProfileModal from './components/UserProfileModal';
import LiveNewsScheduler from './components/LiveNewsScheduler';
import BrutalistNotificationBanner from './components/BrutalistNotificationBanner';
import CallOverlay from './components/CallOverlay';
import { isFirebaseConfigured, firebaseInitError } from './lib/firebase';
import FirebaseSetupGuide from './components/FirebaseSetupGuide';
import { playGlitchClickSound, playLikeSound, playReceiveMessageSound, playIncomingMessageSound } from './lib/sounds';
import { 
  subscribeToNotifications, 
  markNotificationAsRead, 
  subscribeToFeed, 
  subscribeToUsers,
  subscribeToIncomingCall,
  subscribeToCallState,
  createActiveCall,
  ringActiveCall,
  acceptActiveCall,
  endActiveCall
} from './lib/services';
import { InAppNotification } from './types';
import {
  showPushNotification,
  requestNotificationPermission,
  checkNotificationPermission,
  registerCapacitorPushNotifications,
  updateOneSignalUserTags
} from './lib/pushNotifications';
import { deepLinkManager } from './lib/deepLinkManager';
import { NotificationProvider, useNotificationSystem } from './lib/notificationSystem';
import { CustomNavigationProvider, useNavigation } from './lib/navigationService';
import {
  Shield,
  ShieldCheck,
  MessageSquare,
  Globe,
  Bell,
  LogOut,
  Key,
  Users,
  Check,
  Unlock,
  Radio,
  Sparkles,
  Sun,
  Moon,
  Volume2,
  Sliders,
  Sparkle,
  Battery,
  BatteryCharging,
  Keyboard,
  Wifi,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSavedTheme, applyTheme } from './lib/theme';
import { triggerVibration, triggerEventVibration } from './lib/haptics';

function Dashboard() {
  const {
    activeTab,
    setActiveTab,
    deepLinkedPeerId,
    setDeepLinkedPeerId,
    deepLinkedGroupId,
    setDeepLinkedGroupId,
    viewedProfileId,
    setViewedProfileId,
    isSettingsOpen,
    setIsSettingsOpen,
    isFeedbackOpen,
    setIsFeedbackOpen,
    isShortcutsOpen,
    setIsShortcutsOpen,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    showOnboarding,
    setShowOnboarding,
    isTourOpen,
    setIsTourOpen,
    showNotifDropdown,
    setShowNotifDropdown
  } = useNavigation();

  React.useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  const [ongoingCall, setOngoingCall] = React.useState<any | null>(null);

  // Programmatically lock scrolling when any overlay/modal/sheet is open, preserving vertical scroll offsets
  const isAnyOverlayOpen = 
    isSettingsOpen || 
    isFeedbackOpen || 
    isShortcutsOpen || 
    viewedProfileId !== null || 
    showOnboarding || 
    isTourOpen || 
    ongoingCall !== null;

  useScrollLock(isAnyOverlayOpen);

  React.useEffect(() => {
    // Handle Electron Deeplinks and Tray actions
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        if (ipcRenderer) {
          ipcRenderer.on('deeplink-action', (event: any, action: string) => {
            console.log('Received deeplink action:', action);
            if (action === 'post') {
              setActiveTab('feed');
              setTimeout(() => window.dispatchEvent(new CustomEvent('faraflick-trigger-post')), 300);
            } else if (action === 'story') {
              setActiveTab('feed');
              // Trigger story creator via custom event if possible
              setTimeout(() => window.dispatchEvent(new CustomEvent('faraflick-trigger-post')), 300); // For now, just trigger post
            } else if (action === 'message') {
              setActiveTab('chat');
            }
          });
        }
      } catch (e) {
        console.warn('Electron IPC not available:', e);
      }
    }

    const handleViewProfileEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ uid: string }>;
      if (customEvent.detail && customEvent.detail.uid) {
        setViewedProfileId(customEvent.detail.uid);
      }
    };

    const handleTriggerOnboarding = () => {
      setShowOnboarding(true);
    };
    window.addEventListener('faraflick-view-profile', handleViewProfileEvent);
    window.addEventListener('faraflick-trigger-onboarding', handleTriggerOnboarding);
    return () => {
      window.removeEventListener('faraflick-view-profile', handleViewProfileEvent);
      window.removeEventListener('faraflick-trigger-onboarding', handleTriggerOnboarding);
    };
  }, []);

  const { profile, logout, localPrivateKey, loading, isAuthReady } = useAuth();
  const { triggerInAppNotification } = useNotificationSystem();

  // Subscribe to incoming call requests
  React.useEffect(() => {
    if (!isAuthReady || !profile?.uid) return;

    const unsubscribeIncoming = subscribeToIncomingCall(profile.uid, (incomingCall) => {
      if (incomingCall) {
        console.log('[Realtime Call] Incoming call detected on Firestore:', incomingCall);
        setOngoingCall({
          id: incomingCall.id,
          type: incomingCall.type,
          status: incomingCall.status,
          peerId: incomingCall.callerId,
          peerName: incomingCall.callerName,
          peerPhoto: incomingCall.callerPhoto,
          isIncoming: true
        });

        // Auto transition status to ringing so caller knows we are being notified
        if (incomingCall.status === 'dialing') {
          ringActiveCall(incomingCall.id);
        }
      } else {
        setOngoingCall(prev => (prev && prev.isIncoming ? null : prev));
      }
    });

    return () => unsubscribeIncoming();
  }, [profile?.uid]);

  // Sync handshakes in real-time
  React.useEffect(() => {
    if (!ongoingCall?.id) return;

    const unsubscribeState = subscribeToCallState(ongoingCall.id, (updatedCall) => {
      if (!updatedCall || updatedCall.status === 'ended') {
        console.log('[Realtime Call] Call terminated by peer.');
        setOngoingCall(null);
      } else {
        setOngoingCall(prev => {
          if (!prev) return null;
          return {
            ...prev,
            status: updatedCall.status
          };
        });
      }
    });

    return () => unsubscribeState();
  }, [ongoingCall?.id]);

  // Handle outbound calls triggered via custom window event
  React.useEffect(() => {
    const handleInitiateCall = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        peerId: string;
        peerName: string;
        peerPhoto: string;
        type: 'voice' | 'video';
      }>;
      if (!profile || !customEvent.detail) return;

      const { peerId, peerName, peerPhoto, type } = customEvent.detail;
      console.log('[Realtime Call] Initiated outgoing call to:', peerId);

      try {
        const callId = await createActiveCall(
          profile.uid,
          profile.displayName,
          profile.photoURL,
          peerId,
          type
        );

        setOngoingCall({
          id: callId,
          type,
          status: 'dialing',
          peerId,
          peerName,
          peerPhoto,
          isIncoming: false
        });
      } catch (err) {
        console.warn('[Realtime Call] Failed to initiate outgoing call:', err);
      }
    };

    window.addEventListener('faraflick-initiate-call', handleInitiateCall);
    return () => {
      window.removeEventListener('faraflick-initiate-call', handleInitiateCall);
    };
  }, [profile]);
  const { isOnline, connectionType, isSlow } = useConnectivity();
  const [deepLinkedPostId, setDeepLinkedPostId] = React.useState<string | null>(null);
  const [deepLinkedStoryId, setDeepLinkedStoryId] = React.useState<string | null>(null);
  const [deepLinkedNewsId, setDeepLinkedNewsId] = React.useState<string | null>(null);
  const [deepLinkedAnnouncementId, setDeepLinkedAnnouncementId] = React.useState<string | null>(null);

  const [batteryLevel, setBatteryLevel] = React.useState<number | null>(null);
  const [isCharging, setIsCharging] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let batteryInstance: any = null;
    const nav = navigator as any;

    const updateBattery = () => {
      if (batteryInstance) {
        setBatteryLevel(batteryInstance.level);
        setIsCharging(batteryInstance.charging);
      }
    };

    if (nav?.getBattery) {
      nav.getBattery().then((battery: any) => {
        batteryInstance = battery;
        updateBattery();

        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch((err: any) => {
        console.warn("Battery status API promise rejected:", err);
      });
    }

    return () => {
      if (batteryInstance) {
        batteryInstance.removeEventListener('levelchange', updateBattery);
        batteryInstance.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  React.useEffect(() => {
    if (profile?.uid) {
      const completed = localStorage.getItem(`flick_onboarded_v3_${profile.uid}`) === 'true';
      setShowOnboarding(!completed);
      if (completed) {
        // Only open the systems tour if they haven't completed it yet
        const tourCompleted = localStorage.getItem(`flick_tour_completed_${profile.uid}`) === 'true' || localStorage.getItem('flick_tour_completed') === 'true';
        if (!tourCompleted) {
          setIsTourOpen(true);
        }
      }
    }
  }, [profile?.uid]);

  // Sync deepLinkManager state triggers
  React.useEffect(() => {
    deepLinkManager.setStates(true, !!profile);
  }, [profile]);

  // Subscribe to normalized deep-link manager navigation events
  React.useEffect(() => {
    const unsubscribe = deepLinkManager.subscribe((payload) => {
      console.log('[Dashboard DeepLink] Handled dispatcher callback route:', payload);
      const targetId = payload.senderId || payload.params?.id || payload.params?.newsId || payload.params?.postId || payload.params?.storyId || payload.params?.groupId || payload.params?.announcementId || null;
      const route = payload.route?.toLowerCase().trim();

      if (route === 'chat') {
        if (targetId) {
          setDeepLinkedPeerId(targetId);
        }
        setActiveTab('chat');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
        setViewedProfileId(null);
      } else if (route === 'feed' || route === 'home') {
        setActiveTab('home');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'post') {
        if (targetId) {
          setDeepLinkedPostId(targetId);
        }
        setActiveTab('home');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'profile') {
        if (targetId) {
          setViewedProfileId(targetId);
        }
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'group') {
        if (targetId) {
          setDeepLinkedGroupId(targetId);
        }
        setActiveTab('chat');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'story') {
        if (targetId) {
          setDeepLinkedStoryId(targetId);
        }
        setActiveTab('home');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'news') {
        if (targetId) {
          setDeepLinkedNewsId(targetId);
        }
        setActiveTab('news');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'announcement') {
        if (targetId) {
          setDeepLinkedAnnouncementId(targetId);
        }
        setActiveTab('news');
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } else if (route === 'settings') {
        setIsSettingsOpen(true);
        setIsMobileMenuOpen(false);
      }
    });
    return unsubscribe;
  }, []);

  // Handle native deep link events dispatched from legacy routes or custom elements
  React.useEffect(() => {
    const handleDeepLinkEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      if (data) {
        console.log('[Deep Link] Received native event:', data);
        const parsed = deepLinkManager.parsePayload(data);
        if (parsed) {
          deepLinkManager.queueDeepLink(parsed);
        }
      }
    };
    window.addEventListener('fara-flick-deeplink', handleDeepLinkEvent);
    return () => {
      window.removeEventListener('fara-flick-deeplink', handleDeepLinkEvent);
    };
  }, []);

  const [notifications, setNotifications] = React.useState<InAppNotification[]>([]);

  // Theme support
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark'); // Default to dark for premium green-black look

  // Native notification permission state
  const [pushPermission, setPushPermission] = React.useState<string>(() => checkNotificationPermission());

  // In-app elegant floating toast state
  const [toasts, setToasts] = React.useState<{ id: string; title: string; body: string; icon?: string; type?: 'success' | 'error' | 'warning' | 'info' | 'loading' }[]>([]);

  // Auto Dismiss Toast Alerts (only dismiss non-loading toasts)
  React.useEffect(() => {
    const nonLoadingToasts = toasts.filter(t => t.type !== 'loading');
    if (nonLoadingToasts.length > 0) {
      const firstNonLoading = nonLoadingToasts[0];
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== firstNonLoading.id));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  // Global listener for custom brutalist toast dispatching
  React.useEffect(() => {
    const handleToastTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string; body: string; type?: 'success' | 'error' | 'warning' | 'info' | 'loading'; icon?: string; id?: string }>;
      if (customEvent.detail) {
        const { title, body, type, icon, id } = customEvent.detail;
        const toastId = id || Math.random().toString();
        
        setToasts(prev => {
          const index = prev.findIndex(t => t.id === toastId);
          const newToast = {
            id: toastId,
            title: title || (type === 'error' ? 'ERROR ×' : type === 'success' ? 'SUCCESS ✓' : type === 'warning' ? 'WARNING !' : type === 'loading' ? 'LOADING...' : 'SYSTEM UPDATE'),
            body: body || '',
            type: type || 'info',
            icon: icon
          };
          
          if (index > -1) {
            const updated = [...prev];
            updated[index] = newToast;
            return updated;
          } else {
            return [...prev, newToast];
          }
        });
      }
    };
    window.addEventListener('faraflick-toast-trigger', handleToastTrigger);
    return () => {
      window.removeEventListener('faraflick-toast-trigger', handleToastTrigger);
    };
  }, []);

  // Combined Native OS + Elegant In-App fallback notification trigger
  const triggerPushNotification = (titleOrPayload: string | any, body?: string, icon?: string) => {
    // Play sound if globally enabled/not muted
    const senderId = (typeof titleOrPayload === 'object' && titleOrPayload !== null) ? titleOrPayload.senderId : undefined;
    const isGroup = (typeof titleOrPayload === 'object' && titleOrPayload !== null) ? (!!titleOrPayload.chatId && titleOrPayload.chatId.includes('group')) : false;
    playIncomingMessageSound(senderId, isGroup);

    // Trigger haptics on new messages using dedicated user configuration
    triggerEventVibration('message');

    let finalTitle = "";
    let finalBody = "";
    let finalIcon = icon;
    let payloadToValidate: any = null;

    if (typeof titleOrPayload === 'object' && titleOrPayload !== null) {
      payloadToValidate = titleOrPayload;
      finalTitle = titleOrPayload.title || "New Flick Dialogue";
      finalBody = titleOrPayload.content || titleOrPayload.body || "";
      finalIcon = titleOrPayload.icon || icon;
    } else {
      finalTitle = titleOrPayload;
      finalBody = body || "";
      payloadToValidate = {
        senderId: 'simulation-sender-id',
        content: finalBody || finalTitle,
        timestamp: Date.now(),
        title: finalTitle,
        body: finalBody,
        icon: finalIcon
      };
    }

    // Try native push notification
    showPushNotification(payloadToValidate);

    // Call our premium in-app notification system banner queue!
    try {
      const isMessage = finalTitle.includes("Message") || finalTitle.includes("E2EE") || finalTitle.includes("Dialogue") || finalTitle.includes("Group");
      const senderName = isMessage ? finalTitle.replace(/E2EE Message from |Message from |New /g, "").trim() : "Flick Update";
      const sender = usersRef.current?.find(u => u.displayName === senderName) || null;
      
      triggerInAppNotification({
        senderId: sender?.uid || 'simulation-sender-id',
        senderName: senderName,
        senderAvatar: sender?.photoURL || finalIcon,
        content: finalBody,
        chatId: sender?.uid || 'general-chat', // Dynamic chat groupings
        type: 'message'
      });
    } catch (err) {
      console.warn("[NotificationSystem] Bypassed in-app queue trigger:", err);
    }
  };

  // Session markers to prevent spam on reload
  const sessionStartTime = React.useRef<number>(Date.now());
  const seenNotificationIds = React.useRef<Set<string>>(new Set());
  const seenPostIds = React.useRef<Set<string>>(new Set());
  const seenUserStatuses = React.useRef<Record<string, string>>({});
  const usersRef = React.useRef<any[]>([]);
  const isFeedInitialLoaded = React.useRef<boolean>(false);

  // Hardcode always dark mode for absolute brutalism black and green aesthetic
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Proactively request native push notification permissions on initial startup
  React.useEffect(() => {
    const autoRequestPush = async () => {
      if (checkNotificationPermission() === 'default') {
        const res = await requestNotificationPermission();
        setPushPermission(res);
        if (res === 'granted') {
          triggerPushNotification(
            "Fara Flick // Node Tunnel Secured",
            "Broadcasting nodes online. Push notification pathways have been synchronized."
          );
        }
      }
    };
    
    // Timeout to load nicely after animation
    const requestTimer = setTimeout(autoRequestPush, 3500);
    return () => clearTimeout(requestTimer);
  }, []);

  // Register Capacitor push notifications once the signed-in profile is active
  React.useEffect(() => {
    if (profile?.uid) {
      // 1. Register with OneSignal SDK
      registerCapacitorPushNotifications(profile.uid);
      
      // 2. Synchronize user profile characteristics/tags to OneSignal context
      updateOneSignalUserTags(profile);
    }
  }, [profile?.uid, profile]);

  // Subscribe to unread messages or likes notifications alerts (simulated pushes)
  React.useEffect(() => {
    if (!isAuthReady || !profile) return;
    const unsubscribe = subscribeToNotifications(profile.uid, (unread) => {
      setNotifications(unread);
    });
    return () => unsubscribe();
  }, [isAuthReady, profile?.uid]);

  // Welcome back feedback on login showing pending notifications
  const isInitialNotifAlert = React.useRef(true);
  React.useEffect(() => {
    if (!profile || notifications.length === 0) return;
    if (isInitialNotifAlert.current) {
      isInitialNotifAlert.current = false;
      const unreadCount = notifications.length;
      triggerPushNotification(
        `⚡ Welcome back, ${profile.displayName}!`,
        `Direct link secured. You have ${unreadCount} pending notification${unreadCount > 1 ? 's' : ''} waiting in your conduit.`
      );
    }
  }, [profile, notifications]);

  // Dispatch real push notifications for new unread messages/likes
  React.useEffect(() => {
    if (!profile) return;
    notifications.forEach((n) => {
      if (!seenNotificationIds.current.has(n.id)) {
        seenNotificationIds.current.add(n.id);
        
        // Skip pushes for existing historical data at session startup
        const createdMs = n.createdAt ? (n.createdAt.seconds ? n.createdAt.seconds * 1000 : (n.createdAt.toDate ? n.createdAt.toDate().getTime() : Date.parse(n.createdAt))) : Date.now();
        if (createdMs >= sessionStartTime.current - 10000) {
          if (n.type === 'message') {
            const sender = usersRef.current.find(u => u.displayName === n.senderName);
            const senderUid = sender?.uid;

            const allowAll = profile.notifMessagesAll !== false; // default true
            const allowedSenders = profile.notifMessagesFrom || [];

            let shouldShow = false;
            if (allowAll) {
              shouldShow = true;
            } else if (senderUid && allowedSenders.includes(senderUid)) {
              shouldShow = true;
            }

            if (shouldShow) {
              triggerPushNotification(
                n.title,
                n.body
              );
            }
          } else {
            // Reaction/like alert - only show if social feed notifications are allowed
            const allowSocialNotifs = profile.notifSocialFeed !== false; // default true
            if (allowSocialNotifs) {
              triggerPushNotification(
                n.title,
                n.body
              );
            }
          }
        }
      }
    });
  }, [notifications, profile?.uid, profile?.notifMessagesAll, profile?.notifMessagesFrom, profile?.notifSocialFeed]);

  // Dispatch real push notifications for new posts on Social Feed
  React.useEffect(() => {
    if (!isAuthReady || !profile) return;
    const wasLoaded = isFeedInitialLoaded.current;
    const unsubscribe = subscribeToFeed((posts) => {
      posts.forEach((p) => {
        if (!seenPostIds.current.has(p.id)) {
          seenPostIds.current.add(p.id);
          
          if (wasLoaded && p.authorId !== profile.uid) {
            const allowSocialNotifs = profile.notifSocialFeed !== false; // default true
            if (allowSocialNotifs) {
              triggerPushNotification(
                `New Post by ${p.authorName}`,
                p.content,
                p.authorPhoto
              );
            }
          }
        }
      });
      isFeedInitialLoaded.current = true;
    }, (err) => {
      console.warn("Feed subscription warning:", err);
    });
    return () => unsubscribe();
  }, [isAuthReady, profile?.uid, profile?.notifSocialFeed]);

  // Dispatch real push notifications for user presence sign ins
  React.useEffect(() => {
    if (!isAuthReady || !profile) return;
    const unsubscribe = subscribeToUsers((allUsers) => {
      usersRef.current = allUsers;
      allUsers.forEach((u) => {
        if (u.uid === profile.uid) return;
        
        const previousStatus = seenUserStatuses.current[u.uid];
        seenUserStatuses.current[u.uid] = u.status;
        
        // Transition offline/undefined -> online
        if (previousStatus !== undefined && previousStatus !== 'online' && u.status === 'online') {
          triggerPushNotification(
            `${u.displayName} is Online`,
            `Your peer is now online and available for encrypted conversations.`,
            u.photoURL
          );
        }
      });
    }, (err) => {
      console.warn("User status subscription warning:", err);
    });
    return () => unsubscribe();
  }, [isAuthReady, profile?.uid]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        (activeElement as HTMLElement).isContentEditable
      );

      // Support Escape to close modals even if typing
      if (e.key === 'Escape') {
        setIsFeedbackOpen(false);
        setIsSettingsOpen(false);
        setIsShortcutsOpen(false);
        setViewedProfileId(null);
        e.preventDefault();
        return;
      }

      if (isTyping) return;

      const hasModifier = e.altKey || e.shiftKey;

      if (hasModifier) {
        const keyLower = e.key.toLowerCase();
        if (keyLower === 'f') {
          setActiveTab('feed');
          playGlitchClickSound();
          e.preventDefault();
        } else if (keyLower === 'c') {
          setActiveTab('chat');
          playGlitchClickSound();
          e.preventDefault();
        } else if (keyLower === 's') {
          setIsSettingsOpen(prev => !prev);
          playGlitchClickSound();
          e.preventDefault();
        } else if (keyLower === 'e') {
          setIsFeedbackOpen(prev => !prev);
          playGlitchClickSound();
          e.preventDefault();
        } else if (keyLower === 'k') {
          setIsShortcutsOpen(prev => !prev);
          playGlitchClickSound();
          e.preventDefault();
        }
      } else {
        if (e.key === '?') {
          setIsShortcutsOpen(prev => !prev);
          playGlitchClickSound();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClearNotification = async (id: string) => {
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleNotificationClick = (n: InAppNotification) => {
    playGlitchClickSound();
    if (n.type === 'message' && n.senderId) {
      setDeepLinkedPeerId(n.senderId);
      setActiveTab('chat');
    } else {
      setActiveTab('feed');
    }
    handleClearNotification(n.id);
    setShowNotifDropdown(false);
  };

  if (!isFirebaseConfigured) {
    return <FirebaseSetupGuide error={firebaseInitError} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#f4f4f5] flex flex-col items-center justify-center font-mono relative p-4 selection:bg-[var(--neon-green)] selection:text-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.03)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative flex flex-col items-center max-w-xs text-center space-y-6 animate-pulse">
          <div className="w-12 h-12 border-3 border-[var(--neon-green)] flex items-center justify-center font-serif text-2xl font-black bg-black text-[var(--neon-green)] shadow-[4px_4px_0px_var(--neon-green)]">
            F
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black tracking-[0.2em] text-[var(--neon-green)] uppercase">
              INITIALIZING SECURE SESSION
            </p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              Verifying terminal node credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AuthScreen />;
  }

  const unreadE2EECount = notifications.filter(n => n.type === 'message').length;

  return (
    <div className={`bg-[#050505] text-[#f4f4f5] dark:text-zinc-100 flex flex-col font-mono selection:bg-[var(--neon-green)] selection:text-black transition-colors duration-200 ${activeTab === 'chat' ? 'h-screen overflow-hidden' : 'min-h-screen pb-12'}`}>
      
      {/* Premium Brutalist Liquid Glass Header */}
      <header className="border-b-2 border-[var(--neon-green)]/30 sticky top-0 z-50 bg-[#050505]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          
          {/* Logo and navigation links */}
          <div className="flex items-center space-x-6 select-none group/logo cursor-pointer">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 border-2 border-[var(--neon-green)] flex items-center justify-center font-serif text-2xl font-black bg-black text-[var(--neon-green)] shadow-[3px_3px_0px_var(--neon-green)] transition-all duration-100 container-glitch-hover">
                F
              </div>
              <div>
                <h1 className="font-serif font-black text-xs sm:text-sm text-white tracking-tight leading-none uppercase glitch-hover">
                  FARA FLICK
                </h1>
                <p className="hidden xs:block text-[7px] uppercase tracking-widest font-mono font-bold text-[var(--neon-green)] mt-1 opacity-90 group-hover/logo:text-red-500 transition-colors">
                  E2E SECURE NET // PORTAL_A
                </p>
              </div>
            </div>
          </div>

          {/* Current credentials state & settings drawer triggers - Desktop Only */}
          <div className="hidden md:flex items-center space-x-2.5">

            {/* Real-time Network Connectivity Monitor */}
            <div 
              className={`flex items-center space-x-1.5 px-2 py-1 border font-mono text-[9px] uppercase tracking-wider font-bold transition-all select-none ${
                !isOnline 
                  ? 'border-red-500 bg-red-955/20 text-red-500 animate-pulse'
                  : isSlow
                    ? 'border-amber-500 bg-amber-955/20 text-amber-500'
                    : 'border-[var(--neon-green)]/20 bg-[#0c0c0c] text-[var(--neon-green)]'
              }`}
              title={
                !isOnline 
                  ? 'Network Tunnel Offline' 
                  : `Network Connected via ${connectionType.toUpperCase()}${isSlow ? ' (Slow Connection)' : ''}`
              }
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-500 animate-bounce" />
                  <span className="hidden xs:inline">TUNNEL BLOCKED</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                  <span className="hidden xs:inline">
                    {isSlow ? 'TUNNEL SLOW' : 'TUNNEL LIVE'}
                  </span>
                </>
              )}
            </div>

            {/* Battery Status Monitor */}
            <div 
              className={`flex items-center space-x-1.5 px-2 py-1 border font-mono text-[9px] uppercase tracking-wider font-bold transition-all select-none ${
                (batteryLevel !== null && batteryLevel <= 0.20)
                  ? 'border-red-500 bg-red-955/20 text-red-500 animate-pulse' 
                  : 'border-[var(--neon-green)]/20 bg-[#0c0c0c] text-[var(--neon-green)]'
              }`}
              title={batteryLevel !== null ? (isCharging ? "Battery is Charging" : `Battery level: ${Math.round(batteryLevel * 100)}%`) : "Connected to Grid Power"}
            >
              {isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-[var(--neon-green)]" />
              ) : (
                <Battery className={`w-3.5 h-3.5 ${(batteryLevel !== null && batteryLevel <= 0.20) ? 'text-red-500 animate-bounce' : 'text-[var(--neon-green)]'}`} />
              )}
              <span>{batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : 'GRID'}</span>
              {isCharging && <span className="text-[7.5px] text-[var(--neon-green)] font-mono font-black">[CHRG]</span>}
            </div>

            {/* Inbound Notifications Bell Dropdown */}
            <div className="relative border-[var(--neon-green)]/20 pl-1">
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setShowNotifDropdown(!showNotifDropdown);
                }}
                className="p-2 border border-[var(--neon-green)]/20 hover:border-[var(--neon-green)] text-[var(--neon-green)] bg-[#0c0c0c] cursor-pointer"
                title="System Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-3.5 w-80 bg-[#0c0c0c] border-2 border-[var(--neon-green)] shadow-xl overflow-hidden z-50 text-left rounded-none">
                  <div className="p-4 border-b border-[var(--neon-green)]/20 bg-black flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest font-black text-[var(--neon-green)]">NODE BROADCASTS</span>
                    <span className="text-[8px] bg-red-600 border border-black px-1.5 py-0.5 font-mono text-white">
                      {notifications.length} DISPATCHED
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-[var(--neon-green)]/10 text-xs">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 italic">
                        No active queue signals.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className="p-4 hover:bg-[var(--neon-green)]/10 flex items-start justify-between gap-2 bg-[#050505] cursor-pointer group transition-all"
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className="space-y-1 flex-1">
                            <p className="font-bold tracking-tight text-white group-hover:text-[var(--neon-green)] transition-colors">{n.title}</p>
                            <p className="text-[10px] text-zinc-400">{n.body}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // prevent triggering the parent click
                              handleClearNotification(n.id);
                            }}
                            className="border border-[var(--neon-green)]/40 p-1 hover:bg-[var(--neon-green)] hover:text-black text-[var(--neon-green)] transition cursor-pointer self-start"
                            title="Done"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => {
                playGlitchClickSound();
                setIsShortcutsOpen(true);
              }}
              className="p-2 border border-[var(--neon-green)]/25 hover:border-[var(--neon-green)] text-[var(--neon-green)] bg-[#0c0c0c] cursor-pointer hover:bg-black/45 transition"
              title="Keyboard Shortcuts Menu [Shift + K]"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Profile trigger */}
            <button
              id="tour-profile-btn"
              onClick={() => {
                playGlitchClickSound();
                setIsSettingsOpen(true);
              }}
              className="flex items-center space-x-2 border-l border-[var(--neon-green)]/25 pl-3 h-8 text-left hover:opacity-85 transition cursor-pointer"
              title="Configure Node Profile"
            >
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                className="w-7 h-7 rounded-none border border-[var(--neon-green)]/40 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="hidden sm:block">
                <p className="text-xs font-black leading-none text-white uppercase">{profile.displayName}</p>
                <div className="flex items-center gap-1 mt-1 font-mono text-[8px] text-[var(--neon-green)]">
                  <span className="w-1.5 h-1.5 bg-[var(--neon-green)] rounded-full"></span>
                  <span>TUNNEL ON</span>
                </div>
              </div>
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 border border-transparent hover:border-red-500/30 text-zinc-500 hover:text-red-500 transition cursor-pointer"
              title="Terminate Secure Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Specific Indicator & Hamburger Trigger */}
          <div className="flex md:hidden items-center space-x-2.5">
            {unreadE2EECount > 0 && (
              <span className="bg-red-600 text-white px-2 py-1 leading-none text-[8.5px] font-black border border-red-500 animate-pulse tracking-tight font-mono">
                {unreadE2EECount} SECURE
              </span>
            )}
            <button
              onClick={() => {
                playGlitchClickSound();
                triggerVibration('light');
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="px-3 py-2 border border-[var(--neon-green)] text-[var(--neon-green)] bg-black font-mono font-bold tracking-wider text-[9px] uppercase flex items-center gap-1 cursor-pointer transition-all hover:bg-[var(--neon-green)] hover:text-black"
              aria-label="Toggle Navigation Terminal"
            >
              {isMobileMenuOpen ? (
                <>
                  <span className="font-extrabold mr-0.5">✕</span>
                  <span>CLOSE</span>
                </>
              ) : (
                <>
                  <span className="text-xs">☰</span>
                  <span>MENU</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Animated Mobile Console Terminal Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="md:hidden w-full bg-black border-t border-[var(--neon-green)]/30 text-[var(--neon-green)] overflow-hidden font-mono text-[10px]"
            >
              <div className="p-4 sm:p-6 space-y-4 divide-y divide-[var(--neon-green)]/15">
                
                {/* Profile Overview */}
                <div className="flex items-center space-x-3 pb-3">
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className="w-10 h-10 border-2 border-[var(--neon-green)] object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white uppercase truncate mb-0.5">
                      {profile.displayName}
                    </p>
                    <p className="text-[8px] text-zinc-400 lowercase truncate leading-none mb-1">
                      {profile.email}
                    </p>
                    <div className="flex items-center gap-1.5 font-mono text-[8px] text-[var(--neon-green)] font-black">
                      <span className="w-1.5 h-1.5 bg-[var(--neon-green)] rounded-full animate-ping"></span>
                      <span>SECURE NODE ACTIVE</span>
                    </div>
                  </div>
                </div>

                {/* Direct Tabs Toggle Options */}
                <div className="py-3 space-y-2">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-1">Console Destinations</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        triggerVibration('light');
                        setActiveTab('feed');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`p-2 text-center border font-bold uppercase transition flex flex-col items-center justify-center gap-1 text-[8px] ${
                        activeTab === 'feed'
                          ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black font-serif italic'
                          : 'border-[var(--neon-green)]/20 text-zinc-400 bg-zinc-950/40 hover:text-white'
                      }`}
                    >
                      <Sparkle className="w-3.5 h-3.5" />
                      <span>Chronicles</span>
                    </button>

                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        triggerVibration('light');
                        setActiveTab('news');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`p-2 text-center border font-bold uppercase transition flex flex-col items-center justify-center gap-1 text-[8px] ${
                        activeTab === 'news'
                          ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black font-serif italic'
                          : 'border-[var(--neon-green)]/20 text-zinc-400 bg-zinc-950/40 hover:text-white'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5 text-zinc-400" />
                      <span>News Wire</span>
                    </button>

                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        triggerVibration('light');
                        setActiveTab('chat');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`p-2 text-center border font-bold uppercase transition flex flex-col items-center justify-center gap-1 text-[8px] ${
                        activeTab === 'chat'
                          ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black font-serif italic'
                          : 'border-[var(--neon-green)]/20 text-zinc-400 bg-zinc-950/40 hover:text-white'
                      }`}
                    >
                      <div className="relative">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {unreadE2EECount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-red-650 text-white px-0.5 font-mono text-[7px] font-black rounded-sm border border-red-500">
                            {unreadE2EECount}
                          </span>
                        )}
                      </div>
                      <span>Tunnels</span>
                    </button>
                  </div>
                </div>

                {/* System Monitors */}
                <div className="py-3 grid grid-cols-2 gap-3">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">Tunnel Monitor</span>
                    <div className={`p-2 border font-bold text-center flex items-center justify-center space-x-1 select-none text-[8.5px] ${
                      !isOnline 
                        ? 'border-red-500/40 text-red-500 bg-red-955/20 animate-pulse'
                        : isSlow
                          ? 'border-amber-500/40 text-amber-500'
                          : 'border-[var(--neon-green)]/20 bg-zinc-950/40 text-[var(--neon-green)]'
                    }`}>
                      {!isOnline ? <WifiOff className="w-3.5 h-3.5 shrink-0" /> : <Wifi className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{!isOnline ? "BLOCKED" : isSlow ? "SLOW CONNECTION" : "LIVE"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">Power Reserves</span>
                    <div className="p-2 border border-[var(--neon-green)]/20 bg-zinc-950/40 text-[var(--neon-green)] text-center font-bold flex items-center justify-center space-x-1 text-[8.5px]">
                      {isCharging ? <BatteryCharging className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <Battery className="w-3.5 h-3.5" />}
                      <span>{batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : 'GRID'}</span>
                    </div>
                  </div>
                </div>

                {/* Utility Subsystems */}
                <div className="py-3 space-y-2 whitespace-nowrap">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-1">Utility Subsystems</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        setShowNotifDropdown(!showNotifDropdown);
                      }}
                      className="p-2.5 border border-[var(--neon-green)]/35 bg-zinc-950/30 text-[var(--neon-green)] font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-[var(--neon-green)]/15 transition text-[9px]"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Alerts ({notifications.length})</span>
                    </button>

                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        setIsSettingsOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="p-2.5 border border-[var(--neon-green)]/35 bg-zinc-950/30 text-[var(--neon-green)] font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-[var(--neon-green)]/15 transition text-[9px]"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Config</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        setIsShortcutsOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="p-2.5 border border-[var(--neon-green)]/35 bg-zinc-950/30 text-[var(--neon-green)] font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-[var(--neon-green)]/15 transition text-[9px]"
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>Shortcuts</span>
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="p-2.5 border border-red-500/30 bg-red-950/10 text-red-500 font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-red-500/10 transition text-[9px]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 w-full mx-auto flex flex-col min-h-0">
        
        {/* Dynamic content segments wrapped securely inside a flex-1 overflow-hidden layout parent */}
        <div className="w-full flex-1 overflow-hidden flex flex-col">
          <FeedSection 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            unreadE2EECount={unreadE2EECount}
            deepLinkedPeerId={deepLinkedPeerId}
            onClearDeepLink={() => setDeepLinkedPeerId(null)}
            deepLinkedGroupId={deepLinkedGroupId}
            onClearDeepLinkedGroup={() => setDeepLinkedGroupId(null)}
          />
        </div>

      </main>

      {/* Exquisite bottom navigation placeholder removed to avoid covering inputs. Sticky Top horizontal nav bar replaces it securely. */}

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <ProfileSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onReplayTour={() => setIsTourOpen(true)}
        onTestPush={(payload) => triggerPushNotification(payload)}
      />

      <UserProfileModal uid={viewedProfileId} onClose={() => setViewedProfileId(null)} />

      {showOnboarding && (
        <OnboardingIntro 
          onComplete={() => {
            if (profile?.uid) {
              localStorage.setItem(`flick_onboarded_v3_${profile.uid}`, 'true');
            }
            setShowOnboarding(false);
            setIsTourOpen(true);
          }} 
        />
      )}

      <AppTour
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setIsSettingsOpen={setIsSettingsOpen}
        isOpen={isTourOpen}
        onClose={() => {
          setIsTourOpen(false);
          if (profile?.uid) {
            localStorage.setItem(`flick_tour_completed_${profile.uid}`, 'true');
          }
        }}
      />

      {/* Floating In-App Fallback Toasts Container */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3.5 max-w-sm w-full pointer-events-none font-mono">
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';
          const isLoading = toast.type === 'loading';

          let borderColor = 'border-[var(--neon-green)]';
          let textColor = 'text-[var(--neon-green)]';
          let bgColor = 'bg-[#060a08]/95';
          let iconChar = '⚡';

          if (isError) {
            borderColor = 'border-[#ff0055]';
            textColor = 'text-[#ff0055]';
            bgColor = 'bg-[#120206]/95';
            iconChar = '×';
          } else if (isSuccess) {
            borderColor = 'border-[#00ff66]';
            textColor = 'text-[#00ff66]';
            bgColor = 'bg-[#021206]/95';
            iconChar = '✓';
          } else if (isWarning) {
            borderColor = 'border-[#eab308]';
            textColor = 'text-[#eab308]';
            bgColor = 'bg-[#140f02]/95';
            iconChar = '!';
          } else if (isLoading) {
            borderColor = 'border-[#00ccff]';
            textColor = 'text-[#00ccff]';
            bgColor = 'bg-[#010b10]/95';
            iconChar = '↻';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border-3 ${borderColor} ${bgColor} p-4 shadow-[6px_6px_0px_0px_#000000] flex items-start space-x-3.5 transition-all duration-300 transform translate-y-0 rounded-none`}
            >
              {toast.icon ? (
                <img
                  src={toast.icon}
                  alt=""
                  className={`w-10 h-10 object-cover border-2 ${borderColor} flex-shrink-0`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`w-10 h-10 bg-black flex items-center justify-center font-serif text-xl font-black border-2 ${borderColor} flex-shrink-0 ${textColor} ${isLoading ? 'animate-spin' : ''}`}>
                  {iconChar}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-black tracking-wider uppercase leading-none ${textColor} flex items-center justify-between pb-2 border-b border-white/10 mb-2`}>
                  <span>{toast.title}</span>
                  <button
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-white hover:text-rose-500 text-[10px] font-sans cursor-pointer pl-2.5 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </p>
                <p className="text-[11px] text-zinc-100 leading-normal font-sans uppercase font-bold">
                  {toast.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {ongoingCall && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999]"
          >
            <CallOverlay
              call={ongoingCall}
              onEndCall={async () => {
                if (ongoingCall.id) {
                  await endActiveCall(ongoingCall.id);
                }
                setOngoingCall(null);
              }}
              onAcceptCall={async () => {
                if (ongoingCall.id) {
                  await acceptActiveCall(ongoingCall.id);
                }
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Unified background news and notification overlays */}
      <LiveNewsScheduler />
      <BrutalistNotificationBanner />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ConnectivityProvider>
        <AuthProvider>
          <OperationProvider>
            <NotificationProvider>
              <CustomNavigationProvider>
                <Dashboard />
              </CustomNavigationProvider>
            </NotificationProvider>
          </OperationProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </ThemeProvider>
  );
}
