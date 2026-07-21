package com.mzcet.campus_connect

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE = 1001
        private const val CHANNEL_ID = "high_importance_channel"
        private const val CHANNEL_NAME = "High Importance Notifications"
        private const val CHANNEL_DESCRIPTION = "Campus Connect alerts, ticket updates and reminders."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create the notification channel (required for Android 8.0+)
        createNotificationChannel()

        // Request POST_NOTIFICATIONS permission at runtime (required for Android 13+)
        requestNotificationPermissionIfNeeded()
    }

    /**
     * Creates the FCM high-importance notification channel.
     * Safe to call multiple times — Android ignores duplicate registrations.
     * Must match channel ID declared in AndroidManifest.xml meta-data and fcm_service.dart.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }
            val notificationManager =
                getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * On Android 13+ (API 33), POST_NOTIFICATIONS must be explicitly granted
     * at runtime. Shows a system permission dialog if not yet granted.
     */
    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    NOTIFICATION_PERMISSION_REQUEST_CODE
                )
            }
        }
    }
}
