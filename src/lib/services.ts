import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { UserProfile, Post, DirectChat, ChatMessage, InAppNotification, MessageReaction, Story, CallLogItem } from '../types';
import {
  UserProfileSchema,
  PostSchema,
  DirectChatSchema,
  ChatMessageSchema,
  InAppNotificationSchema,
  MessageReactionSchema,
  StorySchema
} from './schemas';
import { encryptE2EEMessage } from './crypto';

// --- User Profile Services ---

export async function upsertUserProfile(uid: string, profileData: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  const rawData: any = {
    uid,
    ...profileData,
    updatedAt: serverTimestamp()
  };
  
  // Remove undefined fields to prevent Firestore serialization crash
  Object.keys(rawData).forEach(key => {
    if (rawData[key] === undefined) {
      delete rawData[key];
    }
  });
  
  // Validate with Zod
  UserProfileSchema.parse(rawData);

  // Maintain modern local backup first
  try {
    localStorage.setItem(`faraflick_profile_backup_${uid}`, JSON.stringify({
      ...rawData,
      updatedAt: new Date().toISOString() // static format for offline reading
    }));
  } catch (err) {
    console.warn('[Offline Backup] Failed backing up profile locally:', err);
  }

  try {
    await setDoc(doc(db, 'users', uid), rawData, { merge: true });
  } catch (error: any) {
    const isOffline = error?.message?.toLowerCase().includes('offline') || 
                      error?.code === 'unavailable' || 
                      !navigator.onLine;
    if (isOffline) {
      console.warn('[Firestore Offline] Skipping blocking server write of user profile since client is offline.');
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const profileData = snap.data() as UserProfile;
    
    // Store backup local copy
    try {
      localStorage.setItem(`faraflick_profile_backup_${uid}`, JSON.stringify(profileData));
    } catch {
      // ignore helper caching errors
    }
    
    return profileData;
  } catch (error: any) {
    const isOffline = error?.message?.toLowerCase().includes('offline') || 
                      error?.code === 'unavailable' || 
                      !navigator.onLine;
    if (isOffline) {
      console.warn(`[Firestore Offline] Falling back to emergency local backup for user profile: ${uid}`);
      const backup = localStorage.getItem(`faraflick_profile_backup_${uid}`);
      if (backup) {
        try {
          return JSON.parse(backup) as UserProfile;
        } catch {
          // ignore parsing error
        }
      }
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data() as UserProfile)
      .filter(u => u && !u.isDeleted && u.displayName !== '[DEREGISTERED NODE]');
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Subscribe to other users' online/offline triggers safely in real-time
export function subscribeToUsers(callback: (users: UserProfile[]) => void, onError?: (err: any) => void) {
  const path = 'users';
  const q = query(collection(db, 'users'), limit(150));
  return onSnapshot(q, (snap) => {
    const users = snap.docs
      .map(doc => doc.data() as UserProfile)
      .filter(u => u && !u.isDeleted && u.displayName !== '[DEREGISTERED NODE]');
    // Sort in memory by displayName or fallback properties safely
    users.sort((a, b) => {
      const nameA = a.displayName || a.email || '';
      const nameB = b.displayName || b.email || '';
      return nameA.localeCompare(nameB);
    });
    callback(users);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (parsedErr) {
      if (onError) {
        onError(parsedErr);
      } else {
        console.warn("Users list stream error:", parsedErr);
      }
    }
  });
}

// --- Realtime Followers & Network Connections Services ---

export async function followUser(
  currentUserId: string,
  targetUserId: string,
  currentUserName?: string
): Promise<void> {
  if (currentUserId === targetUserId) return;
  try {
    const batch = writeBatch(db);
    
    // Add target to current user's following list
    const currentUserRef = doc(db, 'users', currentUserId);
    batch.update(currentUserRef, {
      following: arrayUnion(targetUserId),
      followingCount: increment(1)
    });

    // Add current user to target's followers list
    const targetUserRef = doc(db, 'users', targetUserId);
    batch.update(targetUserRef, {
      followers: arrayUnion(currentUserId),
      followersCount: increment(1)
    });

    // Send realtime notification
    const notificationId = doc(collection(db, 'notifications')).id;
    const notificationRef = doc(db, 'notifications', notificationId);
    batch.set(notificationRef, {
      id: notificationId,
      receiverId: targetUserId,
      senderId: currentUserId,
      senderName: currentUserName || 'Operator',
      type: 'like',
      title: `⚡ New Flicker Node Connection`,
      body: `@${currentUserName || 'Operator'} is now following your node`,
      read: false,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${targetUserId}`);
  }
}

export async function unfollowUser(
  currentUserId: string,
  targetUserId: string
): Promise<void> {
  if (currentUserId === targetUserId) return;
  try {
    const batch = writeBatch(db);

    const currentUserRef = doc(db, 'users', currentUserId);
    batch.update(currentUserRef, {
      following: arrayRemove(targetUserId),
      followingCount: increment(-1)
    });

    const targetUserRef = doc(db, 'users', targetUserId);
    batch.update(targetUserRef, {
      followers: arrayRemove(currentUserId),
      followersCount: increment(-1)
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${targetUserId}`);
  }
}

export function subscribeToUserFollowers(
  userId: string,
  callback: (data: { followers: string[]; following: string[]; followersCount: number; followingCount: number }) => void
) {
  const path = `users/${userId}`;
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        followers: Array.isArray(data.followers) ? data.followers : [],
        following: Array.isArray(data.following) ? data.following : [],
        followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (Array.isArray(data.followers) ? data.followers.length : 0),
        followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (Array.isArray(data.following) ? data.following.length : 0)
      });
    }
  }, (err) => {
    console.warn("Followers stream error:", err);
  });
}

// --- Feed Post Services ---

export async function createPost(postData: {
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'none';
}): Promise<void> {
  const postId = doc(collection(db, 'posts')).id;
  const path = `posts/${postId}`;
  try {
    const rawData: any = {
      id: postId,
      authorId: postData.authorId,
      authorName: postData.authorName,
      authorPhoto: postData.authorPhoto,
      content: postData.content,
      likesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (postData.imageUrl !== undefined) rawData.imageUrl = postData.imageUrl;
    if (postData.videoUrl !== undefined) rawData.videoUrl = postData.videoUrl;
    if (postData.audioUrl !== undefined) rawData.audioUrl = postData.audioUrl;
    if (postData.mediaType !== undefined) rawData.mediaType = postData.mediaType;

    PostSchema.parse(rawData);

    await setDoc(doc(db, 'posts', postId), rawData);

    // Trigger Notification to other registered users of this new post
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const notifyPromises = usersSnap.docs
        .filter(d => d.id !== postData.authorId)
        .map(async (d) => {
          const receiverId = d.id;
          const notificationId = doc(collection(db, 'notifications')).id;
          const payload = {
            id: notificationId,
            receiverId,
            senderName: postData.authorName,
            senderId: postData.authorId,
            type: 'like', // Validate against existing security rules enum
            title: `New Chronicle by ${postData.authorName}`,
            body: `"${postData.content.slice(0, 40)}${postData.content.length > 40 ? '...' : ''}"`,
            read: false,
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, 'notifications', notificationId), payload);
        });
      await Promise.all(notifyPromises);
    } catch (e) {
      console.warn("Failed to dispatch post notifications:", e);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePost(
  postId: string,
  authorId: string,
  content: string,
  imageUrl?: string,
  videoUrl?: string,
  audioUrl?: string,
  mediaType?: 'image' | 'video' | 'audio' | 'none'
): Promise<void> {
  const path = `posts/${postId}`;
  try {
    const postRef = doc(db, 'posts', postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) throw new Error("Post does not exist.");
    const existing = snap.data() as Post;
    
    if (existing.authorId !== authorId) {
      throw new Error("Unauthorized modifier. You do not own this post.");
    }

    const payload: any = {
      content,
      updatedAt: serverTimestamp()
    };

    if (imageUrl !== undefined) payload.imageUrl = imageUrl;
    if (videoUrl !== undefined) payload.videoUrl = videoUrl;
    if (audioUrl !== undefined) payload.audioUrl = audioUrl;
    if (mediaType !== undefined) payload.mediaType = mediaType;

    await updateDoc(postRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePost(postId: string, authorId: string): Promise<void> {
  const path = `posts/${postId}`;
  try {
    const postRef = doc(db, 'posts', postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) return;
    const existing = snap.data() as Post;
    if (existing.authorId !== authorId) {
      throw new Error("Unauthorized delete. You do not own this post.");
    }
    await deleteDoc(postRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleLikePost(postId: string, userId: string): Promise<void> {
  const path = `posts/${postId}`;
  try {
    // Elegant Multi-record Atomic Transaction matching Pillar 7
    await runTransaction(db, async (transaction) => {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) throw new Error("Post does not exist");
      
      const likesRef = doc(db, 'posts', postId, 'likes', userId);
      const likesSnap = await transaction.get(likesRef);

      const postData = postSnap.data() as Post;
      if (postData.authorId === userId) {
        throw new Error("sorry u cant like ur own post it dosent count");
      }
      let newLikesCount = postData.likesCount;

      const userRef = doc(db, 'users', userId);
      const userSnap = await transaction.get(userRef);
      const likerName = userSnap.exists() ? userSnap.data().displayName : "A classmate";

      if (likesSnap.exists()) {
        // Unlike post
        transaction.delete(likesRef);
        newLikesCount = Math.max(0, newLikesCount - 1);
      } else {
        // Like post
        transaction.set(likesRef, { likedAt: serverTimestamp() });
        newLikesCount += 1;

        // Atomically trigger In-App Notification
        if (postData.authorId !== userId) {
          const notificationId = doc(collection(db, 'notifications')).id;
          const notificationRef = doc(db, 'notifications', notificationId);
          const notifyPayload = {
            id: notificationId,
            receiverId: postData.authorId,
            senderName: likerName,
            senderId: userId,
            type: 'like',
            title: `${likerName} liked your post`,
            body: `"${postData.content.slice(0, 40)}${postData.content.length > 40 ? '...' : ''}"`,
            read: false,
            createdAt: serverTimestamp()
          };
          transaction.set(notificationRef, notifyPayload);
        }
      }

      transaction.update(postRef, {
        likesCount: newLikesCount,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Check if a list of posts are liked by the current user
export async function getLikedPostIds(userId: string): Promise<Record<string, boolean>> {
  try {
    // Since subcollections cannot be queried uniformly easily, we check on demand or query the collection group
    // But since this is small/fast, we can check liked states via helper subcollection listener or list.
    // Let's implement a clean listener for user liked posts if we need to.
    return {};
  } catch (error) {
    return {};
  }
}

export function subscribeToPostLikes(postId: string, callback: (likedUserIds: string[]) => void, onError?: (err: any) => void) {
  const path = `posts/${postId}/likes`;
  const q = collection(db, 'posts', postId, 'likes');
  return onSnapshot(q, (snap) => {
    const userIds = snap.docs.map(doc => doc.id);
    callback(userIds);
  }, (err) => {
    if (onError) onError(err);
    else console.warn(`Silent listener error on ${path}:`, err);
  });
}

// Real-time pagination listener for optimized scroll feed
export function subscribeToFeed(callback: (posts: Post[]) => void, onError: (err: any) => void) {
  const path = 'posts';
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    const posts = snap.docs.map(doc => doc.data() as Post);
    callback(posts);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (parsedErr) {
      onError(parsedErr);
    }
  });
}

// --- Chat Room & Direct Message Services (E2EE Built-in) ---

/**
 * Returns a unique deterministic room ID based on sorted user logins: chat_uidA_uidB
 */
export function getDeterministicChatId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `chat_${sorted[0]}_${sorted[1]}`;
}

export async function getOrCreateDirectChat(meId: string, otherId: string): Promise<DirectChat> {
  const chatId = getDeterministicChatId(meId, otherId);
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);

    if (snap.exists()) {
      return snap.data() as DirectChat;
    }

    // Otherwise create direct chat room
    const rawData = {
      id: chatId,
      participantIds: [meId, otherId].sort() as [string, string],
      lastMessage: "Chat started (End-to-End Encrypted)",
      lastMessageAt: serverTimestamp()
    };

    DirectChatSchema.parse(rawData);

    await setDoc(chatRef, rawData);
    return rawData as any;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function setFirestoreTypingStatus(chatId: string, uid: string, isTyping: boolean, typingType?: string): Promise<void> {
  const typingDocRef = doc(db, 'chats', chatId, 'typingStates', uid);
  try {
    await setDoc(typingDocRef, {
      uid,
      isTyping,
      typingType: typingType || (isTyping ? 'typing' : ''),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Error updating typing indicator subcollection:", error);
  }
}

export function subscribeToChatTypingStatus(chatId: string, callback: (typingMap: Record<string, boolean | string>) => void) {
  const typingColRef = collection(db, 'chats', chatId, 'typingStates');
  return onSnapshot(typingColRef, (snap) => {
    const typingMap: Record<string, boolean | string> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const uid = d.id;
      const updatedAt = data.updatedAt;
      let isValid = true;
      if (updatedAt) {
        const timeMs = updatedAt.seconds ? updatedAt.seconds * 1000 : (updatedAt.toDate ? updatedAt.toDate().getTime() : Date.parse(updatedAt));
        if (Date.now() - timeMs > 15000) { // expired after 15 seconds of inactivity
          isValid = false;
        }
      }
      if (data.isTyping && isValid) {
        typingMap[uid] = data.typingType || true;
      }
    });
    callback(typingMap);
  }, (err) => {
    console.warn("Error listening to typing status subcollection:", err);
  });
}

/**
 * Sends a message in a conversation. Automatically handles E2EE keys!
 */
export async function sendE2EEMessage(params: {
  chatId: string;
  senderId: string;
  senderDisplayName: string;
  receiverId: string;
  plainText: string;
  recipientPublicKeyJwk: string;
  senderPublicKeyJwk: string;
  lifespanSeconds?: number;
}): Promise<void> {
  const { chatId, senderId, senderDisplayName, receiverId, plainText, recipientPublicKeyJwk, senderPublicKeyJwk, lifespanSeconds } = params;
  const messageId = doc(collection(db, 'chats', chatId, 'messages')).id;
  const path = `chats/${chatId}/messages/${messageId}`;

  try {
    // 1. Perform Hybrid Cryptography Encryption
    const cipherResult = await encryptE2EEMessage(plainText, recipientPublicKeyJwk, senderPublicKeyJwk);

    const messageData: any = {
      id: messageId,
      senderId,
      receiverId,
      participantIds: [senderId, receiverId].sort() as [string, string],
      encryptedText: cipherResult.encryptedText,
      encryptedKey: cipherResult.encryptedKey,
      senderEncryptedKey: cipherResult.senderEncryptedKey,
      read: false,
      senderDisplayName,
      createdAt: serverTimestamp()
    };

    if (lifespanSeconds && lifespanSeconds > 0) {
      // Calculate active stamp in future
      messageData.expiresAt = new Date(Date.now() + lifespanSeconds * 1000);
    }

    // 2. Validate
    ChatMessageSchema.parse(messageData);

    const chatRef = doc(db, 'chats', chatId);
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const notificationId = doc(collection(db, 'notifications')).id;
    const notificationRef = doc(db, 'notifications', notificationId);

    // 3. Batched execution using writeBatch to enable offline queuing and avoid "client is offline" transaction errors!
    const batch = writeBatch(db);
    
    // Post Message
    batch.set(messageRef, messageData);
    
    // Update parent Chat snippet details
    batch.update(chatRef, {
      lastMessage: "Encrypted Message", // Keep database clear text completely masked!
      lastMessageAt: serverTimestamp()
    });

    // Submit push Notification metadata so recipient's device triggers sound/banners
    const notifyPayload = {
      id: notificationId,
      receiverId,
      senderName: senderDisplayName,
      senderId,
      chatId,
      type: 'message' as const,
      title: `E2EE Message from ${senderDisplayName}`,
      body: 'Click to unlock private message', // Mask secure chat bodies in system alerts for privacy!
      read: false,
      createdAt: serverTimestamp()
    };
    
    // Zod Validation
    InAppNotificationSchema.parse(notifyPayload);
    batch.set(notificationRef, notifyPayload);
    
    await batch.commit();

    // TRIGGER NATIVE PUSH IMMEDIATELY VIA REST PROXY FOR INSTANT DELIVERY
    try {
      // Lazy load to avoid circular dependencies
      const { sendOneSignalPush } = await import('./pushNotifications');
      await sendOneSignalPush(receiverId, `E2EE Message from ${senderDisplayName}`, 'Click to unlock private message', {
        chatId,
        senderName: senderDisplayName,
        type: 'message'
      });
    } catch (pushFastPathErr) {
      console.warn("Fast-path push failed, relying on backend watcher", pushFastPathErr);
    }

    // Note: Background native push notification dispatch is now fully delegated to the 
    // secure, authenticated backend system snapshot trigger engine (server.ts) to eliminate
    // duplicate alerts and secure REST api credentials.
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Group Chat Services ---

export async function ensureGlobalGroupChat(userId: string): Promise<void> {
  const globalRef = doc(db, 'chats', 'global-node-concourse');
  try {
    const snap = await getDoc(globalRef);
    if (!snap.exists()) {
      const initData = {
        id: 'global-node-concourse',
        participantIds: [userId],
        lastMessage: 'Portal initialized. General concourse activated.',
        lastMessageAt: serverTimestamp(),
        isGroup: true,
        name: 'GLOBAL NODE CONCOURSE',
        ownerId: 'system',
        createdAt: serverTimestamp()
      };
      await setDoc(globalRef, initData);
    } else {
      const data = snap.data();
      const currentParticipants = data.participantIds || [];
      if (!currentParticipants.includes(userId)) {
        await updateDoc(globalRef, {
          participantIds: arrayUnion(userId)
        });
      }
    }
  } catch (error) {
    console.warn("Failed to ensure global group chat membership:", error);
  }
}

export async function createGroupChat(
  name: string,
  members: string[],
  ownerId: string,
  extra?: {
    description?: string;
    privacy?: 'public' | 'private';
    inviteCode?: string;
    avatarUrl?: string;
    groupType?: 'friends' | 'school' | 'church' | 'business' | 'community' | 'custom';
    groupBannerUrl?: string;
    permSend?: 'all' | 'admins';
    permAdd?: 'all' | 'admins';
    permPin?: boolean;
    adminApprovalRequired?: boolean;
    anonymousMode?: boolean;
    approvalQueue?: string[];
  }
): Promise<string> {
  const chatId = `group-${Date.now()}`;
  const path = `chats/${chatId}`;
  try {
    const initialRoles: Record<string, string> = { [ownerId]: 'owner' };
    members.forEach(m => {
      if (m !== ownerId) {
        initialRoles[m] = 'member';
      }
    });

    const rawData = {
      id: chatId,
      participantIds: Array.from(new Set([ownerId, ...members])),
      lastMessage: 'Group deployed.',
      lastMessageAt: serverTimestamp(),
      isGroup: true,
      name: name.toUpperCase(),
      ownerId,
      createdAt: serverTimestamp(),
      description: extra?.description || "",
      privacy: extra?.privacy || "private",
      inviteCode: extra?.inviteCode || "",
      avatarUrl: extra?.avatarUrl || "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120",
      roles: initialRoles,
      announcementsOnly: false,
      pinnedMessages: [],
      groupType: extra?.groupType || "friends",
      groupBannerUrl: extra?.groupBannerUrl || "",
      permSend: extra?.permSend || "all",
      permAdd: extra?.permAdd || "all",
      permPin: extra?.permPin !== undefined ? extra?.permPin : true,
      adminApprovalRequired: extra?.adminApprovalRequired !== undefined ? extra?.adminApprovalRequired : false,
      anonymousMode: extra?.anonymousMode !== undefined ? extra?.anonymousMode : false,
      approvalQueue: extra?.approvalQueue || [],
      voiceRoomActive: false,
      voiceRoomParticipants: [],
      events: []
    };
    DirectChatSchema.parse(rawData);
    await setDoc(doc(db, 'chats', chatId), rawData);
    return chatId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateGroupSettings(chatId: string, settings: Partial<DirectChat>): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const updates: any = {};
    if (settings.name !== undefined) updates.name = settings.name.toUpperCase();
    if (settings.description !== undefined) updates.description = settings.description;
    if (settings.avatarUrl !== undefined) updates.avatarUrl = settings.avatarUrl;
    if (settings.privacy !== undefined) updates.privacy = settings.privacy;
    if (settings.inviteCode !== undefined) updates.inviteCode = settings.inviteCode;
    if (settings.announcementsOnly !== undefined) updates.announcementsOnly = settings.announcementsOnly;
    if (settings.pinnedMessages !== undefined) updates.pinnedMessages = settings.pinnedMessages;
    if (settings.roles !== undefined) updates.roles = settings.roles;
    if (settings.participantIds !== undefined) updates.participantIds = settings.participantIds;

    // WhatsApp group settings fields
    if (settings.groupType !== undefined) updates.groupType = settings.groupType;
    if (settings.groupBannerUrl !== undefined) updates.groupBannerUrl = settings.groupBannerUrl;
    if (settings.permSend !== undefined) updates.permSend = settings.permSend;
    if (settings.permAdd !== undefined) updates.permAdd = settings.permAdd;
    if (settings.permPin !== undefined) updates.permPin = settings.permPin;
    if (settings.adminApprovalRequired !== undefined) updates.adminApprovalRequired = settings.adminApprovalRequired;
    if (settings.anonymousMode !== undefined) updates.anonymousMode = settings.anonymousMode;
    if (settings.approvalQueue !== undefined) updates.approvalQueue = settings.approvalQueue;
    if (settings.voiceRoomActive !== undefined) updates.voiceRoomActive = settings.voiceRoomActive;
    if (settings.voiceRoomParticipants !== undefined) updates.voiceRoomParticipants = settings.voiceRoomParticipants;
    if (settings.events !== undefined) updates.events = settings.events;

    await updateDoc(chatRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function joinGroupWithCode(chatId: string, userId: string, inviteCode?: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      throw new Error("Target channel not found.");
    }
    const data = snap.data() as DirectChat;
    if (data.privacy === 'private' && data.inviteCode && data.inviteCode !== inviteCode) {
      throw new Error("ACCESS_DENIED: Invalid join credentials.");
    }
    const currentParticipants = data.participantIds || [];
    const roles = data.roles || {};

    if (!currentParticipants.includes(userId)) {
      if (data.adminApprovalRequired) {
        const queue = data.approvalQueue || [];
        if (!queue.includes(userId)) {
          const nextQueue = [...queue, userId];
          await updateDoc(chatRef, {
            approvalQueue: nextQueue
          });
          throw new Error("APPROVAL_REQUIRED: Request submitted to group admins.");
        } else {
          throw new Error("APPROVAL_PENDING: Your join request is pending admin approval.");
        }
      }

      const nextParticipants = [...currentParticipants, userId];
      roles[userId] = 'member';
      await updateDoc(chatRef, {
        participantIds: nextParticipants,
        roles: roles
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function voteOnPollMessage(chatId: string, messageId: string, userId: string, optionIdx: number): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(msgRef);
      if (!snap.exists()) {
        throw new Error("Message not found.");
      }
      const data = snap.data() as ChatMessage;
      let pollData = data.pollData;
      if (!pollData) {
        if (data.plainText && data.plainText.startsWith('📊 POLL_DATA:')) {
          const rawObj = data.plainText.replace('📊 POLL_DATA:', '');
          const parsed = JSON.parse(rawObj);
          pollData = {
            question: parsed.question,
            options: parsed.options,
            votes: {}
          };
        } else {
          throw new Error("Message does not contain poll data.");
        }
      }
      const nextVotes = { ...(pollData.votes || {}) };
      nextVotes[userId] = optionIdx;
      transaction.update(msgRef, {
        pollData: {
          ...pollData,
          votes: nextVotes
        }
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function sendGroupMessageService(params: {
  chatId: string;
  senderId: string;
  senderDisplayName: string;
  plainText: string;
  messageType?: 'text' | 'system' | 'poll' | 'shared_post' | 'shared_profile';
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  pollData?: { question: string; options: string[]; votes: Record<string, number> };
}): Promise<void> {
  const {
    chatId,
    senderId,
    senderDisplayName,
    plainText,
    messageType = 'text',
    mediaUrl = '',
    mediaType = '',
    mediaName = '',
    replyToId = '',
    replyToText = '',
    replyToSenderName = '',
    pollData = null
  } = params;
  const messageId = doc(collection(db, 'chats', chatId, 'messages')).id;
  const path = `chats/${chatId}/messages/${messageId}`;

  try {
    const messageData: any = {
      id: messageId,
      senderId,
      receiverId: 'group',
      participantIds: [senderId],
      encryptedText: '',
      encryptedKey: '',
      senderEncryptedKey: '',
      plainText,
      isGroupMessage: true,
      senderDisplayName,
      createdAt: serverTimestamp(),
      messageType,
      mediaUrl,
      mediaType,
      mediaName,
      replyToId,
      replyToText,
      replyToSenderName,
      reactions: {},
      pollData: pollData ? {
        question: pollData.question,
        options: pollData.options,
        votes: pollData.votes
      } : null
    };

    ChatMessageSchema.parse(messageData);

    const chatRef = doc(db, 'chats', chatId);
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    let snippet = plainText;
    if (messageType === 'poll') snippet = `📊 Poll: ${pollData?.question || ""}`;
    else if (messageType === 'system') snippet = plainText;
    else if (mediaUrl) snippet = `📎 Attachment: ${mediaName || mediaType}`;

    await runTransaction(db, async (transaction) => {
      transaction.set(messageRef, messageData);
      transaction.update(chatRef, {
        lastMessage: messageType === 'system' ? snippet : `${senderDisplayName.toUpperCase()}: ${snippet.slice(0, 50)}`,
        lastMessageAt: serverTimestamp()
      });
    });

    // Notify other group members via in-app notifications and OneSignal Push!
    try {
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const destUids: string[] = chatSnap.data().participantIds || [];
        for (const destUid of destUids) {
          if (destUid && destUid !== senderId) {
            // Write real-time in-app notification document to Firestore
            const notificationId = doc(collection(db, 'notifications')).id;
            const notificationRef = doc(db, 'notifications', notificationId);
            const notifyPayload = {
              id: notificationId,
              receiverId: destUid,
              senderName: senderDisplayName,
              senderId,
              chatId,
              type: 'message' as const,
              title: `Group ${chatSnap.data().name || 'Chat'}`,
              body: `${senderDisplayName}: ${snippet.slice(0, 75)}`,
              read: false,
              createdAt: serverTimestamp()
            };
            // Validate and save
            InAppNotificationSchema.parse(notifyPayload);
            await setDoc(notificationRef, notifyPayload);
            
            // FAST PATH INSTANT NATIVE PUSH DISPATCH
            try {
              const { sendOneSignalPush } = await import('./pushNotifications');
              await sendOneSignalPush(destUid, `Group ${chatSnap.data().name || 'Chat'}`, `${senderDisplayName}: ${snippet.slice(0, 75)}`, {
                chatId,
                senderName: senderDisplayName,
                type: 'group_message'
              });
            } catch (pushFastPathErr) {
               console.warn("Fast-path group push failed, relying on backend watcher", pushFastPathErr);
            }
          }
        }
      }
    } catch (pushErr) {
      console.warn('[Group Push Dispatch Error]', pushErr);
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Subscribe to conversational listings in real-time
export function subscribeToChats(userId: string, callback: (chats: DirectChat[]) => void, onError?: (err: any) => void) {
  const path = 'chats';
  const q = query(
    collection(db, 'chats'),
    where('participantIds', 'array-contains', userId)
    // Client-side sorting workaround to bypass composite index requirement
    // orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(doc => doc.data() as DirectChat);
    chats.sort((a, b) => {
      const aTime = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
      const bTime = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
      return bTime - aTime;
    });
    callback(chats);
  }, (err) => {
    if (onError) onError(err);
    else console.warn(`Silent listener error on ${path}:`, err);
  });
}

// Subscribe to messages under a subcollection in real-time
export function subscribeToMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
  const path = `chats/${chatId}/messages`;
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (e) {
      console.warn("Messages stream subscription error:", e);
    }
  });
}

// --- Push & In-App Notification Services ---

export function subscribeToNotifications(userId: string, callback: (notifs: InAppNotification[]) => void) {
  const path = 'notifications';
  const q = query(
    collection(db, 'notifications'),
    where('receiverId', '==', userId),
    // Client-side filtering workaround to bypass composite index requirement
    // where('read', '==', false),
    // orderBy('createdAt', 'desc'),
    // limit(20)
  );
  return onSnapshot(q, (snap) => {
    let notifs = snap.docs.map(d => d.data() as InAppNotification);
    notifs = notifs.filter(n => n.read === false);
    notifs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    callback(notifs.slice(0, 20));
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (e) {
      console.warn("Notifications stream subscription error:", e);
    }
  });
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const path = `notifications/${id}`;
  try {
    const ref = doc(db, 'notifications', id);
    await updateDoc(ref, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function triggerLikeNotification(senderName: string, receiverId: string, postSnippet: string, senderId?: string) {
  if (senderName === receiverId) return; // don't notify self likes
  const notificationId = doc(collection(db, 'notifications')).id;
  const path = `notifications/${notificationId}`;
  try {
    const payload = {
      id: notificationId,
      receiverId,
      senderName,
      senderId,
      type: 'like',
      title: `${senderName} liked your post`,
      body: `"${postSnippet.slice(0, 40)}${postSnippet.length > 40 ? '...' : ''}"`,
      read: false,
      createdAt: serverTimestamp()
    };
    
    InAppNotificationSchema.parse(payload);
    await setDoc(doc(db, 'notifications', notificationId), payload);

    // Note: Background push notification dispatch is fully delegated to the 
    // backend system snapshot trigger engine (server.ts) to avoid duplications.
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Message Emoji Reactions Services ---

export async function addOrUpdateMessageReaction(
  chatId: string,
  messageId: string,
  reaction: {
    userId: string;
    userName: string;
    emoji: string;
  }
): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}/message_reactions/${reaction.userId}`;
  try {
    const reactionData = {
      id: reaction.userId,
      emoji: reaction.emoji,
      userId: reaction.userId,
      userName: reaction.userName,
      createdAt: serverTimestamp()
    };
    
    // Validate
    MessageReactionSchema.parse(reactionData);

    const reactionRef = doc(db, 'chats', chatId, 'messages', messageId, 'message_reactions', reaction.userId);
    await setDoc(reactionRef, reactionData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeMessageReaction(
  chatId: string,
  messageId: string,
  userId: string
): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}/message_reactions/${userId}`;
  try {
    const reactionRef = doc(db, 'chats', chatId, 'messages', messageId, 'message_reactions', userId);
    await deleteDoc(reactionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToMessageReactions(
  chatId: string,
  messageId: string,
  callback: (reactions: MessageReaction[]) => void,
  onError?: (err: any) => void
) {
  const q = collection(db, 'chats', chatId, 'messages', messageId, 'message_reactions');
  
  return onSnapshot(q, (snap) => {
    const reactions = snap.docs.map(doc => doc.data() as MessageReaction);
    callback(reactions);
  }, (err) => {
    if (onError) {
      onError(err);
    } else {
      console.warn("Failed to fetch message reactions:", err);
    }
  });
}

// --- Social Post Emoji Reactions Services ---

export async function addOrUpdatePostReaction(
  postId: string,
  reaction: {
    userId: string;
    userName: string;
    emoji: string;
  }
): Promise<void> {
  const path = `posts/${postId}/post_reactions/${reaction.userId}`;
  try {
    const reactionData = {
      id: reaction.userId,
      emoji: reaction.emoji,
      userId: reaction.userId,
      userName: reaction.userName,
      createdAt: serverTimestamp()
    };
    
    // Validate
    MessageReactionSchema.parse(reactionData);

    const reactionRef = doc(db, 'posts', postId, 'post_reactions', reaction.userId);
    await setDoc(reactionRef, reactionData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removePostReaction(
  postId: string,
  userId: string
): Promise<void> {
  const path = `posts/${postId}/post_reactions/${userId}`;
  try {
    const reactionRef = doc(db, 'posts', postId, 'post_reactions', userId);
    await deleteDoc(reactionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToPostReactions(
  postId: string,
  callback: (reactions: MessageReaction[]) => void,
  onError?: (err: any) => void
) {
  const q = collection(db, 'posts', postId, 'post_reactions');
  
  return onSnapshot(q, (snap) => {
    const reactions = snap.docs.map(doc => doc.data() as MessageReaction);
    callback(reactions);
  }, (err) => {
    if (onError) {
      onError(err);
    } else {
      console.warn("Failed to fetch post reactions:", err);
    }
  });
}

// --- Stories Services ---

export async function createStory(storyData: {
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  mediaType: 'image' | 'video' | 'audio' | 'none';
  link?: string;
  musicTitle?: string;
  musicArtist?: string;
  location?: string;
  pollQuestion?: string;
  pollOptions?: { id: string; text: string; votes: number }[];
  pollVotes?: Record<string, string>;
  stickers?: string[];
  mentions?: string[];
  hashtags?: string[];
  gradientPreset?: string;
}): Promise<void> {
  const storyId = doc(collection(db, 'stories')).id;
  const path = `stories/${storyId}`;
  try {
    const raw: any = {
      id: storyId,
      authorId: storyData.authorId,
      authorName: storyData.authorName,
      authorPhoto: storyData.authorPhoto,
      content: storyData.content,
      mediaType: storyData.mediaType,
      viewsCount: 0,
      viewedBy: [] as string[],
      createdAt: serverTimestamp()
    };

    if (storyData.imageUrl !== undefined) raw.imageUrl = storyData.imageUrl;
    if (storyData.videoUrl !== undefined) raw.videoUrl = storyData.videoUrl;
    if (storyData.audioUrl !== undefined) raw.audioUrl = storyData.audioUrl;
    if (storyData.link !== undefined) raw.link = storyData.link;
    if (storyData.musicTitle !== undefined) raw.musicTitle = storyData.musicTitle;
    if (storyData.musicArtist !== undefined) raw.musicArtist = storyData.musicArtist;
    if (storyData.location !== undefined) raw.location = storyData.location;
    if (storyData.pollQuestion !== undefined) raw.pollQuestion = storyData.pollQuestion;
    if (storyData.pollOptions !== undefined) raw.pollOptions = storyData.pollOptions;
    if (storyData.pollVotes !== undefined) raw.pollVotes = storyData.pollVotes;
    if (storyData.stickers !== undefined) raw.stickers = storyData.stickers;
    if (storyData.mentions !== undefined) raw.mentions = storyData.mentions;
    if (storyData.hashtags !== undefined) raw.hashtags = storyData.hashtags;
    if (storyData.gradientPreset !== undefined) raw.gradientPreset = storyData.gradientPreset;

    // Validate schema
    StorySchema.parse(raw);
    await setDoc(doc(db, 'stories', storyId), raw);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function voteStoryPoll(storyId: string, userId: string, optionId: string): Promise<void> {
  const path = `stories/${storyId}`;
  try {
    const storyRef = doc(db, 'stories', storyId);
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(storyRef);
      if (!sfDoc.exists()) {
        throw new Error("Story does not exist!");
      }
      const data = sfDoc.data() as Story;
      const votes = { ...(data.pollVotes || {}) };
      const currentVote = votes[userId];
      
      // Update votes mapping
      votes[userId] = optionId;

      // Re-calculate counts for options
      const options = (data.pollOptions || []).map(opt => {
        let count = opt.votes || 0;
        if (currentVote === opt.id) {
          count = Math.max(0, count - 1);
        }
        if (optionId === opt.id) {
          count = count + 1;
        }
        return { ...opt, votes: count };
      });

      transaction.update(storyRef, {
        pollVotes: votes,
        pollOptions: options
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToStories(
  callback: (stories: Story[]) => void,
  onError?: (err: any) => void
) {
  const path = 'stories';
  const q = query(
    collection(db, 'stories'),
    limit(150)
  );
  return onSnapshot(q, (snap) => {
    const stories = snap.docs.map(doc => doc.data() as Story);
    callback(stories);
  }, (err) => {
    if (onError) {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (parsedErr) {
        onError(parsedErr);
      }
    } else {
      console.warn("Failed to subscribe to stories:", err);
    }
  });
}

export async function viewStory(storyId: string, userId: string): Promise<void> {
  const path = `stories/${storyId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, 'stories', storyId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Story;
      
      const viewedBy = data.viewedBy || [];
      if (!viewedBy.includes(userId)) {
        const updatedViewed = [...viewedBy, userId];
        transaction.update(ref, {
          viewedBy: updatedViewed,
          viewsCount: (data.viewsCount || 0) + 1
        });
      }
    });
  } catch (error) {
    console.warn("Failed tracking story view transactional update:", error);
  }
}

export async function deleteStory(storyId: string): Promise<void> {
  const path = `stories/${storyId}`;
  try {
    await deleteDoc(doc(db, 'stories', storyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Mark a specific message as read in real-time
 */
export async function markMessageAsRead(chatId: string, messageId: string, userId?: string): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    // Check if read receipts are disabled for either participant in this conversation
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const chatData = chatSnap.data();
      const disabledMap = chatData.disabledReadReceipts || {};
      const isAnyDisabled = Object.values(disabledMap).some(val => val === true);
      if (isAnyDisabled) {
        return; // Respect privacy preference: do not update message to 'read'
      }
    }

    const ref = doc(db, 'chats', chatId, 'messages', messageId);
    const updatePayload: any = { 
      read: true, 
      readAt: serverTimestamp() 
    };
    if (userId) {
      updatePayload.readBy = arrayUnion(userId);
    }
    await updateDoc(ref, updatePayload);
  } catch (error) {
    console.warn("Failed marking message as read:", error);
  }
}

/**
 * Toggle custom pinned state for a specific message
 */
export async function togglePinMessage(chatId: string, messageId: string, pinned: boolean): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const ref = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(ref, { pinned });
  } catch (error) {
    console.warn("Failed toggling pinned status on message:", error);
  }
}

/**
 * Add or update reaction to a Story
 */
export async function addOrUpdateStoryReaction(
  storyId: string,
  reaction: { userId: string; userName: string; emoji: string }
): Promise<void> {
  const path = `stories/${storyId}/story_reactions/${reaction.userId}`;
  try {
    const reactionData = {
      id: reaction.userId,
      emoji: reaction.emoji,
      userId: reaction.userId,
      userName: reaction.userName,
      createdAt: serverTimestamp()
    };
    MessageReactionSchema.parse(reactionData);
    await setDoc(doc(db, 'stories', storyId, 'story_reactions', reaction.userId), reactionData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Remove a reaction from a Story
 */
export async function removeStoryReaction(storyId: string, userId: string): Promise<void> {
  const path = `stories/${storyId}/story_reactions/${userId}`;
  try {
    await deleteDoc(doc(db, 'stories', storyId, 'story_reactions', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to story reactions
 */
export function subscribeToStoryReactions(
  storyId: string,
  callback: (reactions: MessageReaction[]) => void
) {
  const path = `stories/${storyId}/story_reactions`;
  const q = query(
    collection(db, 'stories', storyId, 'story_reactions'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const reactions = snap.docs.map(doc => doc.data() as MessageReaction);
    callback(reactions);
  }, (err) => {
    console.warn("Failed to fetch story reactions:", err);
  });
}

/**
 * Create a feedback submission
 */
export async function createFeedback(
  userId: string,
  userName: string,
  content: string
): Promise<void> {
  const feedbackId = doc(collection(db, 'feedbacks')).id;
  const path = `feedbacks/${feedbackId}`;
  try {
    const rawData = {
      id: feedbackId,
      userId,
      userName,
      content,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'feedbacks', feedbackId), rawData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Realtime Call Services ---

export async function createActiveCall(
  callerId: string,
  callerName: string,
  callerPhoto: string,
  receiverId: string,
  type: 'voice' | 'video',
  isGroup: boolean = false,
  groupId: string = '',
  groupName: string = ''
): Promise<string> {
  const callId = doc(collection(db, 'calls')).id;
  const path = `calls/${callId}`;
  try {
    const now = Date.now();
    const rawData = {
      id: callId,
      callerId,
      callerName,
      callerPhoto,
      receiverId,
      type,
      status: isGroup ? 'active' : 'dialing',
      isGroup,
      groupId: groupId || (isGroup ? receiverId : ''),
      groupName: groupName || (isGroup ? 'Group Audio Channel' : callerName),
      participants: [
        {
          uid: callerId,
          name: callerName,
          photo: callerPhoto,
          isMuted: false,
          isSpeaking: false,
          isHandRaised: false,
          joinedAt: now
        }
      ],
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'calls', callId), rawData);

    // Call backend API in parallel for high-priority push notification and memory relay
    try {
      fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          callerId,
          callerName,
          callerPhoto,
          receiverId,
          type,
          isGroup,
          groupId,
          groupName
        })
      }).catch(err => console.warn('[Call Initiate API Request Notice]:', err));
    } catch (e) {
      console.warn('[Call Initiate API Fetch Notice]:', e);
    }

    // Direct push notification attempt as fallback
    if (!isGroup && receiverId) {
      try {
        const { sendOneSignalPush } = await import('./pushNotifications');
        await sendOneSignalPush(
          receiverId,
          `📞 Incoming ${type === 'video' ? 'Video' : 'Voice'} Call`,
          `Incoming call from ${callerName}. Tap to answer!`,
          {
            type: 'call',
            callId,
            callerId,
            callerName,
            callerPhoto,
            callType: type,
            route: 'chat',
            senderId: callerId,
            url: `/call/${callId}`
          }
        );
      } catch (pushErr) {
        console.warn('[Call Push Dispatch] Notice:', pushErr);
      }
    }

    return callId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function joinGroupCall(
  callId: string,
  user: { uid: string; name: string; photo: string }
): Promise<void> {
  const path = `calls/${callId}`;
  try {
    const callRef = doc(db, 'calls', callId);
    const snap = await getDoc(callRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const existingParticipants: any[] = data.participants || [];
    
    if (!existingParticipants.some(p => p.uid === user.uid)) {
      const updated = [
        ...existingParticipants,
        {
          uid: user.uid,
          name: user.name,
          photo: user.photo,
          isMuted: false,
          isSpeaking: false,
          isHandRaised: false,
          joinedAt: Date.now()
        }
      ];
      await updateDoc(callRef, { participants: updated, status: 'active' });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function leaveGroupCall(
  callId: string,
  uid: string
): Promise<void> {
  const path = `calls/${callId}`;
  try {
    const callRef = doc(db, 'calls', callId);
    const snap = await getDoc(callRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const existingParticipants: any[] = data.participants || [];
    const updated = existingParticipants.filter(p => p.uid !== uid);

    if (updated.length === 0) {
      await updateDoc(callRef, { status: 'ended', participants: [], endedAt: serverTimestamp() });
    } else {
      await updateDoc(callRef, { participants: updated });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateGroupParticipantState(
  callId: string,
  uid: string,
  updates: { isMuted?: boolean; isSpeaking?: boolean; isHandRaised?: boolean }
): Promise<void> {
  const path = `calls/${callId}`;
  try {
    const callRef = doc(db, 'calls', callId);
    const snap = await getDoc(callRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const existingParticipants: any[] = data.participants || [];
    const updated = existingParticipants.map(p => {
      if (p.uid === uid) {
        return { ...p, ...updates };
      }
      return p;
    });

    await updateDoc(callRef, { participants: updated });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToIncomingCall(userId: string, callback: (call: any | null) => void) {
  const path = 'calls';
  const q = query(collection(db, 'calls'), where('receiverId', '==', userId));
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const activeIncoming = snap.docs
      .map(doc => doc.data())
      .filter(c => {
        if (!c || c.status === 'ended' || c.callerId === userId) return false;
        const timeMs = c.createdAt?.toMillis ? c.createdAt.toMillis() : (c.createdAt?.seconds ? c.createdAt.seconds * 1000 : (typeof c.createdAt === 'number' ? c.createdAt : now));
        // Only accept calls within the last 90 seconds
        return (now - timeMs < 90000) && (c.status === 'dialing' || c.status === 'ringing');
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0));
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0));
        return timeB - timeA;
      });
    callback(activeIncoming[0] || null);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (e) {
      console.warn("Incoming calls stream error:", e);
    }
  });
}

/**
 * Direct HTTP fallback poller for active incoming calls (bypasses Firestore snapshot latency)
 */
export async function fetchActiveIncomingCall(userId: string): Promise<any | null> {
  if (!userId) return null;
  try {
    const res = await fetch(`/api/calls/incoming/${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      return data?.incomingCall || null;
    }
  } catch (e) {
    // Silent fail on network blip
  }
  return null;
}

export function subscribeToOutgoingCall(callerId: string, callback: (call: any | null) => void) {
  const path = 'calls';
  const q = query(collection(db, 'calls'), where('callerId', '==', callerId));
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const activeOutgoing = snap.docs
      .map(doc => doc.data())
      .filter(c => {
        if (!c || c.status === 'ended') return false;
        const timeMs = c.createdAt?.toMillis ? c.createdAt.toMillis() : (c.createdAt?.seconds ? c.createdAt.seconds * 1000 : (typeof c.createdAt === 'number' ? c.createdAt : now));
        return (now - timeMs < 90000) || c.status === 'active';
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0));
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0));
        return timeB - timeA;
      });
    callback(activeOutgoing[0] || null);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (e) {
      console.warn("Outgoing calls stream error:", e);
    }
  });
}

export function subscribeToCallState(callId: string, callback: (call: any | null) => void) {
  const path = `calls/${callId}`;
  return onSnapshot(doc(db, 'calls', callId), (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback(null);
    }
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.GET, path);
    } catch (e) {
      console.warn("Call state stream error:", e);
    }
  });
}

export async function acceptActiveCall(callId: string): Promise<void> {
  const path = `calls/${callId}`;
  try {
    // Update backend memory relay first for instant zero-latency signaling
    fetch('/api/calls/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId })
    }).catch(console.warn);

    await updateDoc(doc(db, 'calls', callId), { 
      status: 'active',
      acceptedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ringActiveCall(callId: string): Promise<void> {
  const path = `calls/${callId}`;
  try {
    // Update backend memory relay
    fetch('/api/calls/ring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId })
    }).catch(console.warn);

    await updateDoc(doc(db, 'calls', callId), { 
      status: 'ringing'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function endActiveCall(
  callId: string,
  durationSeconds?: number,
  endReason: 'completed' | 'declined' | 'missed' | 'quick_replied' | 'cancelled' = 'completed',
  quickReplyText?: string
): Promise<void> {
  const path = `calls/${callId}`;
  try {
    // Notify backend memory relay immediately
    fetch('/api/calls/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId,
        durationSeconds,
        endReason,
        quickReplyText
      })
    }).catch(console.warn);

    const updateData: any = { 
      status: 'ended',
      endedAt: serverTimestamp(),
      endReason
    };
    if (durationSeconds !== undefined && durationSeconds >= 0) {
      updateData.durationSeconds = Math.round(durationSeconds);
    }
    if (quickReplyText) {
      updateData.quickReplyText = quickReplyText;
    }
    await updateDoc(doc(db, 'calls', callId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function sendQuickReplyAndEndCall(params: {
  callId: string;
  callerId: string;
  currentUserId: string;
  currentUserName: string;
  replyText: string;
}): Promise<void> {
  const { callId, callerId, currentUserId, currentUserName, replyText } = params;
  const path = `calls/${callId}`;
  try {
    // 1. Mark call as ended with quick_replied status
    await updateDoc(doc(db, 'calls', callId), {
      status: 'ended',
      endedAt: serverTimestamp(),
      endReason: 'quick_replied',
      quickReplyText: replyText
    });

    // 2. Dispatch high-priority real-time message notification
    const notificationId = doc(collection(db, 'notifications')).id;
    await setDoc(doc(db, 'notifications', notificationId), {
      id: notificationId,
      receiverId: callerId,
      senderId: currentUserId,
      senderName: currentUserName,
      type: 'message',
      title: `⚡ Quick Call Response from ${currentUserName}`,
      body: replyText,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToCallHistory(userId: string, callback: (calls: CallLogItem[]) => void) {
  const qReceiver = query(collection(db, 'calls'), where('receiverId', '==', userId), limit(60));
  const qCaller = query(collection(db, 'calls'), where('callerId', '==', userId), limit(60));

  let receiverDocs: CallLogItem[] = [];
  let callerDocs: CallLogItem[] = [];

  const mergeAndNotify = () => {
    const map = new Map<string, CallLogItem>();
    [...receiverDocs, ...callerDocs].forEach(c => {
      if (c && c.id) map.set(c.id, c);
    });
    const sorted = Array.from(map.values()).sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
      return tB - tA;
    });
    callback(sorted);
  };

  const unsubReceiver = onSnapshot(qReceiver, (snap) => {
    receiverDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CallLogItem));
    mergeAndNotify();
  }, (err) => console.warn('Call history receiver stream error:', err));

  const unsubCaller = onSnapshot(qCaller, (snap) => {
    callerDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CallLogItem));
    mergeAndNotify();
  }, (err) => console.warn('Call history caller stream error:', err));

  return () => {
    unsubReceiver();
    unsubCaller();
  };
}

export async function deleteCallRecord(callId: string): Promise<void> {
  const path = `calls/${callId}`;
  try {
    await deleteDoc(doc(db, 'calls', callId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Comments & Discussion Services ---

export async function createComment(
  postId: string,
  postAuthorId: string,
  postSnippet: string,
  comment: {
    authorId: string;
    authorName: string;
    authorPhoto: string;
    content: string;
  }
): Promise<string> {
  const commentId = doc(collection(db, 'posts', postId, 'comments')).id;
  const commentPath = `posts/${postId}/comments/${commentId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await transaction.get(postRef);
      let currentCommentsCount = 0;
      if (postSnap.exists()) {
        const postData = postSnap.data() as Post;
        currentCommentsCount = (postData as any).commentsCount || 0;
      }

      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const payload = {
        id: commentId,
        postId,
        authorId: comment.authorId,
        authorName: comment.authorName,
        authorPhoto: comment.authorPhoto,
        content: comment.content,
        createdAt: serverTimestamp()
      };
      transaction.set(commentRef, payload);

      transaction.update(postRef, {
        commentsCount: currentCommentsCount + 1,
        updatedAt: serverTimestamp()
      });
    });

    // Trigger Notification for Comment
    if (postAuthorId !== comment.authorId) {
      await triggerCommentNotification(comment.authorName, postAuthorId, comment.content, postId, comment.authorId);
    }

    return commentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, commentPath);
    throw error;
  }
}

export function subscribeToComments(postId: string, callback: (comments: any[]) => void, onError?: (err: any) => void) {
  const path = `posts/${postId}/comments`;
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
      };
    }));
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (e) {
      console.warn("Comments stream subscription error:", e);
    }
  });
}

export async function triggerCommentNotification(senderName: string, receiverId: string, commentSnippet: string, postId: string, senderId?: string) {
  if (senderName === receiverId) return;
  const notificationId = doc(collection(db, 'notifications')).id;
  const path = `notifications/${notificationId}`;
  try {
    const payload = {
      id: notificationId,
      receiverId,
      senderName,
      senderId,
      type: 'like', // Map to like for existing rules schema validation
      title: `${senderName} commented on your post`,
      body: `"${commentSnippet.slice(0, 40)}${commentSnippet.length > 40 ? '...' : ''}"`,
      read: false,
      createdAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'notifications', notificationId), payload);

    // Note: Background push notification dispatch is fully delegated to the 
    // backend system snapshot trigger engine (server.ts) to avoid duplications.
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}


