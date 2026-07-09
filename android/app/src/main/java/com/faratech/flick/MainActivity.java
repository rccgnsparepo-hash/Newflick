package com.faratech.flick;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. Messages Channel (High Importance, Badge Support, Vibration)
            NotificationChannel messagesChannel = new NotificationChannel(
                    "messages",
                    "Messages",
                    NotificationManager.IMPORTANCE_HIGH
            );
            messagesChannel.setDescription("Direct messages and chat group conversation alerts.");
            messagesChannel.enableVibration(true);
            messagesChannel.setVibrationPattern(new long[]{0, 250, 250, 250});
            messagesChannel.setShowBadge(true);
            messagesChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            // 2. Calls Channel (High Importance, Distinct Call Vibration Pattern)
            NotificationChannel callsChannel = new NotificationChannel(
                    "calls",
                    "Calls",
                    NotificationManager.IMPORTANCE_HIGH
            );
            callsChannel.setDescription("Incoming video and voice call alerts.");
            callsChannel.enableVibration(true);
            callsChannel.setVibrationPattern(new long[]{0, 500, 250, 500, 250, 500});
            callsChannel.setShowBadge(true);
            callsChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            // 3. Mentions Channel (High Importance, Badge Support)
            NotificationChannel mentionsChannel = new NotificationChannel(
                    "mentions",
                    "Mentions & Highlights",
                    NotificationManager.IMPORTANCE_HIGH
            );
            mentionsChannel.setDescription("Alerts when someone mentions you in a post or message.");
            mentionsChannel.enableVibration(true);
            mentionsChannel.setShowBadge(true);

            // 4. Announcements Channel (Default Importance, Badge Support)
            NotificationChannel announcementsChannel = new NotificationChannel(
                    "announcements",
                    "Announcements & Broadcasts",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            announcementsChannel.setDescription("Important news, community announcements and system-wide broadcasts.");
            announcementsChannel.setShowBadge(true);

            // 5. Updates Channel (Low Importance, Badge Disabled)
            NotificationChannel updatesChannel = new NotificationChannel(
                    "updates",
                    "App Updates & Features",
                    NotificationManager.IMPORTANCE_LOW
                );
            updatesChannel.setDescription("Non-intrusive notifications about newly added app features, patches or tips.");
            updatesChannel.setShowBadge(false);

            // Register channels with Android OS
            notificationManager.createNotificationChannel(messagesChannel);
            notificationManager.createNotificationChannel(callsChannel);
            notificationManager.createNotificationChannel(mentionsChannel);
            notificationManager.createNotificationChannel(announcementsChannel);
            notificationManager.createNotificationChannel(updatesChannel);
        }
    }
}
