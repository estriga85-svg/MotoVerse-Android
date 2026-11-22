(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));
  const notify=t=>window.toast?window.toast(t):alert(t);
  const maxListingPhotos=6;
  let listingForm;

  function addGlobalFixStyles(){
    if(q('#mvRuntimeFixStyles'))return;
    const st=document.createElement('style');st.id='mvRuntimeFixStyles';st.textContent=`
      #sNegotiableWrap{align-content:end!important}
      #sNegotiableWrap label{display:flex!important;align-items:center!important;gap:9px!important;min-height:44px!important;padding:8px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;color:inherit!important;box-shadow:none!important}
      #sNegotiableWrap input{width:20px!important;height:20px!important;accent-color:#ff6a24!important}
      #sellPhotoGrid .photoPreviewItem{isolation:isolate}
      .sellPhotoSelect{position:absolute;inset:0;width:100%;border:0;border-radius:inherit;background:transparent;color:white;cursor:pointer}
      .sellPhotoSelect[aria-pressed=true]{outline:3px solid #ff6a24;outline-offset:1px}
      .sellPhotoSelect span{position:absolute;left:5px;bottom:5px;padding:4px 6px;border-radius:8px;background:rgba(0,0,0,.8);font-size:10px;font-weight:800}
      #sellPhotoGrid .photoRemove{width:32px;height:32px}
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
    if(!st){st=document.createElement('div');st.id='listingSaveStatus';st.setAttribute('role','status');st.style.cssText='display:none;margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#f3f6f7;border:1px solid #dce3e7;color:#52616a;font-size:11px;line-height:1.4';b.parentElement.insertBefore(st,b);}
    return st;
  }
  function listingStatus(text,error){let st=ensureListingStatus();if(!st)return;st.textContent=text||'';st.style.display=text?'block':'none';st.style.color=error?'#9b1c1c':'#52616a';st.style.background=error?'#fff0f0':'#f3f6f7';st.style.borderColor=error?'#f3caca':'#dce3e7';}

  const previousOpenSell=window.openSell;
  window.openSell=function(){
    if(listingForm?.sending){notify('O anúncio ainda está a ser enviado.');return;}
    previousOpenSell();
    const button=q('#publishBtn');
    const picker=q('#sellPhotos');
    if(!button||!picker)return;
    listingForm={button,picker,reading:false,sending:false,uploaded:new Map()};
    ensureListingStatus();
    renderSellPhotos();
  };

  function readListingPhoto(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=reject;
      reader.onabort=reject;
      reader.onload=()=>{
        const img=new Image();
        img.onerror=reject;
        img.onload=()=>{
          try{
            const scale=Math.min(1,1200/Math.max(img.width,img.height));
            const canvas=document.createElement('canvas');
            canvas.width=Math.max(1,Math.round(img.width*scale));
            canvas.height=Math.max(1,Math.round(img.height*scale));
            canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
            resolve(canvas.toDataURL('image/jpeg',.78));
          }catch(error){reject(error);}
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.previewSellPhotos=async function(input){
    const form=listingForm;
    if(!form||input!==form.picker||form.reading||form.sending)return;
    const files=Array.from(input.files||[]);
    input.value='';
    if(!files.length)return;
    const available=maxListingPhotos-window.__sellPhotos.length;
    if(!available){listingStatus('Já adicionaste 6 fotografias. Remove uma para juntar outra.',true);return;}

    form.reading=true;
    form.button.disabled=true;
    input.disabled=true;
    listingStatus('A preparar fotografias…');
    const results=await Promise.allSettled(files.slice(0,available).map(readListingPhoto));
    if(listingForm!==form||!input.isConnected)return;

    const photos=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    window.__sellPhotos.push(...photos);
    form.reading=false;
    form.button.disabled=false;
    input.disabled=false;
    renderSellPhotos();
    const messages=[];
    if(photos.length<results.length)messages.push('Algumas fotografias não puderam ser abertas. Tenta selecionar outras.');
    if(files.length>available)messages.push('Podes juntar até 6 fotografias.');
    listingStatus(messages.join(' '),photos.length<results.length);
  };

  window.setMainSellPhoto=function(i){
    if(listingForm?.sending)return;
    const a=window.__sellPhotos||[];if(i<=0||i>=a.length)return;
    const chosen=a.splice(i,1)[0];a.unshift(chosen);window.__sellPhotos=a;window.renderSellPhotos();
    q('#sellPhotoGrid .sellPhotoSelect')?.focus();
  };
  window.removeSellPhoto=function(i){
    if(listingForm?.sending)return;
    const photos=window.__sellPhotos;
    if(i<0||i>=photos.length)return;
    const [photo]=photos.splice(i,1);
    if(!photos.includes(photo))listingForm?.uploaded.delete(photo);
    window.renderSellPhotos();
    qa('#sellPhotoGrid .photoRemove')[Math.min(i,photos.length-1)]?.focus();
  };
  window.renderSellPhotos=function(){
    const box=q('#sellPhotoGrid');if(!box)return;
    const a=window.__sellPhotos||[];
    box.innerHTML=a.map((src,i)=>`<div class="photoPreviewItem" style="background-image:url('${src}')"><button class="sellPhotoSelect" type="button" aria-pressed="${i===0}" aria-label="${i===0?'Fotografia principal':'Definir fotografia '+(i+1)+' como principal'}" onclick="setMainSellPhoto(${i})"><span>${i===0?'Principal':'Usar como capa'}</span></button><button class="photoRemove" type="button" aria-label="Remover fotografia ${i+1}" onclick="removeSellPhoto(${i})">×</button></div>`).join('');
    const t=q('#sellPhotoThumb');if(t){if(a[0]){t.style.backgroundImage=`url(${a[0]})`;t.textContent='';}else{t.style.backgroundImage='';t.textContent='📷';}}
    const count=q('#sellPhotoCount');if(count)count.textContent=`${a.length} de ${maxListingPhotos} fotografias`;
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

  function finishListingSend(form){
    form.sending=false;
    for(const field of form.disabledFields)field.disabled=false;
    form.button.textContent='Enviar para revisão';
  }

  window.saveListingDraft=async function(){
    const form=listingForm;
    if(!form||!form.button.isConnected||form.reading||form.sending)return;
    if(typeof state==='undefined'||!state.user){notify('Inicia sessão para publicar anúncios.');return;}
    const brand=q('#sBrand').value,model=q('#sModel').value,district=q('#sDistrict').value;
    const km=q('#sKm'),price=q('#sPrice');
    const invalid=[['#sBrand',!brand,'Escolhe a marca.'],['#sModel',!model,'Escolhe o modelo.'],
      ['#sDistrict',!district,'Escolhe o distrito.'],['#sKm',!km.validity.valid,'Indica os quilómetros como um número inteiro igual ou superior a zero.'],
      ['#sPrice',!price.validity.valid,'Indica um preço igual ou superior a zero, com até duas casas decimais.']].find(([,error])=>error);
    if(invalid){listingStatus(invalid[2],true);q(invalid[0]).focus();return;}

    const county=q('#sCounty').value;
    const draft={
      brand,model,year:q('#sYear').value,type:q('#sType').value,
      km:km.value===''?null:km.valueAsNumber,price:price.value===''?null:price.valueAsNumber,negotiable:q('#sNegotiable').checked,
      district,county,location:[county,district].filter(Boolean).join(', '),
      extras:qa('#modalContent .extraCheck:checked').map(x=>x.value),desc:q('#sDesc').value
    };
    const photos=[...window.__sellPhotos];
    form.sending=true;
    form.disabledFields=qa('#modalContent :is(button,input,select,textarea):enabled');
    for(const field of form.disabledFields)field.disabled=true;
    form.button.textContent='A preparar anúncio…';
    listingStatus('A preparar o anúncio…');
    try{
      const urls=[];
      for(let i=0;i<photos.length;i++){
        const photo=photos[i];
        if(!form.uploaded.has(photo))form.uploaded.set(photo,await uploadPhoto(photo,i+1,photos.length));
        urls.push(form.uploaded.get(photo));
      }
      draft.photos=urls;
      draft.mainPhoto=urls[0]||'';
      listingStatus('A gravar anúncio…');
      form.button.textContent='A gravar anúncio…';
      Android.saveListing(JSON.stringify(draft));
    }catch(e){window.onListingSaveError(e?.message||'Não foi possível enviar o anúncio.');}
  };

  const previousListingSaved=window.onListingSaved;
  window.onListingSaved=function(id){
    const form=listingForm;
    if(!form?.sending)return;
    const formVisible=form.button.isConnected&&q('#modalWrap').classList.contains('show');
    finishListingSend(form);
    listingForm=null;
    window.__sellPhotos=[];
    if(formVisible&&previousListingSaved)previousListingSaved(id);
    else notify('Anúncio enviado para revisão.');
  };
  window.onListingSaveError=function(message){
    const form=listingForm;
    if(!form?.sending)return;
    finishListingSend(form);
    if(form.button.isConnected&&q('#modalWrap').classList.contains('show'))listingStatus(message,true);
    else notify(message);
  };
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
    const gb=garageButton();if(gb&&(gb.disabled||/A guardar/i.test(gb.textContent||''))){gb.disabled=false;gb.textContent='Guardar na garagem';garageStatus(t,true);}
    if(previousNativeError)previousNativeError(e);
  };
})();
