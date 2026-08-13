import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConnectivityProvider, useConnectivity } from './contexts/ConnectivityContext';
import { OperationProvider } from './contexts/OperationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useScrollLock } from './hooks/useScrollLock';
import AuthScreen from './components/AuthScreen';
import ChatSection from './components/ChatSection';
import FeedSection from './components/FeedSection';
import DesktopSidebar from './components/layout/DesktopSidebar';
import MobileBottomNav from './components/layout/MobileBottomNav';
import { UnifiedNavigation } from './components/layout/UnifiedNavigation';
import { AppHeader } from './components/layout/AppHeader';
import { applyFont, getSavedFont } from './lib/theme';
import SecureNewsFlow from './components/SecureNewsFlow';
import FeedbackModal from './components/FeedbackModal';
import OnboardingIntro from './components/OnboardingIntro';
import { CinematicIntroModal } from './components/CinematicIntroModal';
import AppTour from './components/AppTour';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import HorizontalTicker from './components/HorizontalTicker';
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge';
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

  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  const [ongoingCall, setOngoingCall] = useState<any | null>(null);
  const [showCinematicIntro, setShowCinematicIntro] = useState(false);

  // Programmatically lock scrolling when any overlay/modal/sheet is open, preserving vertical scroll offsets
  const isAnyOverlayOpen = 
    isSettingsOpen || 
    isFeedbackOpen || 
    isShortcutsOpen || 
    viewedProfileId !== null || 
    showOnboarding || 
    showCinematicIntro ||
    isTourOpen || 
    ongoingCall !== null;

  useScrollLock(isAnyOverlayOpen);

  useEffect(() => {
    applyFont(getSavedFont());
  }, []);

  useEffect(() => {
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
    const handleTriggerCinematic = () => {
      setShowCinematicIntro(true);
    };
    window.addEventListener('faraflick-view-profile', handleViewProfileEvent);
    window.addEventListener('faraflick-trigger-onboarding', handleTriggerOnboarding);
    window.addEventListener('faraflick-trigger-cinematic', handleTriggerCinematic);
    return () => {
      window.removeEventListener('faraflick-view-profile', handleViewProfileEvent);
      window.removeEventListener('faraflick-trigger-onboarding', handleTriggerOnboarding);
      window.removeEventListener('faraflick-trigger-cinematic', handleTriggerCinematic);
    };
  }, []);

  const { profile, logout, localPrivateKey, loading, isAuthReady } = useAuth();
  const { triggerInAppNotification } = useNotificationSystem();

  // Subscribe to incoming call requests
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
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
  const [deepLinkedPostId, setDeepLinkedPostId] = useState<string | null>(null);
  const [deepLinkedStoryId, setDeepLinkedStoryId] = useState<string | null>(null);
  const [deepLinkedNewsId, setDeepLinkedNewsId] = useState<string | null>(null);
  const [deepLinkedAnnouncementId, setDeepLinkedAnnouncementId] = useState<string | null>(null);

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);

  useEffect(() => {
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

  useEffect(() => {
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
  useEffect(() => {
    deepLinkManager.setStates(true, !!profile);
  }, [profile]);

  // Subscribe to normalized deep-link manager navigation events
  useEffect(() => {
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
  useEffect(() => {
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

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  // Theme support
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to dark for premium green-black look

  // Native notification permission state
  const [pushPermission, setPushPermission] = useState<string>(() => checkNotificationPermission());

  // In-app elegant floating toast state
  const [toasts, setToasts] = useState<{ id: string; title: string; body: string; icon?: string; type?: 'success' | 'error' | 'warning' | 'info' | 'loading' }[]>([]);

  // Auto Dismiss Toast Alerts (only dismiss non-loading toasts)
  useEffect(() => {
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
  useEffect(() => {
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
  const sessionStartTime = useRef<number>(Date.now());
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const seenPostIds = useRef<Set<string>>(new Set());
  const seenUserStatuses = useRef<Record<string, string>>({});
  const usersRef = useRef<any[]>([]);
  const isFeedInitialLoaded = useRef<boolean>(false);

  // Hardcode always dark mode for absolute brutalism black and green aesthetic
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Proactively request native push notification permissions on initial startup
  useEffect(() => {
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
  useEffect(() => {
    if (profile?.uid) {
      // 1. Register with OneSignal SDK
      registerCapacitorPushNotifications(profile.uid);
      
      // 2. Synchronize user profile characteristics/tags to OneSignal context
      updateOneSignalUserTags(profile);
    }
  }, [profile?.uid, profile]);

  // Subscribe to unread messages or likes notifications alerts (simulated pushes)
  useEffect(() => {
    if (!isAuthReady || !profile) return;
    const unsubscribe = subscribeToNotifications(profile.uid, (unread) => {
      setNotifications(unread);
    });
    return () => unsubscribe();
  }, [isAuthReady, profile?.uid]);

  // Welcome back feedback on login showing pending notifications
  const isInitialNotifAlert = useRef(true);
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
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

  useEffect(() => {
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
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center font-mono relative p-4 selection:bg-[var(--neon-green)] selection:text-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.03)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative flex flex-col items-center max-w-xs text-center space-y-6 animate-pulse">
          <div className="w-12 h-12 border-3 border-[var(--neon-green)] flex items-center justify-center font-serif text-2xl font-black bg-[var(--color-surface)] text-[var(--neon-green)] shadow-[4px_4px_0px_var(--neon-green)]">
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
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[var(--color-background)] text-[var(--color-text)] dark:text-[var(--color-text)] font-mono selection:bg-[var(--neon-green)] selection:text-black transition-colors duration-200 relative">
        {/* Main Responsive App Header */}
      <AppHeader
        profile={profile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadE2EECount={unreadE2EECount}
        notifications={notifications}
        isOnline={isOnline}
        isSlow={isSlow}
        connectionType={connectionType}
        batteryLevel={batteryLevel}
        isCharging={isCharging}
        setShowCinematicIntro={setShowCinematicIntro}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsShortcutsOpen={setIsShortcutsOpen}
        handleNotificationClick={handleNotificationClick}
        handleClearNotification={handleClearNotification}
        logout={logout}
        playGlitchClickSound={playGlitchClickSound}
        triggerVibration={triggerVibration}
      />

      {/* Unified Nav-Aware Layout Container */}
      <div className="flex-1 min-h-0 w-full max-w-full flex flex-row relative overflow-hidden">
        
        {/* Responsive Unified Navigation (Adapts Sidebar vs Mobile Bottom Nav) */}
        <UnifiedNavigation
          unreadE2EECount={unreadE2EECount}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSearch={() => window.dispatchEvent(new CustomEvent('faraflick-trigger-search'))}
        />

        {/* Center Content Column (Main Feed / Messaging / Profile / Workspace) */}
        <main className="flex-1 min-h-0 flex flex-col min-w-0 h-full relative overflow-hidden">
          <FeedSection 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            unreadE2EECount={unreadE2EECount}
            deepLinkedPeerId={deepLinkedPeerId}
            onClearDeepLink={() => setDeepLinkedPeerId(null)}
            deepLinkedGroupId={deepLinkedGroupId}
            onClearDeepLinkedGroup={() => setDeepLinkedGroupId(null)}
          />
        </main>

      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <ProfileSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onReplayTour={() => setIsTourOpen(true)}
        onTestPush={(payload) => triggerPushNotification(payload)}
      />

      <UserProfileModal uid={viewedProfileId} onClose={() => setViewedProfileId(null)} />

      <CinematicIntroModal 
        isOpen={showCinematicIntro} 
        onClose={() => setShowCinematicIntro(false)} 
      />

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
                <div className={`w-10 h-10 bg-[var(--color-surface)] flex items-center justify-center font-serif text-xl font-black border-2 ${borderColor} flex-shrink-0 ${textColor} ${isLoading ? 'animate-spin' : ''}`}>
                  {iconChar}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-black tracking-wider uppercase leading-none ${textColor} flex items-center justify-between pb-2 border-b border-white/10 mb-2`}>
                  <span>{toast.title}</span>
                  <button
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-[var(--color-text)] hover:text-rose-500 text-[10px] font-sans cursor-pointer pl-2.5 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </p>
                <p className="text-[11px] text-[var(--color-text)] leading-normal font-sans uppercase font-bold">
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
