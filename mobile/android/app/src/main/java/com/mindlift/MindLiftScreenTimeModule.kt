package com.mindlift

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

/**
 * React Native native module that returns today's total device screen-on time
 * in minutes using Android's UsageStatsManager API.
 *
 * PERMISSION: android.permission.PACKAGE_USAGE_STATS is a special app-ops
 * permission. The user must grant it via:
 *   Settings → Apps → Special App Access → Usage Access → MindLift
 *
 * Returns null when:
 * - Permission has not been granted
 * - The API returns no data (e.g., first boot, privacy restrictions)
 *
 * JS usage: NativeModules.MindLiftScreenTime.getTodayScreenMinutes() → Promise<number | null>
 */
class MindLiftScreenTimeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MindLiftScreenTime"

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = reactApplicationContext
            .getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactApplicationContext.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @ReactMethod
    fun getTodayScreenMinutes(promise: Promise) {
        if (!hasUsageStatsPermission()) {
            promise.resolve(null)
            return
        }

        val usageStatsManager = reactApplicationContext
            .getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

        if (usageStatsManager == null) {
            promise.resolve(null)
            return
        }

        // Query from midnight today to now.
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val startOfDay = cal.timeInMillis
        val now = System.currentTimeMillis()

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startOfDay,
            now,
        )

        if (stats.isNullOrEmpty()) {
            promise.resolve(null)
            return
        }

        // Sum foreground time across all apps, then convert ms → minutes.
        val totalMs = stats.sumOf { it.totalTimeInForeground }
        val totalMinutes = (totalMs / 60_000L).toInt()

        // Clamp to valid spec range [0, 1440] (24 hours).
        val clamped = totalMinutes.coerceIn(0, 1440)
        promise.resolve(clamped)
    }
}
