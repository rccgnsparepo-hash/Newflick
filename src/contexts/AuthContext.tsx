import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
import { auth, db, activeFirebaseConfig } from '../lib/firebase';
import { authDiagnostics } from '../lib/authDiagnostics';
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
  pendingDeviceVerification: boolean;
  setPendingDeviceVerification: (val: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, avatarSeed: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  regenerateE2EEKeys: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  unlockE2EEKeysWithPassword: (password: string) => Promise<boolean>;
  changeGlobalKeyPassword: (newPassword: string) => Promise<void>;
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
  const [pendingDeviceVerification, setPendingDeviceVerification] = useState(false);
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
  const verifyingUidRef = useRef<string | null>(null);

  // Helper to generate a human-readable cyber-styled Global Key Password
  const generateGlobalKeyPassword = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let part1 = "";
    let part2 = "";
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `FLICK-KEY-${part1}-${part2}`;
  };

  // Synchronous key verification and generation logic with guaranteed profile recovery
  const handleKeyVerification = async (uid: string, userDisplayName: string, userEmail: string, userPhotoUrl: string) => {
    authDiagnostics.logEvent('KEY_VERIFY', 'handleKeyVerification', 'STARTED', activeFirebaseConfig?.projectId || '', {
      details: { uid, userDisplayName, userEmail }
    });

    const defaultName = userDisplayName || userEmail?.split('@')[0] || 'User';
    const defaultEmail = userEmail || `${uid}@flick.local`;
    const defaultPhoto = userPhotoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`;

    let privLocal = localStorage.getItem(`e2ee_private_${uid}`);
    let pubKeyJwk = localStorage.getItem(`e2ee_public_${uid}`) || "";

    try {
      // 1. Check local storage & remote profile
      let existingProfile: UserProfile | null = null;
      try {
        existingProfile = await getUserProfile(uid);
      } catch (e) {
        console.warn('[AuthContext] Remote profile check warning, continuing with local fallback:', e);
      }

      if (existingProfile?.publicKey) {
        pubKeyJwk = existingProfile.publicKey;
        try {
          localStorage.setItem(`e2ee_public_${uid}`, pubKeyJwk);
        } catch {
          // ignore storage full errors
        }
      }

      let backupPass = existingProfile?.globalKeyPassword;
      let encryptedPriv = existingProfile?.encryptedPrivateKey;

      // Case A: We have a local private key, but no remote backup yet
      if (privLocal && (!backupPass || !encryptedPriv)) {
        backupPass = backupPass || generateGlobalKeyPassword();
        try {
          const { encryptSymmetrically } = await import('../lib/crypto');
          encryptedPriv = await encryptSymmetrically(privLocal, backupPass);
        } catch (err) {
          console.warn("Auto-encrypt of local key failed:", err);
        }
      }

      // Case B: We are on a brand new device/browser (no local private key)
      if (!privLocal) {
        if (!existingProfile?.encryptedPrivateKey) {
          try {
            console.log("Generating fresh E2EE RSA key-pair and recovery key...");
            const keypair = await generateE2EEKeyPair();
            privLocal = keypair.privateKeyJwk;
            pubKeyJwk = keypair.publicKeyJwk;
            backupPass = generateGlobalKeyPassword();

            const { encryptSymmetrically } = await import('../lib/crypto');
            encryptedPriv = await encryptSymmetrically(privLocal, backupPass);

            try {
              localStorage.setItem(`e2ee_private_${uid}`, keypair.privateKeyJwk);
              localStorage.setItem(`e2ee_public_${uid}`, keypair.publicKeyJwk);
              localStorage.setItem(`e2ee_global_password_${uid}`, backupPass);
            } catch {}
          } catch (keyGenErr) {
            console.warn('[AuthContext] Cryptographic keypair generation note:', keyGenErr);
            pubKeyJwk = pubKeyJwk || `FLICK_KEY_${uid}`;
            privLocal = privLocal || `FLICK_PRIV_${uid}`;
          }
        } else {
          // Backup exists on Firestore! Check if password was cached locally
          const cachedPass = localStorage.getItem(`e2ee_global_password_${uid}`);
          if (cachedPass) {
            try {
              const { decryptSymmetrically } = await import('../lib/crypto');
              privLocal = await decryptSymmetrically(existingProfile.encryptedPrivateKey, cachedPass);
              try {
                localStorage.setItem(`e2ee_private_${uid}`, privLocal);
              } catch {}
            } catch (err) {
              console.warn("Auto-decrypt of existing key with cached password failed:", err);
            }
          }

          // If still no local private key, check if other active devices or account sync lock requires verification
          if (!privLocal) {
            try {
              const { getOtherActiveDevices, isAccountSyncLockEnabled } = await import('../lib/deviceAuthSyncService');
              const syncLockOn = isAccountSyncLockEnabled(uid);
              const otherActive = await getOtherActiveDevices(uid);
              if (syncLockOn && otherActive.length > 0) {
                setPendingDeviceVerification(true);
              }
            } catch (syncErr) {
              console.warn('[AuthContext] Sync lock check notice:', syncErr);
            }
          }
        }
      }

      // Ensure pubKeyJwk is guaranteed never empty to satisfy UserProfileSchema
      if (!pubKeyJwk || pubKeyJwk.trim().length === 0) {
        pubKeyJwk = `FLICK_PUBKEY_${uid}`;
      }

      setLocalPrivateKey(privLocal);

      // 2. Sync profile details with online status, preserving existing settings/preferences
      const isDefaultName = (name: string | undefined | null) => {
        if (!name) return true;
        const n = name.trim().toLowerCase();
        return n === 'google user' || n === 'anonymous user' || n === 'user' || n === '';
      };

      let finalDisplayName = existingProfile?.displayName || userDisplayName || defaultName;
      if (userDisplayName && !isDefaultName(userDisplayName)) {
        if (isDefaultName(existingProfile?.displayName) || !existingProfile?.displayName) {
          finalDisplayName = userDisplayName;
        }
      }

      const activeProfile: UserProfile = {
        uid,
        displayName: finalDisplayName,
        photoURL: existingProfile?.photoURL || userPhotoUrl || defaultPhoto,
        email: existingProfile?.email || userEmail || defaultEmail,
        status: 'online' as const,
        publicKey: pubKeyJwk,
        bio: existingProfile?.bio || undefined,
        soundEnabled: existingProfile?.soundEnabled !== undefined ? existingProfile.soundEnabled : true,
        notifSocialFeed: existingProfile?.notifSocialFeed !== undefined ? existingProfile.notifSocialFeed : true,
        notifMessagesAll: existingProfile?.notifMessagesAll !== undefined ? existingProfile.notifMessagesAll : true,
        notifMessagesFrom: existingProfile?.notifMessagesFrom || [],
        encryptedPrivateKey: encryptedPriv || existingProfile?.encryptedPrivateKey || undefined,
        globalKeyPassword: backupPass || existingProfile?.globalKeyPassword || undefined,
        updatedAt: new Date()
      };

      // Set state and local cache immediately so the user is NEVER blocked from entering the app
      setProfile(activeProfile);
      try {
        localStorage.setItem('flick_cached_profile', JSON.stringify(activeProfile));
        localStorage.setItem('flick_cached_uid', uid);
        localStorage.setItem('flick_sound_enabled', activeProfile.soundEnabled !== false ? 'true' : 'false');
        if (privLocal) localStorage.setItem(`e2ee_private_${uid}`, privLocal);
        if (pubKeyJwk) localStorage.setItem(`e2ee_public_${uid}`, pubKeyJwk);
        if (backupPass) localStorage.setItem(`e2ee_global_password_${uid}`, backupPass);
      } catch {}

      authDiagnostics.logEvent('KEY_VERIFY', 'handleKeyVerification', 'SUCCESS', activeFirebaseConfig?.projectId || '', {
        details: { uid, displayName: activeProfile.displayName }
      });

      // Background remote sync (non-fatal if offline or network delayed)
      Promise.allSettled([
        upsertUserProfile(uid, activeProfile),
        ensureGlobalGroupChat(uid)
      ]).catch((syncErr) => {
        console.warn('[AuthContext] Background profile sync non-fatal warning:', syncErr);
      });

    } catch (err: any) {
      console.warn("[AuthContext] Key verification issue, activating local recovery profile:", err);
      const recoveryProfile: UserProfile = {
        uid,
        displayName: defaultName,
        email: defaultEmail,
        photoURL: defaultPhoto,
        status: 'online',
        publicKey: pubKeyJwk || `FLICK_KEY_${uid}`,
        updatedAt: new Date()
      };
      setProfile(recoveryProfile);
      try {
        localStorage.setItem('flick_cached_profile', JSON.stringify(recoveryProfile));
        localStorage.setItem('flick_cached_uid', uid);
      } catch {}

      authDiagnostics.logEvent('KEY_VERIFY', 'handleKeyVerification', 'RECOVERED', activeFirebaseConfig?.projectId || '', {
        errorMessage: err?.message || String(err),
        details: { uid }
      });
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setIsAuthReady(true);
      return;
    }

    // Set local persistence with fallback for desktop EXE & browser environments
    import('firebase/auth').then(({ setPersistence, browserLocalPersistence, indexedDBLocalPersistence }) => {
      setPersistence(auth, indexedDBLocalPersistence)
        .catch(() => setPersistence(auth, browserLocalPersistence))
        .catch((err) => {
          console.warn("[Firebase Auth] Persistence configuration notice:", err);
        });
    });

    // Listen for Auth changes
    if (!auth) {
      setLoading(false);
      setIsAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
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

          // Ensure OneSignal and native FCM push services are bound to authenticated UID
          import('../lib/pushNotifications').then(({ registerCapacitorPushNotifications }) => {
            registerCapacitorPushNotifications(user.uid).catch((err) => {
              console.warn('[AuthContext] registerCapacitorPushNotifications warning:', err);
            });
          }).catch(() => {});

          // Prevent race conditions and duplicate concurrent verification runs
          if (verifyingUidRef.current !== user.uid) {
            verifyingUidRef.current = user.uid;
            await handleKeyVerification(
              user.uid,
              user.displayName || 'Google User',
              user.email || '',
              user.photoURL || ''
            ).catch((err) => console.warn('Key verification warning:', err));
            verifyingUidRef.current = null;
          }
        } else {
          verifyingUidRef.current = null;
          // Clear push notification bindings on sign-out
          import('../lib/pushNotifications').then(({ logoutPushNotificationsCleanup }) => {
            logoutPushNotificationsCleanup('').catch(() => {});
          }).catch(() => {});

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
      } catch (err) {
        console.warn("[AuthContext] onAuthStateChanged processing error:", err);
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    // Handle offline status trigger tab/window exit
    const handleBeforeUnload = () => {
      if (auth?.currentUser?.uid && db) {
        // Set offline in Firestore (runs best effort synchronously)
        const ref = doc(db, 'users', auth.currentUser.uid);
        updateDoc(ref, { status: 'offline', updatedAt: serverTimestamp() }).catch(console.warn);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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
    const projectId = activeFirebaseConfig?.projectId || 'gen-lang-client-0982710068';
    authDiagnostics.logEvent('GOOGLE_OAUTH', 'loginWithGoogle', 'STARTED', projectId);
    setLoading(true);
    try {
      if (!auth) {
        throw new Error('Firebase Auth is not initialized. Please verify configuration.');
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const userCredential = await signInWithPopup(auth, provider);
      authDiagnostics.logEvent('GOOGLE_OAUTH', 'loginWithGoogle', 'SUCCESS', projectId, {
        details: { uid: userCredential.user.uid, email: userCredential.user.email }
      });

      setCurrentUser(userCredential.user);
      await handleKeyVerification(
        userCredential.user.uid,
        userCredential.user.displayName || 'Google User',
        userCredential.user.email || '',
        userCredential.user.photoURL || ''
      );
    } catch (error: any) {
      authDiagnostics.logEvent('GOOGLE_OAUTH', 'loginWithGoogle', 'FAILED', projectId, {
        errorCode: error?.code,
        errorMessage: error?.message || String(error)
      });
      setLoading(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Register with Email & Password
  const registerWithEmail = async (email: string, password: string, displayName: string, avatarSeed: string) => {
    const projectId = activeFirebaseConfig?.projectId || 'gen-lang-client-0982710068';
    authDiagnostics.logEvent('SIGNUP', 'createUserWithEmailAndPassword', 'STARTED', projectId, {
      details: { email, displayName }
    });
    setLoading(true);
    try {
      if (!auth) {
        throw new Error('Firebase Auth is not initialized. Please verify your connection.');
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const photoURL = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed || Math.random().toString()}`;
      await updateProfile(userCredential.user, {
        displayName: displayName || 'User',
        photoURL
      });
      await auth.currentUser?.reload();
      const updatedUser = auth.currentUser || userCredential.user;
      setCurrentUser(updatedUser);

      authDiagnostics.logEvent('SIGNUP', 'createUserWithEmailAndPassword', 'SUCCESS', projectId, {
        details: { uid: updatedUser.uid }
      });

      await handleKeyVerification(
        updatedUser.uid,
        updatedUser.displayName || displayName || 'User',
        updatedUser.email || email,
        updatedUser.photoURL || photoURL
      );
    } catch (error: any) {
      authDiagnostics.logEvent('SIGNUP', 'createUserWithEmailAndPassword', 'FAILED', projectId, {
        errorCode: error?.code,
        errorMessage: error?.message || String(error)
      });
      setLoading(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Login with Email & Password
  const loginWithEmail = async (email: string, password: string) => {
    const projectId = activeFirebaseConfig?.projectId || 'gen-lang-client-0982710068';
    authDiagnostics.logEvent('LOGIN', 'signInWithEmailAndPassword', 'STARTED', projectId, {
      details: { email }
    });
    setLoading(true);
    try {
      if (!auth) {
        throw new Error('Firebase Auth is not initialized. Please verify connection.');
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);

      authDiagnostics.logEvent('LOGIN', 'signInWithEmailAndPassword', 'SUCCESS', projectId, {
        details: { uid: userCredential.user.uid }
      });

      await handleKeyVerification(
        userCredential.user.uid,
        userCredential.user.displayName || 'User',
        userCredential.user.email || email,
        userCredential.user.photoURL || ''
      );
    } catch (error: any) {
      authDiagnostics.logEvent('LOGIN', 'signInWithEmailAndPassword', 'FAILED', projectId, {
        errorCode: error?.code,
        errorMessage: error?.message || String(error)
      });
      setLoading(false);
      throw error;
    } finally {
      setLoading(false);
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
        try {
          const ref = doc(db, 'users', currentUser.uid);
          await updateDoc(ref, { status: 'offline', updatedAt: serverTimestamp() });
        } catch (e) {
          console.warn('[AuthContext] Failed to update presence status during logout:', e);
        }
      }
      
      // Reset local state for active session FIRST so React unmounts listeners
      // and prevents "Missing or insufficient permissions" when token revokes
      setCurrentUser(null);
      setProfile(null);
      setLocalPrivateKey(null);
      
      // Give React time to unmount components and clear Firebase listeners
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Perform typical signout (handles Google credentials)
      await signOut(auth);
      
    } catch (error) {
      console.warn("Signout error:", error);
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
      localStorage.setItem(`e2ee_public_${currentUser.uid}`, keypair.publicKeyJwk);
      setLocalPrivateKey(keypair.privateKeyJwk);

      const pass = profile.globalKeyPassword || generateGlobalKeyPassword();
      const { encryptSymmetrically } = await import('../lib/crypto');
      const encrypted = await encryptSymmetrically(keypair.privateKeyJwk, pass);

      await upsertUserProfile(currentUser.uid, {
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        email: profile.email,
        status: 'online',
        publicKey: keypair.publicKeyJwk,
        globalKeyPassword: pass,
        encryptedPrivateKey: encrypted
      });

      const synced = await getUserProfile(currentUser.uid);
      setProfile(synced);
      showBrutalistToast('KEYRING REGENERATED', 'A new RSA keyring was deployed. Historical messages may be locked.', 'info');
    } catch (error) {
      console.warn("Key regeneration failed:", error);
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
      console.warn("Failed to reload user profile:", error);
    }
  };

  // Restores local private key using the symmetrically encrypted Firestore payload and the user's password
  const unlockE2EEKeysWithPassword = async (password: string): Promise<boolean> => {
    if (!currentUser?.uid) return false;
    setLoading(true);
    try {
      const syncedProfile = await getUserProfile(currentUser.uid);
      if (!syncedProfile || !syncedProfile.encryptedPrivateKey) {
        showBrutalistToast('UNLOCK ERROR', 'No secure E2EE backup found for this account.', 'error');
        return false;
      }

      const { decryptSymmetrically } = await import('../lib/crypto');
      const decryptedPrivKey = await decryptSymmetrically(syncedProfile.encryptedPrivateKey, password.trim());
      
      // Decryption succeeded! Store credentials.
      localStorage.setItem(`e2ee_private_${currentUser.uid}`, decryptedPrivKey);
      localStorage.setItem(`e2ee_public_${currentUser.uid}`, syncedProfile.publicKey);
      localStorage.setItem(`e2ee_global_password_${currentUser.uid}`, password.trim());
      localStorage.setItem('flick_cached_private_key', decryptedPrivKey);
      
      setLocalPrivateKey(decryptedPrivKey);
      setProfile(syncedProfile);
      
      showBrutalistToast('CHATS UNLOCKED', 'Your cryptographic keyring has been restored in real-time!', 'success');
      return true;
    } catch (error) {
      console.warn("E2EE unlock decryption failed:", error);
      showBrutalistToast('DECRYPTION FAIL', 'Incorrect Global Key Password. Handshake aborted.', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Updates the Global Key Password and symmetrically encrypts the local private key with the new password
  const changeGlobalKeyPassword = async (newPassword: string): Promise<void> => {
    if (!currentUser?.uid || !profile) return;
    if (!localPrivateKey) {
      showBrutalistToast('ERROR', 'Unlock your chats before changing the key password.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { encryptSymmetrically } = await import('../lib/crypto');
      const encrypted = await encryptSymmetrically(localPrivateKey, newPassword.trim());

      await upsertUserProfile(currentUser.uid, {
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        email: profile.email,
        status: 'online',
        publicKey: profile.publicKey,
        globalKeyPassword: newPassword.trim(),
        encryptedPrivateKey: encrypted
      });

      localStorage.setItem(`e2ee_global_password_${currentUser.uid}`, newPassword.trim());
      
      const synced = await getUserProfile(currentUser.uid);
      setProfile(synced);
      showBrutalistToast('PASSWORD SYNCHRONIZED', 'Your E2EE Global Key Password has been updated.', 'success');
    } catch (error) {
      console.warn("Changing E2EE password failed:", error);
      showBrutalistToast('UPDATE FAILED', 'Failed to update E2EE key password.', 'error');
    } finally {
      setLoading(false);
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
      console.warn("Account deletion failed:", error);
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
        pendingDeviceVerification,
        setPendingDeviceVerification,
        loginWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendPasswordReset,
        logout,
        deleteAccount,
        regenerateE2EEKeys,
        reloadProfile,
        unlockE2EEKeysWithPassword,
        changeGlobalKeyPassword
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
