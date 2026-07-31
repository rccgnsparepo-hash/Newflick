const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(
  /\/\/ Submit push Notification metadata so recipient's device triggers sound\/banners[\s\S]*?await batch\.commit\(\);/g,
  `// Submit push Notification metadata so recipient's device triggers sound/banners
    const notifyPayload = {
      id: notificationId,
      receiverId,
      senderName: senderDisplayName,
      senderId,
      chatId,
      type: 'message' as const,
      title: \`E2EE Message from \${senderDisplayName}\`,
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
      await sendOneSignalPush(receiverId, \`E2EE Message from \${senderDisplayName}\`, 'Click to unlock private message', {
        chatId,
        senderName: senderDisplayName,
        type: 'message'
      });
    } catch (pushFastPathErr) {
      console.warn("Fast-path push failed, relying on backend watcher", pushFastPathErr);
    }`
);

fs.writeFileSync('src/lib/services.ts', code);
