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
        private void meetupPublishFailed(String message) {
            runJs("window.onCommunityPublishFailed&&window.onCommunityPublishFailed(" + JSONObject.quote(message) + ");");
        }
        @JavascriptInterface public void saveMeetup(String json) {
            FirebaseUser user = auth.getCurrentUser();
            if (user == null) { meetupPublishFailed("Inicia sessão para publicar um encontro."); return; }
            try {
                JSONObject input = new JSONObject(json);
                String category = input.getString("category");
                String name = input.getString("name").trim();
                String location = input.getString("location").trim();
                String date = input.getString("date");
                String time = input.getString("time");
                String route = input.optString("route").trim();
                String description = input.optString("description").trim();
                if (!CommunityNotifications.TYPES.contains(category) || name.isEmpty() || name.length() > 100
                        || location.isEmpty() || location.length() > 200 || route.length() > 300 || description.length() > 1500
                        || !date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !time.matches("([01][0-9]|2[0-3]):[0-5][0-9]")) {
                    meetupPublishFailed("Confirma o título, local, tipo, data e hora.");
                    return;
                }
                String type;
                switch (category) {
                    case "cafezada": type = "Cafezada"; break;
                    case "en2": type = "Tour EN2"; break;
                    case "tour": type = "Tour"; break;
                    case "trilho": type = "Trilhos / Off-road"; break;
                    case "trackday": type = "Track Day"; break;
                    default: type = "Passeio";
                }
                Map<String,Object> item = new HashMap<>();
                item.put("category", category);
                item.put("type", type);
                item.put("name", name);
                item.put("location", location);
                item.put("date", date);
                item.put("time", time);
                item.put("route", route);
                item.put("description", description);
                item.put("notifyInterested", input.optBoolean("notifyInterested", false));
                item.put("organizerUid", user.getUid());
                item.put("organizerName", user.getDisplayName() == null ? "Motociclista" : user.getDisplayName());
                item.put("organizerVerified", isAdmin(user) || user.isEmailVerified());
                item.put("status", "active");
                item.put("createdAt", FieldValue.serverTimestamp());
                item.put("updatedAt", FieldValue.serverTimestamp());
                db.collection("meetups").add(item)
                    .addOnSuccessListener(ref -> runJs("window.onMeetupSaved&&window.onMeetupSaved(" + JSONObject.quote(ref.getId()) + ");"))
                    .addOnFailureListener(error -> meetupPublishFailed("Não foi possível publicar o encontro. Tenta novamente."));
            } catch (Exception error) {
                meetupPublishFailed("Dados do encontro inválidos.");
            }
        }
        @JavascriptInterface public void loadMyMeetups(){
            FirebaseUser u=auth.getCurrentUser();if(u==null){sendError("Inicia sessão para ver os teus encontros.");return;}db.collection("meetups").whereEqualTo("organizerUid",u.getUid()).get().addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onMyMeetupsLoaded&&window.onMyMeetupsLoaded("+a+");");}).addOnFailureListener(e->sendError("Não foi possível carregar os encontros."));
        }
        @JavascriptInterface public void loadMeetups(){
            db.collection("meetups").whereEqualTo("status","active").get().addOnSuccessListener(snap->{JSONArray a=new JSONArray();for(QueryDocumentSnapshot d:snap)a.put(docJson(d));runJs("window.onMeetupsLoaded&&window.onMeetupsLoaded("+a+");");}).addOnFailureListener(e -> runJs("window.onCommunityFeedFailed&&window.onCommunityFeedFailed();"));
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
