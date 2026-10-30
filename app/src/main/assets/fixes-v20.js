(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));
  const notify=t=>window.toast?window.toast(t):alert(t);
  const st=()=>{try{return typeof state!=='undefined'?state:null}catch(e){return null}};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let favorites=[], conversations=[], savedAlerts=[], myMeetups=[], myListings=[], currentConversation='';

  const style=document.createElement('style');
  style.textContent=`
    #profile .menuItem{cursor:pointer;min-height:58px}
    #profile .menuItem:active{opacity:.72}
    .mvCount{min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:var(--panel2);display:inline-flex;align-items:center;justify-content:center;font-size:11px}
    .mvProfileStatus{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:10px;color:var(--muted)}
    .mvDot{width:7px;height:7px;border-radius:50%;background:var(--good)}
    .mvModalItem{border:1px solid var(--line);background:var(--panel);border-radius:15px;padding:12px;margin:9px 0}
    .mvModalItem h3{font-size:14px;margin:0 0 5px}.mvModalItem p{font-size:11px;color:var(--muted);margin:2px 0;line-height:1.45}
    .mvRow{display:flex;align-items:center;justify-content:space-between;gap:9px}
    .mvDanger{border-color:rgba(255,93,108,.35)!important;color:#ff8994!important}
    .mvMessageList{display:grid;gap:8px;margin:10px 0 14px}
    .mvBubble{max-width:84%;padding:10px 12px;border-radius:15px;background:var(--panel2);font-size:12px;line-height:1.45}
    .mvBubble.me{margin-left:auto;background:linear-gradient(135deg,var(--accent),var(--accent2));color:white}
    .mvBubbleTime{font-size:8px;opacity:.72;margin-top:4px}
    .mvFavOn{color:#ff7040!important;background:rgba(255,90,31,.22)!important}
    .mvSmall{font-size:10px;color:var(--muted)}
  `;
  document.head.appendChild(style);

  function logged(){const s=st();return !!(s&&s.user&&s.user.uid)}
  function loginNeeded(reason){if(logged())return true;notify('Inicia sessão para '+reason);if(window.mvSwitchAuth)window.mvSwitchAuth('login');else q('#authGate')?.classList.add('show');return false}
  function setCount(id,n){const e=q(id);if(e)e.textContent=String(Number(n)||0)}
  function fmtDate(v){if(!v)return'';try{return new Date(Number(v)||v).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return''}}
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function imageFrom(el){const x=el?.style?.backgroundImage||'';return x.replace(/^url\(["']?/,'').replace(/["']?\)$/,'')}

  function buildProfile(){
    const p=q('#profile');if(!p)return;
    p.innerHTML=`
      <div class="headPad"><h1>Perfil</h1><p>A tua conta MotoVerse.</p></div>
      <div class="section"><div class="profileCard" id="mvProfileCard"><div class="profilePic" id="profileInitial">M</div><div style="min-width:0;flex:1"><h3 id="profileName">Convidado</h3><p id="profileEmail">Explora a MotoVerse sem conta</p><div class="mvProfileStatus" id="mvProfileStatus"></div></div><span>›</span></div></div>
      <div class="section" id="mvProfileMenu">
        <div class="menuItem" id="mvFavoritesRow"><span>♡ Favoritos</span><b class="mvCount" id="mvFavoritesCount">0</b></div>
        <div class="menuItem" id="mvMessagesRow"><span>💬 Mensagens</span><b class="mvCount" id="mvMessagesCount">0</b></div>
        <div class="menuItem" id="mvAlertsRow"><span>🔔 Alertas guardados</span><b class="mvCount" id="mvAlertsCount">0</b></div>
        <div class="menuItem" id="mvListingsRow"><span>🏍 Meus anúncios</span><b class="mvCount" id="mvListingsCount">0</b></div>
        <div class="menuItem" id="mvMeetupsRow"><span>👥 Meus encontros</span><b class="mvCount" id="mvMeetupsCount">0</b></div>
        <div class="menuItem" id="mvAppearanceRow"><span>◐ Aspeto</span><b id="profileThemeLabel">Dark</b></div>
        <div class="menuItem" id="mvSettingsRow"><span>⚙️ Configurações</span><span>›</span></div>
      </div>
      <div class="section" id="mvAdminSection" style="display:none"><div class="menuItem" id="mvAdminReview"><span>🛡️ Rever anúncios</span><b class="mvCount" id="mvAdminCount">0</b></div></div>
      <div class="section"><button class="btn secondary full" id="mvSessionBtn">Entrar / Criar conta</button></div>
      <div class="section"><div class="notice" id="mvAccountNotice">Entra na tua conta para sincronizar garagem, anúncios, favoritos, mensagens, encontros e alertas entre dispositivos.</div></div>`;

    q('#mvFavoritesRow').onclick=openFavorites;
    q('#mvMessagesRow').onclick=openMessages;
    q('#mvAlertsRow').onclick=openSavedAlerts;
    q('#mvListingsRow').onclick=()=>{if(loginNeeded('ver os teus anúncios'))window.openMyListings&&window.openMyListings()};
    q('#mvMeetupsRow').onclick=openMyMeetups;
    q('#mvAppearanceRow').onclick=()=>{if(window.toggleTheme)toggleTheme();setTimeout(updateThemeLabel,0)};
    q('#mvSettingsRow').onclick=openSettings;
    q('#mvAdminReview').onclick=()=>window.openAdminReview&&window.openAdminReview();
    q('#mvProfileCard').onclick=()=>logged()?openSettings():(window.mvSwitchAuth?window.mvSwitchAuth('login'):q('#authGate')?.classList.add('show'));
    q('#mvSessionBtn').onclick=()=>{if(logged())Android.logout();else if(window.mvSwitchAuth)window.mvSwitchAuth('login');};
    updateProfileCard();updateThemeLabel();
  }

  function updateProfileCard(){
    const s=st(),u=s&&s.user;const name=q('#profileName'),email=q('#profileEmail'),initial=q('#profileInitial'),status=q('#mvProfileStatus'),btn=q('#mvSessionBtn'),notice=q('#mvAccountNotice');
    if(u&&u.uid){
      if(name)name.textContent=u.name||'Motociclista';if(email)email.textContent=(u.email||'Conta MotoVerse')+' · '+(s.location||'Portugal');if(initial)initial.textContent=(u.name||u.email||'M').trim().charAt(0).toUpperCase();
      if(status)status.innerHTML=`<span class="mvDot"></span><span>${u.verified?'Conta verificada':'Conta ligada'}</span>`;
      if(btn)btn.textContent='Terminar sessão';if(notice)notice.textContent='Conta ligada ao MotoVerse. Os teus dados pessoais desta área são guardados na tua conta.';
      if(q('#mvAdminSection'))q('#mvAdminSection').style.display=u.admin?'block':'none';
    }else{
      if(name)name.textContent='Convidado';if(email)email.textContent='Explora a MotoVerse sem conta';if(initial)initial.textContent='M';if(status)status.innerHTML='';if(btn)btn.textContent='Entrar / Criar conta';if(notice)notice.textContent='Entra na tua conta para sincronizar garagem, anúncios, favoritos, mensagens, encontros e alertas entre dispositivos.';if(q('#mvAdminSection'))q('#mvAdminSection').style.display='none';
      ['#mvFavoritesCount','#mvMessagesCount','#mvAlertsCount','#mvListingsCount','#mvMeetupsCount'].forEach(x=>setCount(x,0));
    }
  }
  function updateThemeLabel(){const e=q('#profileThemeLabel');if(e)e.textContent=document.documentElement.dataset.theme==='light'?'Light':'Dark'}

  function refreshProfileData(){
    updateProfileCard();updateThemeLabel();if(!logged())return;
    try{Android.loadFavorites();Android.loadConversations();Android.loadSavedAlerts();Android.loadMyMeetups();Android.loadMyListings();const s=st();if(s?.user?.admin&&Android.loadPendingCountAdmin)Android.loadPendingCountAdmin();}catch(e){}
  }

  function bikeRecord(btn){
    const feature=btn.closest('.featureBike'),card=btn.closest('.card'),box=feature||card;if(!box)return null;
    let title='',price='',meta='',image='';
    if(feature){title=feature.querySelector('h3')?.textContent?.trim()||'';price=feature.querySelector('.featurePrice')?.textContent?.trim()||'';meta=Array.from(feature.querySelectorAll('.featureMeta span')).map(x=>x.textContent.trim()).join(' · ');image=imageFrom(feature.querySelector('.featureBikeImg'));}
    else{title=card.querySelector('.cardTitle h3')?.textContent?.trim()||'';price=card.querySelector('.price')?.textContent?.trim()||'';meta=Array.from(card.querySelectorAll('.meta span')).map(x=>x.textContent.trim()).join(' · ');image=imageFrom(card.querySelector('.bikeImg'));}
    if(!title)return null;return{id:'bike_'+hash(title+'|'+price+'|'+meta),title,price,meta,image};
  }
  function decorateFavoriteButtons(){
    qa('.fav,.featureFav').forEach(btn=>{const rec=bikeRecord(btn);if(!rec)return;btn.dataset.mvFavId=rec.id;btn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();if(!loginNeeded('guardar favoritos'))return;const exists=favorites.some(x=>x.id===rec.id);if(exists)Android.removeFavorite(rec.id);else Android.saveFavorite(JSON.stringify(rec));};});refreshFavoriteButtons();
  }
  function refreshFavoriteButtons(){const ids=new Set(favorites.map(x=>x.id));qa('.fav,.featureFav').forEach(b=>{const on=ids.has(b.dataset.mvFavId);b.textContent=on?'♥':'♡';b.classList.toggle('mvFavOn',on)})}
  window.onFavoritesLoaded=function(items){favorites=Array.isArray(items)?items:[];setCount('#mvFavoritesCount',favorites.length);refreshFavoriteButtons();renderFavoritesModal();};
  window.onFavoriteSaved=function(){notify('Adicionada aos favoritos');Android.loadFavorites();};
  window.onFavoriteRemoved=function(){notify('Removida dos favoritos');Android.loadFavorites();};
  function openFavorites(){if(!loginNeeded('ver os favoritos'))return;openModal('<h2>Favoritos</h2><div id="mvFavoritesBox" class="notice">A carregar...</div>');Android.loadFavorites()}
  function renderFavoritesModal(){const b=q('#mvFavoritesBox');if(!b)return;if(!favorites.length){b.className='empty';b.textContent='Ainda não tens motas nos favoritos.';return}b.className='';b.innerHTML=favorites.map(x=>`<div class="mvModalItem"><div class="mvRow"><div style="min-width:0"><h3>${esc(x.title||'Mota')}</h3><p>${esc(x.price||'')} ${x.meta?'· '+esc(x.meta):''}</p></div><button class="btn secondary mvDanger" style="padding:8px 10px" onclick="Android.removeFavorite('${esc(x.id)}')">Remover</button></div>${x.image?`<div style="height:125px;margin-top:9px;border-radius:12px;background:url('${esc(x.image)}') center/cover no-repeat"></div>`:''}</div>`).join('')}

  function openMessages(){if(!loginNeeded('ver as mensagens'))return;openModal('<h2>Mensagens</h2><div id="mvConversationsBox" class="notice">A carregar...</div>');Android.loadConversations()}
  window.onConversationsLoaded=function(items){conversations=Array.isArray(items)?items:[];conversations.sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));setCount('#mvMessagesCount',conversations.length);renderConversations();};
  function renderConversations(){const b=q('#mvConversationsBox');if(!b)return;if(!conversations.length){b.className='empty';b.textContent='Ainda não tens conversas.';return}b.className='';const uid=st()?.user?.uid||'';b.innerHTML=conversations.map(x=>{const role=x.buyerUid===uid?'Comprador':'Vendedor';const title=x.listingTitle||('Anúncio '+String(x.listingId||'').slice(0,8));return`<div class="mvModalItem" onclick="mvOpenConversation('${esc(x.id)}')"><div class="mvRow"><div><h3>${esc(title)}</h3><p>${esc(role)}${x.lastMessage?' · '+esc(x.lastMessage):''}</p></div><span>›</span></div><div class="mvSmall">${fmtDate(x.updatedAt)}</div></div>`}).join('')}
  window.mvOpenConversation=function(id){currentConversation=id;openModal('<h2>Conversa</h2><div id="mvMessagesBox" class="notice">A carregar...</div>');Android.loadConversationMessages(id)};
  window.onConversationMessagesLoaded=function(id,items){currentConversation=id;const b=q('#mvMessagesBox');if(!b)return;items=Array.isArray(items)?items:[];items.sort((a,c)=>(Number(a.createdAt)||0)-(Number(c.createdAt)||0));const uid=st()?.user?.uid||'';b.className='';b.innerHTML=`<div class="mvMessageList">${items.length?items.map(m=>`<div class="mvBubble ${m.senderUid===uid?'me':''}">${esc(m.text||'')}<div class="mvBubbleTime">${fmtDate(m.createdAt)}</div></div>`).join(''):'<div class="empty">Ainda não existem mensagens nesta conversa.</div>'}</div><div class="field"><label>Mensagem</label><textarea id="mvReplyText" placeholder="Escreve uma mensagem..."></textarea></div><button class="btn primary full" onclick="mvSendReply()">Enviar</button>`;setTimeout(()=>{const modal=q('.modal');if(modal)modal.scrollTop=modal.scrollHeight},0)};
  window.mvSendReply=function(){const t=(q('#mvReplyText')?.value||'').trim();if(!t)return notify('Escreve uma mensagem');Android.sendConversationReply(currentConversation,t)};
  window.onConversationReplySent=function(id){notify('Mensagem enviada');Android.loadConversationMessages(id);Android.loadConversations()};

  function openSavedAlerts(){if(!loginNeeded('ver os alertas'))return;openModal('<h2>Alertas guardados</h2><button class="btn primary full" onclick="mvNewAlert()">+ Criar alerta</button><div id="mvAlertsBox" style="margin-top:10px"><div class="notice">A carregar...</div></div>');Android.loadSavedAlerts()}
  window.onSavedAlertsLoaded=function(items){savedAlerts=Array.isArray(items)?items:[];setCount('#mvAlertsCount',savedAlerts.length);renderAlerts();};
  function renderAlerts(){const b=q('#mvAlertsBox');if(!b)return;if(!savedAlerts.length){b.innerHTML='<div class="empty">Ainda não tens alertas guardados.</div>';return}b.innerHTML=savedAlerts.map(x=>`<div class="mvModalItem"><div class="mvRow"><div><h3>${esc([x.brand,x.model].filter(Boolean).join(' ')||'Pesquisa MotoVerse')}</h3><p>${esc(x.district||'Portugal')}${x.maxPrice?' · até '+Number(x.maxPrice).toLocaleString('pt-PT')+' €':''}</p></div><button class="btn secondary mvDanger" style="padding:8px 10px" onclick="Android.deleteSearchAlert('${esc(x.id)}')">Apagar</button></div></div>`).join('')}
  window.mvNewAlert=function(){openModal(`<h2>Novo alerta</h2><div class="field"><label>Marca</label><input id="mvAlertBrand" placeholder="Ex.: CFMOTO"></div><div class="field"><label>Modelo</label><input id="mvAlertModel" placeholder="Ex.: 450MT"></div><div class="two"><div class="field"><label>Distrito</label><input id="mvAlertDistrict" placeholder="Ex.: Setúbal"></div><div class="field"><label>Preço máximo (€)</label><input id="mvAlertPrice" type="number" placeholder="10000"></div></div><button class="btn primary full" onclick="mvSaveAlert()">Guardar alerta</button>`)};
  window.mvSaveAlert=function(){if(!loginNeeded('guardar alertas'))return;const d={brand:(q('#mvAlertBrand')?.value||'').trim(),model:(q('#mvAlertModel')?.value||'').trim(),district:(q('#mvAlertDistrict')?.value||'').trim(),maxPrice:Number(q('#mvAlertPrice')?.value||0)};if(!d.brand&&!d.model&&!d.district&&!d.maxPrice)return notify('Define pelo menos um critério');Android.saveSearchAlert(JSON.stringify(d))};
  window.onSearchAlertSaved=function(){notify('Alerta guardado');openSavedAlerts()};window.onSearchAlertDeleted=function(){notify('Alerta apagado');Android.loadSavedAlerts()};

  window.createMeetup=function(){if(!loginNeeded('criar encontros'))return;const n=(q('#meetName')?.value||'').trim(),l=(q('#meetLoc')?.value||'').trim(),d=q('#meetDate')?.value||'',tm=q('#meetTime')?.value||'',type=q('#meetType')?.value||'Passeio';if(!n||!l||!d)return notify('Preenche nome, local e data');Android.saveMeetup(JSON.stringify({name:n,location:l,date:d,time:tm,type:type}))};
  window.onMeetupSaved=function(){closeModal();notify('Encontro criado');Android.loadMyMeetups();Android.loadMeetups()};
  function openMyMeetups(){if(!loginNeeded('ver os teus encontros'))return;openModal('<h2>Meus encontros</h2><button class="btn primary full" onclick="closeModal();openMeetup()">+ Criar encontro</button><div id="mvMyMeetupsBox" style="margin-top:10px"><div class="notice">A carregar...</div></div>');Android.loadMyMeetups()}
  window.onMyMeetupsLoaded=function(items){myMeetups=Array.isArray(items)?items:[];myMeetups.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));setCount('#mvMeetupsCount',myMeetups.length);renderMyMeetups();};
  function renderMyMeetups(){const b=q('#mvMyMeetupsBox');if(!b)return;if(!myMeetups.length){b.innerHTML='<div class="empty">Ainda não criaste encontros.</div>';return}b.innerHTML=myMeetups.map(x=>`<div class="mvModalItem"><div class="mvRow"><div><h3>${esc(x.name||'Encontro')}</h3><p>${esc(x.location||'')} · ${esc(x.date||'')} ${esc(x.time||'')}</p><p>${esc(x.type||'')}</p></div><button class="btn secondary mvDanger" style="padding:8px 10px" onclick="Android.deleteMeetup('${esc(x.id)}')">Apagar</button></div></div>`).join('')}
  window.onMeetupDeleted=function(){notify('Encontro apagado');Android.loadMyMeetups();Android.loadMeetups()};
  window.onMeetupsLoaded=function(items){const list=q('#eventList');if(!list)return;qa('#eventList .mvCloudMeetup').forEach(x=>x.remove());(Array.isArray(items)?items:[]).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).forEach(x=>{const dt=x.date?new Date(x.date+'T12:00:00'):new Date(),day=String(dt.getDate()).padStart(2,'0'),mon=dt.toLocaleDateString('pt-PT',{month:'short'}).replace('.','');const div=document.createElement('div');div.className='eventCard mvCloudMeetup';div.dataset.meetupId=x.id||'';div.innerHTML=`<div class="datebox"><strong>${day}</strong><span>${esc(mon)}</span></div><div class="eventText">${x.organizerVerified?'<span class="verifiedBadge">✓ Organizador verificado</span>':'<span class="badge live">MotoVerse</span>'}<h3>${esc(x.name||'Encontro')}</h3><p>${esc(x.location||'')} · ${esc(x.time||'Hora a definir')} · ${esc(x.type||'Passeio')}</p><p style="margin-top:5px">Criado por ${esc(x.organizerName||'Motociclista')}</p><div class="meetRow"><div class="avatars"><div class="avatar">MV</div></div></div></div>`;list.prepend(div)});};

  function openSettings(){if(!loginNeeded('abrir as configurações'))return;const u=st()?.user||{};openModal(`<h2>Configurações</h2><div class="mvModalItem"><h3>Conta</h3><p>${esc(u.name||'Motociclista')}</p><p>${esc(u.email||'')}</p><p>${u.verified?'✓ Conta verificada':'Conta MotoVerse ativa'}</p></div><button class="btn secondary full" onclick="Android.requestNotificationPermission()">🔔 Permitir notificações</button><button class="btn secondary full" style="margin-top:8px" onclick="Android.openNotificationSettings()">Definições de notificações</button><button class="btn secondary full" style="margin-top:8px" onclick="Android.resetCurrentPassword()">Redefinir palavra-passe por e-mail</button><button class="btn secondary full" style="margin-top:8px" onclick="mvRefreshProfileNow()">Atualizar dados da conta</button><div class="notice" style="margin-top:12px">MotoVerse 1.11 · AUTOfamily Lda · geral@motoverse.pt</div>`)}
  window.mvRefreshProfileNow=function(){refreshProfileData();notify('Dados atualizados')};window.onCurrentPasswordResetSent=function(){notify('E-mail de recuperação enviado')};window.onNotificationPermissionReady=function(){notify('Notificações disponíveis')};

  const oldMyListings=window.onMyListings;
  window.onMyListings=function(items){myListings=Array.isArray(items)?items:[];setCount('#mvListingsCount',myListings.length);if(oldMyListings)oldMyListings(items)};
  const oldPending=window.onPendingCount;
  window.onPendingCount=function(n){setCount('#mvAdminCount',n);if(oldPending)oldPending(n)};
  const oldNativeAuth=window.onNativeAuth;
  window.onNativeAuth=function(u){if(oldNativeAuth)oldNativeAuth(u);try{if(u)localStorage.setItem('mv_user',JSON.stringify(u));else localStorage.removeItem('mv_user')}catch(e){}buildProfile();setTimeout(()=>{refreshProfileData();decorateFavoriteButtons();if(logged()&&Android.loadMeetups)Android.loadMeetups()},100)};
  const oldGo=window.go;
  window.go=function(id,el){const r=oldGo?oldGo.apply(this,arguments):undefined;if(id==='profile')setTimeout(refreshProfileData,50);if(id==='events'&&window.Android&&Android.loadMeetups)setTimeout(()=>Android.loadMeetups(),50);return r};

  buildProfile();decorateFavoriteButtons();
  const favObserver=new MutationObserver(()=>decorateFavoriteButtons());const app=q('.app');if(app)favObserver.observe(app,{childList:true,subtree:true});
  setTimeout(()=>{refreshProfileData();if(logged()&&window.Android&&Android.loadMeetups)Android.loadMeetups()},250);
})();
