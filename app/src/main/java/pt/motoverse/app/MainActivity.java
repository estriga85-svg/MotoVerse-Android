package pt.motoverse.app;

import static com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.auth.UserProfileChangeRequest;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QueryDocumentSnapshot;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String ADMIN_EMAIL = "estriga85@gmail.com";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private CredentialManager credentialManager;
    private boolean pageReady = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();
        credentialManager = CredentialManager.create(this);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new MotoVerseBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("mailto".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_SENDTO, uri)); } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.startsWith("mailto:")) {
                    try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse(url))); } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                applyMotoVerseFixes();
                loadFirebaseBridge();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(Intent.createChooser(intent, "Selecionar fotografias"), FILE_CHOOSER_REQUEST);
                return true;
            }
        });

        auth.addAuthStateListener(firebaseAuth -> {
            if (pageReady) pushAuthStateToWeb();
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    private void applyMotoVerseFixes() {
        String js = "(function(){" +
                "var st=document.createElement('style');" +
                "st.textContent='.modalWrap{padding-bottom:76px!important;box-sizing:border-box!important;}.modal{max-height:calc(100dvh - 105px)!important;padding-bottom:36px!important;overscroll-behavior:contain!important;}.modal .btn.full:last-child{margin-bottom:18px!important;min-height:54px!important;}.photoThumb,.garagePhoto,.homeGaragePhoto{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;}.photoThumb{background-color:#eef2f7!important;}';" +
                "document.head.appendChild(st);" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    private void loadFirebaseBridge() {
        try (InputStream in = getAssets().open("firebase-bridge.js")) {
            byte[] bytes = new byte[in.available()];
            int offset = 0;
            while (offset < bytes.length) {
                int read = in.read(bytes, offset, bytes.length - offset);
                if (read < 0) break;
                offset += read;
            }
            String js = new String(bytes, 0, offset, StandardCharsets.UTF_8);
            webView.evaluateJavascript(js, value -> {
                pageReady = true;
                pushAuthStateToWeb();
            });
        } catch (Exception e) {
            pageReady = true;
            sendError("Não foi possível carregar a ligação Firebase.");
        }
    }

    private void pushAuthStateToWeb() {
        FirebaseUser user = auth.getCurrentUser();
        JSONObject o = new JSONObject();
        try {
            if (user != null) {
                o.put("uid", user.getUid());
                o.put("name", user.getDisplayName() == null ? "Motociclista" : user.getDisplayName());
                o.put("email", user.getEmail() == null ? "" : user.getEmail());
                o.put("admin", isAdmin(user));
                o.put("verified", isAdmin(user));
            }
        } catch (JSONException ignored) {}
        String payload = user == null ? "null" : o.toString();
        runJs("window.onNativeAuth && window.onNativeAuth(" + payload + ");");
        if (user != null) saveUserProfile(user);
    }

    private boolean isAdmin(FirebaseUser user) {
        if (user == null || user.getEmail() == null || !ADMIN_EMAIL.equalsIgnoreCase(user.getEmail()) || !user.isEmailVerified()) return false;
        for (com.google.firebase.auth.UserInfo info : user.getProviderData()) {
            if ("google.com".equals(info.getProviderId())) return true;
        }
        return false;
    }

    private void saveUserProfile(FirebaseUser user) {
        Map<String, Object> data = new HashMap<>();
        data.put("uid", user.getUid());
        data.put("name", user.getDisplayName() == null ? "Motociclista" : user.getDisplayName());
        data.put("email", user.getEmail() == null ? "" : user.getEmail());
        data.put("admin", isAdmin(user));
        data.put("verified", isAdmin(user));
        data.put("lastLoginAt", FieldValue.serverTimestamp());
        db.collection("users").document(user.getUid()).set(data);
    }

    private void runJs(String js) {
        if (webView == null) return;
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    private void sendError(String message) {
        JSONObject o = new JSONObject();
        try { o.put("message", message == null ? "Erro inesperado" : message); } catch (JSONException ignored) {}
        runJs("window.onNativeError && window.onNativeError(" + o.toString() + ");");
    }

    private String friendlyAuthError(Exception e) {
        if (e instanceof FirebaseAuthException) {
            String code = ((FirebaseAuthException) e).getErrorCode();
            if ("ERROR_WRONG_PASSWORD".equals(code) || "ERROR_INVALID_CREDENTIAL".equals(code)) return "E-mail ou palavra-passe incorretos.";
            if ("ERROR_WEAK_PASSWORD".equals(code)) return "A palavra-passe deve ter pelo menos 6 caracteres.";
            if ("ERROR_INVALID_EMAIL".equals(code)) return "O endereço de e-mail não é válido.";
            if ("ERROR_EMAIL_ALREADY_IN_USE".equals(code)) return "Já existe uma conta com este e-mail. Usa o botão Entrar.";
            if ("ERROR_NETWORK_REQUEST_FAILED".equals(code)) return "Sem ligação à Internet. Tenta novamente.";
            if ("ERROR_TOO_MANY_REQUESTS".equals(code)) return "Demasiadas tentativas. Tenta novamente mais tarde.";
        }
        return e == null || e.getLocalizedMessage() == null ? "Não foi possível concluir a operação." : e.getLocalizedMessage();
    }

    private boolean validEmailPassword(String email, String password) {
        if (email == null || email.trim().isEmpty()) {
            sendError("Indica um e-mail válido.");
            return false;
        }
        if (password == null || password.length() < 6) {
            sendError("A palavra-passe deve ter pelo menos 6 caracteres.");
            return false;
        }
        return true;
    }

    private void createEmailAccount(String name, String email, String password) {
        if (name == null || name.trim().isEmpty()) {
            sendError("Indica o teu nome.");
            return;
        }
        if (!validEmailPassword(email, password)) return;
        auth.createUserWithEmailAndPassword(email.trim(), password).addOnCompleteListener(this, task -> {
            if (!task.isSuccessful()) {
                sendError(friendlyAuthError(task.getException()));
                return;
            }
            FirebaseUser user = auth.getCurrentUser();
            if (user == null) {
                sendError("A conta foi criada, mas não foi possível abrir a sessão.");
                return;
            }
            UserProfileChangeRequest req = new UserProfileChangeRequest.Builder().setDisplayName(name.trim()).build();
            user.updateProfile(req).addOnCompleteListener(profileTask -> {
                pushAuthStateToWeb();
                runJs("window.onAuthSuccess && window.onAuthSuccess('Conta criada com sucesso');");
            });
        });
    }

    private void signInEmailAccount(String email, String password) {
        if (!validEmailPassword(email, password)) return;
        auth.signInWithEmailAndPassword(email.trim(), password).addOnCompleteListener(this, task -> {
            if (task.isSuccessful()) {
                pushAuthStateToWeb();
                runJs("window.onAuthSuccess && window.onAuthSuccess('Sessão iniciada');");
            } else sendError(friendlyAuthError(task.getException()));
        });
    }

    private void startGoogleSignIn(boolean authorizedOnly) {
        GetGoogleIdOption option = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(authorizedOnly)
                .setServerClientId(getString(R.string.default_web_client_id))
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        credentialManager.getCredentialAsync(this, request, new CancellationSignal(), Executors.newSingleThreadExecutor(),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override public void onResult(GetCredentialResponse result) { handleGoogleCredential(result.getCredential()); }
                    @Override public void onError(GetCredentialException e) {
                        if (authorizedOnly) startGoogleSignIn(false);
                        else sendError("O login Google precisa de uma assinatura Android fixa antes de ser ativado nesta build.");
                    }
                });
    }

    private void handleGoogleCredential(Credential credential) {
        if (credential instanceof CustomCredential && TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            try {
                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData());
                AuthCredential firebaseCredential = GoogleAuthProvider.getCredential(google.getIdToken(), null);
                auth.signInWithCredential(firebaseCredential).addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        pushAuthStateToWeb();
                        runJs("window.onAuthSuccess && window.onAuthSuccess('Sessão Google iniciada');");
                    } else sendError(friendlyAuthError(task.getException()));
                });
            } catch (Exception e) { sendError("Credencial Google inválida."); }
        } else sendError("A conta Google não devolveu uma credencial válida.");
    }

    private Map<String, Object> jsonToMap(JSONObject o) throws JSONException {
        Map<String, Object> map = new HashMap<>();
        JSONArray names = o.names();
        if (names == null) return map;
        for (int i = 0; i < names.length(); i++) {
            String key = names.getString(i);
            Object value = o.get(key);
            if (value instanceof JSONArray) {
                JSONArray a = (JSONArray) value;
                List<Object> list = new ArrayList<>();
                for (int j = 0; j < a.length(); j++) list.add(a.get(j));
                map.put(key, list);
            } else if (value == JSONObject.NULL) map.put(key, null);
            else map.put(key, value);
        }
        return map;
    }

    private JSONObject documentJson(DocumentSnapshot doc) {
        JSONObject o = new JSONObject();
        try {
            o.put("id", doc.getId());
            Map<String, Object> data = doc.getData();
            if (data != null) {
                for (Map.Entry<String, Object> e : data.entrySet()) {
                    Object v = e.getValue();
                    if (v instanceof Timestamp) o.put(e.getKey(), ((Timestamp) v).toDate().getTime());
                    else o.put(e.getKey(), JSONObject.wrap(v));
                }
            }
        } catch (Exception ignored) {}
        return o;
    }

    public class MotoVerseBridge {
        @JavascriptInterface public void refreshAuth() { pushAuthStateToWeb(); }

        @JavascriptInterface public void createAccount(String name, String email, String password) {
            runOnUiThread(() -> MainActivity.this.createEmailAccount(name, email, password));
        }

        @JavascriptInterface public void signInEmail(String email, String password) {
            runOnUiThread(() -> MainActivity.this.signInEmailAccount(email, password));
        }

        @JavascriptInterface public void googleLogin() { runOnUiThread(() -> startGoogleSignIn(true)); }

        @JavascriptInterface public void logout() {
            auth.signOut();
            pushAuthStateToWeb();
        }

        @JavascriptInterface public void saveListing(String json) {
            FirebaseUser user = auth.getCurrentUser();
            if (user == null) { sendError("Inicia sessão antes de publicar um anúncio."); return; }
            try {
                Map<String, Object> data = jsonToMap(new JSONObject(json));
                data.put("ownerUid", user.getUid());
                data.put("ownerEmail", user.getEmail() == null ? "" : user.getEmail());
                data.put("ownerName", user.getDisplayName() == null ? "Motociclista" : user.getDisplayName());
                data.put("status", "pending");
                data.put("createdAt", FieldValue.serverTimestamp());
                data.put("updatedAt", FieldValue.serverTimestamp());
                db.collection("listings").add(data)
                        .addOnSuccessListener(ref -> runJs("window.onListingSaved && window.onListingSaved(" + JSONObject.quote(ref.getId()) + ");"))
                        .addOnFailureListener(e -> sendError("Não foi possível guardar o anúncio: " + e.getLocalizedMessage()));
            } catch (Exception e) { sendError("Dados do anúncio inválidos."); }
        }

        @JavascriptInterface public void loadMyListings() {
            FirebaseUser user = auth.getCurrentUser();
            if (user == null) return;
            db.collection("listings").whereEqualTo("ownerUid", user.getUid()).get()
                    .addOnSuccessListener(snap -> {
                        JSONArray arr = new JSONArray();
                        for (QueryDocumentSnapshot d : snap) arr.put(documentJson(d));
                        runJs("window.onMyListings && window.onMyListings(" + arr.toString() + ");");
                    }).addOnFailureListener(e -> sendError("Não foi possível carregar os teus anúncios."));
        }

        @JavascriptInterface public void loadApprovedListings() {
            if (auth.getCurrentUser() == null) return;
            db.collection("listings").whereEqualTo("status", "approved").get()
                    .addOnSuccessListener(snap -> {
                        JSONArray arr = new JSONArray();
                        for (QueryDocumentSnapshot d : snap) arr.put(documentJson(d));
                        runJs("window.onApprovedListings && window.onApprovedListings(" + arr.toString() + ");");
                    }).addOnFailureListener(e -> sendError("Não foi possível carregar os anúncios publicados."));
        }

        @JavascriptInterface public void loadPendingListingsAdmin() {
            FirebaseUser user = auth.getCurrentUser();
            if (!isAdmin(user)) { sendError("Área reservada ao revisor."); return; }
            db.collection("listings").whereEqualTo("status", "pending").get()
                    .addOnSuccessListener(snap -> {
                        JSONArray arr = new JSONArray();
                        for (QueryDocumentSnapshot d : snap) arr.put(documentJson(d));
                        runJs("window.onPendingListings && window.onPendingListings(" + arr.toString() + ");");
                    }).addOnFailureListener(e -> sendError("Não foi possível carregar os anúncios em revisão."));
        }

        @JavascriptInterface public void reviewListing(String id, String status) {
            FirebaseUser user = auth.getCurrentUser();
            if (!isAdmin(user)) { sendError("Apenas o revisor pode aprovar anúncios."); return; }
            if (!("approved".equals(status) || "rejected".equals(status))) { sendError("Estado inválido."); return; }
            Map<String, Object> updates = new HashMap<>();
            updates.put("status", status);
            updates.put("reviewedAt", FieldValue.serverTimestamp());
            updates.put("reviewedBy", user.getEmail());
            updates.put("updatedAt", FieldValue.serverTimestamp());
            db.collection("listings").document(id).update(updates)
                    .addOnSuccessListener(v -> runJs("window.onReviewDone && window.onReviewDone();"))
                    .addOnFailureListener(e -> sendError("Não foi possível atualizar o anúncio."));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) results = new Uri[]{data.getData()};
        }
        fileCallback.onReceiveValue(results);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
