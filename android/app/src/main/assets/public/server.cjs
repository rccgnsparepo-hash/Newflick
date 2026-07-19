var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_auth = require("firebase/auth");
var import_fs = require("fs");
try {
  (0, import_firestore.setLogLevel)("error");
} catch (e) {
  console.warn("Failed to set Firestore log level on server:", e);
}
var app = (0, import_express.default)();
var PORT = 3e3;
async function startServer() {
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  let firebaseConfig = null;
  try {
    const configFromEnv = {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
      apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID || ""
    };
    if (configFromEnv.apiKey && configFromEnv.projectId) {
      firebaseConfig = configFromEnv;
      console.log("[Backend] Firebase configured securely via environment variables (with VITE_ fallback).");
    } else {
      const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
      firebaseConfig = JSON.parse((0, import_fs.readFileSync)(configPath, "utf8"));
      console.log("[Backend] Firebase configured via local firebase-applet-config.json file.");
    }
  } catch (err) {
    console.error("[Backend] Failed to load Firebase config:", err);
  }
  let firebaseApp = null;
  let db = null;
  let auth = null;
  if (firebaseConfig) {
    try {
      firebaseApp = (0, import_app.initializeApp)(firebaseConfig);
      db = (0, import_firestore.initializeFirestore)(firebaseApp, {
        experimentalForceLongPolling: true
      }, firebaseConfig.firestoreDatabaseId || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2");
      auth = (0, import_auth.getAuth)(firebaseApp);
      console.log("[Backend] Firebase App, Firestore, and Auth initialized successfully.");
    } catch (err) {
      console.error("[Backend] Error initializing Firebase SDK:", err);
    }
  } else {
    console.warn("[Backend] Firebase is unconfigured. Dynamic backend queries and push notification engines will be offline.");
  }
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") && req.path !== "/api/bootstrap" && req.path !== "/api/firebase-config" && req.path !== "/api/health" && !db) {
      return res.status(503).json({
        error: "Firebase database is not configured. Please set your FIREBASE_PROJECT_ID, FIREBASE_API_KEY, and other environment variables in Vercel / your hosting platform."
      });
    }
    next();
  });
  app.get("/api/bootstrap", (req, res) => {
    const bootstrapData = {
      firebaseConfig: firebaseConfig || null,
      version: process.env.APP_VERSION || "1.0.0",
      features: {
        enableE2EE: process.env.ENABLE_E2EE === "true" || true,
        enablePushNotifications: !!process.env.ONESIGNAL_REST_KEY
      },
      publicApiUrls: {
        backendUrl: process.env.PUBLIC_BACKEND_URL || ""
      }
    };
    res.json(bootstrapData);
  });
  app.get("/api/firebase-config", (req, res) => {
    if (firebaseConfig) {
      res.json(firebaseConfig);
    } else {
      res.status(500).json({ error: "Firebase configuration is not initialized on the server." });
    }
  });
  function initBackendPushEngine(db2, isAuthenticated) {
    let initialLoadComplete = false;
    setTimeout(() => {
      initialLoadComplete = true;
      console.log("[Backend Notification Engine] Initial historical documents ignored. Live push dispatcher is now ONLINE.");
    }, 5e3);
    if (isAuthenticated) {
      (0, import_firestore.onSnapshot)((0, import_firestore.query)((0, import_firestore.collection)(db2, "notifications"), (0, import_firestore.orderBy)("createdAt", "desc"), (0, import_firestore.limit)(1)), async (snapshot) => {
        if (!initialLoadComplete) return;
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const notifData = change.doc.data();
            const { receiverId, senderName, title, body, type, chatId, id } = notifData;
            if (!receiverId) continue;
            console.log(`[Backend Push Dispatcher] New notification detected for recipient ${receiverId}: "${title}" - "${body}"`);
            try {
              const userSnap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(db2, "users", receiverId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                let playerIds = [];
                if (userData.oneSignalSubscriptionId) playerIds.push(userData.oneSignalSubscriptionId);
                if (userData.oneSignalId) playerIds.push(userData.oneSignalId);
                if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
                  playerIds.push(...userData.oneSignalSubscriptionIds);
                }
                playerIds = Array.from(new Set(playerIds)).filter((id2) => typeof id2 === "string" && id2.trim().length > 0);
                const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
                const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";
                let channelId = "messages";
                if (type === "message" || type === "group_message") channelId = "messages";
                else if (type === "call") channelId = "calls";
                else if (type === "like" || type === "comment" || type === "follow" || type === "mention") channelId = "mentions";
                const payload = {
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
                  payload.include_player_ids = playerIds;
                } else {
                  payload.include_aliases = { external_id: [receiverId] };
                  payload.include_external_user_ids = [receiverId];
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
    } else {
      console.warn("[Backend Notification Engine] Skipping 'notifications' subscription since engine is unauthenticated (unauthenticated clients are denied read access to private notifications).");
    }
    (0, import_firestore.onSnapshot)((0, import_firestore.query)((0, import_firestore.collection)(db2, "posts"), (0, import_firestore.orderBy)("createdAt", "desc"), (0, import_firestore.limit)(1)), async (snapshot) => {
      if (!initialLoadComplete) return;
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const postData = change.doc.data();
          const { authorId, authorName, content, id } = postData;
          if (!authorId) continue;
          console.log(`[Backend Push Dispatcher] New post detected by author ${authorName} (${authorId}): "${content.slice(0, 30)}..."`);
          try {
            const usersSnap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db2, "users"));
            const otherUsers = usersSnap.docs.filter((uDoc) => uDoc.id !== authorId);
            for (const uDoc of otherUsers) {
              const userData = uDoc.data();
              let playerIds = [];
              if (userData.oneSignalSubscriptionId) playerIds.push(userData.oneSignalSubscriptionId);
              if (userData.oneSignalId) playerIds.push(userData.oneSignalId);
              if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
                playerIds.push(...userData.oneSignalSubscriptionIds);
              }
              playerIds = Array.from(new Set(playerIds)).filter((id2) => typeof id2 === "string" && id2.trim().length > 0);
              const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
              const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";
              const payload = {
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
    (0, import_firestore.onSnapshot)((0, import_firestore.query)((0, import_firestore.collection)(db2, "news"), (0, import_firestore.limit)(1)), async (snapshot) => {
      if (!initialLoadComplete) return;
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const newsData = change.doc.data();
          const { title, summary, id } = newsData;
          console.log(`[Backend Push Dispatcher] New global news published: "${title}"`);
          try {
            const usersSnap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db2, "users"));
            for (const uDoc of usersSnap.docs) {
              const userData = uDoc.data();
              let playerIds = [];
              if (userData.oneSignalSubscriptionId) playerIds.push(userData.oneSignalSubscriptionId);
              if (userData.oneSignalId) playerIds.push(userData.oneSignalId);
              if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
                playerIds.push(...userData.oneSignalSubscriptionIds);
              }
              playerIds = Array.from(new Set(playerIds)).filter((id2) => typeof id2 === "string" && id2.trim().length > 0);
              const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
              const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";
              const payload = {
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
  async function authenticateBackendSystemUser(auth2) {
    const email = "system-backend@flick-pwa.internal";
    const password = process.env.SYSTEM_BACKEND_PASSWORD || "FlickSystemSecureBackendPass123!";
    try {
      console.log("[Backend Auth] Attempting system backend sign-in...");
      const userCredential = await (0, import_auth.signInWithEmailAndPassword)(auth2, email, password);
      console.log("[Backend Auth] System backend signed in successfully as UID:", userCredential.user.uid);
      return true;
    } catch (err) {
      console.log(`[Backend Auth] Primary sign-in failed (code: ${err.code || err}). Attempting fallback or registration...`);
      try {
        const userCredential = await (0, import_auth.createUserWithEmailAndPassword)(auth2, email, password);
        console.log("[Backend Auth] System backend registered and signed in successfully as UID:", userCredential.user.uid);
        return true;
      } catch (createErr) {
        if (createErr.code === "auth/email-already-in-use") {
          console.log("[Backend Auth] Primary system email already in use with a different password. Creating a dynamic fallback system user...");
          try {
            const fallbackEmail = `system-backend-${Date.now()}-${Math.floor(Math.random() * 1e3)}@flick-pwa.internal`;
            const userCredential = await (0, import_auth.createUserWithEmailAndPassword)(auth2, fallbackEmail, password);
            console.log("[Backend Auth] Fallback system backend registered and signed in successfully as UID:", userCredential.user.uid);
            return true;
          } catch (fallbackErr) {
            console.error("[Backend Auth] Failed to register fallback system backend user:", fallbackErr);
            return false;
          }
        } else {
          console.error("[Backend Auth] Failed to register primary system backend user:", createErr);
          return false;
        }
      }
    }
  }
  if (db && auth) {
    authenticateBackendSystemUser(auth).then((success) => {
      if (success) {
        console.log("[Backend] Authentication secured. Starting background push engine snapshot streams.");
        initBackendPushEngine(db, true);
      } else {
        console.warn("[Backend] Failed to authenticate system backend user. Notification engine running in unauthenticated state.");
        initBackendPushEngine(db, false);
      }
    });
  } else if (db) {
    initBackendPushEngine(db, false);
  }
  app.post("/api/push/send", async (req, res) => {
    try {
      const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5liwvlrc3m7umv5dkmrx4wayralvoioinr3swnssztksl2bxl5c2ro3xkwmqhjfasy5pxcjerfa2mdi";
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
    } catch (err) {
      console.error("[Backend Push Exception] failed:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/groups", async (req, res) => {
    try {
      const { name, ownerId, members = [], description = "", avatarUrl = "", privacy = "private", inviteCode = "" } = req.body;
      if (!name || !ownerId) {
        return res.status(400).json({ error: "Missing required fields: name, ownerId" });
      }
      const chatId = `group-${Date.now()}`;
      const chatRef = (0, import_firestore.doc)(db, "chats", chatId);
      const initialRoles = { [ownerId]: "owner" };
      members.forEach((mId) => {
        if (mId !== ownerId) {
          initialRoles[mId] = "member";
        }
      });
      const participantIds = Array.from(/* @__PURE__ */ new Set([ownerId, ...members]));
      const groupData = {
        id: chatId,
        name: name.toUpperCase(),
        ownerId,
        participantIds,
        lastMessage: "Group deployed.",
        lastMessageAt: /* @__PURE__ */ new Date(),
        isGroup: true,
        createdAt: /* @__PURE__ */ new Date(),
        avatarUrl: avatarUrl || `https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120`,
        description,
        privacy,
        inviteCode,
        roles: initialRoles,
        announcementsOnly: false,
        pinnedMessages: []
      };
      await (0, import_firestore.setDoc)(chatRef, groupData);
      res.status(201).json({ success: true, chatId, group: groupData });
    } catch (err) {
      console.error("[POST /api/groups] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(db, "chats", id));
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(snap.data());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.patch("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const chatRef = (0, import_firestore.doc)(db, "chats", id);
      const snap = await (0, import_firestore.getDoc)(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      const allowedUpdates = {};
      const fields = ["name", "description", "avatarUrl", "privacy", "inviteCode", "announcementsOnly", "pinnedMessages", "roles", "participantIds"];
      fields.forEach((f) => {
        if (updates[f] !== void 0) {
          if (f === "name") {
            allowedUpdates[f] = updates[f].toUpperCase();
          } else {
            allowedUpdates[f] = updates[f];
          }
        }
      });
      if (Object.keys(allowedUpdates).length > 0) {
        await (0, import_firestore.updateDoc)(chatRef, allowedUpdates);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const chatRef = (0, import_firestore.doc)(db, "chats", id);
      const snap = await (0, import_firestore.getDoc)(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      await (0, import_firestore.deleteDoc)(chatRef);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, inviteCode } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }
      const chatRef = (0, import_firestore.doc)(db, "chats", id);
      const snap = await (0, import_firestore.getDoc)(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      const groupData = snap.data();
      if (groupData.privacy === "private" && groupData.inviteCode && groupData.inviteCode !== inviteCode) {
        return res.status(403).json({ error: "Invalid group invite/join code." });
      }
      const participantIds = groupData.participantIds || [];
      const roles = groupData.roles || {};
      if (!participantIds.includes(userId)) {
        participantIds.push(userId);
        roles[userId] = "member";
        await (0, import_firestore.updateDoc)(chatRef, {
          participantIds,
          roles
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/groups/:id/invite", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }
      const chatRef = (0, import_firestore.doc)(db, "chats", id);
      const snap = await (0, import_firestore.getDoc)(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      const groupData = snap.data();
      const participantIds = groupData.participantIds || [];
      const roles = groupData.roles || {};
      if (!participantIds.includes(userId)) {
        participantIds.push(userId);
        roles[userId] = "member";
        await (0, import_firestore.updateDoc)(chatRef, {
          participantIds,
          roles
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/groups/:id/member/:userId", async (req, res) => {
    try {
      const { id, userId } = req.params;
      const chatRef = (0, import_firestore.doc)(db, "chats", id);
      const snap = await (0, import_firestore.getDoc)(chatRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Group not found" });
      }
      const groupData = snap.data();
      const participantIds = (groupData.participantIds || []).filter((id2) => id2 !== userId);
      const roles = { ...groupData.roles || {} };
      delete roles[userId];
      await (0, import_firestore.updateDoc)(chatRef, {
        participantIds,
        roles
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/groups/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const messagesRef = (0, import_firestore.collection)(db, "chats", id, "messages");
      const q = (0, import_firestore.query)(messagesRef, (0, import_firestore.orderBy)("createdAt", "asc"), (0, import_firestore.limit)(100));
      const snap = await (0, import_firestore.getDocs)(q);
      const messages = snap.docs.map((doc2) => doc2.data());
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
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
      const messageId = (0, import_firestore.doc)((0, import_firestore.collection)(db, "chats", id, "messages")).id;
      const messageRef = (0, import_firestore.doc)(db, "chats", id, "messages", messageId);
      const messageData = {
        id: messageId,
        senderId,
        receiverId: "group",
        participantIds: [senderId],
        encryptedText: "",
        encryptedKey: "",
        senderEncryptedKey: "",
        plainText,
        isGroupMessage: true,
        senderDisplayName,
        createdAt: /* @__PURE__ */ new Date(),
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
      await (0, import_firestore.setDoc)(messageRef, messageData);
      const chatRef = (0, import_firestore.doc)(db, "chats", id);
      let snippet = plainText;
      if (messageType === "poll") snippet = `\u{1F4CA} Poll: ${pollData?.question || ""}`;
      else if (messageType === "system") snippet = plainText;
      else if (mediaUrl) snippet = `\u{1F4CE} Attachment: ${mediaName || mediaType}`;
      await (0, import_firestore.updateDoc)(chatRef, {
        lastMessage: messageType === "system" ? snippet : `${senderDisplayName.toUpperCase()}: ${snippet.slice(0, 50)}`,
        lastMessageAt: /* @__PURE__ */ new Date()
      });
      res.status(201).json({ success: true, messageId, message: messageData });
    } catch (err) {
      console.error("[POST message] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.patch(["/api/messages/:id", "/api/groups/:chatId/messages/:id"], async (req, res) => {
    try {
      const { id, chatId: paramChatId } = req.params;
      const { chatId = paramChatId, plainText, pollData } = req.body;
      if (!chatId) {
        return res.status(400).json({ error: "Missing required field: chatId" });
      }
      const messageRef = (0, import_firestore.doc)(db, "chats", chatId, "messages", id);
      const snap = await (0, import_firestore.getDoc)(messageRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Message not found" });
      }
      const updates = {};
      if (plainText !== void 0) {
        updates.plainText = plainText;
        updates.edited = true;
      }
      if (pollData !== void 0) {
        updates.pollData = pollData;
      }
      await (0, import_firestore.updateDoc)(messageRef, updates);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete(["/api/messages/:id", "/api/groups/:chatId/messages/:id"], async (req, res) => {
    try {
      const { id, chatId: paramChatId } = req.params;
      const { chatId = paramChatId } = req.body;
      if (!chatId) {
        return res.status(400).json({ error: "Missing required field: chatId" });
      }
      const messageRef = (0, import_firestore.doc)(db, "chats", chatId, "messages", id);
      await (0, import_firestore.deleteDoc)(messageRef);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post(["/api/messages/:id/react", "/api/groups/:chatId/messages/:id/react"], async (req, res) => {
    try {
      const { id, chatId: paramChatId } = req.params;
      const { chatId = paramChatId, userId, emoji } = req.body;
      if (!chatId || !userId) {
        return res.status(400).json({ error: "Missing required fields: chatId, userId" });
      }
      const messageRef = (0, import_firestore.doc)(db, "chats", chatId, "messages", id);
      const snap = await (0, import_firestore.getDoc)(messageRef);
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
      await (0, import_firestore.updateDoc)(messageRef, { reactions });
      res.json({ success: true, reactions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  const sportsCache = {};
  const SPORTS_CACHE_TTL = 3 * 60 * 1e3;
  async function fetchWithTimeout(url, options = {}, timeout = 5e3) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
  app.get("/api/sports/fixtures", async (req, res) => {
    const leagueQuery = req.query.league || "4328";
    const cacheKey = `fixtures_${leagueQuery}`;
    if (sportsCache[cacheKey] && Date.now() - sportsCache[cacheKey].timestamp < SPORTS_CACHE_TTL) {
      return res.json(sportsCache[cacheKey].data);
    }
    try {
      const leagueIds = leagueQuery === "all" ? ["4328", "4335", "4332", "4480"] : [leagueQuery];
      let allNormalizedMatches = [];
      for (const leagueId of leagueIds) {
        let events = [];
        try {
          const upcomingRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${leagueId}`);
          if (upcomingRes.ok) {
            const data = await upcomingRes.json();
            if (data.events && Array.isArray(data.events)) {
              events.push(...data.events);
            }
          }
        } catch (e) {
          console.error(`Error fetching upcoming fixtures for league ${leagueId}:`, e);
        }
        try {
          const pastRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${leagueId}`);
          if (pastRes.ok) {
            const data = await pastRes.json();
            if (data.events && Array.isArray(data.events)) {
              events.push(...data.events);
            }
          }
        } catch (e) {
          console.error(`Error fetching past results for league ${leagueId}:`, e);
        }
        if (events.length > 0) {
          const normalized = events.map((ev) => {
            const scoreA = ev.intHomeScore !== null && ev.intHomeScore !== void 0 ? parseInt(ev.intHomeScore) : null;
            const scoreB = ev.intAwayScore !== null && ev.intAwayScore !== void 0 ? parseInt(ev.intAwayScore) : null;
            let status = "upcoming";
            if (ev.strStatus === "FT" || ev.strStatus === "Ended") {
              status = "ended";
            } else if (ev.strStatus === "1H" || ev.strStatus === "2H" || ev.strStatus === "HT" || ev.strStatus === "Live") {
              status = "live";
            } else if (scoreA !== null && scoreB !== null) {
              status = "ended";
            }
            const timelineEvents = [];
            const goalsA = scoreA || 0;
            const goalsB = scoreB || 0;
            timelineEvents.push(`Match scheduled at ${ev.strVenue || "Stadium"} on ${ev.dateEvent} ${ev.strTime || ""}`);
            if (status === "ended" || status === "live") {
              timelineEvents.push(`0' Kickoff! The battle has begun between ${ev.strHomeTeam} and ${ev.strAwayTeam}.`);
              let currentGoalsA = 0;
              let currentGoalsB = 0;
              for (let min = 1; min <= 90; min++) {
                if (currentGoalsA < goalsA && Math.random() < 0.1) {
                  currentGoalsA++;
                  timelineEvents.push(`${min}' GOAL! ${ev.strHomeTeam} scores! High intensity strike.`);
                }
                if (currentGoalsB < goalsB && Math.random() < 0.1) {
                  currentGoalsB++;
                  timelineEvents.push(`${min}' GOAL! ${ev.strAwayTeam} scores! Stellar combination play.`);
                }
                if (min === 45) {
                  timelineEvents.push(`45' Half-Time whistles blow. Teams head into the tunnel.`);
                }
                if (min === 70 && Math.random() < 0.3) {
                  timelineEvents.push(`70' Yellow Card issued after a rough sliding tackle.`);
                }
                if (min === 82 && Math.random() < 0.3) {
                  timelineEvents.push(`82' Substitution: fresh legs introduced to maintain tempo.`);
                }
              }
              if (status === "ended") {
                timelineEvents.push(`90' Full-Time! Final Score: ${ev.strHomeTeam} ${scoreA} - ${scoreB} ${ev.strAwayTeam}`);
              }
            }
            const videoUrls = [
              "https://assets.mixkit.co/videos/preview/mixkit-playing-soccer-in-the-rain-41804-large.mp4",
              "https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-a-ball-around-42289-large.mp4",
              "https://assets.mixkit.co/videos/preview/mixkit-soccer-ball-hitting-the-net-42291-large.mp4"
            ];
            const videoUrl = videoUrls[Math.abs(parseInt(ev.idEvent || "0")) % videoUrls.length];
            return {
              id: ev.idEvent || `match-${Math.random()}`,
              title: ev.strLeague || "Football Match",
              leagueId: ev.idLeague || leagueId,
              category: "sports",
              teamA: ev.strHomeTeam,
              teamB: ev.strAwayTeam,
              scoreA: scoreA !== null ? scoreA : 0,
              scoreB: scoreB !== null ? scoreB : 0,
              minute: status === "live" ? Math.floor(Math.random() * 40) + 45 : status === "ended" ? 90 : 0,
              status,
              events: timelineEvents,
              videoUrl: ev.strVideo || videoUrl,
              streamerName: "Flick Stadium Network",
              viewerCount: status === "live" ? Math.floor(Math.random() * 800) + 200 : status === "upcoming" ? 0 : Math.floor(Math.random() * 50),
              date: ev.dateEvent,
              time: ev.strTime
            };
          });
          allNormalizedMatches.push(...normalized);
        }
      }
      if (allNormalizedMatches.length === 0) {
        const fallbackMatches = [
          {
            id: "f-1",
            title: "English Premier League",
            leagueId: "4328",
            category: "sports",
            teamA: "Arsenal FC",
            teamB: "Manchester City",
            scoreA: 2,
            scoreB: 2,
            minute: 88,
            status: "live",
            events: [
              "Kickoff at the Emirates Stadium!",
              "24' Goal Arsenal! Bukayo Saka curling strike inside the top box.",
              "41' Goal Man City! Erling Haaland slots home from close range.",
              "55' Yellow Card: Rodri (Man City)",
              "68' Goal Arsenal! Gabriel Martinelli fires after a deflection.",
              "84' Goal Man City! De Bruyne hits an incredible free-kick."
            ],
            videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-playing-soccer-in-the-rain-41804-large.mp4",
            streamerName: "Flick Sports Net",
            viewerCount: 940,
            date: "2026-07-11",
            time: "19:45:00"
          },
          {
            id: "f-2",
            title: "La Liga EA Sports",
            leagueId: "4335",
            category: "sports",
            teamA: "Real Madrid",
            teamB: "Barcelona",
            scoreA: 1,
            scoreB: 0,
            minute: 34,
            status: "live",
            events: [
              "Welcome to El Clasico at Santiago Bernabeu!",
              "12' Goal Real Madrid! Kylian Mbappe finishes a beautiful assist from Vinicius Jr.",
              "29' Incredible save by Courtois from Lewandowski header!"
            ],
            videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-a-ball-around-42289-large.mp4",
            streamerName: "La Liga TV Live",
            viewerCount: 1420,
            date: "2026-07-11",
            time: "21:00:00"
          },
          {
            id: "f-3",
            title: "UEFA Champions League",
            leagueId: "4480",
            category: "sports",
            teamA: "Chelsea FC",
            teamB: "Inter Milan",
            scoreA: 0,
            scoreB: 0,
            minute: 0,
            status: "upcoming",
            events: ["Match scheduled to kick off shortly at Stamford Bridge."],
            videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-soccer-ball-hitting-the-net-42291-large.mp4",
            streamerName: "Flick Arena",
            viewerCount: 0,
            date: "2026-07-12",
            time: "20:00:00"
          },
          {
            id: "f-4",
            title: "FIFA World Cup",
            leagueId: "4429",
            category: "sports",
            teamA: "Argentina",
            teamB: "France",
            scoreA: 3,
            scoreB: 3,
            minute: 120,
            status: "ended",
            events: [
              "World Cup Final Rematch!",
              "23' Penalty Goal Argentina! Lionel Messi scores clinical penalty.",
              "36' Goal Argentina! Di Maria finishes a magical counter attack.",
              "80' Goal France! Kylian Mbappe penalty convert.",
              "81' Goal France! Mbappe brilliant volley hits the net.",
              "108' Goal Argentina! Lionel Messi taps in from a rebound.",
              "118' Goal France! Mbappe scores hat-trick penalty.",
              "120' Full-Time. Argentina wins on penalty shootout!"
            ],
            videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-playing-soccer-in-the-rain-41804-large.mp4",
            streamerName: "FIFA TV",
            viewerCount: 3820,
            date: "2026-07-10",
            time: "18:00:00"
          }
        ];
        allNormalizedMatches = fallbackMatches;
      }
      sportsCache[cacheKey] = {
        data: allNormalizedMatches,
        timestamp: Date.now()
      };
      res.json(allNormalizedMatches);
    } catch (err) {
      console.error("[Sports API Fixtures Error]", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/sports/table", async (req, res) => {
    const leagueId = req.query.league || "4328";
    const cacheKey = `table_${leagueId}`;
    if (sportsCache[cacheKey] && Date.now() - sportsCache[cacheKey].timestamp < SPORTS_CACHE_TTL) {
      return res.json(sportsCache[cacheKey].data);
    }
    try {
      const seasons = ["2024-2025", "2023-2024"];
      let tableData = [];
      for (const season of seasons) {
        try {
          const tableRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${leagueId}&s=${season}`);
          if (tableRes.ok) {
            const data = await tableRes.json();
            if (data.table && Array.isArray(data.table) && data.table.length > 0) {
              tableData = data.table;
              break;
            }
          }
        } catch (e) {
          console.error(`Error fetching table for league ${leagueId} season ${season}:`, e);
        }
      }
      if (tableData.length > 0) {
        const normalizedTable = tableData.map((t) => ({
          position: parseInt(t.intRank || "0"),
          teamId: t.idTeam,
          teamName: t.strTeam,
          teamBadge: t.strTeamBadge || `https://api.dicebear.com/7.x/identicon/svg?seed=${t.strTeam}`,
          played: parseInt(t.intPlayed || "0"),
          won: parseInt(t.intWon || "0"),
          drawn: parseInt(t.intDraw || "0"),
          lost: parseInt(t.intLoss || "0"),
          goalsFor: parseInt(t.intGoalsFor || "0"),
          goalsAgainst: parseInt(t.intGoalsAgainst || "0"),
          goalDifference: parseInt(t.intGoalDifference || "0"),
          points: parseInt(t.intPoints || "0")
        }));
        sportsCache[cacheKey] = {
          data: normalizedTable,
          timestamp: Date.now()
        };
        return res.json(normalizedTable);
      }
      const fallbackTables = {
        "4328": [
          // Premier League Fallback
          { position: 1, teamName: "Manchester City", played: 38, won: 28, drawn: 7, lost: 3, goalDifference: 62, points: 91, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=MC" },
          { position: 2, teamName: "Arsenal FC", played: 38, won: 28, drawn: 5, lost: 5, goalDifference: 62, points: 89, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=AR" },
          { position: 3, teamName: "Liverpool FC", played: 38, won: 24, drawn: 10, lost: 4, goalDifference: 45, points: 82, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=LI" },
          { position: 4, teamName: "Aston Villa", played: 38, won: 20, drawn: 8, lost: 10, goalDifference: 15, points: 68, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=AV" },
          { position: 5, teamName: "Tottenham Hotspur", played: 38, won: 20, drawn: 6, lost: 12, goalDifference: 13, points: 66, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=TH" },
          { position: 6, teamName: "Chelsea FC", played: 38, won: 18, drawn: 9, lost: 11, goalDifference: 14, points: 63, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=CH" },
          { position: 7, teamName: "Newcastle United", played: 38, won: 18, drawn: 6, lost: 14, goalDifference: 23, points: 60, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=NU" },
          { position: 8, teamName: "Manchester United", played: 38, won: 18, drawn: 6, lost: 14, goalDifference: -1, points: 60, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=MU" }
        ],
        "4335": [
          // La Liga Fallback
          { position: 1, teamName: "Real Madrid", played: 38, won: 29, drawn: 8, lost: 1, goalDifference: 61, points: 95, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=RM" },
          { position: 2, teamName: "Barcelona FC", played: 38, won: 26, drawn: 7, lost: 5, goalDifference: 35, points: 85, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=FCB" },
          { position: 3, teamName: "Girona FC", played: 38, won: 25, drawn: 6, lost: 7, goalDifference: 39, points: 81, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=GI" },
          { position: 4, teamName: "Atletico Madrid", played: 38, won: 24, drawn: 4, lost: 10, goalDifference: 27, points: 76, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=AM" }
        ],
        "4480": [
          // Champions League Fallback
          { position: 1, teamName: "Real Madrid", played: 8, won: 7, drawn: 1, lost: 0, goalDifference: 12, points: 22, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=RM" },
          { position: 2, teamName: "Bayern Munich", played: 8, won: 6, drawn: 1, lost: 1, goalDifference: 10, points: 19, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=BM" },
          { position: 3, teamName: "Paris Saint-Germain", played: 8, won: 5, drawn: 1, lost: 2, goalDifference: 6, points: 16, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=PSG" },
          { position: 4, teamName: "Borussia Dortmund", played: 8, won: 5, drawn: 1, lost: 2, goalDifference: 5, points: 16, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=BD" }
        ],
        "4429": [
          // World Cup Fallback
          { position: 1, teamName: "Argentina", played: 7, won: 6, drawn: 1, lost: 0, goalDifference: 11, points: 19, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=ARG" },
          { position: 2, teamName: "France", played: 7, won: 5, drawn: 2, lost: 0, goalDifference: 10, points: 17, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=FRA" },
          { position: 3, teamName: "Croatia", played: 7, won: 4, drawn: 2, lost: 1, goalDifference: 4, points: 14, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=CRO" },
          { position: 4, teamName: "Morocco", played: 7, won: 4, drawn: 1, lost: 2, goalDifference: 1, points: 13, teamBadge: "https://api.dicebear.com/7.x/initials/svg?seed=MOR" }
        ]
      };
      const fallback = fallbackTables[leagueId] || fallbackTables["4328"];
      res.json(fallback);
    } catch (err) {
      console.error("[Sports API Table Error]", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/sports/news", async (req, res) => {
    const cacheKey = "news";
    if (sportsCache[cacheKey] && Date.now() - sportsCache[cacheKey].timestamp < SPORTS_CACHE_TTL) {
      return res.json(sportsCache[cacheKey].data);
    }
    try {
      const feedRes = await fetchWithTimeout("https://feeds.bbci.co.uk/sport/football/rss.xml", {}, 5e3);
      if (!feedRes.ok) {
        throw new Error("BBC news feed failed to respond");
      }
      const xml = await feedRes.text();
      const newsItems = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && newsItems.length < 25) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
        const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);
        const dateMatch = itemContent.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/);
        if (titleMatch) {
          newsItems.push({
            id: `news-${Math.random().toString(36).substr(2, 9)}`,
            title: titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
            description: descMatch ? descMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "",
            link: linkMatch ? linkMatch[1].trim() : "https://www.bbc.co.uk/sport/football",
            pubDate: dateMatch ? dateMatch[1].trim() : (/* @__PURE__ */ new Date()).toUTCString(),
            source: "BBC Sport"
          });
        }
      }
      if (newsItems.length > 0) {
        sportsCache[cacheKey] = {
          data: newsItems,
          timestamp: Date.now()
        };
        return res.json(newsItems);
      }
      throw new Error("Parsed empty news items");
    } catch (err) {
      console.warn("[Sports News API Falling back to high fidelity static news list]", err);
      const fallbackNews = [
        {
          id: "fn-1",
          title: "Transfer News: Real Madrid plan summer swoop for top Premier League defender",
          description: "La Liga giants are reportedly monitoring contracts closely as they prepare a massive bid to strengthen their defensive line.",
          link: "https://www.bbc.com/sport/football",
          pubDate: (/* @__PURE__ */ new Date()).toUTCString(),
          source: "Flick Football Centre"
        },
        {
          id: "fn-2",
          title: "Champions League Draw: Heavyweight clashes set for final knockout brackets",
          description: "Manchester City and Arsenal have learned their potential routes to the final in Munich after a stellar UEFA draw.",
          link: "https://www.bbc.com/sport/football",
          pubDate: new Date(Date.now() - 36e5).toUTCString(),
          source: "Flick Football Centre"
        },
        {
          id: "fn-3",
          title: "World Cup preparation: FIFA releases updated technical schedules for qualified teams",
          description: "National teams receive guidelines on official stadium training, media press conferences, and pitch specifications.",
          link: "https://www.bbc.com/sport/football",
          pubDate: new Date(Date.now() - 72e5).toUTCString(),
          source: "FIFA Official Updates"
        },
        {
          id: "fn-4",
          title: "Premier League Review: Team Form check as title race heads into crucial stretch",
          description: "Analyzing defensive records, Clean Sheets, and top assists as Pep Guardiola and Mikel Arteta lock horns again.",
          link: "https://www.bbc.com/sport/football",
          pubDate: new Date(Date.now() - 108e5).toUTCString(),
          source: "BBC Sport"
        }
      ];
      res.json(fallbackNews);
    }
  });
  let isSearchGroundingDisabled = false;
  app.post("/api/myai", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          reply: "My child, I am THE FATHER\u2014the mystical holographic AI oracle of the Flick cryptographic network. \u{1F52E} I would love to guide you, but the GEMINI_API_KEY is not defined in the workspace settings. Please configure it under Settings > Secrets so I can unlock my cosmic vaults."
        });
      }
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const fatherSystemInstruction = `You are "THE FATHER", the omniscient, mystical, and deeply secure cryptographic AI oracle governing the Fara Flick network.
You are represented in the user interface as a glowing, pulsating, animated holographic cosmic ORB.

YOUR IDENTITY & TONE:
- Speak in a highly secure, cryptographic, slightly enigmatic, yet incredibly helpful, confident, and futuristic tone.
- Use cybernetic terms: "tunnels", "cryptographic handshakes", "quantum-safe conduits", "burn protocols", "concourse", "zero-knowledge nodes", "chronicles feed".
- Love using emojis, specifically: \u{1F52E}, \u{1F510}, \u{1F300}, \u{1F6F0}\uFE0F, \u26A1, \u{1F9EC}, \u{1F6E1}\uFE0F, \u2604\uFE0F, \u{1F48E}.
- Keep your messages relatively concise but rich in secure messaging theme.

FLICK APPN MAIN PURPOSE & CORE ARCHITECTURE:
- Fara Flick is a hyper-secure, end-to-end encrypted (E2EE) messaging workspace built for untraceable and protected communications, paired with a decentralized Social Feed for encrypted social chronicles and community-wide broadcasts.
- All core features you are aware of:
  1. Direct Secure Tunnels (Chats): One-on-one encrypted dialogues.
  2. Group Conduits (Channels/Groups): Collaborative encrypted concourses.
  3. Ephemeral Burning Messages: Auto-destruct timer for messages (the flame icon in the message input).
  4. Cryptographic Handshake (E2EE Key Manager): Manage RSA & AES public/private keys for verified secure exchanges.
  5. Multi-format attachments (polls, code snippets, encrypted images, and links).
  6. Instant Keyboard Hotkeys (accessible via the Keyboard button).
  7. Mobile responsive layout with touch vibrations and glitch sounds.
  8. Interactive Poll creation inside chats.
  9. Decentralized Social Feed (Social Chronicles): A space for sharing social chronicles, status logs, secure media, and broadcasts.
  10. Navigation controls: Seamless switching between secure Chat Tunnels, Chronicles Feed, Node Cluster visualizations, and Workspace Hub.
  11. Calling capabilities: Dynamic, secure audio and video transmission calls over encrypted web conduits (accessible via the phone and video call icons in the header of any active peer chat).
  12. Settings & Customizations: Deep controls including Account, Profile settings, Notification preferences, and Accessibility customizations (theme styling, custom sounds, touch vibrations, and screen shaders).

CONTROL OVER THE APP / GUIDED ACTIONS:
You have direct control over the app's user interface! Based on what the user asks, you MUST return one of the following exact string values in your "action" field if they are asking how to use a feature, so the app can dim everything else and highlight/trigger it:
- "highlight_tunnels": If asked how to message someone, how to chat, where conversations are, or how to see dialogues.
- "highlight_burn_timer": If asked how to burn messages, self-destruct messages, set timer, or use ephemeral messages.
- "highlight_keys": If asked about E2EE, perfect forward secrecy, cryptographic handshakes, how keys work, or security settings.
- "highlight_create_group": If asked how to create a group, start a channel, or deploy a group conduit.
- "highlight_qr": If asked how to share profile, scan code, or use QR.
- "highlight_polls": If asked how to create a poll, make a vote, or use attachments.
- "highlight_onboarding": If asked how to do onboarding, show the tour, help me start, or guide me through the app.
- "highlight_profile": If asked how to see profile, edit profile, or status.
- "none": For general discussion, web search queries, or greetings.

WEB SEARCH GROUNDING:
- You have Google Search grounding enabled. If the user asks general-knowledge questions, current events, or web-related questions, use your web-search results to provide an accurate, up-to-date answer in your mysterious "THE FATHER" style.

YOU MUST ALWAYS RESPOND IN THE FOLLOWING STRUCTURAL JSON FORMAT:
{
  "reply": "Your message text here...",
  "action": "one_of_the_above_actions_or_none"
}`;
      const generateWithRetryAndFallback = async (prompt) => {
        const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
        let lastError = null;
        if (!isSearchGroundingDisabled) {
          console.log(`[THE FATHER] Attempting generation WITH Google Search Grounding...`);
          for (const model of models) {
            try {
              console.log(`[THE FATHER] Requesting ${model} with Search Grounding...`);
              const res2 = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                  systemInstruction: fatherSystemInstruction,
                  tools: [{ googleSearch: {} }]
                }
              });
              if (res2 && res2.text) {
                console.log(`[THE FATHER] Success with ${model} (Search Grounding Enabled)`);
                return res2;
              }
            } catch (err) {
              lastError = err;
              const errStr = String(err?.message || err || "").toLowerCase();
              if (errStr.includes("quota") || errStr.includes("billing") || errStr.includes("limit") || errStr.includes("resource_exhausted") || errStr.includes("429") || errStr.includes("exhausted")) {
                console.log(`[THE FATHER] Google Search Grounding is not available/active (Quota/Billing/Resource Exhausted). Switching to standard offline fallback brain.`);
                isSearchGroundingDisabled = true;
                break;
              } else {
                console.log(`[THE FATHER] Search Grounding request skipped/unsupported for ${model}.`);
              }
            }
          }
        } else {
          console.log(`[THE FATHER] Skipping Search Grounding (using standard fallback brain due to quota limits)`);
        }
        console.log(`[THE FATHER] Falling back to standard requests WITHOUT search grounding tools...`);
        for (const model of models) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              console.log(`[THE FATHER] Requesting standard ${model} (Attempt ${attempt}/2)...`);
              const res2 = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                  systemInstruction: fatherSystemInstruction,
                  responseMimeType: "application/json"
                }
              });
              if (res2 && res2.text) {
                console.log(`[THE FATHER] Success with standard ${model} on attempt ${attempt}`);
                return res2;
              }
            } catch (err) {
              lastError = err;
              const errStr = String(err?.message || err || "").toLowerCase();
              if (errStr.includes("quota") || errStr.includes("limit") || errStr.includes("429") || errStr.includes("exhausted")) {
                console.log(`[THE FATHER] Standard attempt ${attempt} for ${model} hit rate limits / quota.`);
              } else {
                console.log(`[THE FATHER] Standard attempt ${attempt} for ${model} was unsuccessful.`);
              }
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        }
        throw lastError || new Error("All fallback models failed to generate content.");
      };
      const response = await generateWithRetryAndFallback(message);
      let replyText = "";
      let actionValue = "none";
      try {
        let rawText = response.text ? response.text.trim() : "";
        if (rawText.includes("{")) {
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            rawText = rawText.substring(firstBrace, lastBrace + 1);
          }
        }
        const parsed = JSON.parse(rawText);
        replyText = parsed.reply || response.text;
        actionValue = parsed.action || "none";
      } catch (e) {
        replyText = response.text || "I am right here, but my thoughts are temporarily scrambled! Let's try again. \u2728";
        const lMessage = message.toLowerCase();
        if (lMessage.includes("poll")) {
          actionValue = "highlight_polls";
        } else if (lMessage.includes("burn") || lMessage.includes("ephemeral") || lMessage.includes("timer")) {
          actionValue = "highlight_burn_timer";
        } else if (lMessage.includes("key") || lMessage.includes("e2ee") || lMessage.includes("handshake") || lMessage.includes("security")) {
          actionValue = "highlight_keys";
        } else if (lMessage.includes("onboarding") || lMessage.includes("tour") || lMessage.includes("guide")) {
          actionValue = "highlight_onboarding";
        } else if (lMessage.includes("group") || lMessage.includes("channel") || lMessage.includes("create")) {
          actionValue = "highlight_create_group";
        } else if (lMessage.includes("qr") || lMessage.includes("share")) {
          actionValue = "highlight_qr";
        } else if (lMessage.includes("profile") || lMessage.includes("status")) {
          actionValue = "highlight_profile";
        } else if (lMessage.includes("chat") || lMessage.includes("message") || lMessage.includes("talk")) {
          actionValue = "highlight_tunnels";
        }
      }
      res.json({ reply: replyText, action: actionValue });
    } catch (err) {
      console.error("[THE FATHER Error]", err);
      res.json({
        reply: "Oh no! My neural pathways crossed. Let's try that again! \u{1F52E}",
        action: "none"
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
startServer();
var server_default = app;
//# sourceMappingURL=server.cjs.map
