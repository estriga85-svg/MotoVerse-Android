package pt.motoverse.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.android.gms.tasks.Tasks;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QuerySnapshot;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

public class PendingListingWorker extends Worker {
    private static final String ADMIN_EMAIL = "estriga85@gmail.com";
    private static final String CHANNEL_ID = "motoverse_approvals";
    private static final String PREFS = "motoverse_admin_alerts";
    private static final String KEY_PENDING_IDS = "pending_ids";

    public PendingListingWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            if (user == null || user.getEmail() == null || !ADMIN_EMAIL.equalsIgnoreCase(user.getEmail())) {
                return Result.success();
            }

            QuerySnapshot snapshot = Tasks.await(
                    FirebaseFirestore.getInstance().collection("listings")
                            .whereEqualTo("status", "pending")
                            .get(),
                    25,
                    TimeUnit.SECONDS
            );

            Set<String> currentIds = new HashSet<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                currentIds.add(doc.getId());
            }

            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Set<String> saved = prefs.getStringSet(KEY_PENDING_IDS, Collections.emptySet());
            Set<String> previousIds = new HashSet<>(saved == null ? Collections.emptySet() : saved);
            Set<String> newIds = new HashSet<>(currentIds);
            newIds.removeAll(previousIds);

            if (!newIds.isEmpty()) {
                showNotification(newIds.size(), currentIds.size());
            }

            prefs.edit().putStringSet(KEY_PENDING_IDS, new HashSet<>(currentIds)).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private void showNotification(int newCount, int totalPending) {
        Context context = getApplicationContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Anúncios para aprovação",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Avisos quando existem novos anúncios MotoVerse por rever");
            manager.createNotificationChannel(channel);
        }

        Intent openApp = new Intent(context, MainActivity.class);
        openApp.putExtra("openAdminReview", true);
        openApp.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                9001,
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = newCount == 1
                ? "Novo anúncio para aprovar"
                : newCount + " novos anúncios para aprovar";
        String text = totalPending == 1
                ? "Há 1 anúncio pendente na MotoVerse."
                : "Há " + totalPending + " anúncios pendentes na MotoVerse.";

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);

        builder.setSmallIcon(R.drawable.ic_motoverse)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(Notification.PRIORITY_HIGH);

        manager.notify(9001, builder.build());
    }
}
