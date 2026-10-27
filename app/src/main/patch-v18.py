from pathlib import Path
import re

p = Path('app/src/main/java/pt/motoverse/app/MainActivity.java')
s = p.read_text(encoding='utf-8')

if 'import com.google.firebase.firestore.SetOptions;' not in s:
    s = s.replace('import com.google.firebase.firestore.QueryDocumentSnapshot;','import com.google.firebase.firestore.QueryDocumentSnapshot;\nimport com.google.firebase.firestore.SetOptions;')

s = re.sub(
    r'private void loadGarageForUser\(FirebaseUser u\)\{.*?\}\n\n    private void sendPendingAlert',
    '''private void loadGarageForUser(FirebaseUser u){\n        db.collection("users").document(u.getUid()).get()\n            .addOnSuccessListener(d->{\n                Object g=d.get("garage");\n                if(g instanceof Map){\n                    JSONObject o=new JSONObject((Map)g);\n                    runJs("window.onGarageLoaded&&window.onGarageLoaded("+o.toString()+");");\n                }\n            })\n            .addOnFailureListener(e->sendError("Não foi possível carregar a garagem: "+e.getLocalizedMessage()));\n    }\n\n    private void sendPendingAlert''',
    s, flags=re.S)

s = s.replace('private void sendPendingAlert(String listingId,FirebaseUser user){','private void sendPendingAlert(String listingId,FirebaseUser user,Map<String,Object> listing){')

s = s.replace('body.put("listingId",listingId);body.put("idToken",token);',
'''body.put("listingId",listingId);body.put("idToken",token);\n                    body.put("segredo","MV-ESTRIGA-2026-ALERT");\n                    body.put("id",listingId);\n                    body.put("marca",listing.get("brand"));\n                    body.put("modelo",listing.get("model"));\n                    body.put("ano",listing.get("year"));\n                    body.put("preco",listing.get("price"));\n                    body.put("localizacao",listing.get("location"));\n                    body.put("nome",user.getDisplayName()==null?"Motociclista":user.getDisplayName());\n                    body.put("email",user.getEmail()==null?"":user.getEmail());''')

s = s.replace('sendPendingAlert(ref.getId(),u);','sendPendingAlert(ref.getId(),u,d);')

s = re.sub(
    r'@JavascriptInterface public void saveGarage\(String json\)\{.*?\}\n        @JavascriptInterface public void loadGarage',
    '''@JavascriptInterface public void saveGarage(String json){FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para guardar a tua garagem.");return;}try{Map<String,Object>d=jsonToMap(new JSONObject(json));d.put("ownerUid",u.getUid());d.put("updatedAt",FieldValue.serverTimestamp());Map<String,Object>w=new HashMap<>();w.put("garage",d);w.put("garageUpdatedAt",FieldValue.serverTimestamp());db.collection("users").document(u.getUid()).set(w,SetOptions.merge()).addOnSuccessListener(v->runJs("window.onGarageSaved&&window.onGarageSaved();")).addOnFailureListener(e->sendError("Não foi possível guardar a mota: "+e.getLocalizedMessage()));}catch(Exception e){sendError("Dados da mota inválidos: "+e.getLocalizedMessage());}}\n        @JavascriptInterface public void loadGarage''',
    s, flags=re.S)

p.write_text(s, encoding='utf-8')
print('v1.8 native patch applied')
