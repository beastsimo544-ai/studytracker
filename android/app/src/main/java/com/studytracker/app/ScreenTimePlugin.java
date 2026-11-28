package com.studytracker.app;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {

    private static final Set<String> IGNORED_PACKAGES = new HashSet<>();

    static {
        IGNORED_PACKAGES.add("com.android.systemui");
        IGNORED_PACKAGES.add("com.android.launcher");
        IGNORED_PACKAGES.add("com.android.launcher3");
        IGNORED_PACKAGES.add("com.google.android.apps.nexuslauncher");
        IGNORED_PACKAGES.add("com.sec.android.app.launcher");
        IGNORED_PACKAGES.add("com.miui.home");
        IGNORED_PACKAGES.add("com.huawei.android.launcher");
        IGNORED_PACKAGES.add("com.oppo.launcher");
        IGNORED_PACKAGES.add("com.oneplus.launcher");
        IGNORED_PACKAGES.add("com.android.inputmethod.latin");
        IGNORED_PACKAGES.add("com.google.android.inputmethod.latin");
    }

    private boolean hasUsageAccessPermission() {
        Context context = getContext();
        if (context == null) return false;
        AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;

        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.getPackageName()
            );
        } else {
            mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.getPackageName()
            );
        }

        if (mode == AppOpsManager.MODE_DEFAULT) {
            return context.checkCallingOrSelfPermission(
                android.Manifest.permission.PACKAGE_USAGE_STATS
            ) == PackageManager.PERMISSION_GRANTED;
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private boolean isIgnoredSystemPackage(String pkgName) {
        if (pkgName == null || pkgName.isEmpty()) return true;
        if (IGNORED_PACKAGES.contains(pkgName)) return true;
        return pkgName.contains("launcher") && pkgName.startsWith("com.");
    }

    private String resolveAppLabel(PackageManager pm, String pkgName) {
        if (pm == null) return pkgName;
        try {
            ApplicationInfo info = pm.getApplicationInfo(pkgName, 0);
            CharSequence label = pm.getApplicationLabel(info);
            if (label != null && label.length() > 0) {
                return label.toString();
            }
        } catch (PackageManager.NameNotFoundException ignored) {
            // Fall back to formatted package suffix
        }
        int lastDot = pkgName.lastIndexOf('.');
        return lastDot >= 0 && lastDot < pkgName.length() - 1
            ? pkgName.substring(lastDot + 1)
            : pkgName;
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasUsageAccessPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Android context unavailable");
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception firstError) {
            try {
                Intent fallback = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
            } catch (Exception secondError) {
                call.reject("Could not open Usage Access settings: " + secondError.getMessage());
                return;
            }
        }

        call.resolve();
    }

    @PluginMethod
    public void getTodayUsage(PluginCall call) {
        boolean granted = hasUsageAccessPermission();
        if (!granted) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("totalSeconds", 0);
            ret.put("apps", new JSArray());
            call.resolve(ret);
            return;
        }

        Context context = getContext();
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) {
            call.reject("UsageStatsManager unavailable");
            return;
        }

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long startOfDayMs = cal.getTimeInMillis();
        long nowMs = System.currentTimeMillis();

        String dateKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(nowMs));

        Map<String, Long> durationMsByPackage = new HashMap<>();
        Map<String, Long> activeStartByPackage = new HashMap<>();

        UsageEvents events = usm.queryEvents(startOfDayMs, nowMs);
        if (events != null) {
            UsageEvents.Event event = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                String pkg = event.getPackageName();
                if (isIgnoredSystemPackage(pkg)) continue;

                int type = event.getEventType();
                boolean isResume = type == UsageEvents.Event.ACTIVITY_RESUMED
                    || type == UsageEvents.Event.MOVE_TO_FOREGROUND;
                boolean isPause = type == UsageEvents.Event.ACTIVITY_PAUSED
                    || type == UsageEvents.Event.MOVE_TO_BACKGROUND
                    || type == UsageEvents.Event.ACTIVITY_STOPPED;

                if (isResume) {
                    if (!activeStartByPackage.containsKey(pkg)) {
                        activeStartByPackage.put(pkg, event.getTimeStamp());
                    }
                } else if (isPause) {
                    Long startedAt = activeStartByPackage.remove(pkg);
                    if (startedAt != null && event.getTimeStamp() > startedAt) {
                        long delta = event.getTimeStamp() - startedAt;
                        durationMsByPackage.put(
                            pkg,
                            durationMsByPackage.getOrDefault(pkg, 0L) + delta
                        );
                    }
                }
            }

            // Close any session currently in the foreground
            for (Map.Entry<String, Long> openEntry : activeStartByPackage.entrySet()) {
                long startedAt = openEntry.getValue();
                if (nowMs > startedAt) {
                    String pkg = openEntry.getKey();
                    durationMsByPackage.put(
                        pkg,
                        durationMsByPackage.getOrDefault(pkg, 0L) + (nowMs - startedAt)
                    );
                }
            }
        }

        // Fallback for OEMs where queryEvents is sparse
        if (durationMsByPackage.isEmpty()) {
            Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(startOfDayMs, nowMs);
            if (stats != null) {
                for (UsageStats stat : stats.values()) {
                    if (stat == null) continue;
                    String pkg = stat.getPackageName();
                    if (isIgnoredSystemPackage(pkg)) continue;
                    long fgMs = stat.getTotalTimeInForeground();
                    if (fgMs > 0) {
                        durationMsByPackage.put(pkg, fgMs);
                    }
                }
            }
        }

        PackageManager pm = context.getPackageManager();
        List<Map.Entry<String, Long>> entries = new ArrayList<>();
        long totalSeconds = 0L;

        for (Map.Entry<String, Long> entry : durationMsByPackage.entrySet()) {
            long secs = entry.getValue() / 1000L;
            if (secs >= 10L) {
                entries.add(entry);
                totalSeconds += secs;
            }
        }

        Collections.sort(entries, (a, b) -> Long.compare(b.getValue(), a.getValue()));

        JSArray appsArray = new JSArray();
        int limit = Math.min(entries.size(), 25);
        for (int i = 0; i < limit; i++) {
            Map.Entry<String, Long> entry = entries.get(i);
            String pkg = entry.getKey();
            long secs = entry.getValue() / 1000L;

            JSObject appObj = new JSObject();
            appObj.put("id", pkg);
            appObj.put("name", resolveAppLabel(pm, pkg));
            appObj.put("seconds", secs);
            appsArray.put(appObj);
        }

        JSObject ret = new JSObject();
        ret.put("granted", true);
        ret.put("dateKey", dateKey);
        ret.put("totalSeconds", totalSeconds);
        ret.put("apps", appsArray);
        call.resolve(ret);
    }
}
