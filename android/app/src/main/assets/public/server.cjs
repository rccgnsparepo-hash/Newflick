var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_fs = require("fs");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const firebaseConfig = JSON.parse((0, import_fs.readFileSync)(import_path.default.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  const firebaseApp = (0, import_app.initializeApp)(firebaseConfig);
  const db = (0, import_firestore.getFirestore)(firebaseApp, firebaseConfig.firestoreDatabaseId);
  app.post("/api/push/send", async (req, res) => {
    try {
      const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || "os_v2_app_auhm7poehvct3jlyf47m4rsj5is2idip7b4eyw5wptnokevhjxu6vivdx2wzqquxx3p4msxykz7fxfajtejklrkbi6tdxaqvs2zm6pi";
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
