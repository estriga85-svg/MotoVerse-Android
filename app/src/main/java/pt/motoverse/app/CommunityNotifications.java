package pt.motoverse.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.Map;
import java.util.Set;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;

final class CommunityNotifications {
    static final String CHANNEL = "community_meetups";
    static final Set<String> TYPES = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            "cafezada", "passeio", "en2", "tour", "trilho", "trackday")));
    private static final long MAX_AGE = 7 * 24 * 60 * 60 * 1000L;

    private CommunityNotifications() {}

    static Query query(FirebaseFirestore db) {
        return db.collection("meetups").whereEqualTo("status", "active").whereEqualTo("notifyInterested", true);
    }

    static SharedPreferences preferences(Context context, String uid) {
        return context.getSharedPreferences("community_interests_" + uid, Context.MODE_PRIVATE);
    }

    static JSONObject selection(Context context, String uid) {
        JSONObject result = new JSONObject();
        SharedPreferences prefs = preferences(context, uid);
        for (String type : TYPES) {
            long since = prefs.getLong(type, 0);
            if (since > 0) {
                try { result.put(type, since); }
                catch (org.json.JSONException error) { throw new IllegalStateException(error); }
            }
        }
        return result;
    }

    static void save(Context context, String uid, Set<String> enabled) {
        SharedPreferences prefs = preferences(context, uid);
        SharedPreferences.Editor editor = prefs.edit();
        for (String type : TYPES) {
            if (enabled.contains(type)) editor.putLong(type, prefs.getLong(type, System.currentTimeMillis()));
            else editor.remove(type);
        }
        editor.apply();
        syncTopics(enabled);
    }

    static void syncTopics(Set<String> enabled) {
        for (String type : TYPES) {
            String topic = "mv_community_" + type;
            if (enabled.contains(type)) FirebaseMessaging.getInstance().subscribeToTopic(topic);
            else FirebaseMessaging.getInstance().unsubscribeFromTopic(topic);
        }
    }

    static void deliver(Context context, String uid, DocumentSnapshot document) {
        Object created = document.get("createdAt");
        if (!(created instanceof Timestamp) || !Boolean.TRUE.equals(document.get("notifyInterested"))) return;
        deliver(context, uid, document.getId(), text(document,"category"), text(document,"name"),
                text(document,"location"), text(document,"organizerUid"), ((Timestamp) created).toDate().getTime());
    }

    private static String text(DocumentSnapshot document, String key) {
        Object value = document.get(key);
        return value instanceof String ? (String) value : null;
    }

    static synchronized void deliver(Context context, String uid, String id, String category, String name,
                                     String location, String organizer, long created) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null || !user.getUid().equals(uid) || uid.equals(organizer) || id == null
                || !id.matches("[A-Za-z0-9_-]{1,130}") || category == null || !TYPES.contains(category)) return;
        long now = System.currentTimeMillis();
        SharedPreferences prefs = preferences(context, uid);
        long since = prefs.getLong(category, 0);
        if (since == 0 || created < since || created < now - MAX_AGE) return;
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Comunidade MotoVerse",
                    NotificationManager.IMPORTANCE_DEFAULT));
            if (manager.getNotificationChannel(CHANNEL).getImportance() == NotificationManager.IMPORTANCE_NONE) return;
        }
        String key = "sent_" + id;
        if (prefs.contains(key)) return;
        SharedPreferences.Editor editor = prefs.edit().putLong(key, now);
        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            if (entry.getKey().startsWith("sent_") && entry.getValue() instanceof Long
                    && (Long) entry.getValue() < now - MAX_AGE) editor.remove(entry.getKey());
        }
        Intent intent = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("communityMeetupId", id);
        PendingIntent open = PendingIntent.getActivity(context, id.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder notification = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        notification.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(name == null || name.trim().isEmpty() ? "Novo encontro MotoVerse" : name)
                .setContentText(location == null ? "Novo encontro do teu interesse" : location)
                .setContentIntent(open).setAutoCancel(true);
        manager.notify(id, 23, notification.build());
        editor.apply();
    }
}
