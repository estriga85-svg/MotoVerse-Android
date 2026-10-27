(function(){
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));
  const notify=t=>window.toast?window.toast(t):alert(t);

  const style=document.createElement('style');
  style.textContent=`
    .mvCalendarBtn{border:1px solid var(--line);background:transparent;color:var(--text);border-radius:10px;padding:8px 10px;font-size:10px;font-weight:800;white-space:nowrap}
    .mvMaintCalendar{margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:7px}
    .meetRow{gap:7px;flex-wrap:wrap}
  `;
  document.head.appendChild(style);

  function nativeCalendar(title,location,date,time,description,durationMin){
    if(!date)return notify('Define primeiro uma data.');
    const clock=(time&&/^\d{2}:\d{2}$/.test(time))?time:'09:00';
    const start=new Date(date+'T'+clock+':00');
    if(Number.isNaN(start.getTime()))return notify('Data inválida.');
    const end=new Date(start.getTime()+(durationMin||90)*60000);
    try{
      if(window.Android&&Android.addCalendarEvent){
        Android.addCalendarEvent(title||'MotoVerse',location||'',start.getTime(),end.getTime(),description||'');
      }else notify('Calendário indisponível nesta versão.');
    }catch(e){notify('Não foi possível abrir o calendário.');}
  }

  window.addMaintenanceToCalendar=function(){
    const g=(typeof state!=='undefined'&&state.garage)?state.garage:null;
    if(!g||!g.nextDate)return notify('Define primeiro a data da próxima revisão.');
    const title='Revisão MotoVerse — '+(g.brand||'')+' '+(g.model||'');
    const desc=[g.nextKm?('Revisão prevista aos '+Number(g.nextKm).toLocaleString('pt-PT')+' km'):'',g.plate?('Matrícula: '+g.plate):''].filter(Boolean).join('\n');
    nativeCalendar(title.trim(),'Oficina / local a definir',g.nextDate,'09:00',desc,60);
  };

  function decorateMaintenance(){
    const box=q('.maint');
    const g=(typeof state!=='undefined'&&state.garage)?state.garage:null;
    if(!box)return;
    let b=q('#mvMaintCalendarBtn');
    if(g&&g.nextDate){
      if(!b){
        b=document.createElement('button');
        b.id='mvMaintCalendarBtn';
        b.className='mvCalendarBtn mvMaintCalendar';
        b.type='button';
        b.innerHTML='📅 Adicionar à Agenda Google';
        b.onclick=window.addMaintenanceToCalendar;
        box.appendChild(b);
      }
    }else if(b)b.remove();
  }

  const monthMap={jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
  function cardDate(card){
    const day=parseInt(card.querySelector('.datebox strong')?.textContent||'',10);
    const monTxt=(card.querySelector('.datebox span')?.textContent||'').trim().toLowerCase().replace('.','').slice(0,3);
    const mon=monthMap[monTxt];
    if(!day||mon===undefined)return null;
    const now=new Date();let year=now.getFullYear();
    let d=new Date(year,mon,day,12,0,0,0);
    if(d.getTime()<now.getTime()-30*86400000){year++;d=new Date(year,mon,day,12,0,0,0);}
    const yyyy=String(year),mm=String(mon+1).padStart(2,'0'),dd=String(day).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  window.addMeetupCardToCalendar=function(btn){
    const card=btn.closest('.eventCard');if(!card)return;
    const title=card.querySelector('.eventText h3')?.textContent?.trim()||'Encontro MotoVerse';
    const p=card.querySelector('.eventText p')?.textContent?.trim()||'';
    const parts=p.split('·').map(x=>x.trim());
    const location=parts[0]||'';
    const tm=p.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
    const time=tm?tm[0]:'09:00';
    const date=cardDate(card);
    nativeCalendar(title,location,date,time,'Encontro MotoVerse\n'+p,120);
  };

  function decorateMeetups(){
    qa('#eventList .eventCard').forEach(card=>{
      if(card.querySelector('.mvMeetCalendar'))return;
      const row=card.querySelector('.meetRow');if(!row)return;
      const b=document.createElement('button');
      b.className='mvCalendarBtn mvMeetCalendar';
      b.type='button';
      b.innerHTML='📅 Agenda';
      b.onclick=function(){window.addMeetupCardToCalendar(this);};
      row.appendChild(b);
    });
  }

  if(typeof window.renderGarage==='function'){
    const oldRenderGarage=window.renderGarage;
    window.renderGarage=function(){const r=oldRenderGarage.apply(this,arguments);setTimeout(decorateMaintenance,0);return r;};
  }
  if(typeof window.createMeetup==='function'){
    const oldCreateMeetup=window.createMeetup;
    window.createMeetup=function(){const r=oldCreateMeetup.apply(this,arguments);setTimeout(decorateMeetups,0);return r;};
  }

  const list=q('#eventList');
  if(list)new MutationObserver(decorateMeetups).observe(list,{childList:true,subtree:true});
  setTimeout(()=>{decorateMeetups();decorateMaintenance();},150);

  const oldAlertFailed=window.onPendingAlertFailed;
  window.onPendingAlertFailed=function(response){
    let msg='Anúncio guardado, mas o email de aprovação falhou.';
    if(response&&typeof response==='string'){
      try{const j=JSON.parse(response);if(j&&j.erro)msg+=' '+j.erro;}catch(e){}
    }
    notify(msg);
    if(oldAlertFailed&&oldAlertFailed!==window.onPendingAlertFailed)try{oldAlertFailed(response);}catch(e){}
  };
})();
