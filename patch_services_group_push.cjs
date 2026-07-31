const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(
  /\/\/ Validate and save\s*InAppNotificationSchema\.parse\(notifyPayload\);\s*await setDoc\(notificationRef, notifyPayload\);\s*\/\/ Note: Native push notification dispatch is fully managed by the server listener \(server\.ts\)\s*\/\/ when notification is written above\./g,
  `// Validate and save
            InAppNotificationSchema.parse(notifyPayload);
            await setDoc(notificationRef, notifyPayload);
            
            // FAST PATH INSTANT NATIVE PUSH DISPATCH
            try {
              const { sendOneSignalPush } = await import('./pushNotifications');
              await sendOneSignalPush(destUid, \`Group \${chatSnap.data().name || 'Chat'}\`, \`\${senderDisplayName}: \${snippet.slice(0, 75)}\`, {
                chatId,
                senderName: senderDisplayName,
                type: 'group_message'
              });
            } catch (pushFastPathErr) {
               console.warn("Fast-path group push failed, relying on backend watcher", pushFastPathErr);
            }`
);

fs.writeFileSync('src/lib/services.ts', code);
