package com.studytracker.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "NowPlaying")
public class NowPlayingPlugin extends Plugin {

    private boolean isListenerEnabled(Context context) {
        Set<String> enabled = NotificationManagerCompat.getEnabledListenerPackages(context);
        return enabled != null && enabled.contains(context.getPackageName());
    }

    private String detectPlatform(String packageName) {
        if (packageName == null) return "other";
        switch (packageName) {
            case "com.spotify.music":
            case "com.spotify.lite":
                return "spotify";
            case "com.google.android.apps.youtube.music":
            case "app.revanced.android.apps.youtube.music":
            case "com.vanced.android.apps.youtube.music":
                return "youtube_music";
            case "com.soundcloud.android":
                return "soundcloud";
            default:
                return "other";
        }
    }

    private String firstNonEmpty(String... values) {
        if (values == null) return null;
        for (String val : values) {
            if (val != null && !val.trim().isEmpty()) {
                return val.trim();
            }
        }
        return null;
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isListenerEnabled(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getNowPlaying(PluginCall call) {
        Context context = getContext();
        if (!isListenerEnabled(context)) {
            JSObject ret = new JSObject();
            ret.put("isPlaying", false);
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }

        try {
            MediaSessionManager manager =
                (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);

            if (manager == null) {
                JSObject ret = new JSObject();
                ret.put("isPlaying", false);
                ret.put("granted", true);
                call.resolve(ret);
                return;
            }

            List<MediaController> controllers = manager.getActiveSessions(
                new ComponentName(context, MediaNotificationListener.class)
            );

            MediaController chosen = null;
            for (MediaController controller : controllers) {
                PlaybackState state = controller.getPlaybackState();
                if (state == null || state.getState() != PlaybackState.STATE_PLAYING) {
                    continue;
                }

                String platform = detectPlatform(controller.getPackageName());
                if (!"other".equals(platform)) {
                    chosen = controller;
                    break;
                }
                if (chosen == null) {
                    chosen = controller;
                }
            }

            if (chosen == null || chosen.getMetadata() == null) {
                JSObject ret = new JSObject();
                ret.put("isPlaying", false);
                ret.put("granted", true);
                call.resolve(ret);
                return;
            }

            MediaMetadata meta = chosen.getMetadata();
            String title = firstNonEmpty(
                meta.getString(MediaMetadata.METADATA_KEY_TITLE),
                meta.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
            );

            if (title == null) {
                JSObject ret = new JSObject();
                ret.put("isPlaying", false);
                ret.put("granted", true);
                call.resolve(ret);
                return;
            }

            String artist = firstNonEmpty(
                meta.getString(MediaMetadata.METADATA_KEY_ARTIST),
                meta.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST),
                meta.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
            );

            String pkg = chosen.getPackageName();
            JSObject ret = new JSObject();
            ret.put("isPlaying", true);
            ret.put("granted", true);
            ret.put("title", title);
            if (artist != null) {
                ret.put("artist", artist);
            }
            ret.put("platform", detectPlatform(pkg));
            ret.put("packageName", pkg != null ? pkg : "");
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("isPlaying", false);
            ret.put("granted", isListenerEnabled(context));
            call.resolve(ret);
        }
    }
}
