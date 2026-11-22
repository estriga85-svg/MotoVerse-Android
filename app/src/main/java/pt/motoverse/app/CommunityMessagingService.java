package pt.motoverse.app;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public final class CommunityMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        var user = FirebaseAuth.getInstance().getCurrentUser();
        Map<String, String> data = message.getData();
        if (user == null || !"community".equals(data.get("kind"))) return;
        try {
            long created = Long.parseLong(data.get("createdAt"));
            CommunityNotifications.deliver(this, user.getUid(), data.get("id"), data.get("category"),
                    data.get("name"), data.get("location"), data.get("organizer"), created);
        } catch (NumberFormatException ignored) {
            // A notification without a valid publication time is discarded.
        }
    }
}
