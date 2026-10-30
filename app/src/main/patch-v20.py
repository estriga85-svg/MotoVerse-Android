from pathlib import Path

p = Path('app/src/main/java/pt/motoverse/app/MainActivity.java')
s = p.read_text(encoding='utf-8')

marker = '        @JavascriptInterface public void sendSellerMessage(String listingId,String sellerUid,String text)'

methods = r'''        @JavascriptInterface public void loadFavorites(){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para ver os favoritos.");return;}
            db.collection("users").document(u.getUid()).collection("favorites").get()
                .addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onFavoritesLoaded&&window.onFavoritesLoaded("+a+");");})
                .addOnFailureListener(e->sendError("Não foi possível carregar os favoritos."));
        }
        @JavascriptInterface public void saveFavorite(String json){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para guardar favoritos.");return;}
            try{JSONObject o=new JSONObject(json);String id=o.optString("id","");if(id.trim().isEmpty()){sendError("Favorito inválido.");return;}Map<String,Object>d=jsonToMap(o);d.put("updatedAt",FieldValue.serverTimestamp());db.collection("users").document(u.getUid()).collection("favorites").document(id).set(d,SetOptions.merge()).addOnSuccessListener(v->runJs("window.onFavoriteSaved&&window.onFavoriteSaved("+JSONObject.quote(id)+");")).addOnFailureListener(e->sendError("Não foi possível guardar o favorito."));}catch(Exception e){sendError("Favorito inválido.");}
        }
        @JavascriptInterface public void removeFavorite(String id){
            FirebaseUser u=auth.getCurrentUser();if(u==null)return;if(id==null||id.trim().isEmpty())return;
            db.collection("users").document(u.getUid()).collection("favorites").document(id).delete().addOnSuccessListener(v->runJs("window.onFavoriteRemoved&&window.onFavoriteRemoved("+JSONObject.quote(id)+");")).addOnFailureListener(e->sendError("Não foi possível remover o favorito."));
        }
        @JavascriptInterface public void loadConversations(){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para ver as mensagens.");return;}String uid=u.getUid();Map<String,JSONObject> rows=new HashMap<>();
            db.collection("conversations").whereEqualTo("buyerUid",uid).get().addOnSuccessListener(first->{for(QueryDocumentSnapshot d:first)rows.put(d.getId(),docJson(d));db.collection("conversations").whereEqualTo("sellerUid",uid).get().addOnSuccessListener(second->{for(QueryDocumentSnapshot d:second)rows.put(d.getId(),docJson(d));JSONArray a=new JSONArray();for(JSONObject o:rows.values())a.put(o);runJs("window.onConversationsLoaded&&window.onConversationsLoaded("+a+");");}).addOnFailureListener(e->sendError("Não foi possível carregar as mensagens."));}).addOnFailureListener(e->sendError("Não foi possível carregar as mensagens."));
        }
        @JavascriptInterface public void loadConversationMessages(String conversationId){
            FirebaseUser u=auth.getCurrentUser();if(u==null||conversationId==null||conversationId.trim().isEmpty())return;String uid=u.getUid();
            db.collection("conversations").document(conversationId).get().addOnSuccessListener(c->{if(!c.exists()){sendError("Conversa não encontrada.");return;}String buyer=c.getString("buyerUid"),seller=c.getString("sellerUid");if(!uid.equals(buyer)&&!uid.equals(seller)){sendError("Não tens acesso a esta conversa.");return;}db.collection("conversations").document(conversationId).collection("messages").get().addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onConversationMessagesLoaded&&window.onConversationMessagesLoaded("+JSONObject.quote(conversationId)+","+a+");");}).addOnFailureListener(e->sendError("Não foi possível carregar a conversa."));}).addOnFailureListener(e->sendError("Não foi possível abrir a conversa."));
        }
        @JavascriptInterface public void sendConversationReply(String conversationId,String text){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para responder.");return;}if(conversationId==null||conversationId.trim().isEmpty()||text==null||text.trim().isEmpty())return;String uid=u.getUid();
            db.collection("conversations").document(conversationId).get().addOnSuccessListener(c->{String buyer=c.getString("buyerUid"),seller=c.getString("sellerUid");if(!c.exists()||(!uid.equals(buyer)&&!uid.equals(seller))){sendError("Não tens acesso a esta conversa.");return;}Map<String,Object>m=new HashMap<>();m.put("senderUid",uid);m.put("senderName",u.getDisplayName()==null?"Motociclista":u.getDisplayName());m.put("text",text.trim());m.put("createdAt",FieldValue.serverTimestamp());db.collection("conversations").document(conversationId).collection("messages").add(m).addOnSuccessListener(v->{Map<String,Object>x=new HashMap<>();x.put("updatedAt",FieldValue.serverTimestamp());x.put("lastMessage",text.trim());db.collection("conversations").document(conversationId).set(x,SetOptions.merge());runJs("window.onConversationReplySent&&window.onConversationReplySent("+JSONObject.quote(conversationId)+");");}).addOnFailureListener(e->sendError("Não foi possível enviar a mensagem."));}).addOnFailureListener(e->sendError("Não foi possível abrir a conversa."));
        }
        @JavascriptInterface public void loadSavedAlerts(){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para ver os alertas.");return;}
            db.collection("users").document(u.getUid()).collection("alerts").get().addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onSavedAlertsLoaded&&window.onSavedAlertsLoaded("+a+");");}).addOnFailureListener(e->sendError("Não foi possível carregar os alertas."));
        }
        @JavascriptInterface public void saveSearchAlert(String json){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para guardar alertas.");return;}
            try{Map<String,Object>d=jsonToMap(new JSONObject(json));d.put("active",true);d.put("updatedAt",FieldValue.serverTimestamp());db.collection("users").document(u.getUid()).collection("alerts").add(d).addOnSuccessListener(ref->runJs("window.onSearchAlertSaved&&window.onSearchAlertSaved("+JSONObject.quote(ref.getId())+");")).addOnFailureListener(e->sendError("Não foi possível guardar o alerta."));}catch(Exception e){sendError("Dados do alerta inválidos.");}
        }
        @JavascriptInterface public void deleteSearchAlert(String id){
            FirebaseUser u=auth.getCurrentUser();if(u==null||id==null||id.trim().isEmpty())return;db.collection("users").document(u.getUid()).collection("alerts").document(id).delete().addOnSuccessListener(v->runJs("window.onSearchAlertDeleted&&window.onSearchAlertDeleted();")).addOnFailureListener(e->sendError("Não foi possível apagar o alerta."));
        }
        @JavascriptInterface public void saveMeetup(String json){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para criar encontros.");return;}
            try{Map<String,Object>d=jsonToMap(new JSONObject(json));d.put("organizerUid",u.getUid());d.put("organizerEmail",u.getEmail()==null?"":u.getEmail());d.put("organizerName",u.getDisplayName()==null?"Motociclista":u.getDisplayName());d.put("organizerVerified",isAdmin(u)||u.isEmailVerified());d.put("status","active");d.put("createdAt",FieldValue.serverTimestamp());d.put("updatedAt",FieldValue.serverTimestamp());db.collection("meetups").add(d).addOnSuccessListener(ref->runJs("window.onMeetupSaved&&window.onMeetupSaved("+JSONObject.quote(ref.getId())+");")).addOnFailureListener(e->sendError("Não foi possível criar o encontro."));}catch(Exception e){sendError("Dados do encontro inválidos.");}
        }
        @JavascriptInterface public void loadMyMeetups(){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para ver os teus encontros.");return;}db.collection("meetups").whereEqualTo("organizerUid",u.getUid()).get().addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onMyMeetupsLoaded&&window.onMyMeetupsLoaded("+a+");");}).addOnFailureListener(e->sendError("Não foi possível carregar os encontros."));
        }
        @JavascriptInterface public void loadMeetups(){
            db.collection("meetups").whereEqualTo("status","active").get().addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onMeetupsLoaded&&window.onMeetupsLoaded("+a+");");}).addOnFailureListener(e->sendError("Não foi possível atualizar os encontros."));
        }
        @JavascriptInterface public void deleteMeetup(String id){
            FirebaseUser u=auth.getCurrentUser();if(u==null||id==null||id.trim().isEmpty())return;db.collection("meetups").document(id).get().addOnSuccessListener(d->{if(!d.exists()||!u.getUid().equals(d.getString("organizerUid"))){sendError("Só o organizador pode apagar este encontro.");return;}db.collection("meetups").document(id).delete().addOnSuccessListener(v->runJs("window.onMeetupDeleted&&window.onMeetupDeleted();")).addOnFailureListener(e->sendError("Não foi possível apagar o encontro."));});
        }
        @JavascriptInterface public void requestNotificationPermission(){
            runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION_REQUEST);}else runJs("window.onNotificationPermissionReady&&window.onNotificationPermissionReady();");});
        }
        @JavascriptInterface public void openNotificationSettings(){
            runOnUiThread(()->{try{Intent i=new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getPackageName());startActivity(i);}catch(Exception e){sendError("Não foi possível abrir as definições de notificações.");}});
        }
        @JavascriptInterface public void resetCurrentPassword(){
            FirebaseUser u=auth.getCurrentUser();if(u==null||u.getEmail()==null||u.getEmail().trim().isEmpty()){sendError("Esta conta não tem e-mail disponível.");return;}auth.sendPasswordResetEmail(u.getEmail()).addOnCompleteListener(t->{if(t.isSuccessful())runJs("window.onCurrentPasswordResetSent&&window.onCurrentPasswordResetSent();");else sendError("Não foi possível enviar o e-mail de recuperação.");});
        }
'''

if 'public void loadFavorites()' not in s:
    if marker not in s:
        raise SystemExit('v1.11 marker not found in MainActivity.java')
    s = s.replace(marker, methods + marker)

# Preserve richer conversation metadata when the first message is sent.
s = s.replace('c.put("buyerEmail",u.getEmail());c.put("sellerUid",sellerUid);c.put("updatedAt",FieldValue.serverTimestamp());db.collection("conversations").document(conv).set(c);',
'''c.put("buyerEmail",u.getEmail());c.put("buyerName",u.getDisplayName()==null?"Motociclista":u.getDisplayName());c.put("sellerUid",sellerUid);c.put("updatedAt",FieldValue.serverTimestamp());db.collection("conversations").document(conv).set(c,SetOptions.merge());''')

p.write_text(s, encoding='utf-8')
print('v1.11 profile native patch applied')
