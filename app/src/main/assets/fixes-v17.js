(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));
  const notify=t=>window.toast?window.toast(t):alert(t);

  function ensureListingStatus(){
    let b=q('#publishBtn')||qa('.modal button').find(x=>(x.textContent||'').includes('revisão')||(x.textContent||'').includes('Guardar anúncio'));
    if(!b)return null;
    b.id='publishBtn';
    let st=q('#listingSaveStatus');
    if(!st){st=document.createElement('div');st.id='listingSaveStatus';st.style.cssText='display:none;margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#161e24;border:1px solid #29353e;color:#aab6bf;font-size:11px;line-height:1.4';b.parentElement.insertBefore(st,b);}
    return st;
  }
  function listingStatus(text,error){let st=ensureListingStatus();if(!st)return;st.textContent=text||'';st.style.display=text?'block':'none';st.style.color=error?'#ffb3b3':'#aab6bf';st.style.borderColor=error?'#7a3030':'#29353e';}

  const previousOpenSell=window.openSell;
  window.openSell=function(){
    previousOpenSell();
    setTimeout(()=>{
      const km=q('#sKm'), price=q('#sPrice');
      if(km){km.value='';km.placeholder='';km.removeAttribute('value');km.setAttribute('inputmode','numeric');}
      if(price){price.value='';price.placeholder='';price.removeAttribute('value');price.setAttribute('inputmode','decimal');
        const field=price.closest('.field');
        if(field&&!q('#sNegotiableWrap')) field.insertAdjacentHTML('afterend','<div id="sNegotiableWrap" class="field" style="align-content:end"><label style="display:flex;align-items:center;gap:9px;min-height:44px;padding:10px 12px;border:1px solid #2a333b;border-radius:12px;background:#0e1317;color:inherit;font-size:12px"><input id="sNegotiable" type="checkbox" style="width:18px;height:18px;accent-color:#ff6a24"> Preço negociável</label></div>');
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
  const previousNativeError=window.onNativeError;
  window.onNativeError=function(e){const t=e?.message||'Ocorreu um erro';if(q('#publishBtn'))listingStatus(t,true);if(previousNativeError)previousNativeError(e);};

  // Make garage save visibly transactional instead of silently appearing stuck.
  const previousSaveBike=window.saveBike;
  window.saveBike=async function(){
    const btn=qa('.modal button').find(x=>(x.textContent||'').includes('Guardar na garagem'));
    if(btn){btn.disabled=true;btn.textContent='A guardar…';}
    try{await previousSaveBike();}catch(e){if(btn){btn.disabled=false;btn.textContent='Guardar na garagem';}notify(e?.message||'Não foi possível guardar a mota.');}
  };
  const previousGarageSaved=window.onGarageSaved;
  window.onGarageSaved=function(){const btn=qa('.modal button').find(x=>(x.textContent||'').includes('A guardar'));if(btn){btn.disabled=false;btn.textContent='Guardar na garagem';}if(previousGarageSaved)previousGarageSaved();};
})();
