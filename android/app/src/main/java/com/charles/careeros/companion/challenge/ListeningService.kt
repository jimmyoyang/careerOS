package com.charles.careeros.companion.challenge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.charles.careeros.companion.CompanionApp
import com.charles.careeros.companion.MainActivity

class ListeningService : Service() {
    override fun onCreate() {
        super.onCreate()
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel("active_challenges", "当前接码请求", NotificationManager.IMPORTANCE_LOW))
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") { stopSelf(); return START_NOT_STICKY }
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, ListeningService::class.java).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(this, "active_challenges")
            .setSmallIcon(android.R.drawable.ic_dialog_email).setContentTitle("CareerOS 接码中")
            .setContentText("仅处理当前请求；验证码需在手机确认")
            .setVisibility(Notification.VISIBILITY_SECRET).setOngoing(true).setContentIntent(open)
            .addAction(Notification.Action.Builder(null, "停止并清空", stop).build()).build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(10, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING)
        else startForeground(10, notification)
        (application as CompanionApp).session.start()
        return START_NOT_STICKY
    }
    override fun onDestroy() { (application as CompanionApp).session.stop(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
