package pt.motoverse.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private static final int FILE_CHOOSER_REQUEST = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                applyMotoVerseFixes();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }

                fileCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

                startActivityForResult(
                        Intent.createChooser(intent, "Selecionar fotografias"),
                        FILE_CHOOSER_REQUEST
                );
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    private void applyMotoVerseFixes() {
        String js =
            "(function(){" +
            "var st=document.createElement('style');" +
            "st.textContent='" +
                ".modalWrap{padding-bottom:76px!important;box-sizing:border-box!important;}" +
                ".modal{max-height:calc(100dvh - 105px)!important;padding-bottom:36px!important;overscroll-behavior:contain!important;}" +
                ".modal .btn.full:last-child{margin-bottom:18px!important;min-height:54px!important;}" +
                ".photoThumb,.garagePhoto,.homeGaragePhoto{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;}" +
                ".photoThumb{background-color:#eef2f7!important;}" +
            "';document.head.appendChild(st);" +

            "window.previewGaragePhoto=function(input){" +
                "var f=input.files&&input.files[0];if(!f)return;" +
                "var r=new FileReader();" +
                "r.onload=function(e){var img=new Image();img.onload=function(){" +
                    "var max=1000,scale=Math.min(1,max/Math.max(img.width,img.height));" +
                    "var cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*scale));cv.height=Math.max(1,Math.round(img.height*scale));" +
                    "var ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);" +
                    "window.__garagePhoto=cv.toDataURL('image/jpeg',0.72);" +
                    "var t=document.querySelector('#garagePhotoThumb');if(t){t.style.backgroundImage='url('+window.__garagePhoto+')';t.style.backgroundSize='contain';t.style.backgroundRepeat='no-repeat';t.style.backgroundPosition='center';t.textContent='';}" +
                "};img.src=e.target.result;};r.readAsDataURL(f);" +
            "};" +

            "window.saveBike=function(){" +
                "var q=function(s){return document.querySelector(s)};" +
                "var brand=q('#gBrand')?q('#gBrand').value.trim():'';var model=q('#gModel')?q('#gModel').value.trim():'';" +
                "if(!brand||!model){if(window.toast)toast('Indica marca e modelo');return;}" +
                "var bike={brand:brand,model:model,year:q('#gYear')?q('#gYear').value:'',km:Number(q('#gKm')?q('#gKm').value||0:0),plate:q('#gPlate')?q('#gPlate').value.trim():'',nextKm:Number(q('#gNextKm')?q('#gNextKm').value||0:0),nextDate:q('#gNextDate')?q('#gNextDate').value:'',photo:window.__garagePhoto||''};" +
                "try{localStorage.setItem('mv_garage',JSON.stringify(bike));}" +
                "catch(e){bike.photo='';try{localStorage.setItem('mv_garage',JSON.stringify(bike));}catch(e2){if(window.toast)toast('Não foi possível guardar.');return;}if(window.toast)toast('Dados guardados; a fotografia era demasiado grande.');}" +
                "if(window.state)state.garage=bike;" +
                "if(window.closeModal)closeModal();if(window.renderGarage)renderGarage();if(window.renderHomeGarage)renderHomeGarage();if(window.updateProfile&&window.state&&state.user)updateProfile();" +
                "if(window.toast)toast('Mota guardada na garagem');" +
            "};" +
            "})();";

        webView.evaluateJavascript(js, null);
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
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
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
