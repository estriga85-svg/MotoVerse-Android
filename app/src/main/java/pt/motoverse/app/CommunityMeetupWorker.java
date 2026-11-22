package pt.motoverse.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.android.gms.tasks.Tasks;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Source;

import java.util.concurrent.TimeUnit;

public final class CommunityMeetupWorker extends Worker {
    public CommunityMeetupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull @Override public Result doWork() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return Result.success();
        String uid = user.getUid();
        if (CommunityNotifications.selection(getApplicationContext(), uid).length() == 0) return Result.success();
        try {
            var snapshot = Tasks.await(CommunityNotifications.query(FirebaseFirestore.getInstance()).get(Source.SERVER),
                    25, TimeUnit.SECONDS);
            for (var document : snapshot) CommunityNotifications.deliver(getApplicationContext(), uid, document);
            return Result.success();
        } catch (Exception error) {
            return Result.retry();
        }
    }
}
