import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize server-side Firebase connection (with environment variables fallback)
  let firebaseConfig: any = null;
  try {
    const configFromEnv = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
    };

    if (configFromEnv.apiKey && configFromEnv.projectId) {
      firebaseConfig = configFromEnv;
      console.log("[Backend] Firebase configured securely via environment variables.");
    } else {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      console.log("[Backend] Firebase configured via local firebase-applet-config.json file.");
    }
  } catch (err) {
    console.error("[Backend] Failed to load Firebase config:", err);
  }

  let firebaseApp: any = null;
  let db: any = null;
  let auth: any = null;

  if (firebaseConfig) {
    try {
      firebaseApp = initializeApp(firebaseConfig);
      db = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
      }, firebaseConfig.firestoreDatabaseId || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2");
      auth = getAuth(firebaseApp);
      console.log("[Backend] Firebase App, Firestore, and Auth initialized successfully.");
    } catch (err) {
      console.error("[Backend] Error initializing Firebase SDK:", err);
    }
  } else {
    console.warn("[Backend] Firebase is unconfigured. Dynamic backend queries and push notification engines will be offline.");
  }

  // Intercept API routes if database is not initialized yet
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") && req.path !== "/api/firebase-config" && req.path !== "/api/health" && !db) {
      return res.status(503).json({
        error: "Firebase database is not configured. Please set your FIREBASE_PROJECT_ID, FIREBASE_API_KEY, and other environment variables in Vercel / your hosting platform."
      });
    }
    next();
  });

  // Serve Firebase configuration dynamically to front-end to prevent hardcoded credentials in client builds/Electron
  app.get("/api/firebase-config", (req, res) => {
    if (firebaseConfig) {
      res.json(firebaseConfig);
    } else {
      res.status(500).json({ error: "Firebase configuration is not initialized on the server." });
    }
  });

  // --- Real-time Backend-driven OneSignal Push Dispatch Engine ---
  function initBackendPushEngine(db: any) {
    let initialLoadComplete = false;
    setTimeout(() => {
      initialLoadComplete = true;
      console.log("[Backend Notification Engine] Initial historical documents ignored. Live push dispatcher is now ONLINE.");
    }, 5000);

    // 1. Listen to notifications collection (covers: Messages, Likes, Comments, Mentions, Follows)
    onSnapshot(collection(db, 'notifications'), async (snapshot) => {
      if (!initialLoadComplete) return;

      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const notifData = change.doc.data();
          const { receiverId, senderName, title, body, type, chatId, id } = notifData;
          if (!receiverId) continue;

          console.log(`[Backend Push Dispatcher] New notification detected for recipient ${receiverId}: "${title}" - "${body}"`);

          try {
            const userSnap = await getDoc(doc(db, 'users', receiverId));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              let playerIds: string[] = [];
              if (userData.oneSignalSubscriptionId) playerIds.push(userData.oneSignalSubscriptionId);
              if (userData.oneSignalId) playerIds.push(userData.oneSignalId);
              if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
                playerIds.push(...userData.oneSignalSubscriptionIds);
              }

              playerIds = Array.from(new Set(playerIds)).filter(id => typeof id === 'string' && id.trim().length > 0);

              const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
              const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";

              let channelId = "messages";
              if (type === 'message' || type === 'group_message') channelId = "messages";
              else if (type === 'call') channelId = "calls";
              else if (type === 'like' || type === 'comment' || type === 'follow' || type === 'mention') channelId = "mentions";

              const payload: any = {
                app_id: ONESIGNAL_APP_ID,
                headings: { en: title || `Notification from ${senderName}` },
                contents: { en: body || "New encrypted update available." },
                data: {
                  id,
                  receiverId,
                  senderName,
                  chatId,
                  type
                },
                priority: 10,
                ttl: 259200,
                android_visibility: 1,
                android_sound: "default",
                ios_sound: "default",
                android_channel_id: channelId,
                small_icon: "ic_stat_flick_logo",
                android_accent_color: "FF39FF14"
              };

              if (playerIds.length > 0) {
                payload.include_subscription_ids = playerIds;
              } else {
                payload.include_aliases = { external_id: [receiverId] };
                payload.target_channel = "push";
              }

              const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
                },
                body: JSON.stringify(payload)
              });

              const osResult = await osResponse.json();
              console.log(`[Backend Push Dispatcher] OneSignal REST API Response Status: ${osResponse.status}`, osResult);
            }
          } catch (err) {
            console.error(`[Backend Push Dispatcher] Error processing notification push:`, err);
          }
        }
      }
    }, (error) => {
      console.warn("[Backend Push Dispatcher] Notifications subscription warning/error (likely unauthenticated):", error.message || error);
    });

    // 2. Listen to posts collection (to broadcast New Post notifications to all other users)
    onSnapshot(collection(db, 'posts'), async (snapshot) => {
      if (!initialLoadComplete) return;

      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const postData = change.doc.data();
          const { authorId, authorName, content, id } = postData;
          if (!authorId) continue;

          console.log(`[Backend Push Dispatcher] New post detected by author ${authorName} (${authorId}): "${content.slice(0, 30)}..."`);

          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const otherUsers = usersSnap.docs.filter(uDoc => uDoc.id !== authorId);

            for (const uDoc of otherUsers) {
              const userData = uDoc.data();
              let playerIds: string[] = [];
              if (userData.oneSignalSubscriptionId) playerIds.push(userData.oneSignalSubscriptionId);
              if (userData.oneSignalId) playerIds.push(userData.oneSignalId);
              if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
                playerIds.push(...userData.oneSignalSubscriptionIds);
              }

              playerIds = Array.from(new Set(playerIds)).filter(id => typeof id === 'string' && id.trim().length > 0);

              const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
              const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";

              const payload: any = {
                app_id: ONESIGNAL_APP_ID,
                headings: { en: "New Chronicle Published" },
                contents: { en: `${authorName} posted a new update: "${content.slice(0, 50)}..."` },
                data: {
                  id,
                  authorId,
                  type: "new_post"
                },
                priority: 10,
                ttl: 259200,
                android_channel_id: "updates",
                small_icon: "ic_stat_flick_logo",
                android_accent_color: "FF39FF14"
              };

              if (playerIds.length > 0) {
                payload.include_subscription_ids = playerIds;
              } else {
                payload.include_aliases = { external_id: [uDoc.id] };
                payload.target_channel = "push";
              }

              await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
                },
                body: JSON.stringify(payload)
              }).catch(console.error);
            }
          } catch (err) {
            console.error(`[Backend Push Dispatcher] Error processing new post notifications:`, err);
          }
        }
      }
    }, (error) => {
      console.warn("[Backend Push Dispatcher] Posts subscription warning/error:", error.message || error);
    });

    // 3. Listen to news collection (to broadcast global news wire notifications to all users)
    onSnapshot(collection(db, 'news'), async (snapshot) => {
      if (!initialLoadComplete) return;

      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const newsData = change.doc.data();
          const { title, summary, id } = newsData;

          console.log(`[Backend Push Dispatcher] New global news published: "${title}"`);

          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            for (const uDoc of usersSnap.docs) {
              const userData = uDoc.data();
              let playerIds: string[] = [];
              if (userData.oneSignalSubscriptionId) playerIds.push(userData.oneSignalSubscriptionId);
              if (userData.oneSignalId) playerIds.push(userData.oneSignalId);
              if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
                playerIds.push(...userData.oneSignalSubscriptionIds);
              }

              playerIds = Array.from(new Set(playerIds)).filter(id => typeof id === 'string' && id.trim().length > 0);

              const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
              const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";

              const payload: any = {
                app_id: ONESIGNAL_APP_ID,
                headings: { en: "Global Tech Wire Broadcast" },
                contents: { en: `${title}: ${summary}` },
                data: {
                  id,
                  type: "news"
                },
                priority: 10,
                ttl: 259200,
                android_channel_id: "updates",
                small_icon: "ic_stat_flick_logo",
                android_accent_color: "FF39FF14"
              };

              if (playerIds.length > 0) {
                payload.include_subscription_ids = playerIds;
              } else {
                payload.include_aliases = { external_id: [uDoc.id] };
                payload.target_channel = "push";
              }

              await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
                },
                body: JSON.stringify(payload)
              }).catch(console.error);
            }
          } catch (err) {
            console.error(`[Backend Push Dispatcher] Error processing news global broadcast:`, err);
          }
        }
      }
    }, (error) => {
      console.warn("[Backend Push Dispatcher] News subscription warning/error:", error.message || error);
    });
  }

  // Secure Backend-driven System User Authentication (allows bypassing rules securely by registering as client)
  async function authenticateBackendSystemUser(auth: any) {
    const email = "system-backend@flick-pwa.internal";
    const password = process.env.SYSTEM_BACKEND_PASSWORD || "FlickSystemSecureBackendPass123!";
    
    try {
      console.log("[Backend Auth] Attempting system backend sign-in...");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("[Backend Auth] System backend signed in successfully as UID:", userCredential.user.uid);
      return true;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        try {
          console.log("[Backend Auth] System user not found or credentials invalid. Attempting auto-registration...");
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          console.log("[Backend Auth] System backend registered and signed in successfully as UID:", userCredential.user.uid);
          return true;
        } catch (createErr: any) {
          console.error("[Backend Auth] Failed to register system backend user:", createErr);
          return false;
        }
      } else {
        console.error("[Backend Auth] Error signing in system backend user:", err);
        return false;
      }
    }
  }

  // Run the backend push dispatcher only if Firebase is configured
  if (db && auth) {
    authenticateBackendSystemUser(auth).then((success) => {
      if (success) {
        console.log("[Backend] Authentication secured. Starting background push engine snapshot streams.");
        initBackendPushEngine(db);
      } else {
        console.warn("[Backend] Failed to authenticate system backend user. Notification engine running in unauthenticated state.");
        initBackendPushEngine(db);
      }
    });
  } else if (db) {
    initBackendPushEngine(db);
  }

  // API Route for sending OneSignal push notifications securely (no CORS preflight issue!)
  app.post("/api/push/send", async (req, res) => {
    try {
      const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";

      // Forward full body from client to preserve all native options (channel_id, small_icon, large_icon, collapse_id, etc.)
      const payload = { ...req.body };

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      res.status(response.status).json(responseData);
    } catch (err: any) {
      console.error("[Backend Push Exception] failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Group Chat Backend REST API ---

  // 1. Create Group: POST /api/groups
  app.post("/api/groups", async (req, res) => {
    try {
      const { name, ownerId, members = [], description = "", avatarUrl = "", privacy = "private", inviteCode = "" } = req.body;
      if (!name || !ownerId) {
        return res.status(400).json({ error: "Missing required fields: name, ownerId" });
      }

      const chatId = `group-${Date.now()}`;
      const chatRef = doc(db, 'chats', chatId);

      // owner is automatically owner; others are member
      const initialRoles: Record<string, string> = { [ownerId]: 'owner' };
      members.forEach((mId: string) => {
        if (mId !== ownerId) {
          initialRoles[mId] = 'member';
        }
      });

      const participantIds = Array.from(new Set([ownerId, ...members]));

      const groupData = {
        id: chatId,
        name: name.toUpperCase(),
        ownerId,
        participantIds,
        lastMessage: 'Group deployed.',
        lastMessageAt: new Date(),
        isGroup: true,
        createdAt: new Date(),
        avatarUrl: avatarUrl || `https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120`,
        description,
        privacy,
        inviteCode,
        roles: initialRoles,
        announcementsOnly: false,
        pinnedMessages: []
      };

      await setDoc(chatRef, groupData);
      res.status(201).json({ success: true, chatId, group: groupData });
    } catch (err: any) {
      console.error("[POST /api/groups] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Get Group Details: GET /api/groups/:id
  app.get("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const snap = await getDoc(doc(db, 'chats', id));
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(snap.data());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Update Group Details: PATCH /api/groups/:id
  app.patch("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const chatRef = doc(db, 'chats', id);

      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }

      const allowedUpdates: Record<string, any> = {};
      const fields = ['name', 'description', 'avatarUrl', 'privacy', 'inviteCode', 'announcementsOnly', 'pinnedMessages', 'roles', 'participantIds'];
      fields.forEach(f => {
        if (updates[f] !== undefined) {
          if (f === 'name') {
            allowedUpdates[f] = updates[f].toUpperCase();
          } else {
            allowedUpdates[f] = updates[f];
          }
        }
      });

      if (Object.keys(allowedUpdates).length > 0) {
        await updateDoc(chatRef, allowedUpdates);
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Delete Group: DELETE /api/groups/:id
  app.delete("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const chatRef = doc(db, 'chats', id);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }

      await deleteDoc(chatRef);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Join Group via invite link/code or public access: POST /api/groups/:id/join
  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, inviteCode } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const chatRef = doc(db, 'chats', id);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }

      const groupData = snap.data();
      if (groupData.privacy === 'private' && groupData.inviteCode && groupData.inviteCode !== inviteCode) {
        return res.status(403).json({ error: "Invalid group invite/join code." });
      }

      const participantIds: string[] = groupData.participantIds || [];
      const roles = groupData.roles || {};

      if (!participantIds.includes(userId)) {
        participantIds.push(userId);
        roles[userId] = 'member';
        await updateDoc(chatRef, {
          participantIds,
          roles
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Invite Member to Group: POST /api/groups/:id/invite
  app.post("/api/groups/:id/invite", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const chatRef = doc(db, 'chats', id);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }

      const groupData = snap.data();
      const participantIds: string[] = groupData.participantIds || [];
      const roles = groupData.roles || {};

      if (!participantIds.includes(userId)) {
        participantIds.push(userId);
        roles[userId] = 'member';
        await updateDoc(chatRef, {
          participantIds,
          roles
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Remove Member / Left Group: DELETE /api/groups/:id/member/:userId
  app.delete("/api/groups/:id/member/:userId", async (req, res) => {
    try {
      const { id, userId } = req.params;
      const chatRef = doc(db, 'chats', id);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }

      const groupData = snap.data();
      const participantIds = (groupData.participantIds || []).filter((id: string) => id !== userId);
      const roles = { ...(groupData.roles || {}) };
      delete roles[userId];

      await updateDoc(chatRef, {
        participantIds,
        roles
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Get Group Messages: GET /api/groups/:id/messages
  app.get("/api/groups/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const messagesRef = collection(db, 'chats', id, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));
      const snap = await getDocs(q);
      const messages = snap.docs.map(doc => doc.data());
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Post Group Message: POST /api/groups/:id/messages
  app.post("/api/groups/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        senderId,
        senderDisplayName = "Relay Node",
        plainText = "",
        messageType = "text",
        mediaUrl = "",
        mediaType = "",
        mediaName = "",
        replyToId = "",
        replyToText = "",
        replyToSenderName = "",
        pollData = null
      } = req.body;

      if (!senderId) {
        return res.status(400).json({ error: "Missing required field: senderId" });
      }

      const messageId = doc(collection(db, 'chats', id, 'messages')).id;
      const messageRef = doc(db, 'chats', id, 'messages', messageId);

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
        createdAt: new Date(),
        messageType,
        mediaUrl,
        mediaType,
        mediaName,
        replyToId,
        replyToText,
        replyToSenderName,
        reactions: {},
        pollData: pollData ? {
          question: pollData.question || "",
          options: pollData.options || [],
          votes: pollData.votes || {}
        } : null
      };

      await setDoc(messageRef, messageData);

      // Update parent chat lastMessage
      const chatRef = doc(db, 'chats', id);
      let snippet = plainText;
      if (messageType === 'poll') snippet = `📊 Poll: ${pollData?.question || ""}`;
      else if (messageType === 'system') snippet = plainText;
      else if (mediaUrl) snippet = `📎 Attachment: ${mediaName || mediaType}`;

      await updateDoc(chatRef, {
        lastMessage: messageType === 'system' ? snippet : `${senderDisplayName.toUpperCase()}: ${snippet.slice(0, 50)}`,
        lastMessageAt: new Date()
      });

      res.status(201).json({ success: true, messageId, message: messageData });
    } catch (err: any) {
      console.error("[POST message] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Update Message (Edit Message or Cast Vote): PATCH /api/messages/:id OR PATCH /api/groups/:chatId/messages/:id
  app.patch(["/api/messages/:id", "/api/groups/:chatId/messages/:id"], async (req, res) => {
    try {
      const { id, chatId: paramChatId } = req.params;
      const { chatId = paramChatId, plainText, pollData } = req.body;

      if (!chatId) {
        return res.status(400).json({ error: "Missing required field: chatId" });
      }

      const messageRef = doc(db, 'chats', chatId, 'messages', id);
      const snap = await getDoc(messageRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Message not found" });
      }

      const updates: any = {};
      if (plainText !== undefined) {
        updates.plainText = plainText;
        updates.edited = true;
      }
      if (pollData !== undefined) {
        updates.pollData = pollData;
      }

      await updateDoc(messageRef, updates);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Delete Message: DELETE /api/messages/:id OR DELETE /api/groups/:chatId/messages/:id
  app.delete(["/api/messages/:id", "/api/groups/:chatId/messages/:id"], async (req, res) => {
    try {
      const { id, chatId: paramChatId } = req.params;
      const { chatId = paramChatId } = req.body;

      if (!chatId) {
        return res.status(400).json({ error: "Missing required field: chatId" });
      }

      const messageRef = doc(db, 'chats', chatId, 'messages', id);
      await deleteDoc(messageRef);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. React to Message: POST /api/messages/:id/react OR POST /api/groups/:chatId/messages/:id/react
  app.post(["/api/messages/:id/react", "/api/groups/:chatId/messages/:id/react"], async (req, res) => {
    try {
      const { id, chatId: paramChatId } = req.params;
      const { chatId = paramChatId, userId, emoji } = req.body;

      if (!chatId || !userId) {
        return res.status(400).json({ error: "Missing required fields: chatId, userId" });
      }

      const messageRef = doc(db, 'chats', chatId, 'messages', id);
      const snap = await getDoc(messageRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Message not found" });
      }

      const messageData = snap.data();
      const reactions = messageData.reactions || {};
      
      if (emoji) {
        reactions[userId] = emoji;
      } else {
        delete reactions[userId];
      }

      await updateDoc(messageRef, { reactions });
      res.json({ success: true, reactions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
