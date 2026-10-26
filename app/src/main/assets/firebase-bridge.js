(function(){
  const CLOUDINARY_CLOUD='rgiqwtsa';
  const CLOUDINARY_PRESET='motoverse_anuncios';

  function q(s){return document.querySelector(s)}
  function qa(s){return Array.from(document.querySelectorAll(s))}
  function msg(t){if(window.toast) window.toast(t); else alert(t)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function euro(v){return Number(v||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
  function bridge(){if(!window.Android){msg('Erro: esta APK não tem a ligação Firebase ativa.');return false}return true}

  try{localStorage.removeItem('mv_user')}catch(e){}
  if(window.state) state.user=null;

  function installAuthUi(){
    const gate=q('#authGate'); if(!gate) return;
    gate.classList.add('show');
    gate.innerHTML=`<div class="authBox">
      <div class="authLogo">🏍️</div>
      <div class="eyebrow">Bem-vindo ao MotoVerse</div>
      <h1>A tua vida em duas rodas.</h1>
      <p>Cria a tua conta para guardar anúncios e aceder à comunidade MotoVerse em qualquer dispositivo.</p>
      <button class="socialBtn" onclick="mvGoogleLogin()">G&nbsp;&nbsp;Continuar com Google</button>
      <div class="authSep">ou</div>
      <div class="field"><label>Nome <span class="optionalLabel">(para criar conta)</span></label><input id="authName" autocomplete="name" placeholder="O teu nome"></div>
      <div class="field"><label>E-mail</label><input id="authEmail" type="email" autocomplete="email" inputmode="email" placeholder="nome@email.pt"></div>
      <div class="field"><label>Palavra-passe</label><input id="authPassword" type="password" minlength="6" placeholder="Mínimo 6 caracteres"></div>
      <button id="createAccountBtn" class="btn primary full" onclick="mvCreateAccount()">Criar conta</button>
      <button id="signInBtn" class="btn secondary full" style="margin-top:9px" onclick="mvSignInEmail()">Já tenho conta · Entrar</button>
      <p class="catalogNote" style="margin-top:13px"><strong>Firebase online · v1.2</strong><br>Conta e sessão são guardadas no Firebase.</p>
    </div>`;
  }

  function authValues(){return {name:(q('#authName')?.value||'').trim(),email:(q('#authEmail')?.value||'').trim(),password:q('#authPassword')?.value||''}}
  function busy(on,kind){const a=q('#createAccountBtn'),b=q('#signInBtn');if(a){a.disabled=on;a.textContent=on&&kind==='create'?'A criar conta...':'Criar conta'}if(b){b.disabled=on;b.textContent=on&&kind==='signin'?'A entrar...':'Já tenho conta · Entrar'}}
  window.mvCreateAccount=function(){if(!bridge())return;const v=authValues();if(!v.name)return msg('Indica o teu nome');if(!v.email)return msg('Indica o teu e-mail');if(v.password.length<6)return msg('A palavra-passe deve ter pelo menos 6 caracteres');busy(true,'create');Android.createAccount(v.name,v.email,v.password)};
  window.mvSignInEmail=function(){if(!bridge())return;const v=authValues();if(!v.email)return msg('Indica o teu e-mail');if(v.password.length<6)return msg('A palavra-passe deve ter pelo menos 6 caracteres');busy(true,'signin');Android.signInEmail(v.email,v.password)};
  window.mvGoogleLogin=function(){if(bridge())Android.googleLogin()};
  window.emailLogin=window.mvCreateAccount;
  window.socialLogin=function(provider){if(provider==='Google')return window.mvGoogleLogin();msg('O login Apple ainda não está ativo.')};
  window.logoutDemo=function(){if(bridge())Android.logout()};

  window.onNativeAuth=function(u){
    if(!window.state) return;
    state.user=u||null;
    const gate=q('#authGate');
    if(u){if(gate)gate.classList.remove('show');if(window.updateProfile)updateProfile();Android.loadMyListings();Android.loadApprovedListings();installProfileActions()}
    else{if(gate)gate.classList.add('show');installAuthUi()}
  };
  window.onAuthSuccess=function(t){busy(false);msg(t||'Sessão iniciada')};
  window.onNativeError=function(e){busy(false);msg((e&&e.message)||'Ocorreu um erro');const b=q('#publishBtn');if(b){b.disabled=false;b.textContent='Enviar para revisão'}};

  function installProfileActions(){
    qa('#profile .menuItem').forEach(el=>{
      const text=el.textContent||'';
      if(text.includes('Meus anúncios')){el.style.cursor='pointer';el.onclick=openMyListings}
    });
    const logout=qa('#profile button').find(b=>(b.textContent||'').includes('Terminar sessão'));if(logout)logout.onclick=()=>Android.logout();
    const notice=q('#profile .notice');if(notice)notice.innerHTML='<strong>MotoVerse online.</strong> Conta, anúncios e revisão estão ligados ao Firebase. Fotografias dos anúncios usam Cloudinary.';
    if(state.user&&state.user.admin&&!q('#mvAdminReview')){
      const menus=q('#profile .section .menuItem')?.parentElement;
      if(menus){const el=document.createElement('div');el.id='mvAdminReview';el.className='menuItem';el.style.cursor='pointer';el.innerHTML='<span>🛡️ Rever anúncios</span><span>›</span>';el.onclick=openAdminReview;menus.appendChild(el)}
    }
  }

  const oldOpenSell=window.openSell;
  window.openSell=function(){
    if(!state.user){q('#authGate')?.classList.add('show');return msg('Inicia sessão para anunciar')}
    oldOpenSell();
    const n=q('.modal .notice');if(n)n.textContent='O anúncio será enviado para revisão antes de ficar público. Distrito é obrigatório; concelho é opcional.';
    const buttons=qa('.modal button');const b=buttons.find(x=>(x.textContent||'').includes('Guardar anúncio'));if(b){b.id='publishBtn';b.textContent='Enviar para revisão'}
  };

  async function cloudinary(dataUrl){
    const fd=new FormData();fd.append('file',dataUrl);fd.append('upload_preset',CLOUDINARY_PRESET);
    const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,{method:'POST',body:fd});
    if(!r.ok)throw new Error('Falha no upload da fotografia');const j=await r.json();if(!j.secure_url)throw new Error('Cloudinary não devolveu URL');return j.secure_url;
  }
  window.saveListingDraft=async function(){
    if(!bridge()||!state.user)return msg('Inicia sessão primeiro');
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
  window.onApprovedListings=function(items){state.approvedListings=items||[]};

  installAuthUi();
  if(bridge())Android.refreshAuth();
})();
