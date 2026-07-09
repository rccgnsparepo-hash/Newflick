const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onValueCreated } = require("firebase-functions/v2/database");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// CRITICAL: Firestore custom Database ID retrieved from firebase-applet-config.json
const FIRESTORE_DATABASE_ID = "ai-studio-3f0e07d3-583e-41cd-9f39-778730aa16a2";

// Set production-grade v2 Global Options to minimize latency and eliminate cold starts
setGlobalOptions({
  region: "europe-west2",
  memory: "256MiB",
  minInstances: 1, // Keep 1 instance warm to eliminate cold starts and match WhatsApp delivery quality
  timeoutSeconds: 60,
  maxInstances: 10
});

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore(FIRESTORE_DATABASE_ID);

// OneSignal Credentials
const ONESIGNAL_APP_ID = "050ecfbd-c43d-453d-a578-2f3ece4649ea";
const ONESIGNAL_REST_KEY = "os_v2_app_auhm7poehvct3jlyf47m4rsj5is2idip7b4eyw5wptnokevhjxu6vivdx2wzqquxx3p4msxykz7fxfajtejklrkbi6tdxaqvs2zm6pi";

/**
 * Helper to dispatch push notification via OneSignal REST API.
 */
async function triggerOneSignalNotification(receiverId, title, body, extraData) {
  try {
    // Try to retrieve native subscription IDs from Firestore user profile
    const userDocRef = db.doc(`users/${receiverId}`);
    const userDoc = await userDocRef.get();
    
    let playerIds = [];
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.oneSignalId) {
        playerIds.push(userData.oneSignalId);
      }
      if (userData.oneSignalSubscriptionId) {
        playerIds.push(userData.oneSignalSubscriptionId);
      }
      if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
        playerIds.push(...userData.oneSignalSubscriptionIds);
      }
    }

    // Deduplicate and filter empty/invalid strings
    playerIds = [...new Set(playerIds)].filter(t => typeof t === 'string' && t.trim().length > 0);

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      headings: {
        en: title
      },
      contents: {
        en: body || ""
      },
      data: extraData || {},
      priority: 10,                 // High priority: dispatches immediately and wakes up deep-sleeping devices
      ttl: 259200,                  // Time To Live: 3 days in seconds
      android_visibility: 1,        // Public: visible on lock screen
      android_sound: "default",
      ios_sound: "default"
    };

    // Collapse multiple push notifications from the same conversation/chat to match WhatsApp design
    if (extraData && extraData.chatId) {
      payload.collapse_id = extraData.chatId;
      payload.android_group = extraData.chatId;
    }

    // Use specific subscription IDs if registered, otherwise fall back to targeting user via their external authenticated UID alias!
    if (playerIds.length > 0) {
      payload.include_subscription_ids = playerIds;
      console.log(`[OneSignal Dispatch] Sending to receiver ${receiverId} via explicit subscription list:`, playerIds);
    } else {
      payload.include_aliases = {
        external_id: [receiverId]
      };
      payload.target_channel = "push";
      console.log(`[OneSignal Dispatch] Sending to receiverId alias: ${receiverId}`);
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`[OneSignal Dispatch] Outcome for ${receiverId}:`, JSON.stringify(result));
    
    // Clean up invalid or stale subscription IDs if reported by OneSignal
    if (result.errors && Array.isArray(result.errors) && playerIds.length > 0 && userDoc.exists) {
      // If error indicates invalid player ID or token, we could sanitize, but fallback is robust.
      console.warn("[OneSignal Dispatch] Observed errors in response:", result.errors);
    }
  } catch (err) {
    console.error("[OneSignal Dispatch] Network error posting to OneSignal:", err);
  }
}

/**
 * 1. FIRESTORE TRIGGER: Triggers when a new document is written under `notifications/{notificationId}`.
 * This covers:
 * - New chat messages (created atomically in transaction via sendE2EEMessage)
 * - Social Feed Likes, Reactions, and other in-app action alerts
 */
exports.sendPushOnNotificationCreated = onDocumentCreated({
  document: "notifications/{notificationId}",
  database: FIRESTORE_DATABASE_ID
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("[Firestore Trigger] Event has no data snapshot.");
    return;
  }

  const notificationData = snapshot.data();
  console.log("[Firestore Trigger] Intercepted notification doc:", JSON.stringify(notificationData));

  const { receiverId, title, body, senderName, senderId, type } = notificationData;

  if (!receiverId) {
    console.warn("[Firestore Trigger] Missing receiverId, cannot deliver push.");
    return;
  }

  if (!title) {
    console.warn("[Firestore Trigger] Missing notification title, skipping.");
    return;
  }

  const extraData = {
    type: type || "standard",
    senderId: senderId || "",
    senderName: senderName || "",
    id: notificationData.id || "",
    chatId: notificationData.chatId || ""
  };

  await triggerOneSignalNotification(receiverId, title, body, extraData);
});

/**
 * 2. REALTIME DATABASE TRIGGER: Alternate/Fallback DB trigger.
 * Triggers when a new message is inserted in Realtime Database at `/messages/{chatId}/{messageId}`.
 * This ensures that if the developer incorporates Realtime Database for chat services in the future,
 * push notification pipelines automatically support it.
 */
exports.sendPushOnRTDBMessageCreated = onValueCreated({
  ref: "/messages/{chatId}/{messageId}"
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("[RTDB Trigger] Event data snapshot empty.");
    return;
  }

  const messageData = snapshot.val();
  console.log("[RTDB Trigger] Intercepted new RTDB message node:", JSON.stringify(messageData));

  // Destructure typical Chat structure
  const { senderId, receiverId, content, text, senderDisplayName } = messageData;
  const bodyText = content || text || "Sent an attachment";
  const senderName = senderDisplayName || "Someone";

  if (!receiverId) {
    console.warn("[RTDB Trigger] No receiverId field found in RTDB message, skipping.");
    return;
  }

  const extraData = {
    type: "message",
    senderId: senderId || "",
    senderName: senderName || "",
    id: event.params.messageId || "",
    chatId: event.params.chatId || ""
  };

  await triggerOneSignalNotification(receiverId, `Message from ${senderName}`, bodyText, extraData);
});

/**
 * 3. FIRESTORE TRIGGER: Triggers when a new document is written under `news/{newsId}`.
 * Sends a high-priority push notification to all users (broadcast segment) with rich metadata!
 */
exports.sendPushOnNewsCreated = onDocumentCreated({
  document: "news/{newsId}",
  database: FIRESTORE_DATABASE_ID
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("[Firestore News Trigger] Event has no data.");
    return;
  }

  const newsData = snapshot.data();
  console.log("[Firestore News Trigger] Intercepted news doc:", JSON.stringify(newsData));

  const { title, body, summary, category, impactLevel } = newsData;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ["All"], // Broadcast to all active push subscribers
    headings: {
      en: title || "NEWS WIRE ALERT"
    },
    contents: {
      en: summary || body || "New technical signal packet broadcast."
    },
    data: {
      type: "news",
      id: event.params.newsId,
      newsId: event.params.newsId,
      title: title || "NEWS WIRE ALERT",
      body: summary || body || "New technical signal packet broadcast.",
      priority: impactLevel === "CRITICAL" ? "high" : "normal",
      showPopup: true,
      popupDuration: 3000
    }
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("[Firestore News Trigger] Broadcast push response:", JSON.stringify(result));
  } catch (err) {
    console.error("[Firestore News Trigger] Network error sending broadcast:", err);
  }
});

/**
 * 4. FIRESTORE TRIGGER: Direct Chat Message creation push notification pipeline.
 * Triggers directly from the nested subcollection document: `chats/{chatId}/messages/{messageId}`.
 * This completely eliminates the need for the client-side database layer to create
 * intermediate notification documents inside chat write transactions, thereby solving latency
 * bottle-necks and permission errors!
 */
exports.sendPushOnMessageCreated = onDocumentCreated({
  document: "chats/{chatId}/messages/{messageId}",
  database: FIRESTORE_DATABASE_ID
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("[Direct Message Trigger] Event has no data snapshot.");
    return;
  }

  const messageData = snapshot.data();
  console.log("[Direct Message Trigger] Intercepted new message doc:", JSON.stringify(messageData));

  const { senderId, receiverId, participantIds, senderDisplayName, isGroupMessage } = messageData;
  const senderName = senderDisplayName || "Someone";

  // Check if it is a group chat message or has multiple participantIds
  if (isGroupMessage || (participantIds && participantIds.length > 2)) {
    console.log(`[Direct Message Trigger] Group message detected in ${event.params.chatId}. Broadcasting to participants.`);
    const receivers = (participantIds || []).filter(uid => uid !== senderId);

    const extraData = {
      type: "message",
      senderId: senderId || "",
      senderName: senderName,
      id: event.params.messageId,
      chatId: event.params.chatId,
      isGroup: true
    };

    // Broadcast push notification to each other participant
    for (const recId of receivers) {
      await triggerOneSignalNotification(recId, `Group: ${senderName}`, 'Click to unlock private message', extraData);
    }
  } else if (receiverId) {
    // Direct chat message
    const extraData = {
      type: "message",
      senderId: senderId || "",
      senderName: senderName,
      id: event.params.messageId,
      chatId: event.params.chatId
    };

    await triggerOneSignalNotification(receiverId, `E2EE Message from ${senderName}`, 'Click to unlock private message', extraData);
  } else {
    console.warn("[Direct Message Trigger] No clear receiverId/participants. Skipping push.");
  }
});
