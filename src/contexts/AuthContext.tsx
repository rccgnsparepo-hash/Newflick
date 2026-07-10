import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { generateE2EEKeyPair } from '../lib/crypto';
import { upsertUserProfile, getUserProfile, ensureGlobalGroupChat } from '../lib/services';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { trackUserPresence } from '../lib/rtdbService';
import { showBrutalistToast } from '../lib/toast';

interface AuthContextType {
  currentUser: any | null; // Firebase User
  profile: UserProfile | null; // Firestore Profile
  localPrivateKey: string | null; // RSA private key string stored client side
  loading: boolean;
  isAuthReady: boolean; // Tracks whether initial auth check is finished
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, avatarSeed: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  regenerateE2EEKeys: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const cached = localStorage.getItem('flick_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('flick_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [localPrivateKey, setLocalPrivateKey] = useState<string | null>(() => {
    try {
      const cachedUid = localStorage.getItem('flick_cached_uid');
      if (cachedUid) {
        return localStorage.getItem(`e2ee_private_${cachedUid}`) || localStorage.getItem('flick_cached_private_key');
      }
      return localStorage.getItem('flick_cached_private_key');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cachedUser = localStorage.getItem('flick_cached_user');
      const cachedProfile = localStorage.getItem('flick_cached_profile');
      if (cachedUser && cachedProfile) {
        return false; // Instant session recovery!
      }
    } catch {}
    return true;
  });
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Synchronous key verification and generation logic
  const handleKeyVerification = async (uid: string, userDisplayName: string, userEmail: string, userPhotoUrl: string) => {
    try {
      // 1. Check local storage for private and public keys
      let privLocal = localStorage.getItem(`e2ee_private_${uid}`);
      let pubKeyJwk = localStorage.getItem(`e2ee_public_${uid}`) || "";

      const existingProfile = await getUserProfile(uid);

      if (existingProfile?.publicKey) {
        pubKeyJwk = existingProfile.publicKey;
        try {
          localStorage.setItem(`e2ee_public_${uid}`, pubKeyJwk);
        } catch {
          // ignore storage full errors
        }
      }

      if (!privLocal || !pubKeyJwk) {
        console.log("Generating fresh E2EE RSA key-pair...");
        const keypair = await generateE2EEKeyPair();
        
        privLocal = keypair.privateKeyJwk;
        pubKeyJwk = keypair.publicKeyJwk;
        try {
          localStorage.setItem(`e2ee_private_${uid}`, keypair.privateKeyJwk);
          localStorage.setItem(`e2ee_public_${uid}`, keypair.publicKeyJwk);
        } catch {
          // ignore storage full errors
        }
      }

      setLocalPrivateKey(privLocal);

      // 2. Sync profile details with online status, preserving existing settings/preferences
      const isDefaultName = (name: string | undefined | null) => {
        if (!name) return true;
        const n = name.trim().toLowerCase();
        return n === 'google user' || n === 'anonymous user' || n === 'user' || n === '';
      };

      let finalDisplayName = existingProfile?.displayName || userDisplayName || 'Anonymous User';
      if (userDisplayName && !isDefaultName(userDisplayName)) {
        // If the new passed name is a real specific name, set it
        if (isDefaultName(existingProfile?.displayName) || !existingProfile?.displayName) {
          finalDisplayName = userDisplayName;
        }
      }

      const updatedProfile = {
        displayName: finalDisplayName,
        photoURL: existingProfile?.photoURL || userPhotoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`,
        email: existingProfile?.email || userEmail || `${uid}@flick.local`,
        status: 'online' as const,
        publicKey: pubKeyJwk,
        bio: existingProfile?.bio || undefined,
        soundEnabled: existingProfile?.soundEnabled !== undefined ? existingProfile.soundEnabled : true,
        notifSocialFeed: existingProfile?.notifSocialFeed !== undefined ? existingProfile.notifSocialFeed : true,
        notifMessagesAll: existingProfile?.notifMessagesAll !== undefined ? existingProfile.notifMessagesAll : true,
        notifMessagesFrom: existingProfile?.notifMessagesFrom || []
      };

      await upsertUserProfile(uid, updatedProfile);
      await ensureGlobalGroupChat(uid);

      // Retrieve full synced profile
      const synched = await getUserProfile(uid);
      if (synched) {
        localStorage.setItem('flick_sound_enabled', synched.soundEnabled !== false ? 'true' : 'false');
        try {
          localStorage.setItem('flick_cached_profile', JSON.stringify(synched));
          localStorage.setItem('flick_cached_private_key', privLocal || '');
        } catch {}
        setProfile(synched);
      } else {
        const localFallback = {
          uid,
          ...updatedProfile,
          updatedAt: new Date()
        } as UserProfile;
        try {
          localStorage.setItem('flick_cached_profile', JSON.stringify(localFallback));
          localStorage.setItem('flick_cached_private_key', privLocal || '');
        } catch {}
        // Fallback to our compiled local version
        setProfile(localFallback);
      }
    } catch (err) {
      console.error("Failed to verify/generate cryptographic keypair:", err);
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Explicitly set browserLocalPersistence to guarantee session persistence across exits/locks
    import('firebase/auth').then(({ setPersistence, browserLocalPersistence }) => {
      setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn("[Firebase Auth] Failed to enforce local persistence:", err);
      });
    });

    // Listen for Auth changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const hasCache = !!localStorage.getItem('flick_cached_user') && !!localStorage.getItem('flick_cached_profile');
      if (!hasCache) {
        setLoading(true);
      }

      if (user) {
        const simplifiedUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        try {
          localStorage.setItem('flick_cached_user', JSON.stringify(simplifiedUser));
          localStorage.setItem('flick_cached_uid', user.uid);
        } catch {}

        setCurrentUser(user);
        await handleKeyVerification(
          user.uid,
          user.displayName || 'Google User',
          user.email || '',
          user.photoURL || ''
        );
      } else {
        // Clear cache if session is explicitly cleared / logged out
        try {
          localStorage.removeItem('flick_cached_user');
          localStorage.removeItem('flick_cached_profile');
          localStorage.removeItem('flick_cached_private_key');
          localStorage.removeItem('flick_cached_uid');
        } catch {}
        setCurrentUser(null);
        setProfile(null);
        setLocalPrivateKey(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    // Handle offline status trigger tab/window exit
    const handleBeforeUnload = () => {
      if (currentUser?.uid && db) {
        // Set offline in Firestore (runs best effort synchronously)
        const ref = doc(db, 'users', currentUser.uid);
        updateDoc(ref, { status: 'offline', updatedAt: serverTimestamp() }).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.uid]);

  // Sync Realtime Database presence
  useEffect(() => {
    if (!profile) return;
    const cleanupPresence = trackUserPresence(
      profile.uid,
      profile.displayName,
      profile.photoURL,
      profile.email,
      (isOnline) => {
        // Option to log or manage connection state
      }
    );
    return () => {
      cleanupPresence();
    };
  }, [profile?.uid]);

  // Real-time Firestore presence heartbeat
  useEffect(() => {
    if (!profile?.uid || !db) return;

    // Send initial heartbeat immediately
    const sendHeartbeat = async () => {
      try {
        const ref = doc(db, 'users', profile.uid);
        await updateDoc(ref, {
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp() // triggers real-time stream subscription update listeners
        });
      } catch (err) {
        console.warn("Heartbeat update failed:", err);
      }
    };

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [profile?.uid]);

  // Google Sign-In Action
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Force Google account chooser popup
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google authentication failed:", error);
      setLoading(false);
      throw error;
    }
  };

  // Register with Email & Password
  const registerWithEmail = async (email: string, password: string, displayName: string, avatarSeed: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const photoURL = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed || Math.random().toString()}`;
      await updateProfile(userCredential.user, {
        displayName: displayName || 'User',
        photoURL
      });
      // Force reload user to sync auth state fields
      await auth.currentUser?.reload();
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        setCurrentUser(updatedUser);
        await handleKeyVerification(
          updatedUser.uid,
          updatedUser.displayName || displayName || 'User',
          updatedUser.email || email,
          updatedUser.photoURL || photoURL
        );
      }
    } catch (error) {
      console.error("Email registration failed:", error);
      setLoading(false);
      throw error;
    }
  };

  // Login with Email & Password
  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
      await handleKeyVerification(
        userCredential.user.uid,
        userCredential.user.displayName || 'User',
        userCredential.user.email || email,
        userCredential.user.photoURL || ''
      );
    } catch (error) {
      console.error("Email login failed:", error);
      setLoading(false);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    setLoading(true);
    try {
      if (currentUser?.uid) {
        // Run push notifications logout cleanup
        try {
          const { logoutPushNotificationsCleanup } = await import('../lib/pushNotifications');
          await logoutPushNotificationsCleanup(currentUser.uid);
        } catch (e) {
          console.warn('[AuthContext] Failed to run push notifications logout cleanup:', e);
        }

        // Explicitly set presence offline
        const ref = doc(db, 'users', currentUser.uid);
        await updateDoc(ref, { status: 'offline', updatedAt: serverTimestamp() });
      }
      
      // Perform typical signout (handles Google credentials)
      await signOut(auth);
      
      // Reset local state for active session
      setCurrentUser(null);
      setProfile(null);
      setLocalPrivateKey(null);
    } catch (error) {
      console.error("Signout error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Force reset / regenerate cryptographic keys (e.g. if cleared from device)
  const regenerateE2EEKeys = async () => {
    if (!currentUser?.uid || !profile) return;
    setLoading(true);
    try {
      const keypair = await generateE2EEKeyPair();
      localStorage.setItem(`e2ee_private_${currentUser.uid}`, keypair.privateKeyJwk);
      setLocalPrivateKey(keypair.privateKeyJwk);

      await upsertUserProfile(currentUser.uid, {
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        email: profile.email,
        status: 'online',
        publicKey: keypair.publicKeyJwk
      });

      const synced = await getUserProfile(currentUser.uid);
      setProfile(synced);
    } catch (error) {
      console.error("Key regeneration failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const reloadProfile = async () => {
    if (!currentUser?.uid) return;
    try {
      const synced = await getUserProfile(currentUser.uid);
      setProfile(synced);
    } catch (error) {
      console.error("Failed to reload user profile:", error);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const deleteAccount = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const uid = currentUser.uid;
      // 1. Run push notifications cleanup if any
      try {
        const { logoutPushNotificationsCleanup } = await import('../lib/pushNotifications');
        await logoutPushNotificationsCleanup(uid);
      } catch (e) {
        console.warn('Push cleanup failed', e);
      }

      // 2. Mark as deleted/offline in Firestore and update displayName to indicate node deregistration
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        isDeleted: true,
        status: 'offline',
        displayName: '[DEREGISTERED NODE]',
        updatedAt: serverTimestamp()
      });

      // Clean up localStorage keys
      localStorage.removeItem(`e2ee_private_${uid}`);

      // 3. Delete from Firebase Auth if current user is active
      const user = auth.currentUser;
      if (user) {
        await deleteUser(user);
      }

      // 4. Sign out
      await signOut(auth);

      setCurrentUser(null);
      setProfile(null);
      setLocalPrivateKey(null);
      showBrutalistToast('NODE DEREGISTERED', 'Your terminal node has been wiped from the Flick network.', 'success');
    } catch (error: any) {
      console.error("Account deletion failed:", error);
      if (error?.code === 'auth/requires-recent-login') {
        showBrutalistToast('SECURITY ALERT', 'For security, please sign out and sign back in before de-registering your node.', 'error');
      } else {
        showBrutalistToast('DEREGISTRATION FAIL', error?.message || 'Failed to wipe node.', 'error');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        localPrivateKey,
        loading,
        isAuthReady,
        loginWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendPasswordReset,
        logout,
        deleteAccount,
        regenerateE2EEKeys,
        reloadProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be wrapped inside an AuthProvider');
  }
  return context;
}
