# Fara Flick FCM Push Notifications Backend Triggers

This directory contains the Firebase Cloud Functions v2 backend configuration required to automatically deliver push notifications to Android devices when messages are sent or posts are liked.

## Architecture Choice: Option A (Automated Cloud Functions)

We implemented **Option A (Firebase Cloud Functions)**. This is the only production-grade solution.

- **Automatic Event Listening**: Listens to Firestore `notifications` collections natively.
- **Unified Delivery**: Both chat notifications (sent atomically via `sendE2EEMessage` inside standard client-side transactions) and like notifications (sent via `triggerLikeNotification`) automatically route to the device.
- **FCM Cleanup**: Built-in invalid token pruning (it automatically purges uninstalled app tokens from the Firestore `users/{receiverId}` registry).
- **Fallback RTDB triggers**: Also listens to `/messages/{chatId}/{messageId}` in case of future Realtime Database migrations.

---

## Deployment Steps

To deploy these functions to your Firebase project, ensure you have the Firebase CLI installed on your machine and run the following commands:

### 1. Login to Firebase CLI
```bash
firebase login
```

### 2. Configure Your Project Environment
Make sure you are targeting the correct project.
```bash
firebase use gen-lang-client-0982710068
```

### 3. Install Dependencies
Navigate to the functions folder and pull the active packages:
```bash
cd functions
npm install
```

### 4. Deploy Triggers
Deploy the cloud backend triggers:
```bash
firebase deploy --only functions
```

---

## Verification & testing Checklist

Once the functions are deployed, follow this checklist to test native pushes:

1. **Clean Register**: Compile the APK, grant push permissions, and log in. Verify that `fcmToken` and `fcmTokens` are populated inside the `users/{userId}` Firestore collection.
2. **Foreground Delivery**: Send a message from the web panel, compile on APK. Verify in-app notifications and foreground triggers.
3. **Background Delivery**: Swipe away/minimize the app on your Android device (app backgrounded). Send a message from web panel to the APK user. Verify that a heads-up system drawer push notification card arrives.
4. **App Killed / Restart Delivery**: FORCE CLOSE the APK (app killed). Send a post like activity from the web interface. Verify that the Android OS displays the FCM push drawer card, and clicking it deep links the user directly into the corresponding feed.
