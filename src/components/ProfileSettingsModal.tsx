import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Bell, Eye, HardDrive, Layout, BookOpen, UserPlus, HelpCircle, Terminal, Check, Info, Loader2, QrCode, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOperations } from '../contexts/OperationContext';
import { showBrutalistToast } from '../lib/toast';
import { sanitizeErrorMessage } from '../lib/errorSanitizer';
import { upsertUserProfile, subscribeToUsers } from '../lib/services';
import { compressImage } from '../lib/mediaHelper';
import { playLikeSound, playGlitchClickSound } from '../lib/sounds';
import { showPushNotification, registerCapacitorPushNotifications } from '../lib/pushNotifications';
import { NativePushDebugger } from './NativePushDebugger';
import { SettingsAccountTab } from './SettingsAccountTab';
import { SettingsNotificationsTab } from './SettingsNotificationsTab';
import { SettingsAccessibilityTab } from './SettingsAccessibilityTab';
import { SettingsOtherTabs } from './SettingsOtherTabs';
import { SettingsQrKeyExchangeTab } from './SettingsQrKeyExchangeTab';
import { SettingsStoragePurgeTab } from './SettingsStoragePurgeTab';
import { SettingsSecurityTab } from './SettingsSecurityTab';
import { SettingsPrivacyTab } from './SettingsPrivacyTab';
import { SettingsAboutTab } from './SettingsAboutTab';
import { UserProfile } from '../types';
import { getSavedTheme, applyTheme, BrutalistTheme, THEMES } from '../lib/theme';
import { isVibrationEnabled, setVibrationEnabled, triggerVibration, getVibrationIntensity, setVibrationIntensity, VibrationIntensity } from '../lib/haptics';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTour?: () => void;
  onTestPush?: (payload: any) => void;
}

export default function ProfileSettingsModal({ isOpen, onClose, onReplayTour, onTestPush }: ProfileSettingsModalProps) {
  const { profile, reloadProfile } = useAuth();
  const { isTaskMonitorEnabled, setIsTaskMonitorEnabled } = useOperations();
  
  const [selectedTheme, setSelectedTheme] = useState<BrutalistTheme>(() => getSavedTheme());
  const [vibeEnabled, setVibeEnabled] = useState(() => isVibrationEnabled());
  const [vibeMessageIntensity, setVibeMessageIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('message'));
  const [vibeLikeIntensity, setVibeLikeIntensity] = useState<VibrationIntensity>(() => getVibrationIntensity('like'));

  const [sendShortcut, setSendShortcut] = useState<'enter' | 'cmd-enter'>(() => {
    return (localStorage.getItem('flick_send_shortcut') as 'enter' | 'cmd-enter') || 'enter';
  });
  const [typingVisualStyle, setTypingVisualStyle] = useState<'pulse' | 'stealth' | 'minimal'>(() => {
    return (localStorage.getItem('flick_typing_style') as 'pulse' | 'stealth' | 'minimal') || 'pulse';
  });
  const [sessionCipherTtl, setSessionCipherTtl] = useState<'5m' | '15m' | '1h' | 'infinite'>(() => {
    return (localStorage.getItem('flick_cipher_ttl') as '5m' | '15m' | '1h' | 'infinite') || 'infinite';
  });

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<'account' | 'privacy' | 'security' | 'notifications' | 'accessibility' | 'storage' | 'about'>('account');
  const [eduModeEnabled, setEduModeEnabled] = useState<boolean>(() => localStorage.getItem('flick_edu_mode') === 'true');
  const [newsFeedStyle, setNewsFeedStyle] = useState<'vapor' | 'brutalist' | 'silicon'>(() => {
    return (localStorage.getItem('flick_news_style') as 'vapor' | 'brutalist' | 'silicon') || 'brutalist';
  });
  const [autoDownloadOnCellular, setAutoDownloadOnCellular] = useState<boolean>(() => {
    return localStorage.getItem('flick_auto_download') !== 'false';
  });
  const [cacheCleanupRetention, setCacheCleanupRetention] = useState<'7d' | '30d' | 'infinite'>(() => {
    return (localStorage.getItem('flick_cleanup_retention') as '7d' | '30d' | 'infinite') || 'infinite';
  });
  const [friendsUserSearchQuery, setFriendsUserSearchQuery] = useState('');
  const [helpTicketCategory, setHelpTicketCategory] = useState<'technical' | 'privacy' | 'feedback'>('technical');
  const [helpTicketContent, setHelpTicketContent] = useState('');
  const [chatLockEnabled, setChatLockEnabled] = useState<boolean>(() => {
    return localStorage.getItem('flick_chat_lock') === 'true';
  });
  const [chatLockPin, setChatLockPin] = useState<string>(() => {
    return localStorage.getItem('flick_chat_lock_pin') || '';
  });
  
  const [notifGroups, setNotifGroups] = useState<boolean>(() => localStorage.getItem('flick_notif_groups') !== 'false');
  const [notifCalls, setNotifCalls] = useState<boolean>(() => localStorage.getItem('flick_notif_calls') !== 'false');
  const [notifNewsAlerts, setNotifNewsAlerts] = useState<boolean>(() => localStorage.getItem('flick_notif_news') !== 'false');
  const [notifSilentMode, setNotifSilentMode] = useState<boolean>(() => localStorage.getItem('flick_notif_silent') === 'true');
  const [notifPriorityChatsOnly, setNotifPriorityChatsOnly] = useState<boolean>(() => localStorage.getItem('flick_notif_priority') === 'true');
  
  const [notifSocialFeed, setNotifSocialFeed] = useState(profile?.notifSocialFeed !== false);
  const [notifMessagesAll, setNotifMessagesAll] = useState(profile?.notifMessagesAll !== false);
  const [notifMessagesFrom, setNotifMessagesFrom] = useState<string[]>(profile?.notifMessagesFrom || []);
  const [soundEnabled, setSoundEnabled] = useState(profile?.soundEnabled !== false);
  const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);

  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>(["Panel loaded. Standby for operation..."]);
  const [isRegisteringPush, setIsRegisteringPush] = useState(false);
  const [isSendingCloudTest, setIsSendingCloudTest] = useState(false);
  const [simSeconds, setSimSeconds] = useState(0);
  const [bridges, setBridges] = useState({
    webkit: false,
    android: false,
    androidInterface: false,
    androidPush: false,
    jsInterface: false,
    capacitor: false,
    cordova: false,
    browserNative: false
  });

  const updatePermissionAndBridges = async () => {
    if (typeof window === 'undefined') return;
    const uWindow = window as any;
    
    const currentPermission = 'Notification' in window ? Notification.permission : 'denied';
    setPermission(currentPermission);
    setBridges({
      webkit: !!uWindow.webkit?.messageHandlers?.notification,
      android: !!uWindow.Android,
      androidInterface: !!uWindow.AndroidInterface,
      androidPush: !!uWindow.AndroidPush,
      jsInterface: !!uWindow.JSInterface,
      capacitor: false,
      cordova: false,
      browserNative: 'Notification' in window
    });
  };

  useEffect(() => {
    updatePermissionAndBridges();
  }, [isOpen]);

  const handleRequestPermission = async () => {
    playGlitchClickSound();
    
    if (profile?.uid) {
      console.log('[Settings Push] Registering PWA Web Push notification parameters...');
      await registerCapacitorPushNotifications(profile.uid);
      setTimeout(() => {
        updatePermissionAndBridges();
      }, 1500);
    } else {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const p = await Notification.requestPermission();
          setPermission(p);
        } catch (e) {
          Notification.requestPermission((p) => setPermission(p));
        }
      }
    }
  };

  const handleSimulatePush = (delayMs: number) => {
    playGlitchClickSound();
    if (delayMs === 0) {
      showPushNotification(
        "Flick Telemetry Alert",
        "E2EE test notification dispatched. Cryptographic pipeline: [ACTIVE]",
        profile?.photoURL
      );
      return;
    }

    setSimSeconds(5);
    const interval = setInterval(() => {
      setSimSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimeout(() => {
      showPushNotification(
        "Flick Telemetry Alert",
        "5s simulation loop triggered successfully. Security keys synced.",
        profile?.photoURL
      );
    }, delayMs);
  };

  const handleForceRegisterOneSignal = async () => {
    playGlitchClickSound();
    setIsRegisteringPush(true);
    const timeStr = new Date().toLocaleTimeString();
    setDiagnosticLogs(prev => [`[${timeStr}] Starting manual OneSignal Web Push register sequence...`, ...prev]);
    
    try {
      if (!profile?.uid) {
        setDiagnosticLogs(prev => [`[${timeStr}] FAIL: No active profile UID found. Sign-in required.`, ...prev]);
        setIsRegisteringPush(false);
        return;
      }

      setDiagnosticLogs(prev => [
        `[${timeStr}] Current UID: ${profile.uid}`,
        `[${timeStr}] Initializing OneSignal Web SDK with App ID: 050ecfbd-c43d-453d-a578-2f3ece4649ea`,
        ...prev
      ]);

      await registerCapacitorPushNotifications(profile.uid);

      setDiagnosticLogs(prev => [
        `[${timeStr}] Handshake request processed. checking window.OneSignal status...`,
        ...prev
      ]);

      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        setDiagnosticLogs(prev => [`[${timeStr}] OneSignal Web SDK is verified in global scope.`, ...prev]);
        const subId = OneSignal.User?.pushSubscription?.id;
        setDiagnosticLogs(prev => [`[${timeStr}] Active subscription ID: ${subId || 'PENDING/ABSENT'}`, ...prev]);
      } else {
        setDiagnosticLogs(prev => [`[${timeStr}] WARNING: OneSignal variable not found in window context. Loading deferred...`, ...prev]);
      }

      setDiagnosticLogs(prev => [`[${timeStr}] SUCCESS: PWA Push Node synchronization cycle executed.`, ...prev]);
      await reloadProfile();
    } catch (err: any) {
      console.warn(err);
      setDiagnosticLogs(prev => [`[${timeStr}] ERROR: ${err.message || String(err)}`, ...prev]);
    } finally {
      setIsRegisteringPush(false);
    }
  };

  const handleTriggerCloudPushTest = async () => {
    playGlitchClickSound();
    setIsSendingCloudTest(true);
    const timeStr = new Date().toLocaleTimeString();
    setDiagnosticLogs(prev => [`[${timeStr}] Dispatched trigger command. Queueing sub-request...`, ...prev]);

    try {
      if (!profile?.uid) {
        setDiagnosticLogs(prev => [`[${timeStr}] FAIL: No active profile UID found.`, ...prev]);
        setIsSendingCloudTest(false);
        return;
      }

      const activeSubId = profile.oneSignalSubscriptionId || profile.oneSignalId;
      if (!activeSubId) {
        setDiagnosticLogs(prev => [`[${timeStr}] WARNING: No registered device token in your Firestore record. Did you complete registration?`, ...prev]);
      } else {
        setDiagnosticLogs(prev => [`[${timeStr}] Target OneSignal token: "${activeSubId}"`, ...prev]);
      }

      setDiagnosticLogs(prev => [`[${timeStr}] Instantiating Firestore trigger doc under path 'notifications' targeting ${profile.uid}...`, ...prev]);

      const { doc, setDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const testId = doc(collection(db, 'notifications')).id;
      const payload = {
        id: testId,
        receiverId: profile.uid,
        senderId: profile.uid,
        senderName: 'Diagnostic Node',
        type: 'message',
        title: 'FARA FLICK PUSH VERIFICATION',
        body: `Triggered at ${timeStr}. Delivering push payload to OneSignal.`,
        read: false,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'notifications', testId), payload);

      setDiagnosticLogs(prev => [
        `[${timeStr}] SUCCESS: Trigger document written in Firestore db!`,
        `[${timeStr}] Collection: 'notifications'`,
        `[${timeStr}] Cloud Function is executing REST post asynchronously now...`,
        ...prev
      ]);
      
    } catch (err: any) {
      console.warn(err);
      setDiagnosticLogs(prev => [`[${timeStr}] ERROR creating trigger document: ${err.message || String(err)}`, ...prev]);
    } finally {
      setIsSendingCloudTest(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !profile) return;
    const unsubscribe = subscribeToUsers((allUsers) => {
      setSystemUsers(allUsers.filter(u => u.uid !== profile.uid));
    }, (err) => {
      console.warn("Settings user subscription alert:", err);
    });
    return () => unsubscribe();
  }, [isOpen, profile?.uid]);

  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
      setBio(profile.bio || '');
      setNotifSocialFeed(profile.notifSocialFeed !== false);
      setNotifMessagesAll(profile.notifMessagesAll !== false);
      setNotifMessagesFrom(profile.notifMessagesFrom || []);
      setSoundEnabled(profile.soundEnabled !== false);
      setSelectedTheme(getSavedTheme());
      setVibeEnabled(isVibrationEnabled());
      setVibeMessageIntensity(getVibrationIntensity('message'));
      setVibeLikeIntensity(getVibrationIntensity('like'));
      setSendShortcut((localStorage.getItem('flick_send_shortcut') as 'enter' | 'cmd-enter') || 'enter');
      setTypingVisualStyle((localStorage.getItem('flick_typing_style') as 'pulse' | 'stealth' | 'minimal') || 'pulse');
      setSessionCipherTtl((localStorage.getItem('flick_cipher_ttl') as '5m' | '15m' | '1h' | 'infinite') || 'infinite');
    } else if (!isOpen) {
      applyTheme(getSavedTheme());
    }
  }, [isOpen, profile]);

  const toggleAllowedSender = (uid: string) => {
    setNotifMessagesFrom((prev) => {
      if (prev.includes(uid)) {
        return prev.filter(id => id !== uid);
      } else {
        return [...prev, uid];
      }
    });
  };

  if (!profile) return null;

  const generateRandomSeedAvatar = () => {
    playGlitchClickSound();
    const randomSeed = Math.floor(Math.random() * 100000);
    const url = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${randomSeed}`;
    setPhotoURL(url);
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const b64Compressed = await compressImage(file, 400, 400, 0.7);
      setPhotoURL(b64Compressed);
      playLikeSound();
      showBrutalistToast('SUCCESS ✓', 'Profile image processed and updated successfully!', 'success');
    } catch (err: any) {
      setError("Image reading/compression failed. Please select a valid JPEG or PNG file.");
      showBrutalistToast('ERROR ×', 'Failed reading/compressing avatar image.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name cannot be blank.");
      showBrutalistToast('WARNING !', 'Display name cannot be blank.', 'warning');
      return;
    }

    const toastId = 'save-profile';
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      showBrutalistToast('SAVING...', 'Updating decentralized registry profile nodes...', 'loading', undefined, toastId);
      localStorage.setItem('flick_sound_enabled', soundEnabled ? 'true' : 'false');
      localStorage.setItem('flick_send_shortcut', sendShortcut);
      localStorage.setItem('flick_typing_style', typingVisualStyle);
      localStorage.setItem('flick_cipher_ttl', sessionCipherTtl);
      localStorage.setItem('flick_edu_mode', eduModeEnabled ? 'true' : 'false');
      localStorage.setItem('flick_news_style', newsFeedStyle);
      localStorage.setItem('flick_auto_download', autoDownloadOnCellular ? 'true' : 'false');
      localStorage.setItem('flick_cleanup_retention', cacheCleanupRetention);
      localStorage.setItem('flick_chat_lock', chatLockEnabled ? 'true' : 'false');
      localStorage.setItem('flick_chat_lock_pin', chatLockPin);
      
      localStorage.setItem('flick_notif_groups', notifGroups ? 'true' : 'false');
      localStorage.setItem('flick_notif_calls', notifCalls ? 'true' : 'false');
      localStorage.setItem('flick_notif_news', notifNewsAlerts ? 'true' : 'false');
      localStorage.setItem('flick_notif_silent', notifSilentMode ? 'true' : 'false');
      localStorage.setItem('flick_notif_priority', notifPriorityChatsOnly ? 'true' : 'false');

      applyTheme(selectedTheme);
      setVibrationEnabled(vibeEnabled);
      setVibrationIntensity('message', vibeMessageIntensity);
      setVibrationIntensity('like', vibeLikeIntensity);
      if (vibeEnabled) {
        triggerVibration('heavy');
      }
      
      await upsertUserProfile(profile.uid, {
        displayName: displayName.trim(),
        photoURL: photoURL,
        email: profile.email,
        status: profile.status,
        publicKey: profile.publicKey,
        bio: bio.trim() || undefined,
        soundEnabled,
        notifSocialFeed,
        notifMessagesAll,
        notifMessagesFrom
      });

      await reloadProfile();
      setSuccess(true);
      playLikeSound();
      showBrutalistToast('SUCCESS ✓', 'Registry node updated! Profile settings saved.', 'success', undefined, toastId);
      
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);

    } catch (err: any) {
      const errMsg = sanitizeErrorMessage(err);
      setError(errMsg);
      showBrutalistToast('ERROR ×', errMsg, 'error', undefined, toastId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-2xl z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="glass-panel border border-[var(--glass-border)] w-full max-w-4xl relative z-10 shadow-2xl p-6 sm:p-8 rounded-2xl overflow-y-auto max-h-[92vh] text-[var(--color-text)]"
          >
            {/* Headline block */}
            <div className="flex items-center justify-between border-b border-[var(--neon-green)]/35 pb-4 mb-6">
              <div>
                <h2 className="font-serif text-xl font-black uppercase text-[var(--color-text)] flex items-center gap-2">
                  <User className="w-5 h-5 text-[var(--neon-green)]" />
                  FLICK SYSTEM COORDINATES
                </h2>
                <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 mt-1">
                  Configure secure node preferences & cryptographic endpoints
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1 px-3 border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition font-mono text-[9px] uppercase cursor-pointer"
              >
                Close Control Panel
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Dual-Pane Split Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left Panel - Tab Sidebar links switcher */}
                <div className="md:col-span-4 flex flex-col gap-1.5 border-b md:border-b-0 md:border-r border-[var(--neon-green)]/20 pb-4 md:pb-0 md:pr-4">
                  {[
                    { id: 'account', label: 'Account', icon: User },
                    { id: 'privacy', label: 'Privacy', icon: Eye },
                    { id: 'security', label: 'Security', icon: Shield },
                    { id: 'notifications', label: 'Notifications', icon: Bell },
                    { id: 'accessibility', label: 'Appearance', icon: Layout },
                    { id: 'storage', label: 'Storage', icon: HardDrive },
                    { id: 'about', label: 'About', icon: Info },
                  ].map((tab) => {
                    const TabIcon = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          setActiveTab(tab.id as any);
                          triggerVibration('light');
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 text-xs font-mono uppercase tracking-wide text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)] [box-shadow:2px_2px_0px_var(--neon-green)] font-extrabold'
                            : 'border-zinc-900 bg-black text-zinc-400 hover:border-zinc-700 hover:text-[var(--color-text)]'
                        }`}
                      >
                        <TabIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[var(--neon-green)]' : 'text-zinc-500'}`} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Panel - Active Tab Layout workspace */}
                <div className="md:col-span-8 min-h-[365px] bg-[var(--color-surface)]/45 border border-[var(--neon-green-border)] p-4 sm:p-5 text-[var(--color-text)]">
                  <AnimatePresence mode="wait">
                    {activeTab === 'account' && (
                      <motion.div
                        key="tab-panel-account"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsAccountTab
                          displayName={displayName}
                          setDisplayName={setDisplayName}
                          bio={bio}
                          setBio={setBio}
                          photoURL={photoURL}
                          setPhotoURL={setPhotoURL}
                          isUploading={isUploading}
                          handlePictureUpload={handlePictureUpload}
                          onReplayTour={onReplayTour}
                          onClose={onClose}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'privacy' && (
                      <motion.div
                        key="tab-panel-privacy"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsPrivacyTab userId={profile.uid} />
                      </motion.div>
                    )}

                    {activeTab === 'security' && (
                      <motion.div
                        key="tab-panel-security"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsSecurityTab userId={profile.uid} />
                      </motion.div>
                    )}

                    {activeTab === 'storage' && (
                      <motion.div
                        key="tab-panel-storage"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsStoragePurgeTab profile={profile} />
                      </motion.div>
                    )}

                    {activeTab === 'notifications' && (
                      <motion.div
                        key="tab-panel-notifications"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsNotificationsTab
                          soundEnabled={soundEnabled}
                          setSoundEnabled={setSoundEnabled}
                          notifMessagesAll={notifMessagesAll}
                          setNotifMessagesAll={setNotifMessagesAll}
                          notifGroups={notifGroups}
                          setNotifGroups={setNotifGroups}
                          notifCalls={notifCalls}
                          setNotifCalls={setNotifCalls}
                          notifSocialFeed={notifSocialFeed}
                          setNotifSocialFeed={setNotifSocialFeed}
                          notifNewsAlerts={notifNewsAlerts}
                          setNotifNewsAlerts={setNotifNewsAlerts}
                          notifSilentMode={notifSilentMode}
                          setNotifSilentMode={setNotifSilentMode}
                          notifPriorityChatsOnly={notifPriorityChatsOnly}
                          setNotifPriorityChatsOnly={setNotifPriorityChatsOnly}
                          notifMessagesFrom={notifMessagesFrom}
                          systemUsers={systemUsers}
                          toggleAllowedSender={toggleAllowedSender}
                          profile={profile}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'accessibility' && (
                      <motion.div
                        key="tab-panel-accessibility"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsAccessibilityTab
                          selectedTheme={selectedTheme}
                          setSelectedTheme={setSelectedTheme}
                          vibeEnabled={vibeEnabled}
                          setVibeEnabled={setVibeEnabled}
                          vibeMessageIntensity={vibeMessageIntensity}
                          setVibeMessageIntensity={setVibeMessageIntensity}
                          vibeLikeIntensity={vibeLikeIntensity}
                          setVibeLikeIntensity={setVibeLikeIntensity}
                          sendShortcut={sendShortcut}
                          setSendShortcut={setSendShortcut}
                          typingVisualStyle={typingVisualStyle}
                          setTypingVisualStyle={setTypingVisualStyle}
                          sessionCipherTtl={sessionCipherTtl}
                          setSessionCipherTtl={setSessionCipherTtl}
                          chatLockEnabled={chatLockEnabled}
                          setChatLockEnabled={setChatLockEnabled}
                          chatLockPin={chatLockPin}
                          setChatLockPin={setChatLockPin}
                          applyTheme={applyTheme}
                          isTaskMonitorEnabled={isTaskMonitorEnabled}
                          setIsTaskMonitorEnabled={setIsTaskMonitorEnabled}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'about' && (
                      <motion.div
                        key="tab-panel-about"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SettingsAboutTab />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Error notifications */}
              {error && (
                <div className="p-3 bg-red-955/45 border border-red-500/50 text-red-100 text-xs flex items-center gap-1.5 uppercase font-mono leading-tight">
                  <Info className="w-3.5 h-3.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success notifications */}
              {success && (
                <div className="p-3 bg-emerald-955/45 border border-[var(--neon-green)]/50 text-[var(--neon-green)] text-xs flex items-center gap-1.5 uppercase font-mono justify-center font-bold">
                  <Check className="w-4 h-4" />
                  <span>Coordinates Synchronized Successfully</span>
                </div>
              )}

              {/* Save Buttons */}
              <div className="pt-2 border-t border-[var(--neon-green)]/20 flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="bg-[var(--neon-green)] text-black hover:bg-white hover:text-black transition-all px-8 py-3 text-xs font-mono uppercase tracking-widest font-black flex items-center space-x-2.5 cursor-pointer disabled:opacity-[0.4] shadow-[3px_3px_0px_#000000]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <span>Apply Coordinates</span>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
