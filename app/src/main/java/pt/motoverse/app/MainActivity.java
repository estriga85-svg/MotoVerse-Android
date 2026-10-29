package pt.motoverse.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
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
import com.google.firebase.firestore.SetOptions;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int GOOGLE_SIGN_IN_REQUEST = 1002;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1003;
    private static final String ADMIN_EMAIL = "estriga85@gmail.com";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private GoogleSignInClient googleClient;
    private boolean pageReady = false;
    private boolean openAdminReviewOnReady = false;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openAdminReviewOnReady = getIntent()!=null && getIntent().getBooleanExtra("openAdminReview", false);
        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.default_web_client_id)).requestEmail().build();
        googleClient = GoogleSignIn.getClient(this, gso);

        webView = new WebView(this);
        webView.setClipToPadding(true);
        webView.setOnApplyWindowInsetsListener((v, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(left, top, right, bottom);
            return insets;
        });
        setContentView(webView);
        webView.requestApplyInsets();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true); settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new MotoVerseBridge(), "Android");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl(); if("mailto".equalsIgnoreCase(uri.getScheme())){try{startActivity(new Intent(Intent.ACTION_SENDTO,uri));}catch(Exception ignored){} return true;} return false;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){if(url!=null&&url.startsWith("mailto:")){try{startActivity(new Intent(Intent.ACTION_SENDTO,Uri.parse(url)));}catch(Exception ignored){} return true;}return false;}
            @Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);applyMotoVerseFixes();loadFirebaseBridge();}
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams p){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;
                Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("image/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                startActivityForResult(Intent.createChooser(i,"Selecionar fotografias"),FILE_CHOOSER_REQUEST);return true;
            }
        });
        auth.addAuthStateListener(a->{if(pageReady)pushAuthStateToWeb();});
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void applyMotoVerseFixes(){String js="(function(){var st=document.createElement('style');st.textContent='.modalWrap{padding-bottom:20px!important;box-sizing:border-box!important}.modal{max-height:calc(100dvh - 44px)!important;padding-bottom:36px!important}.photoThumb,.garagePhoto,.homeGaragePhoto{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}';document.head.appendChild(st)})();";webView.evaluateJavascript(js,null);}
    private void loadFirebaseBridge(){try(InputStream in=getAssets().open("firebase-bridge.js");ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);String js=out.toString(StandardCharsets.UTF_8.name());webView.evaluateJavascript(js,v->{pageReady=true;pushAuthStateToWeb();});}catch(Exception e){pageReady=true;sendError("Não foi possível carregar a ligação à conta.");}}
    private void runJs(String js){if(webView!=null)runOnUiThread(()->webView.evaluateJavascript(js,null));}
    private void sendError(String m){JSONObject o=new JSONObject();try{o.put("message",m==null?"Erro inesperado":m);}catch(Exception ignored){}runJs("window.onNativeError&&window.onNativeError("+o+");");}

    private boolean isAdmin(FirebaseUser u){return u!=null&&u.getEmail()!=null&&ADMIN_EMAIL.equalsIgnoreCase(u.getEmail());}

    private void ensureAdminNotifications(){
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION_REQUEST);
        }
        Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest now=new OneTimeWorkRequest.Builder(PendingListingWorker.class).setConstraints(constraints).build();
        WorkManager.getInstance(this).enqueueUniqueWork("motoverse_pending_alert_now",ExistingWorkPolicy.REPLACE,now);
        PeriodicWorkRequest periodic=new PeriodicWorkRequest.Builder(PendingListingWorker.class,15,TimeUnit.MINUTES).setConstraints(constraints).build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("motoverse_pending_alerts",ExistingPeriodicWorkPolicy.KEEP,periodic);
    }

    private void pushAuthStateToWeb(){FirebaseUser u=auth.getCurrentUser();JSONObject o=new JSONObject();try{if(u!=null){o.put("uid",u.getUid());o.put("name",u.getDisplayName()==null?"Motociclista":u.getDisplayName());o.put("email",u.getEmail()==null?"":u.getEmail());o.put("admin",isAdmin(u));o.put("verified",isAdmin(u)||u.isEmailVerified());}}catch(Exception ignored){}runJs("window.onNativeAuth&&window.onNativeAuth("+(u==null?"null":o.toString())+");");if(u!=null){saveUserProfile(u);loadGarageForUser(u);if(isAdmin(u)){loadPendingCountForAdmin();ensureAdminNotifications();if(openAdminReviewOnReady){openAdminReviewOnReady=false;runJs("setTimeout(function(){window.openAdminReview&&window.openAdminReview();},350);");}}}}
    private void saveUserProfile(FirebaseUser u){Map<String,Object>d=new HashMap<>();d.put("uid",u.getUid());d.put("name",u.getDisplayName()==null?"Motociclista":u.getDisplayName());d.put("email",u.getEmail()==null?"":u.getEmail());d.put("admin",isAdmin(u));d.put("verified",isAdmin(u)||u.isEmailVerified());d.put("lastLoginAt",FieldValue.serverTimestamp());db.collection("users").document(u.getUid()).set(d, SetOptions.merge());}
    private String friendly(Exception e){if(e instanceof FirebaseAuthException){String c=((FirebaseAuthException)e).getErrorCode();if("ERROR_WRONG_PASSWORD".equals(c)||"ERROR_INVALID_CREDENTIAL".equals(c))return "E-mail ou palavra-passe incorretos.";if("ERROR_USER_NOT_FOUND".equals(c))return "Não existe nenhuma conta com este e-mail.";if("ERROR_EMAIL_ALREADY_IN_USE".equals(c))return "Já existe uma conta com este e-mail.";if("ERROR_WEAK_PASSWORD".equals(c))return "A palavra-passe deve ter pelo menos 6 caracteres.";}return e==null||e.getLocalizedMessage()==null?"Não foi possível concluir a operação.":e.getLocalizedMessage();}
    private boolean valid(String email,String pass){if(email==null||email.trim().isEmpty()){sendError("Indica um e-mail válido.");return false;}if(pass==null||pass.length()<6){sendError("A palavra-passe deve ter pelo menos 6 caracteres.");return false;}return true;}
    private void createEmail(String name,String email,String pass){if(name==null||name.trim().isEmpty()){sendError("Indica o teu nome.");return;}if(!valid(email,pass))return;auth.createUserWithEmailAndPassword(email.trim(),pass).addOnCompleteListener(this,t->{if(!t.isSuccessful()){sendError(friendly(t.getException()));return;}FirebaseUser u=auth.getCurrentUser();if(u==null)return;u.updateProfile(new UserProfileChangeRequest.Builder().setDisplayName(name.trim()).build()).addOnCompleteListener(x->{pushAuthStateToWeb();runJs("window.onAuthSuccess&&window.onAuthSuccess('Conta criada com sucesso');");});});}
    private void signInEmail(String email,String pass){if(!valid(email,pass))return;auth.signInWithEmailAndPassword(email.trim(),pass).addOnCompleteListener(this,t->{if(t.isSuccessful()){pushAuthStateToWeb();runJs("window.onAuthSuccess&&window.onAuthSuccess('Sessão iniciada');");}else sendError(friendly(t.getException()));});}
    private void startGoogle(){startActivityForResult(googleClient.getSignInIntent(),GOOGLE_SIGN_IN_REQUEST);}
    private void firebaseGoogle(String token){AuthCredential c=GoogleAuthProvider.getCredential(token,null);auth.signInWithCredential(c).addOnCompleteListener(this,t->{if(t.isSuccessful()){pushAuthStateToWeb();runJs("window.onAuthSuccess&&window.onAuthSuccess('Sessão iniciada com Google');");}else sendError("Não foi possível iniciar sessão com Google.");});}
    private Map<String,Object> jsonToMap(JSONObject o)throws JSONException{Map<String,Object>m=new HashMap<>();JSONArray names=o.names();if(names==null)return m;for(int i=0;i<names.length();i++){String k=names.getString(i);Object v=o.get(k);if(v instanceof JSONArray){JSONArray a=(JSONArray)v;List<Object>l=new ArrayList<>();for(int j=0;j<a.length();j++)l.add(a.get(j));m.put(k,l);}else m.put(k,v==JSONObject.NULL?null:v);}return m;}
    private JSONObject docJson(DocumentSnapshot d){JSONObject o=new JSONObject();try{o.put("id",d.getId());if(d.getData()!=null)for(Map.Entry<String,Object>e:d.getData().entrySet()){Object v=e.getValue();o.put(e.getKey(),v instanceof Timestamp?((Timestamp)v).toDate().getTime():JSONObject.wrap(v));}}catch(Exception ignored){}return o;}
    private JSONObject mapJson(Map<String,Object> data){JSONObject o=new JSONObject();try{for(Map.Entry<String,Object>e:data.entrySet()){Object v=e.getValue();o.put(e.getKey(),v instanceof Timestamp?((Timestamp)v).toDate().getTime():JSONObject.wrap(v));}}catch(Exception ignored){}return o;}
    private void loadLegacyGarage(FirebaseUser u){db.collection("garages").document(u.getUid()).get().addOnSuccessListener(d->{if(d.exists())runJs("window.onGarageLoaded&&window.onGarageLoaded("+docJson(d)+");");});}
    @SuppressWarnings("unchecked") private void loadGarageForUser(FirebaseUser u){db.collection("users").document(u.getUid()).get().addOnSuccessListener(d->{Object g=d.get("garage");if(g instanceof Map){runJs("window.onGarageLoaded&&window.onGarageLoaded("+mapJson((Map<String,Object>)g)+");");}else loadLegacyGarage(u);}).addOnFailureListener(e->loadLegacyGarage(u));}
    private void loadPendingCountForAdmin(){db.collection("listings").whereEqualTo("status","pending").get().addOnSuccessListener(s->runJs("window.onPendingCount&&window.onPendingCount("+s.size()+");"));}

    private void sendPendingAlert(String listingId,FirebaseUser user){
        if(user==null)return;
        if(BuildConfig.ALERT_WEBHOOK_URL==null||BuildConfig.ALERT_WEBHOOK_URL.trim().isEmpty()){runJs("window.onPendingAlertUnavailable&&window.onPendingAlertUnavailable();");return;}
        user.getIdToken(false).addOnSuccessListener(result->{String token=result.getToken();if(token==null||token.isEmpty())return;new Thread(()->{HttpURLConnection c=null;try{JSONObject body=new JSONObject();body.put("listingId",listingId);body.put("idToken",token);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c=(HttpURLConnection)new URL(BuildConfig.ALERT_WEBHOOK_URL).openConnection();c.setRequestMethod("POST");c.setConnectTimeout(12000);c.setReadTimeout(12000);c.setDoOutput(true);c.setInstanceFollowRedirects(true);c.setRequestProperty("Content-Type","application/json; charset=UTF-8");c.setRequestProperty("Accept","application/json");try(OutputStream os=c.getOutputStream()){os.write(bytes);}int code=c.getResponseCode();if(code>=200&&code<400)runJs("window.onPendingAlertSent&&window.onPendingAlertSent();");else runJs("window.onPendingAlertFailed&&window.onPendingAlertFailed();");}catch(Exception ignored){runJs("window.onPendingAlertFailed&&window.onPendingAlertFailed();");}finally{if(c!=null)c.disconnect();}}).start();});
    }

    public class MotoVerseBridge {
        @JavascriptInterface public void refreshAuth(){pushAuthStateToWeb();}
        @JavascriptInterface public void createAccount(String n,String e,String p){runOnUiThread(()->createEmail(n,e,p));}
        @JavascriptInterface public void signInEmail(String e,String p){runOnUiThread(()->MainActivity.this.signInEmail(e,p));}
        @JavascriptInterface public void googleLogin(){runOnUiThread(()->startGoogle());}
        @JavascriptInterface public void resetPassword(String e){if(e==null||e.trim().isEmpty()){sendError("Indica primeiro o e-mail.");return;}auth.sendPasswordResetEmail(e.trim()).addOnCompleteListener(t->{if(t.isSuccessful())runJs("window.onPasswordResetSent&&window.onPasswordResetSent();");else sendError(friendly(t.getException()));});}
        @JavascriptInterface public void logout(){auth.signOut();googleClient.signOut();pushAuthStateToWeb();}
        @JavascriptInterface public void saveGarage(String json){FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para guardar a tua garagem.");return;}try{Map<String,Object>d=jsonToMap(new JSONObject(json));d.remove("updatedAt");d.put("ownerUid",u.getUid());Map<String,Object>x=new HashMap<>();x.put("garage",d);x.put("garageUpdatedAt",FieldValue.serverTimestamp());db.collection("users").document(u.getUid()).set(x,SetOptions.merge()).addOnSuccessListener(v->runJs("window.onGarageSaved&&window.onGarageSaved();")).addOnFailureListener(e->sendError("Não foi possível guardar a mota: "+(e.getLocalizedMessage()==null?"erro de permissões":e.getLocalizedMessage())));}catch(Exception e){sendError("Dados da mota inválidos.");}}
        @JavascriptInterface public void loadGarage(){FirebaseUser u=auth.getCurrentUser();if(u!=null)loadGarageForUser(u);}
        @JavascriptInterface public void saveListing(String json){FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão antes de publicar um anúncio.");return;}try{Map<String,Object>d=jsonToMap(new JSONObject(json));d.put("ownerUid",u.getUid());d.put("ownerEmail",u.getEmail()==null?"":u.getEmail());d.put("ownerName",u.getDisplayName()==null?"Motociclista":u.getDisplayName());d.put("status","pending");d.put("createdAt",FieldValue.serverTimestamp());d.put("updatedAt",FieldValue.serverTimestamp());db.collection("listings").add(d).addOnSuccessListener(ref->{sendPendingAlert(ref.getId(),u);runJs("window.onListingSaved&&window.onListingSaved("+JSONObject.quote(ref.getId())+");");if(isAdmin(u))loadPendingCountForAdmin();}).addOnFailureListener(e->sendError("Não foi possível guardar o anúncio: "+e.getLocalizedMessage()));}catch(Exception e){sendError("Dados do anúncio inválidos.");}}
        @JavascriptInterface public void loadMyListings(){FirebaseUser u=auth.getCurrentUser();if(u==null)return;db.collection("listings").whereEqualTo("ownerUid",u.getUid()).get().addOnSuccessListener(s->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:s)a.put(docJson(d));runJs("window.onMyListings&&window.onMyListings("+a+");");});}
        @JavascriptInterface public void loadApprovedListings(){db.collection("listings").whereEqualTo("status","approved").get().addOnSuccessListener(s->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:s)a.put(docJson(d));runJs("window.onApprovedListings&&window.onApprovedListings("+a+");");});}
        @JavascriptInterface public void loadPendingListingsAdmin(){FirebaseUser u=auth.getCurrentUser();if(!isAdmin(u)){sendError("Área reservada ao revisor.");return;}db.collection("listings").whereEqualTo("status","pending").get().addOnSuccessListener(s->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:s)a.put(docJson(d));runJs("window.onPendingListings&&window.onPendingListings("+a+");window.onPendingCount&&window.onPendingCount("+s.size()+");");});}
        @JavascriptInterface public void loadPendingCountAdmin(){FirebaseUser u=auth.getCurrentUser();if(isAdmin(u))loadPendingCountForAdmin();}
        @JavascriptInterface public void reviewListing(String id,String status){FirebaseUser u=auth.getCurrentUser();if(!isAdmin(u)){sendError("Apenas o revisor pode aprovar anúncios.");return;}if(!"approved".equals(status)&&!"rejected".equals(status))return;Map<String,Object>x=new HashMap<>();x.put("status",status);x.put("reviewedAt",FieldValue.serverTimestamp());x.put("reviewedBy",u.getEmail());db.collection("listings").document(id).update(x).addOnSuccessListener(v->{runJs("window.onReviewDone&&window.onReviewDone();");loadPendingCountForAdmin();}).addOnFailureListener(e->sendError("Não foi possível atualizar o anúncio."));}
        @JavascriptInterface public void sendSellerMessage(String listingId,String sellerUid,String text){FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para responder ao anúncio.");return;}if(text==null||text.trim().isEmpty())return;String conv=listingId+"_"+u.getUid();Map<String,Object>c=new HashMap<>();c.put("listingId",listingId);c.put("buyerUid",u.getUid());c.put("buyerEmail",u.getEmail());c.put("sellerUid",sellerUid);c.put("updatedAt",FieldValue.serverTimestamp());db.collection("conversations").document(conv).set(c);Map<String,Object>m=new HashMap<>();m.put("senderUid",u.getUid());m.put("text",text.trim());m.put("createdAt",FieldValue.serverTimestamp());db.collection("conversations").document(conv).collection("messages").add(m).addOnSuccessListener(v->runJs("window.onSellerMessageSent&&window.onSellerMessageSent();")).addOnFailureListener(e->sendError("Não foi possível enviar a mensagem."));}
    }

    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(intent!=null&&intent.getBooleanExtra("openAdminReview",false)){openAdminReviewOnReady=true;if(pageReady){FirebaseUser u=auth.getCurrentUser();if(isAdmin(u)){openAdminReviewOnReady=false;runJs("setTimeout(function(){window.openAdminReview&&window.openAdminReview();},200);");}}}}
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==GOOGLE_SIGN_IN_REQUEST){Task<GoogleSignInAccount>task=GoogleSignIn.getSignedInAccountFromIntent(data);try{GoogleSignInAccount a=task.getResult(ApiException.class);if(a!=null&&a.getIdToken()!=null)firebaseGoogle(a.getIdToken());else sendError("Login Google cancelado.");}catch(ApiException e){if(e.getStatusCode()==10)sendError("Google ainda não está autorizado para a assinatura atual da MotoVerse. Falta atualizar o SHA-1 no Firebase.");else sendError("Não foi possível entrar com Google ("+e.getStatusCode()+").");}return;}if(requestCode!=FILE_CHOOSER_REQUEST||fileCallback==null)return;Uri[]r=null;if(resultCode==Activity.RESULT_OK&&data!=null){if(data.getClipData()!=null){int c=data.getClipData().getItemCount();r=new Uri[c];for(int i=0;i<c;i++)r[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)r=new Uri[]{data.getData()};}fileCallback.onReceiveValue(r);fileCallback=null;}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
}
