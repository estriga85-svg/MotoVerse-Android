(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));

  const st=document.createElement('style');
  st.textContent=`
    #sNegotiableWrap{margin:2px 0 8px!important}
    #sNegotiableWrap label{background:transparent!important;border:0!important;color:var(--text)!important;padding:4px 0!important;min-height:auto!important;font-size:13px!important}
    #sNegotiableWrap input{background:transparent!important}
    .bottom{bottom:0!important}
    .fab{bottom:78px!important}
    .app{padding-bottom:96px!important}
    .modalWrap{padding-bottom:0!important}
    .modal{max-height:calc(100dvh - 24px)!important;padding-bottom:34px!important}
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
        const lab=wrap.querySelector('label');
        if(lab){lab.style.background='transparent';lab.style.border='0';lab.style.color='var(--text)';}
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
})();
