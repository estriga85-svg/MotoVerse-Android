(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));

  const st=document.createElement('style');
  st.textContent=`
    #sNegotiableWrap,#sNegotiableWrap.field{margin:2px 0 8px!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}
    #sNegotiableWrap label{background:transparent!important;border:0!important;color:#27323a!important;padding:4px 0!important;min-height:auto!important;font-size:13px!important;box-shadow:none!important}
    #sNegotiableWrap input{background:transparent!important;box-shadow:none!important}
    .bottom{bottom:0!important;margin-bottom:0!important}
    .app{padding-bottom:104px!important}
    .modalWrap{padding-bottom:0!important}
    .modal{max-height:calc(100dvh - 28px)!important;padding-bottom:42px!important}
    @supports(padding: max(0px)){
      .bottom{padding-bottom:max(8px,env(safe-area-inset-bottom))!important}
      .app{padding-bottom:max(112px,calc(96px + env(safe-area-inset-bottom)))!important}
      .modal{padding-bottom:max(42px,calc(28px + env(safe-area-inset-bottom)))!important}
    }
  `;
  document.head.appendChild(st);

  const prevOpenSell=window.openSell;
  window.openSell=function(){
    prevOpenSell();
    setTimeout(()=>{
      const wrap=q('#sNegotiableWrap');
      if(wrap){
        wrap.style.background='transparent';
        wrap.style.border='0';
        wrap.style.boxShadow='none';
        const lab=wrap.querySelector('label');
        if(lab){lab.style.background='transparent';lab.style.border='0';lab.style.color='#27323a';lab.style.boxShadow='none';}
      }
    },0);
  };

  const prevErr=window.onNativeError;
  window.onNativeError=function(e){
    const t=e?.message||'Ocorreu um erro';
    qa('.modal button').forEach(b=>{
      if((b.textContent||'').includes('A guardar')){b.disabled=false;b.textContent='Guardar na garagem';}
    });
    if(prevErr)prevErr(e);
    else if(window.toast)window.toast(t);
  };

  window.onPendingAlertSent=function(){if(window.toast)window.toast('Alerta de aprovação enviado por e-mail.');};
  window.onPendingAlertFailed=function(){if(window.toast)window.toast('Anúncio guardado, mas o alerta por e-mail falhou.');};

  window.onPendingCount=function(n){
    const item=q('#mvAdminReview');
    if(!item)return;
    let badge=item.querySelector('.mvPendingBadge');
    if(!badge){badge=document.createElement('span');badge.className='mvPendingBadge';badge.style.cssText='margin-left:auto;background:#ff6a24;color:white;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800';item.insertBefore(badge,item.lastElementChild);}
    badge.textContent=String(n||0);
    badge.style.display=Number(n)>0?'inline-block':'none';
  };
})();
