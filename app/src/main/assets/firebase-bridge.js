(function(){
  const CLOUDINARY_CLOUD='rgiqwtsa';
  const CLOUDINARY_PRESET='motoverse_anuncios';
  let authMode='login';

  function q(s){return document.querySelector(s)}
  function qa(s){return Array.from(document.querySelectorAll(s))}
  function msg(t){if(window.toast) window.toast(t); else alert(t)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function euro(v){return Number(v||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
  function appState(){try{return typeof state!=='undefined'?state:null}catch(e){return null}}
  function bridge(){if(!window.Android){showAuthMessage('Erro interno da aplicação.','error');return false}return true}
  function showAuthMessage(t,type='error'){
    const box=q('#authMessage');
    if(!box)return;
    box.textContent=t||'';
    box.style.display=t?'block':'none';
    box.style.background=type==='success'?'#edf9f1':'#fff0f0';
    box.style.borderColor=type==='success'?'#9bd5ad':'#e5a7a7';
    box.style.color=type==='success'?'#176532':'#9b1c1c';
  }
  function helmetLogo(){
    return `<svg viewBox="0 0 108 108" width="72" height="72" aria-hidden="true">
      <rect x="5" y="5" width="98" height="98" rx="24" fill="#ff6a24"/>
      <path fill="#12171c" d="M18 61C20 37 35 20 57 18c16-1 30 7 37 20l-16-4c-8-7-18-9-28-6-13 4-21 15-22 29L18 61Z"/>
      <path fill="#f5f7f8" d="M25 58c3-20 17-33 35-34 10 0 20 4 27 11l-17-2c-9-4-19-2-26 4-7 5-11 12-12 21h-7Z"/>
      <path fill="#151a1f" d="M31 59c3-16 14-25 27-26 10-1 20 3 27 10l6 7-7 14-13 11H49l-13-8-5-8Z"/>
      <path fill="#050607" d="M45 40c10-6 24-5 35 2l8 8-5 8-35-3-9-5c1-4 3-7 6-10Z"/>
      <path fill="#f5f7f8" d="m32 63 10 6 9 7-9 7-15-10 5-10Z"/>
    </svg>`;
  }

  const initialState=appState();
  if(initialState) initialState.user=null;
  try{localStorage.removeItem('mv_user')}catch(e){}

  function installAuthUi(mode=authMode){
    authMode=mode;
    const gate=q('#authGate'); if(!gate) return;
    gate.classList.add('show');
    const login=mode==='login';
    gate.innerHTML=`<div class="authBox" style="max-height:calc(100dvh - 36px);overflow:auto">
      <div style="display:flex;justify-content:center;margin-bottom:14px">${helmetLogo()}</div>
      <div class="eyebrow">${login?'Bem-vindo de volta':'Junta-te à MotoVerse'}</div>
      <h1 style="margin-bottom:8px">${login?'Entrar na MotoVerse':'Criar conta'}</h1>
      <p style="margin-top:0">${login?'Entra para aceder à tua garagem, anúncios e comunidade.':'Cria o teu perfil para guardares a garagem, anúncios e encontros.'}</p>
      <div id="authMessage" style="display:none;margin:0 0 12px;padding:11px 12px;border-radius:12px;border:1px solid;font-size:12px;font-weight:700;line-height:1.4"></div>
      ${login?'':`<div class="field"><label>Nome</label><input id="authName" autocomplete="name" placeholder="O teu nome"></div>`}
      <div class="field"><label>E-mail</label><input id="authEmail" type="email" autocomplete="email" inputmode="email" placeholder="nome@email.pt"></div>
      <div class="field"><label>Palavra-passe</label><input id="authPassword" type="password" minlength="6" autocomplete="${login?'current-password':'new-password'}" placeholder="Mínimo 6 caracteres"></div>
      ${login?'':`<div class="field"><label>Confirmar palavra-passe</label><input id="authPassword2" type="password" minlength="6" autocomplete="new-password" placeholder="Repete a palavra-passe"></div>`}
      ${login?`<button type="button" style="display:block;margin:-2px 0 14px auto;border:0;background:none;color:#ff6a24;font-weight:800;font-size:12px;padding:4px 0" onclick="mvForgotPassword()">Esqueci-me da palavra-passe</button>`:''}
      <button id="authPrimaryBtn" class="btn primary full" onclick="${login?'mvSignInEmail()':'mvCreateAccount()'}">${login?'Entrar':'Criar conta'}</button>
      <div style="display:flex;align-items:center;gap:10px;margin:18px 0;color:#8d99a3;font-size:11px"><span style="height:1px;background:#d9dfe4;flex:1"></span><span>${login?'Ainda não tens conta?':'Já tens conta?'}</span><span style="height:1px;background:#d9dfe4;flex:1"></span></div>
      <button class="btn secondary full" onclick="mvSwitchAuth('${login?'register':'login'}')">${login?'Criar conta':'Voltar a entrar'}</button>
    </div>`;
  }

  function authValues(){
    return {
      name:(q('#authName')?.value||'').trim(),
      email:(q('#authEmail')?.value||'').trim(),
      password:q('#authPassword')?.value||'',
      password2:q('#authPassword2')?.value||''
    }
  }
  function busy(on,label){
    const b=q('#authPrimaryBtn');
    if(!b)return;
    b.disabled=on;
    if(on)b.textContent=label;
    else b.textContent=authMode==='login'?'Entrar':'Criar conta';
  }
  window.mvSwitchAuth=function(mode){showAuthMessage('');installAuthUi(mode)};
  window.mvCreateAccount=function(){
    showAuthMessage('');
    if(!bridge())return;
    const v=authValues();
    if(!v.name)return showAuthMessage('Indica o teu nome.');
    if(!v.email)return showAuthMessage('Indica o teu e-mail.');
    if(v.password.length<6)return showAuthMessage('A palavra-passe deve ter pelo menos 6 caracteres.');
    if(v.password!==v.password2)return showAuthMessage('As palavras-passe não coincidem.');
    busy(true,'A criar conta...');
    Android.createAccount(v.name,v.email,v.password);
  };
  window.mvSignInEmail=function(){
    showAuthMessage('');
    if(!bridge())return;
    const v=authValues();
    if(!v.email)return showAuthMessage('Indica o teu e-mail.');
    if(v.password.length<6)return showAuthMessage('A palavra-passe deve ter pelo menos 6 caracteres.');
    busy(true,'A entrar...');
    Android.signInEmail(v.email,v.password);
  };
  window.mvForgotPassword=function(){
    showAuthMessage('');
    if(!bridge())return;
    const email=(q('#authEmail')?.value||'').trim();
    if(!email)return showAuthMessage('Escreve primeiro o teu e-mail acima.');
    Android.resetPassword(email);
  };
  window.emailLogin=window.mvSignInEmail;
  window.socialLogin=function(){};
  window.logoutDemo=function(){if(bridge())Android.logout()};

  window.onNativeAuth=function(u){
    const st=appState();
    if(!st){busy(false);showAuthMessage('Erro interno da aplicação.');return}
    st.user=u||null;
    const gate=q('#authGate');
    if(u){
      busy(false);showAuthMessage('');
      if(gate)gate.classList.remove('show');
      if(window.updateProfile)updateProfile();
      if(window.Android){Android.loadMyListings();Android.loadApprovedListings()}
      installProfileActions();
    }else{
      if(gate)gate.classList.add('show');
      installAuthUi('login');
    }
  };
  window.onAuthSuccess=function(t){busy(false);showAuthMessage('');if(q('#authGate')&&!q('#authGate').classList.contains('show'))msg(t||'Sessão iniciada')};
  window.onPasswordResetSent=function(){busy(false);showAuthMessage('Enviámos um e-mail para redefinires a palavra-passe. Verifica também o spam.','success')};
  window.onNativeError=function(e){
    busy(false);
    const text=(e&&e.message)||'Ocorreu um erro';
    if(q('#authGate')?.classList.contains('show'))showAuthMessage(text);
    else msg(text);
    const b=q('#publishBtn');if(b){b.disabled=false;b.textContent='Enviar para revisão'}
  };

  function installProfileActions(){
    const st=appState();
    qa('#profile .menuItem').forEach(el=>{
      const text=el.textContent||'';
      if(text.includes('Meus anúncios')){el.style.cursor='pointer';el.onclick=openMyListings}
    });
    const logout=qa('#profile button').find(b=>(b.textContent||'').includes('Terminar sessão'));if(logout)logout.onclick=()=>Android.logout();
    const notice=q('#profile .notice');if(notice)notice.innerHTML='<strong>Conta sincronizada.</strong> Os teus anúncios e dados acompanham-te entre dispositivos.';
    if(st&&st.user&&st.user.admin&&!q('#mvAdminReview')){
      const menus=q('#profile .section .menuItem')?.parentElement;
      if(menus){const el=document.createElement('div');el.id='mvAdminReview';el.className='menuItem';el.style.cursor='pointer';el.innerHTML='<span>🛡️ Rever anúncios</span><span>›</span>';el.onclick=openAdminReview;menus.appendChild(el)}
    }
  }

  const oldOpenSell=window.openSell;
  window.openSell=function(){
    const st=appState();
    if(!st||!st.user){q('#authGate')?.classList.add('show');installAuthUi('login');return msg('Inicia sessão para anunciar')}
    oldOpenSell();
    const n=q('.modal .notice');if(n)n.textContent='O anúncio será enviado para revisão antes de ficar público. Distrito é obrigatório; concelho é opcional.';
    const buttons=qa('.modal button');const b=buttons.find(x=>(x.textContent||'').includes('Guardar anúncio'));if(b){b.id='publishBtn';b.textContent='Enviar para revisão'}
  };

  async function cloudinary(dataUrl){
    const fd=new FormData();fd.append('file',dataUrl);fd.append('upload_preset',CLOUDINARY_PRESET);
    const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,{method:'POST',body:fd});
    if(!r.ok)throw new Error('Falha no upload da fotografia');
    const j=await r.json();if(!j.secure_url)throw new Error('Não foi possível guardar a fotografia');return j.secure_url;
  }
  window.saveListingDraft=async function(){
    const st=appState();
    if(!bridge()||!st||!st.user)return msg('Inicia sessão primeiro');
    const brand=q('#sBrand')?.value||'',model=q('#sModel')?.value||'',district=q('#sDistrict')?.value||'';
    if(!brand||!model)return msg('Escolhe marca e modelo');if(!district)return msg('Escolhe o distrito');
    const btn=q('#publishBtn')||qa('.modal button').find(x=>(x.textContent||'').includes('revisão'));if(btn){btn.disabled=true;btn.textContent='A enviar fotografias...'}
    try{
      const urls=[];const photos=window.__sellPhotos||[];
      for(let i=0;i<photos.length;i++){if(btn)btn.textContent=`A enviar foto ${i+1}/${photos.length}...`;urls.push(await cloudinary(photos[i]))}
      const extras=qa('.extraCheck:checked').map(x=>x.value);
      const draft={brand,model,year:q('#sYear')?.value||'',type:q('#sType')?.value||'',km:Number(q('#sKm')?.value||0),price:Number(q('#sPrice')?.value||0),district,county:q('#sCounty')?.value||'',location:[q('#sCounty')?.value||'',district].filter(Boolean).join(', '),photos:urls,extras,desc:q('#sDesc')?.value||''};
      if(btn)btn.textContent='A guardar anúncio...';Android.saveListing(JSON.stringify(draft));
    }catch(e){if(btn){btn.disabled=false;btn.textContent='Enviar para revisão'}msg(e.message||'Não foi possível enviar o anúncio')}
  };

  window.onListingSaved=function(){if(window.closeModal)closeModal();msg('Anúncio enviado para revisão');setTimeout(openMyListings,200)};
  window.openMyListings=function(){if(!bridge())return;openModal('<h2>Meus anúncios</h2><div class="notice">A carregar...</div><div id="mvMyListings"></div>');Android.loadMyListings()};
  window.onMyListings=function(items){
    const box=q('#mvMyListings');if(!box)return;
    if(!items||!items.length){box.innerHTML='<div class="empty" style="margin-top:12px">Ainda não tens anúncios.</div>';return}
    box.innerHTML=items.map(x=>{const st=x.status==='approved'?'Publicado':x.status==='rejected'?'Rejeitado':'Em revisão';const im=x.photos&&x.photos[0]?`<div style="height:120px;border-radius:14px;background:url('${esc(x.photos[0])}') center/cover;margin-bottom:10px"></div>`:'';return `<div class="listItem" style="display:block;margin-top:10px">${im}<div style="display:flex;justify-content:space-between;gap:10px"><strong>${esc(x.brand)} ${esc(x.model)}</strong><b>${esc(st)}</b></div><div class="catalogNote">${euro(x.price)} · ${esc(x.location||x.district||'')}</div></div>`}).join('')
  };

  window.openAdminReview=function(){openModal('<h2>Rever anúncios</h2><div class="notice">Anúncios à espera de aprovação.</div><div id="mvPending"></div>');Android.loadPendingListingsAdmin()};
  window.onPendingListings=function(items){
    const box=q('#mvPending');if(!box)return;if(!items||!items.length){box.innerHTML='<div class="empty" style="margin-top:12px">Sem anúncios pendentes.</div>';return}
    box.innerHTML=items.map(x=>`<div class="listItem" style="display:block;margin-top:10px">${x.photos&&x.photos[0]?`<div style="height:120px;border-radius:14px;background:url('${esc(x.photos[0])}') center/cover;margin-bottom:10px"></div>`:''}<strong>${esc(x.brand)} ${esc(x.model)}</strong><div class="catalogNote">${euro(x.price)} · ${esc(x.location||x.district||'')} · ${esc(x.ownerEmail||'')}</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" onclick="Android.reviewListing('${esc(x.id)}','approved')">Aprovar</button><button class="btn secondary" onclick="Android.reviewListing('${esc(x.id)}','rejected')">Rejeitar</button></div></div>`).join('')
  };
  window.onReviewDone=function(){msg('Anúncio atualizado');Android.loadPendingListingsAdmin()};
  window.onApprovedListings=function(items){const st=appState();if(st)st.approvedListings=items||[]};

  installAuthUi('login');
  if(bridge())Android.refreshAuth();
})();
