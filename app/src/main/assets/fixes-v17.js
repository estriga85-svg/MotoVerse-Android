(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));
  const notify=t=>window.toast?window.toast(t):alert(t);

  function addGlobalFixStyles(){
    if(q('#mvRuntimeFixStyles'))return;
    const st=document.createElement('style');st.id='mvRuntimeFixStyles';st.textContent=`
      #sNegotiableWrap{align-content:end!important}
      #sNegotiableWrap label{display:flex!important;align-items:center!important;gap:9px!important;min-height:44px!important;padding:8px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;color:inherit!important;box-shadow:none!important}
      #sNegotiableWrap input{width:20px!important;height:20px!important;accent-color:#ff6a24!important}
      #garageSaveStatus{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#f3f6f7;color:#52616a;font-size:12px;line-height:1.4}
      #mvAdminReview .mvPendingBadge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;margin-left:8px;padding:0 6px;border-radius:999px;background:#ff6a24;color:#fff;font-size:11px;font-weight:900}
    `;document.head.appendChild(st);
  }
  addGlobalFixStyles();

  function ensureListingStatus(){
    let b=q('#publishBtn')||qa('.modal button').find(x=>(x.textContent||'').includes('revisão')||(x.textContent||'').includes('Guardar anúncio'));
    if(!b)return null;
    b.id='publishBtn';
    let st=q('#listingSaveStatus');
    if(!st){st=document.createElement('div');st.id='listingSaveStatus';st.style.cssText='display:none;margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#f3f6f7;border:1px solid #dce3e7;color:#52616a;font-size:11px;line-height:1.4';b.parentElement.insertBefore(st,b);}
    return st;
  }
  function listingStatus(text,error){let st=ensureListingStatus();if(!st)return;st.textContent=text||'';st.style.display=text?'block':'none';st.style.color=error?'#9b1c1c':'#52616a';st.style.background=error?'#fff0f0':'#f3f6f7';st.style.borderColor=error?'#f3caca':'#dce3e7';}

  const previousOpenSell=window.openSell;
  window.openSell=function(){
    previousOpenSell();
    setTimeout(()=>{
      addGlobalFixStyles();
      const km=q('#sKm'), price=q('#sPrice');
      if(km){km.value='';km.placeholder='';km.removeAttribute('value');km.setAttribute('inputmode','numeric');}
      if(price){price.value='';price.placeholder='';price.removeAttribute('value');price.setAttribute('inputmode','decimal');
        const field=price.closest('.field');
        if(field&&!q('#sNegotiableWrap')) field.insertAdjacentHTML('afterend','<div id="sNegotiableWrap"><label><input id="sNegotiable" type="checkbox"> <span>Preço negociável</span></label></div>');
      }
      const note=q('#sellPhotos')?.closest('.photoPicker')?.querySelector('.catalogNote');if(note)note.textContent='Até 6 fotografias · toca numa foto para a definir como principal.';
      const b=qa('.modal button').find(x=>(x.textContent||'').includes('Guardar anúncio')||(x.textContent||'').includes('Enviar para revisão'));if(b){b.id='publishBtn';b.textContent='Enviar para revisão';}
      ensureListingStatus();
      if(window.renderSellPhotos)window.renderSellPhotos();
    },0);
  };

  window.setMainSellPhoto=function(i){
    const a=window.__sellPhotos||[];if(i<=0||i>=a.length)return;
    const chosen=a.splice(i,1)[0];a.unshift(chosen);window.__sellPhotos=a;window.renderSellPhotos();
  };
  window.removeSellPhoto=function(i){window.__sellPhotos.splice(i,1);window.renderSellPhotos();};
  window.renderSellPhotos=function(){
    const box=q('#sellPhotoGrid');if(!box)return;
    const a=window.__sellPhotos||[];
    box.innerHTML=a.map((src,i)=>`<div class="photoPreviewItem" onclick="setMainSellPhoto(${i})" style="background-image:url('${src}');position:relative;cursor:pointer;${i===0?'outline:3px solid #ff6a24;outline-offset:2px;':''}">${i===0?'<span style="position:absolute;left:6px;bottom:6px;background:#ff6a24;color:#fff;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900">PRINCIPAL</span>':''}<button class="photoRemove" type="button" onclick="event.stopPropagation();removeSellPhoto(${i})">×</button></div>`).join('');
    const t=q('#sellPhotoThumb');if(t){if(a[0]){t.style.backgroundImage=`url(${a[0]})`;t.textContent='';}else{t.style.backgroundImage='';t.textContent='📷';}}
  };

  async function uploadPhoto(dataUrl,index,total){
    listingStatus(`A enviar fotografia ${index}/${total}…`);
    const fd=new FormData();fd.append('file',dataUrl);fd.append('upload_preset','motoverse_anuncios');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const r=await fetch('https://api.cloudinary.com/v1_1/rgiqwtsa/image/upload',{method:'POST',body:fd,signal:controller.signal});
      if(!r.ok)throw new Error('Falha no envio da fotografia ('+r.status+').');
      const j=await r.json();if(!j.secure_url)throw new Error('A fotografia não recebeu endereço online.');return j.secure_url;
    }catch(e){if(e&&e.name==='AbortError')throw new Error('O envio da fotografia demorou demasiado. Tenta novamente.');throw e;}finally{clearTimeout(timer);}
  }

  window.saveListingDraft=async function(){
    const s=(typeof state!=='undefined'?state:null);if(!s||!s.user){if(window.requireAuth)return requireAuth('publicar anúncios');return notify('Inicia sessão primeiro');}
    const brand=q('#sBrand')?.value||'',model=q('#sModel')?.value||'',district=q('#sDistrict')?.value||'';
    if(!brand||!model||model==='Escolher modelo')return listingStatus('Escolhe a marca e o modelo.',true);
    if(!district)return listingStatus('Escolhe o distrito.',true);
    const b=q('#publishBtn');if(b){b.disabled=true;b.textContent='A preparar anúncio…';}
    listingStatus('A preparar o anúncio…');
    try{
      const urls=[],photos=window.__sellPhotos||[];
      for(let i=0;i<photos.length;i++) urls.push(await uploadPhoto(photos[i],i+1,photos.length));
      const kmRaw=(q('#sKm')?.value||'').trim(), priceRaw=(q('#sPrice')?.value||'').trim();
      const draft={
        brand,model,year:q('#sYear')?.value||'',type:q('#sType')?.value||'',
        km:kmRaw===''?null:Number(kmRaw),price:priceRaw===''?null:Number(priceRaw),negotiable:!!q('#sNegotiable')?.checked,
        district,county:q('#sCounty')?.value||'',location:[q('#sCounty')?.value||'',district].filter(Boolean).join(', '),
        photos:urls,mainPhoto:urls[0]||'',extras:qa('.extraCheck:checked').map(x=>x.value),desc:q('#sDesc')?.value||''
      };
      listingStatus('A gravar anúncio…');if(b)b.textContent='A gravar anúncio…';
      Android.saveListing(JSON.stringify(draft));
    }catch(e){if(b){b.disabled=false;b.textContent='Enviar para revisão';}listingStatus(e?.message||'Não foi possível enviar o anúncio.',true);}
  };

  const previousListingSaved=window.onListingSaved;
  window.onListingSaved=function(id){listingStatus('Anúncio gravado e enviado para revisão.');const b=q('#publishBtn');if(b){b.disabled=false;b.textContent='Enviar para revisão';}if(previousListingSaved)previousListingSaved(id);};
  window.onPendingAlertUnavailable=function(){notify('Anúncio guardado. O aviso por e-mail ao revisor ainda não está configurado; a aprovação está disponível dentro da MotoVerse.');};

  function garageButton(){return qa('.modal button').find(x=>/Guardar na garagem|A guardar/i.test(x.textContent||''));}
  function garageStatus(text,error){let b=garageButton();if(!b)return;let st=q('#garageSaveStatus');if(!st){st=document.createElement('div');st.id='garageSaveStatus';b.parentElement.insertBefore(st,b);}st.textContent=text||'';st.style.display=text?'block':'none';st.style.color=error?'#9b1c1c':'#52616a';st.style.background=error?'#fff0f0':'#f3f6f7';}
  const previousSaveBike=window.saveBike;
  window.saveBike=async function(){
    const btn=garageButton();if(btn){btn.disabled=true;btn.textContent='A guardar…';}
    garageStatus('A guardar a mota na tua garagem…',false);
    try{await previousSaveBike();}catch(e){if(btn){btn.disabled=false;btn.textContent='Guardar na garagem';}garageStatus(e?.message||'Não foi possível guardar a mota.',true);}
  };
  const previousGarageSaved=window.onGarageSaved;
  window.onGarageSaved=function(){const btn=garageButton();if(btn){btn.disabled=false;btn.textContent='Guardar na garagem';}garageStatus('',false);if(previousGarageSaved)previousGarageSaved();};

  function applyPendingBadge(count){
    const row=q('#mvAdminReview');if(!row)return;
    const first=row.querySelector('span');if(first)first.innerHTML=`🛡️ Rever anúncios${count>0?` <b class="mvPendingBadge">${count}</b>`:''}`;
  }
  window.onPendingCount=function(count){window.__mvPendingCount=Number(count||0);applyPendingBadge(window.__mvPendingCount);};

  const previousNativeAuth=window.onNativeAuth;
  window.onNativeAuth=function(u){if(previousNativeAuth)previousNativeAuth(u);setTimeout(()=>{if(u?.admin){applyPendingBadge(window.__mvPendingCount||0);Android.loadPendingCountAdmin();}},50);};

  const previousNativeError=window.onNativeError;
  window.onNativeError=function(e){
    const t=e?.message||'Ocorreu um erro';
    if(q('#publishBtn'))listingStatus(t,true);
    const gb=garageButton();if(gb&&(gb.disabled||/A guardar/i.test(gb.textContent||''))){gb.disabled=false;gb.textContent='Guardar na garagem';garageStatus(t,true);}
    if(previousNativeError)previousNativeError(e);
  };
})();
