from pathlib import Path

p = Path('app/src/main/java/pt/motoverse/app/MainActivity.java')
s = p.read_text(encoding='utf-8')

if 'import android.provider.CalendarContract;' not in s:
    s = s.replace('import android.os.Bundle;', 'import android.os.Bundle;\nimport android.provider.CalendarContract;')

old = 'int code=c.getResponseCode();if(code>=200&&code<400)runJs("window.onPendingAlertSent&&window.onPendingAlertSent();");else runJs("window.onPendingAlertFailed&&window.onPendingAlertFailed();");'
new = '''int code=c.getResponseCode();String resp="";try{InputStream rs=(code>=200&&code<400)?c.getInputStream():c.getErrorStream();if(rs!=null){ByteArrayOutputStream ro=new ByteArrayOutputStream();byte[] rb=new byte[2048];int rn;while((rn=rs.read(rb))!=-1)ro.write(rb,0,rn);resp=ro.toString(StandardCharsets.UTF_8.name());}}catch(Exception ignored){}boolean ok=code>=200&&code<400&&(resp.trim().isEmpty()||resp.contains("\\\"ok\\\":true")||resp.contains("\\\"ok\\\": true"));if(ok)runJs("window.onPendingAlertSent&&window.onPendingAlertSent();");else runJs("window.onPendingAlertFailed&&window.onPendingAlertFailed("+JSONObject.quote(resp)+");");'''
if old in s:
    s = s.replace(old, new)

calendar_method = '''\n    private void addCalendarEventNative(String title,String location,long startMillis,long endMillis,String description){\n        Intent intent=new Intent(Intent.ACTION_INSERT);\n        intent.setData(CalendarContract.Events.CONTENT_URI);\n        intent.putExtra(CalendarContract.Events.TITLE,title==null?"MotoVerse":title);\n        intent.putExtra(CalendarContract.Events.EVENT_LOCATION,location==null?"":location);\n        intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,startMillis);\n        intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME,endMillis>startMillis?endMillis:startMillis+3600000L);\n        intent.putExtra(CalendarContract.Events.DESCRIPTION,description==null?"":description);\n        try{intent.setPackage("com.google.android.calendar");startActivity(intent);}catch(Exception e){\n            try{intent.setPackage(null);startActivity(intent);}catch(Exception ex){sendError("Não encontrei uma aplicação de calendário instalada.");}\n        }\n    }\n\n'''
if 'addCalendarEventNative(' not in s:
    s = s.replace('    public class MotoVerseBridge {', calendar_method + '    public class MotoVerseBridge {')

if '@JavascriptInterface public void addCalendarEvent(' not in s:
    s = s.replace('        @JavascriptInterface public void refreshAuth(){pushAuthStateToWeb();}',
                  '        @JavascriptInterface public void refreshAuth(){pushAuthStateToWeb();}\n        @JavascriptInterface public void addCalendarEvent(String title,String location,long startMillis,long endMillis,String description){runOnUiThread(()->addCalendarEventNative(title,location,startMillis,endMillis,description));}')

p.write_text(s, encoding='utf-8')
print('v1.9 native patch applied')
