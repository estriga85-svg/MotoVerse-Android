(function(){
  'use strict';
  const q=s=>document.querySelector(s);
  const qa=s=>Array.from(document.querySelectorAll(s));
  const st=()=>{try{return typeof state!=='undefined'?state:null}catch(e){return null}};
  const esc=v=>String(v===null||v===undefined?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur=v=>Number(v||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
  const dateText=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-PT'):'—';
  const notice=t=>window.toast?window.toast(t):alert(t);
  const logged=()=>!!(st()?.user?.uid);
  const safeId=v=>/^[\w-]{1,130}$/.test(String(v||''))?String(v):'';
  const safePhoto=v=>typeof v==='string'&&/^https:\/\/[a-z0-9.-]+\//i.test(v)&&!/[<>"'()]/.test(v)?v:'';
  let marketplaceReady=false, order='recent', selectedListing='', alertRecords=[], savingExtra='';

  const style=document.createElement('style');
  style.textContent=[
    '.mvMarketOptions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}',
    '.mvMarketOptions select{min-width:105px;max-width:50%;flex:1;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:10px;font-size:12px}',
    '.mvMarketCard{cursor:pointer}.mvMarketCard .bikeImg{background-size:contain;background-repeat:no-repeat;background-color:#0e1318}',
    '.mvMarketCard .bikeImg:after{display:none}.mvMiniHint{font-size:10px;color:var(--muted);line-height:1.5}',
    '.mvGallery{display:flex;gap:8px;overflow-x:auto;padding-bottom:5px}.mvGallery img{width:85%;max-width:310px;height:210px;flex:none;object-fit:contain;background:#10151a;border-radius:14px}',
    '.mvReviewPhotos{scroll-snap-type:x mandatory}.mvReviewPhotos img{width:100%;max-width:none;height:clamp(180px,55vw,300px);scroll-snap-align:start}',
    '.mvReviewActions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.mvReviewActions button{flex:1}.mvReviewBack{margin:0 0 10px}',
    '.mvToolBox{border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:15px;margin:12px 16px}',
    '.mvToolBox h3{font-size:15px;margin:0 0 9px}.mvToolBox p{font-size:11px;line-height:1.5;color:var(--muted)}',
    '.mvToolGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.mvToolBtn{background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:12px 7px;border-radius:13px;font-size:11px;font-weight:700}',
    '.mvInfo{font-size:12px;line-height:1.6;color:var(--text)}.mvInfo li{margin:9px 0}',
    '.mvChecklist{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px;line-height:1.4}',
    '.mvChecklist input{min-width:19px;min-height:19px;accent-color:var(--accent)}',
    '.mvChecklistProgress{font-size:12px;color:var(--accent2);font-weight:800;margin:12px 0}',
    '.mvAlertDue{color:#ff9a69;font-weight:700}.mvMuted{color:var(--muted)}'
  ].join('');
  document.head.appendChild(style);

  function listings(){
    const x=st()?.approvedListings;
    return (Array.isArray(x)?x:[]).filter(a=>a&&a.status==='approved'&&safeId(a.id));
  }
  function searchText(x){return [x.brand,x.model,x.type,x.location,x.district,x.county,x.desc].filter(Boolean).join(' ').toLocaleLowerCase('pt-PT')}
  function matches(x,f,search){
    if(search&&!searchText(x).includes(search))return false;
    if(f.brand&&String(x.brand||'').toLowerCase()!==String(f.brand).toLowerCase())return false;
    if(f.model&&String(x.model||'').toLowerCase()!==String(f.model).toLowerCase()&&f.model!=='Escolher modelo')return false;
    if(f.district&&String(x.district||'').toLowerCase()!==String(f.district).toLowerCase())return false;
    if(f.year&&Number(x.year||0)<Number(f.year))return false;
    if(f.type&&String(x.type||'').toLowerCase()!==String(f.type).toLowerCase())return false;
    if(f.price&&(listingNumber(x.price)??Infinity)>Number(f.price))return false;
    if(f.km&&(listingNumber(x.km)??Infinity)>Number(f.km))return false;
    if(Array.isArray(f.extras)&&f.extras.length&&f.extras.some(v=>!(x.extras||[]).includes(v)))return false;
    return true;
  }
  function listingNumber(value){return value==null||value===''?null:Number(value);}
  function compareListingNumbers(a,b,direction=1){
    if(a===null)return b===null?0:1;
    if(b===null)return -1;
    return (a-b)*direction;
  }
  function selectedListings(){
    const f=st()?.filters||{},search=(q('#exploreSearch')?.value||'').trim().toLocaleLowerCase('pt-PT');
    const arr=listings().filter(x=>matches(x,f,search));
    if(order==='priceUp')arr.sort((a,b)=>compareListingNumbers(listingNumber(a.price),listingNumber(b.price)));
    else if(order==='priceDown')arr.sort((a,b)=>compareListingNumbers(listingNumber(a.price),listingNumber(b.price),-1));
    else if(order==='km')arr.sort((a,b)=>compareListingNumbers(listingNumber(a.km),listingNumber(b.km)));
    else arr.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
    return arr;
  }
  function photoStyle(x){const u=safePhoto((x.photos||[])[0]);return u?'background-image:url('+u+');':'background-image:none;'}
  function price(x){return window.mvListingPrice(x);}
  function mileage(x){
    const km=listingNumber(x.km);
    return km===null?'Quilómetros não indicados':km.toLocaleString('pt-PT')+' km';
  }
  function drawMarketplace(){
    const section=q('#exploreMotas'),cards=section?.querySelector('.cards');
    if(!section||!cards)return;
    const head=section.querySelector('.sectionHead h2');
    const arr=selectedListings();
    if(head)head.textContent=marketplaceReady?arr.length+' anúncio(s) aprovado(s)':'A carregar anúncios...';
    let options=q('#mvMarketOptions');
    if(!options){
      options=document.createElement('div');options.id='mvMarketOptions';options.className='mvMarketOptions';
      options.innerHTML='<select id="mvDistrictFilter" aria-label="Filtrar distrito"><option value="">Todos os distritos</option></select><select id="mvSort" aria-label="Ordenar"><option value="recent">Mais recentes</option><option value="priceUp">Preço mais baixo</option><option value="priceDown">Preço mais alto</option><option value="km">Menos quilómetros</option></select>';
      section.querySelector('.sectionHead')?.after(options);
      q('#mvDistrictFilter').onchange=e=>{st().filters.district=e.target.value;drawMarketplace()};
      q('#mvSort').onchange=e=>{order=e.target.value;drawMarketplace()};
    }
    const districts=[...new Set(listings().map(x=>String(x.district||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-PT'));
    const dropdown=q('#mvDistrictFilter'),current=st()?.filters?.district||'';
    if(dropdown){
      dropdown.innerHTML='<option value="">Todos os distritos</option>'+districts.map(d=>'<option value="'+esc(d)+'" '+(d===current?'selected':'')+'>'+esc(d)+'</option>').join('');
      dropdown.value=current;
    }
    if(q('#mvSort'))q('#mvSort').value=order;
    cards.innerHTML=!marketplaceReady?'<div class="empty">A carregar anúncios aprovados...</div>':!arr.length?
      '<div class="empty">Não há anúncios aprovados para estes critérios.<div style="margin-top:12px"><button class="btn secondary" id="mvResetFilters">Limpar filtros</button></div></div>':
      arr.map(x=>'<article class="card mvMarketCard" data-mv-listing="'+esc(x.id)+'"><div class="bikeImg" style="'+photoStyle(x)+'">'+(safePhoto((x.photos||[])[0])?'':'<span style="position:absolute;inset:0;display:grid;place-items:center;font-size:48px">🏍</span>')+'<button class="fav" type="button" aria-label="Adicionar aos favoritos">♡</button></div><div class="cardBody"><div class="cardTitle"><h3>'+esc(x.brand)+' '+esc(x.model)+'</h3><div class="price">'+price(x)+'</div></div><div class="meta"><span>'+esc(x.year||'—')+'</span><span>'+mileage(x)+'</span><span>'+esc(x.location||x.district||'Portugal')+'</span></div><p class="mvMiniHint">Ver detalhes e contactar vendedor</p></div></article>').join('');
    if(q('#mvResetFilters'))q('#mvResetFilters').onclick=()=>{st().filters={};if(q('#exploreSearch'))q('#exploreSearch').value='';drawMarketplace()};
    const featured=q('.featureScroll'),homeSection=featured?.closest('.homeSection');
    if(featured){
      const recent=listings().sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,4);
      featured.innerHTML=!marketplaceReady?'<div class="mvMuted">A carregar...</div>':!recent.length?'<div class="mvMuted">Ainda não existem anúncios aprovados. Publica a tua mota para começar.</div>':recent.map(x=>'<article class="featureBike" data-mv-listing="'+esc(x.id)+'"><div class="featureBikeImg" style="'+photoStyle(x)+'background-size:contain;background-repeat:no-repeat;background-color:#0e1318"><button class="featureFav" type="button" aria-label="Favorito">♡</button></div><div class="featureBikeBody"><h3>'+esc(x.brand)+' '+esc(x.model)+'</h3><div class="featurePrice">'+price(x)+'</div><div class="featureMeta"><span>'+esc(x.year||'—')+'</span><span>'+mileage(x)+'</span><span>'+esc(x.district||'Portugal')+'</span></div></div></article>').join('');
      if(homeSection)homeSection.dataset.mvRealData='true';
    }
  }
  function findListing(id){return listings().find(x=>x.id===id)}
  function listingDetails(x, forReview=false){
    const photos=Array.isArray(x.photos)?x.photos:[];
    const images=[...new Set(photos.concat(x.mainPhoto||[]).map(safePhoto).filter(Boolean))];
    const gallery=images.length
      ? '<div class="mvGallery'+(forReview?' mvReviewPhotos':'')+'" aria-label="Fotografias da mota">'+images.map((src,i)=>'<img src="'+esc(src)+'" alt="Fotografia '+(i+1)+' de '+images.length+'">').join('')+'</div>'
      : '<div class="empty">Fotografias não disponíveis</div>';
    const photoHint=forReview&&images.length>1?'<p class="mvMiniHint">Desliza para ver as '+images.length+' fotografias.</p>':'';
    const specs=[x.year||'Ano não indicado',mileage(x),x.type,x.location||[x.county,x.district].filter(Boolean).join(', ')||'Local não indicado'];
    const extras=Array.isArray(x.extras)&&x.extras.length?'<p class="mvInfo"><strong>Extras:</strong> '+esc(x.extras.join(' · '))+'</p>':'';
    const seller=[x.ownerName||'Utilizador MotoVerse',forReview?x.ownerEmail:''].filter(Boolean).join(' · ');
    return '<h2>'+esc(x.brand)+' '+esc(x.model)+'</h2>'+gallery+photoHint+
      '<h2 style="color:var(--accent2);margin-top:13px">'+price(x)+'</h2><p class="mvInfo">'+esc(specs.filter(Boolean).join(' · '))+'</p>'+extras+
      '<div class="mvToolBox" style="margin:12px 0"><h3>Descrição do vendedor</h3><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(x.desc||'Sem descrição adicional.')+'</p><p style="overflow-wrap:anywhere">Vendedor: '+esc(seller)+'</p></div>';
  }
  function openListing(id){
    const x=findListing(id);if(!x)return notice('Anúncio indisponível ou ainda em revisão.');
    selectedListing=id;
    window.openModal(listingDetails(x)+'<button class="btn primary full" id="mvContactSeller">💬 Contactar vendedor</button><div class="mvToolGrid" style="margin-top:9px"><button class="mvToolBtn" id="mvCheckBike">✓ Verificar mota</button><button class="mvToolBtn" id="mvShareBike">↗ Partilhar detalhes</button><button class="mvToolBtn" id="mvSafetyAdvice">🛡 Compra segura</button><button class="mvToolBtn" id="mvReportBike">⚑ Denunciar por e-mail</button></div><p class="mvMiniHint" style="margin-top:12px">A MotoVerse não recebe pagamentos nem garante o estado mecânico dos veículos.</p>');
    q('#mvContactSeller').onclick=()=>{if(!x.ownerUid)return notice('O vendedor não tem contacto disponível.');window.contactSeller(id,x.ownerUid,x.ownerName||'vendedor')};
    q('#mvCheckBike').onclick=()=>openChecklist(id);
    q('#mvShareBike').onclick=()=>{const text=[x.brand+' '+x.model,price(x),mileage(x),x.location||'',x.desc||'','Encontrado na MotoVerse.'].filter(Boolean).join('\n');if(window.Android?.shareText)Android.shareText('Anúncio MotoVerse',text);else notice('Partilha indisponível nesta versão.')};
    q('#mvSafetyAdvice').onclick=openSafety;
    q('#mvReportBike').onclick=()=>{if(window.Android?.reportListing)Android.reportListing(id,x.brand+' '+x.model);else notice('Denúncia por e-mail indisponível.')};
  }
  window.mvOpenListing=openListing;

  let reviewListRequest=0;
  let reviewInFlight=null;
  const reviewVisible=()=>q('#modalWrap')?.classList.contains('show')&&(q('#mvPending')||q('#mvReviewDetail'));
  window.openAdminReview=function(){
    if(!st()?.user?.admin)return notice('Área reservada ao revisor.');
    window.openModal('<h2>Rever anúncios</h2><div id="mvPending" class="notice" role="status">A carregar…</div>');
    window.Android.loadPendingListingsAdmin(++reviewListRequest);
  };
  window.onPendingListings=function(request,items){
    const list=q('#mvPending');
    if(!list||!reviewVisible()||request!==reviewListRequest||!st()?.user?.admin)return;
    const pending=Array.isArray(items)?items.filter(x=>x?.status==='pending'&&safeId(x.id)):[];
    if(!pending.length){list.textContent='Sem anúncios pendentes.';return;}
    list.className='';
    list.removeAttribute('role');
    list.innerHTML=pending.map((x,i)=>'<article class="listItem" style="display:block;margin-top:10px"><strong>'+esc(x.brand)+' '+esc(x.model)+'</strong><div class="catalogNote">'+price(x)+'</div><button type="button" class="btn secondary full" data-mv-review="'+i+'" style="margin-top:8px">Ver anúncio</button></article>').join('');
    list.querySelectorAll('[data-mv-review]').forEach(button=>{
      button.onclick=()=>openReviewDetail(pending[Number(button.dataset.mvReview)]);
    });
  };
  window.onPendingListingsFailed=function(request,message){
    const list=q('#mvPending');
    if(!list||!reviewVisible()||request!==reviewListRequest)return;
    list.textContent=message;
    const retry=document.createElement('button');
    retry.type='button';retry.className='btn secondary full';retry.textContent='Tentar novamente';
    retry.onclick=window.openAdminReview;
    list.appendChild(retry);
  };
  function openReviewDetail(listing){
    if(!st()?.user?.admin)return;
    window.openModal('<button type="button" id="mvReviewBack" class="btn secondary mvReviewBack">‹ Voltar aos pendentes</button><div id="mvReviewDetail">'+listingDetails(listing,true)+
      '<div class="mvReviewActions"><button type="button" class="btn primary" data-mv-decision="approved">Aprovar</button><button type="button" class="btn secondary" data-mv-decision="rejected">Rejeitar</button></div><p class="mvInfo" role="status" id="mvReviewStatus"></p></div>');
    const detail=q('#mvReviewDetail');
    detail.closest('.modal').scrollTop=0;
    q('#mvReviewBack').onclick=window.openAdminReview;
    const decisions=Array.from(detail.querySelectorAll('[data-mv-decision]'));
    if(reviewInFlight){
      decisions.forEach(button=>button.disabled=true);
      q('#mvReviewStatus').textContent='A guardar a decisão anterior…';
    }
    for(const button of decisions){
      button.onclick=()=>{
        if(reviewInFlight||!st()?.user?.admin)return;
        reviewInFlight=listing.id;
        decisions.forEach(control=>control.disabled=true);
        q('#mvReviewStatus').textContent='A guardar a decisão…';
        window.Android.reviewListing(listing.id,button.dataset.mvDecision);
      };
    }
  }
  window.onReviewDone=function(id,status){
    if(reviewInFlight!==id)return;
    reviewInFlight=null;
    notice(status==='approved'?'Anúncio aprovado e publicado.':'Anúncio rejeitado.');
    if(reviewVisible())window.openAdminReview();
    if(status==='approved')window.Android.loadApprovedListings();
  };
  window.onReviewFailed=function(id,message,refresh){
    if(reviewInFlight!==id)return;
    reviewInFlight=null;
    notice(message);
    if(!reviewVisible())return;
    if(refresh){window.openAdminReview();return;}
    qa('#mvReviewDetail [data-mv-decision]').forEach(button=>button.disabled=false);
    const status=q('#mvReviewStatus');
    if(status)status.textContent=message;
  };
  const checklistItems=[
    'Comparar VIN/número de quadro com o DUA e documentação',
    'Confirmar matrícula, titularidade e eventuais encargos',
    'Pedir registos de revisões e comprovativos',
    'Verificar pneus, idade e desgaste',
    'Testar travões, discos e fluido',
    'Verificar luzes, piscas, painel e bateria',
    'Procurar fugas de óleo, líquidos e sinais de quedas',
    'Inspecionar corrente, transmissão e suspensão',
    'Confirmar arranque a frio e ruídos invulgares',
    'Fazer avaliação por mecânico independente quando necessário',
    'Combinar visita em local seguro, sem adiantamentos',
    'Confirmar os procedimentos e documentos da transferência'
  ];
  function openChecklist(id){
    const x=findListing(id);if(!x)return;
    const key='mv_buyer_check_'+id;
    let checked=[];try{checked=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(checked))checked=[]}catch(e){}
    window.openModal('<h2>Checklist de compra</h2><p class="mvInfo">'+esc(x.brand)+' '+esc(x.model)+'</p><p class="notice">Lista pessoal para a visita, guardada neste dispositivo. Não certifica a mota nem substitui uma inspeção profissional.</p><div id="mvCheckProgress" class="mvChecklistProgress"></div>'+checklistItems.map((t,i)=>'<label class="mvChecklist"><input type="checkbox" data-mv-check="'+i+'" '+(checked.includes(i)?'checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'<button class="btn secondary full" style="margin-top:14px" id="mvClearCheck">Limpar lista</button>');
    const redraw=()=>{const done=qa('[data-mv-check]:checked').length;const el=q('#mvCheckProgress');if(el)el.textContent=done+' de '+checklistItems.length+' verificações concluídas'};
    qa('[data-mv-check]').forEach(el=>{el.onchange=()=>{const arr=qa('[data-mv-check]:checked').map(c=>Number(c.dataset.mvCheck));try{localStorage.setItem(key,JSON.stringify(arr))}catch(e){}redraw()}});
    q('#mvClearCheck').onclick=()=>{qa('[data-mv-check]').forEach(c=>c.checked=false);try{localStorage.removeItem(key)}catch(e){}redraw()};
    redraw();
  }
  function openSafety(){
    window.openModal('<h2>Compra e venda segura</h2><ol class="mvInfo"><li>Confirma presencialmente o número de quadro (VIN) e os documentos originais da mota.</li><li>Verifica travões, pneus, direção, suspensões e sinais de acidentes. Uma oficina independente pode ajudar.</li><li>Desconfia de preços muito abaixo do mercado, pedidos de códigos e pagamentos antecipados.</li><li>Combina encontros em locais seguros e informa alguém da visita.</li><li>Faz a transferência de propriedade pelos canais oficiais e guarda comprovativos.</li><li>Nunca partilhes palavras-passe, códigos de autenticação ou documentos sem necessidade.</li></ol><p class="notice">As dicas de segurança são informativas. A MotoVerse não intermedeia pagamentos nem verifica automaticamente VIN, sinistros ou titularidade.</p>');
  }
  window.mvSafety=openSafety;

  function openPreRide(){
    const day=new Date().toISOString().slice(0,10);
    const key='mv_pre_ride_'+day;
    const items=['Pneus: estado e pressão','Travões dianteiro e traseiro','Corrente / transmissão e lubrificação','Luzes, piscas e buzina','Níveis e possíveis fugas','Espelhos, comandos e descanso','Capacete e equipamento de proteção','Combustível, tempo e percurso'];
    let done=[];try{done=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(done))done=[]}catch(e){}
    window.openModal('<h2>Checklist antes da viagem</h2><p class="notice">Verificação rápida para hoje, '+esc(dateText(day))+'. Não substitui as instruções do fabricante nem uma verificação profissional.</p><div id="mvPreRideCount" class="mvChecklistProgress"></div>'+items.map((text,i)=>'<label class="mvChecklist"><input data-mv-ride="'+i+'" type="checkbox" '+(done.includes(i)?'checked':'')+'><span>'+esc(text)+'</span></label>').join('')+'<button class="btn secondary full" id="mvPreRideReset" style="margin-top:14px">Recomeçar lista</button>');
    const refresh=()=>{const checked=qa('[data-mv-ride]:checked').map(x=>Number(x.dataset.mvRide));q('#mvPreRideCount').textContent=checked.length+' de '+items.length+' verificações feitas';try{localStorage.setItem(key,JSON.stringify(checked))}catch(e){}};
    qa('[data-mv-ride]').forEach(el=>el.onchange=refresh);
    q('#mvPreRideReset').onclick=()=>{qa('[data-mv-ride]').forEach(el=>el.checked=false);refresh()};
    refresh();
  }
  window.mvPreRide=openPreRide;

  function bindMarket(){
    const cards=q('#exploreMotas .cards'),feat=q('.featureScroll');
    [cards,feat].forEach(root=>{if(!root||root.dataset.mvClickBound)return;root.dataset.mvClickBound='1';root.addEventListener('click',e=>{if(e.target.closest('.fav,.featureFav'))return;const card=e.target.closest('[data-mv-listing]');if(card)openListing(card.dataset.mvListing)})});
    const search=q('#exploreSearch');if(search&&!search.dataset.mvSearchBound){search.dataset.mvSearchBound='1';search.addEventListener('input',drawMarketplace)}
    const sortButton=q('#exploreMotas .sectionHead button');if(sortButton){sortButton.textContent='Filtros';sortButton.onclick=()=>window.openBikeFilters&&window.openBikeFilters()}
  }

  function saveGarageSynced(reason){
    const s=st();if(!s?.garage)return;
    s.garage.maintenance=Array.isArray(s.maintenance)?s.maintenance:[];
    try{localStorage.setItem('mv_garage',JSON.stringify(s.garage));localStorage.setItem('mv_maintenance',JSON.stringify(s.garage.maintenance))}catch(e){return notice('Armazenamento cheio; não foi possível guardar.')}
    if(logged()&&window.Android?.saveGarage){savingExtra=reason;Android.saveGarage(JSON.stringify(s.garage))}
    else notice('Dados guardados neste dispositivo. Inicia sessão para os sincronizar.');
  }
  function garageCosts(){
    const s=st(),g=s?.garage||{},m=Array.isArray(s?.maintenance)?s.maintenance:[],fuels=Array.isArray(g.fuelEntries)?g.fuelEntries:[];
    const totalM=m.reduce((n,x)=>n+Number(x.cost||0),0),totalF=fuels.reduce((n,x)=>n+Number(x.total||0),0);
    const complete=fuels.filter(x=>x.full!==false).sort((a,b)=>Number(a.km||0)-Number(b.km||0));
    const last=complete[complete.length-1],prev=complete[complete.length-2];
    const l100=last&&prev&&Number(last.km)>Number(prev.km)?Number(last.liters)*100/(Number(last.km)-Number(prev.km)):null;
    return{totalM,totalF,fuels,l100,entries:m.length};
  }
  function dueLabel(v){
    if(!v)return'Por preencher';const days=Math.ceil((new Date(v+'T12:00:00').getTime()-Date.now())/86400000);
    return days<0?'Atenção: data ultrapassada':days<=30?'Dentro de '+Math.max(0,days)+' dias':dateText(v);
  }
  function drawGarageTools(){
    const s=st(),g=s?.garage,garage=q('#garage');if(!garage)return;
    let box=q('#mvGarageToolkit');
    if(!box){box=document.createElement('div');box.id='mvGarageToolkit';garage.appendChild(box)}
    if(!g){box.innerHTML='';return}
    const c=garageCosts(),d=g.documentDates||{},remain=g.nextKm?Number(g.nextKm)-Number(g.km||0):null;
    const due=g.nextDate&&new Date(g.nextDate+'T12:00:00')<new Date()||remain!==null&&remain<=0;
    box.innerHTML='<div class="mvToolBox"><h3>📊 Painel da minha mota</h3><p>'+esc(g.brand||'')+' '+esc(g.model||'')+' · '+Number(g.km||0).toLocaleString('pt-PT')+' km</p><div class="mvToolGrid"><div class="stat"><strong>'+eur(c.totalM)+'</strong><span>Manutenção registada</span></div><div class="stat"><strong>'+eur(c.totalF)+'</strong><span>Combustível registado</span></div><div class="stat"><strong>'+(c.l100!==null&&isFinite(c.l100)?c.l100.toLocaleString('pt-PT',{maximumFractionDigits:2})+' L/100 km':'—')+'</strong><span>Consumo (depósito cheio)</span></div><div class="stat"><strong>'+c.entries+' + '+c.fuels.length+'</strong><span>Registos + abastecimentos</span></div></div>'+(due?'<p class="mvAlertDue">⚠️ A revisão prevista precisa de atenção.</p>':'')+'<div class="mvToolGrid" style="margin-top:12px"><button class="mvToolBtn" id="mvAddFuel">⛽ Registar abastecimento</button><button class="mvToolBtn" id="mvSeeFuel">📋 Histórico de combustível</button><button class="mvToolBtn" id="mvDocs">📄 Datas e documentos</button><button class="mvToolBtn" id="mvExport">⬇ Exportar CSV</button></div><p>Os valores são calculados a partir dos registos introduzidos por ti, não de dados certificados. Consumo apenas entre dois depósitos completos.</p></div><div class="mvToolBox"><h3>🗓 Datas importantes</h3><p>Seguro: <strong>'+esc(dueLabel(d.insurance))+'</strong></p><p>IUC (data registada): <strong>'+esc(dueLabel(d.iuc))+'</strong></p><p>Outra inspeção / verificação: <strong>'+esc(dueLabel(d.inspection))+'</strong></p></div>';
    q('#mvAddFuel').onclick=openFuel;q('#mvSeeFuel').onclick=openFuelHistory;q('#mvDocs').onclick=openDocuments;q('#mvExport').onclick=exportCsv;
    qa('#garage .quick').forEach(b=>{
      if(b.dataset.mvActive)return;
      const label=b.querySelector('strong')?.textContent||'';
      if(label==='Seguro'||label==='Documentos'){b.removeAttribute('onclick');b.onclick=openDocuments;b.dataset.mvActive='1'}
      if(label==='Custos'){b.removeAttribute('onclick');b.onclick=openFuelHistory;b.dataset.mvActive='1'}
      if(label==='Notificações'){b.removeAttribute('onclick');b.onclick=()=>window.Android?.requestNotificationPermission?Android.requestNotificationPermission():notice('Notificações não disponíveis.');b.dataset.mvActive='1'}
    });
  }
  function openFuel(){
    if(!st()?.garage)return notice('Adiciona primeiro a tua mota.');
    window.openModal('<h2>Registar abastecimento</h2><p class="notice">Para calcular o consumo, regista pelo menos dois abastecimentos completos com os respetivos quilómetros.</p><div class="two"><div class="field"><label>Data</label><input type="date" id="mvFuelDate"></div><div class="field"><label>Odómetro (km)</label><input type="number" id="mvFuelKm" min="0"></div></div><div class="two"><div class="field"><label>Litros abastecidos</label><input type="number" id="mvFuelLiters" min="0" step="0.01"></div><div class="field"><label>Total pago (€)</label><input type="number" id="mvFuelPaid" min="0" step="0.01"></div></div><label class="mvChecklist"><input type="checkbox" id="mvFuelFull" checked><span>Enchi o depósito até ao mesmo nível</span></label><button class="btn primary full" id="mvSaveFuel">Guardar abastecimento</button>');
    q('#mvFuelDate').value=new Date().toISOString().slice(0,10);q('#mvFuelKm').value=st().garage.km||'';
    q('#mvSaveFuel').onclick=()=>{
      const km=Number(q('#mvFuelKm').value),liters=Number(q('#mvFuelLiters').value),paid=Number(q('#mvFuelPaid').value),date=q('#mvFuelDate').value;
      if(!date||!Number.isFinite(km)||km<0||!Number.isFinite(liters)||liters<=0||!Number.isFinite(paid)||paid<0||q('#mvFuelKm').value===''||q('#mvFuelPaid').value==='')return notice('Preenche data, quilómetros, litros e valor pago.');
      const entry={date,km,liters,total:paid,full:q('#mvFuelFull').checked};
      const g=st().garage;g.fuelEntries=Array.isArray(g.fuelEntries)?g.fuelEntries:[];g.fuelEntries.push(entry);
      if(km>Number(g.km||0))g.km=km;
      window.closeModal();window.renderGarage();saveGarageSynced('Abastecimento guardado');
      notice('Abastecimento registado');
    };
  }
  function openFuelHistory(){
    if(!st()?.garage)return notice('Adiciona primeiro a tua mota.');
    const c=garageCosts();const arr=[...c.fuels].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    window.openModal('<h2>Combustível e custos</h2><p class="notice">Gastos com manutenção: '+eur(c.totalM)+' · combustível: '+eur(c.totalF)+' · total registado: '+eur(c.totalM+c.totalF)+'.</p>'+(!arr.length?'<div class="empty">Sem abastecimentos registados.</div>':arr.map((x,i)=>'<div class="mvModalItem"><strong>'+esc(dateText(x.date))+'</strong><p>'+Number(x.km||0).toLocaleString('pt-PT')+' km · '+Number(x.liters||0).toLocaleString('pt-PT')+' L · '+eur(x.total)+'</p><p>'+ (x.full!==false?'Depósito cheio':'Abastecimento parcial')+'</p></div>').join(''))+'<button class="btn primary full" id="mvFuelNew">+ Adicionar abastecimento</button><button class="btn secondary full" id="mvFuelCSV" style="margin-top:8px">Exportar histórico CSV</button>');
    q('#mvFuelNew').onclick=openFuel;q('#mvFuelCSV').onclick=exportCsv;
  }
  function openDocuments(){
    if(!st()?.garage)return notice('Adiciona primeiro a tua mota.');
    const d=st().garage.documentDates||{};
    window.openModal('<h2>Datas e documentos</h2><p class="notice">Indica as datas que constam dos teus documentos. A MotoVerse não determina automaticamente obrigações legais para cada veículo.</p><div class="field"><label>Validade do seguro</label><input type="date" id="mvInsuranceDate"></div><div class="field"><label>Data de referência do IUC</label><input type="date" id="mvIucDate"></div><div class="field"><label>Próxima inspeção / verificação (se aplicável)</label><input type="date" id="mvInspectionDate"></div><button class="btn primary full" id="mvDocsSave">Guardar datas</button><button class="btn secondary full" id="mvDocsCalendar" style="margin-top:8px">📅 Adicionar seguro à agenda</button>');
    q('#mvInsuranceDate').value=d.insurance||'';q('#mvIucDate').value=d.iuc||'';q('#mvInspectionDate').value=d.inspection||'';
    q('#mvDocsSave').onclick=()=>{st().garage.documentDates={insurance:q('#mvInsuranceDate').value,iuc:q('#mvIucDate').value,inspection:q('#mvInspectionDate').value};window.closeModal();drawGarageTools();saveGarageSynced('Datas guardadas');notice('Datas atualizadas')};
    q('#mvDocsCalendar').onclick=()=>{const v=q('#mvInsuranceDate').value;if(!v)return notice('Indica a data do seguro.');const ts=new Date(v+'T09:00:00').getTime();if(window.Android?.addCalendarEvent)Android.addCalendarEvent('MotoVerse — verificar seguro', '',ts,ts+30*60000,'Confirma a data de validade na tua apólice.');else notice('Agenda não disponível.')};
  }
  function csvValue(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
  function exportCsv(){
    const s=st(),g=s?.garage;if(!g)return notice('Não há mota para exportar.');
    const rows=[['Tipo','Data','Descrição','Odómetro (km)','Custo (€)','Local / detalhes']];
    (Array.isArray(s.maintenance)?s.maintenance:[]).forEach(x=>rows.push(['Manutenção',x.date,x.service,x.km,x.cost,(x.shop||'')+' '+(x.notes||'')]));
    (Array.isArray(g.fuelEntries)?g.fuelEntries:[]).forEach(x=>rows.push(['Combustível',x.date,(x.full!==false?'Depósito cheio':'Parcial'),x.km,x.total,Number(x.liters||0)+' L']));
    rows.push(['Mota','',String(g.brand||'')+' '+String(g.model||''),g.km,'','']);
    const csv='\ufeff'+rows.map(r=>r.map(csvValue).join(';')).join('\r\n');
    if(window.Android?.exportGarageCsv)Android.exportGarageCsv(csv);else notice('Exportação disponível na versão Android.');
  }
  window.onGarageCsvExported=()=>notice('Ficheiro CSV guardado.');
  const oldGarageLoaded=window.onGarageLoaded;
  window.onGarageLoaded=function(g){
    if(oldGarageLoaded)oldGarageLoaded(g);
    if(g&&Array.isArray(g.maintenance)){
      st().maintenance=g.maintenance;
      try{localStorage.setItem('mv_maintenance',JSON.stringify(g.maintenance))}catch(e){}
      window.renderGarage();
    }
    drawGarageTools();
  };
  const oldSavedGarage=window.onGarageSaved;
  window.onGarageSaved=function(){
    if(savingExtra){const reason=savingExtra;savingExtra='';drawGarageTools();notice(reason);}
    else if(oldSavedGarage)oldSavedGarage();
  };
  const oldSaveMaint=window.saveMaintenance;
  window.saveMaintenance=function(){
    const before=st()?.maintenance?.length||0;
    if(oldSaveMaint)oldSaveMaint();
    if((st()?.maintenance?.length||0)>before){saveGarageSynced('Manutenção sincronizada');drawGarageTools();}
  };
  const oldRenderGarage=window.renderGarage;
  window.renderGarage=function(){if(oldRenderGarage)oldRenderGarage.apply(this,arguments);drawGarageTools()};
  const oldSavedAlerts=window.onSavedAlertsLoaded;
  window.onSavedAlertsLoaded=function(items){
    alertRecords=Array.isArray(items)?items:[];
    if(oldSavedAlerts)oldSavedAlerts(items);
    const list=q('#mvAlertsBox');if(!list)return;
    qa('#mvAlertsBox .mvModalItem').forEach((card,i)=>{
      const alert=alertRecords[i];if(!alert||card.querySelector('.mvMatchBtn'))return;
      const b=document.createElement('button');b.className='btn secondary full mvMatchBtn';b.style.marginTop='9px';b.textContent='Ver anúncios correspondentes';
      b.onclick=()=>{const s=st();s.filters={brand:alert.brand||'',model:alert.model||'',district:alert.district||'',price:alert.maxPrice||''};q('#exploreSearch').value='';window.closeModal();window.go('explore');drawMarketplace()};
      card.appendChild(b);
    });
  };

  let meetupRecords=[], meetupFilter='Todos';
  function renderHomeMeetups(records){
    const today=new Date().toISOString().slice(0,10);
    const upcoming=(Array.isArray(records)?records:[]).filter(x=>x&&x.date&&x.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const zone=q('.zoneEvent'),spots=q('.meetGrid');
    if(zone){
      zone.style.backgroundImage='none';zone.style.backgroundColor='#151c21';
      if(upcoming.length){
        const x=upcoming[0],dt=new Date(String(x.date)+'T12:00:00');
        const day=String(dt.getDate()).padStart(2,'0'),month=dt.toLocaleDateString('pt-PT',{month:'short'}).replace('.','').toUpperCase();
        zone.innerHTML='<div class="zoneEventDate"><span>'+esc(dt.toLocaleDateString('pt-PT',{weekday:'short'}).toUpperCase())+'</span><strong>'+day+'</strong><span>'+esc(month)+'</span></div><div class="zoneEventBody"><h3>'+esc(x.name||'Encontro MotoVerse')+'</h3><p>⌖ '+esc(x.location||'Portugal')+' · '+esc(x.time||'Hora a definir')+'</p><p>Organizado por '+esc(x.organizerName||'Motociclista')+'</p><div class="eventMiniTags"><span>'+esc(x.type||'Passeio')+'</span><span>Evento publicado</span></div><button class="eventCta" id="mvSeeNextEvent">Ver encontros →</button></div>';
        q('#mvSeeNextEvent').onclick=()=>window.go('community');
      }else{
        zone.innerHTML='<div class="zoneEventBody"><h3>Ainda sem encontros agendados</h3><p>Quando alguém publicar um encontro, aparece aqui.</p><button class="eventCta" id="mvCreateFirstEvent">Criar um encontro →</button></div>';
        q('#mvCreateFirstEvent').onclick=()=>{window.go('community');window.openMeetup&&window.openMeetup()};
      }
    }
    if(spots){
      if(upcoming.length){
        spots.innerHTML=upcoming.slice(0,2).map(x=>'<button class="meetSpot" type="button" data-mv-spot="'+esc(x.id||'')+'"><div><strong>'+esc(x.name||'Encontro')+'</strong><small>⌖ '+esc(x.location||'Local por definir')+' · '+esc(x.date||'')+'</small></div></button>').join('');
        qa('.meetGrid [data-mv-spot]').forEach(btn=>{btn.onclick=()=>{const e=upcoming.find(x=>x.id===btn.dataset.mvSpot);if(e?.location&&window.Android?.openMapSearch)Android.openMapSearch(String(e.location)+' Portugal');else window.go('community')}});
      }else{
        spots.innerHTML='<button class="meetSpot" style="width:100%;grid-column:1/-1" id="mvMeetSearchMap"><div><strong>Descobrir locais no Maps</strong><small>Pesquisar espaços de encontro de motociclistas na tua zona</small></div></button>';
        q('#mvMeetSearchMap').onclick=()=>openMapInSelectedZone('pontos de encontro motards');
      }
    }
  }
  function currentLocalDate(){
    const t=new Date();return String(t.getFullYear())+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  }
  function applyMeetupFilter(){
    const dateNow=currentLocalDate(),from=new Date(dateNow+'T00:00:00'),list=q('#eventList');if(!list)return;
    let visible=0;
    qa('#eventList .mvCloudMeetup').forEach(el=>{
      const x=meetupRecords.find(m=>String(m.id)===el.dataset.meetupId),dt=x?.date?new Date(x.date+'T12:00:00'):null;
      let ok=!!x;
      if(meetupFilter==='Hoje')ok=ok&&x.date===dateNow;
      else if(meetupFilter==='Fim de semana'){
        const days=dt?Math.floor((dt.getTime()-from.getTime())/86400000):100;
        ok=ok&&days>=0&&days<8&&(dt.getDay()===0||dt.getDay()===6);
      }else if(meetupFilter==='Passeios')ok=ok&&String(x.type||'').toLowerCase()==='passeio';
      else if(meetupFilter==='Cafezadas')ok=ok&&(x.category==='cafezada'||String(x.type||'').toLowerCase()==='convívio');
      else if(meetupFilter==='Tours EN2')ok=ok&&x.category==='en2';
      else if(meetupFilter==='Outros tours')ok=ok&&x.category==='tour';
      else if(meetupFilter==='Trilhos')ok=ok&&x.category==='trilho';
      else if(meetupFilter==='Track Day')ok=ok&&String(x.type||'').toLowerCase()==='track day';
      el.style.display=ok?'':'none';if(ok)visible++;
    });
    const existing=q('#mvNoFilteredMeetups');if(existing)existing.remove();
    if(meetupRecords.length&&!visible){
      const div=document.createElement('div');div.id='mvNoFilteredMeetups';div.className='empty';div.textContent='Não há encontros para este filtro.';list.appendChild(div);
    }
  }
  function installCommunityTools(){
    const root=q('#community');if(!root||root.dataset.mvToolsInstalled)return;
    root.dataset.mvToolsInstalled='1';
    const subtitle=root.querySelector('.sectionHead h2');
    if(subtitle&&subtitle.textContent==='Perto de ti')subtitle.textContent='Encontros publicados';
    const mapsButton=root.querySelector('.grid2 .quick:nth-child(2)');
    if(mapsButton){mapsButton.removeAttribute('onclick');const strong=mapsButton.querySelector('strong'),small=mapsButton.querySelector('span');if(strong)strong.textContent='Pesquisar no mapa';if(small)small.textContent='Locais na zona selecionada';mapsButton.onclick=()=>openMapInSelectedZone('encontros de motas')}
    const chips=qa('#community .chips .chip');
    chips.forEach(b=>{b.onclick=()=>{meetupFilter=b.textContent.trim();chips.forEach(x=>x.classList.toggle('active',x===b));applyMeetupFilter()}});
    const sections=qa('#community .section');
    const routes=sections.find(sec=>sec.querySelector('.sectionHead h2')?.textContent==='Descobrir rotas');
    if(routes){
      routes.innerHTML='<div class="sectionHead"><h2>Planear percurso</h2></div><div class="mvToolBox" style="margin:0"><h3>🗺 Percurso de mota</h3><p>Escolhe partida e destino. O Google Maps calcula a rota, distância e duração reais.</p><div class="field"><label>Partida</label><input id="mvRouteStart" placeholder="Ex.: Setúbal"></div><div class="field"><label>Destino</label><input id="mvRouteEnd" placeholder="Ex.: Cabo Espichel"></div><button class="btn primary full" id="mvRouteGo">Abrir direções no Maps</button></div>';
      const loc=st()?.location||'';if(loc!=='Portugal'&&loc!=='Perto de mim')q('#mvRouteStart').value=loc;
      q('#mvRouteGo').onclick=()=>{const start=q('#mvRouteStart').value.trim(),end=q('#mvRouteEnd').value.trim();if(!start||!end)return notice('Indica partida e destino.');if(window.Android?.openRoute)Android.openRoute(start,end);else notice('Planeador disponível na app Android.')};
    }
  }

  const oldMeetups=window.onMeetupsLoaded;
  window.onMeetupsLoaded=function(items){
    meetupRecords=Array.isArray(items)?items:[];
    if(oldMeetups)oldMeetups(items);
    renderHomeMeetups(meetupRecords);
    const list=q('#eventList');if(!list)return;
    qa('#eventList > .eventCard:not(.mvCloudMeetup)').forEach(node=>node.remove());

    qa('#eventList .mvCloudMeetup').forEach(node=>{
      const event=(Array.isArray(items)?items:[]).find(x=>String(x.id)===node.dataset.meetupId);
      const badge=node.querySelector('.verifiedBadge');if(badge)badge.textContent='✓ E-mail confirmado';
      const row=node.querySelector('.meetRow');if(!row||!event?.location)return;
      const button=document.createElement('button');button.className='mvCalendarBtn';button.type='button';
      button.textContent='📍 Ver local';button.onclick=()=>{if(window.Android?.openMapSearch)Android.openMapSearch(String(event.location)+' Portugal');else notice('Mapa só disponível na app Android.')};row.appendChild(button);
    });
    const empty=q('#mvNoMeetups');
    if(!list.querySelector('.mvCloudMeetup')&&!empty)list.innerHTML='<div id="mvNoMeetups" class="empty">Ainda não há encontros publicados. Entra na tua conta e cria o primeiro.</div>';
    if(list.querySelector('.mvCloudMeetup')&&empty)empty.remove();
    applyMeetupFilter();
  };
  function injectExtraTools(){
    attachVerificationControls();
    const menu=q('#mvProfileMenu');if(menu&&!q('#mvSafetyRow')){
      const safety=document.createElement('div');safety.id='mvSafetyRow';safety.className='menuItem';safety.innerHTML='<span>🛡 Guia de compra segura</span><span>›</span>';safety.onclick=openSafety;menu.appendChild(safety);
      const ride=document.createElement('div');ride.id='mvPreRideRow';ride.className='menuItem';ride.innerHTML='<span>🏍 Checklist antes da viagem</span><span>›</span>';ride.onclick=openPreRide;menu.appendChild(ride);
      const help=document.createElement('div');help.id='mvHelpRow';help.className='menuItem';help.innerHTML='<span>❔ Ajuda e suporte</span><span>›</span>';help.onclick=()=>window.openModal('<h2>Ajuda MotoVerse</h2><p class="mvInfo">Os anúncios entram em revisão antes de serem publicados. Usa Mensagens para contactar vendedores e guarda as intervenções na Garagem.</p><p class="mvInfo">Para assistência: <strong>geral@motoverse.pt</strong></p><p class="notice">Nunca envies palavras-passe ou códigos de autenticação. Os pagamentos de veículos são combinados diretamente entre comprador e vendedor, fora da MotoVerse.</p>');menu.appendChild(help);
    }
  }

  function attachVerificationControls(){
    const row=q('#mvSettingsRow');if(!row||row.dataset.mvVerifyBound)return;
    row.dataset.mvVerifyBound='1';
    const previous=row.onclick;
    row.onclick=function(){
      if(previous)previous.apply(this,arguments);
      setTimeout(()=>{
        const body=q('#modalContent'),h=body?.querySelector('h2');
        if(!body||!h||h.textContent.trim()!=='Configurações'||q('#mvEmailVerificationControls'))return;
        const p=document.createElement('div');p.id='mvEmailVerificationControls';p.className='mvToolBox';p.style.margin='12px 0';
        p.innerHTML='<h3>Confirmação do e-mail</h3><p>Uma conta com e-mail confirmado pode mostrar esse estado nos encontros. A administração exige também e-mail confirmado.</p><div class="mvToolGrid"><button class="mvToolBtn" id="mvVerifySend">Enviar confirmação</button><button class="mvToolBtn" id="mvVerifyRefresh">Já confirmei — atualizar</button></div>';
        body.appendChild(p);
        q('#mvVerifySend').onclick=()=>{if(window.Android?.sendVerificationEmail)Android.sendVerificationEmail();else notice('Indisponível nesta versão.')};
        q('#mvVerifyRefresh').onclick=()=>{if(window.Android?.refreshVerification)Android.refreshVerification();else notice('Indisponível nesta versão.')};
      },0);
    };
  }
  window.onVerificationEmailSent=()=>notice('Enviámos um e-mail para confirmares a conta.');
  window.onEmailAlreadyVerified=()=>notice('Este e-mail já está confirmado.');

  const oldAuth=window.onNativeAuth;
  window.onNativeAuth=function(u){if(oldAuth)oldAuth(u);setTimeout(injectExtraTools,0)};
  const oldGo=window.go;
  window.go=function(id,el){
    const result=oldGo?oldGo.apply(this,arguments):undefined;
    if(id==='profile')setTimeout(injectExtraTools,0);
    if(id==='garage')setTimeout(drawGarageTools,0);
    if(id==='explore'){setTimeout(drawMarketplace,0);if(window.Android?.loadApprovedListings)Android.loadApprovedListings();}
    if(id==='community'&&window.Android?.loadMeetups)Android.loadMeetups();
    if(id==='home'){if(window.Android?.loadApprovedListings)Android.loadApprovedListings();if(window.Android?.loadMeetups)Android.loadMeetups();}
    return result;
  };
  const oldApprove=window.onApprovedListings;
  window.onApprovedListings=function(items){if(oldApprove)oldApprove(items);marketplaceReady=true;drawMarketplace()};
  const oldFilters=window.applyBikeFilters;
  window.applyBikeFilters=function(){if(oldFilters)oldFilters();drawMarketplace()};

  function installServices(){
    const defs=[
      ['#explorePecas','Peças e acessórios','Procurar lojas de peças e equipamentos','loja peças acessórios de motas']
    ];
    defs.forEach(([selector,title,description,term])=>{
      const section=q(selector);if(!section||section.dataset.mvRealSearch)return;
      section.dataset.mvRealSearch='1';
      section.innerHTML='<div class="sectionHead"><h2>'+esc(title)+'</h2></div><div class="mvToolBox" style="margin:4px 0"><h3>'+esc(description)+'</h3><p>Pesquisa em lojas e empresas reais através do Google Maps, na localização que escolheste. Os resultados abrem fora da MotoVerse.</p><button class="btn primary full mvOpenServices">Pesquisar no Maps</button></div>'+(selector==='#explorePecas'?'<div class="notice">A publicação de anúncios de peças e acessórios dentro da MotoVerse ainda não está disponível.</div>':'');
      section.querySelector('.mvOpenServices').onclick=()=>openMapInSelectedZone(term);
    });
  }
  window.onApprovedListingsFailed=function(){marketplaceReady=true;notice('Não foi possível atualizar os anúncios. Verifica a ligação e tenta novamente.');drawMarketplace()};

  installServices();installCommunityTools();renderHomeMeetups([]);
  bindMarket();injectExtraTools();drawGarageTools();drawMarketplace();
  if(window.Android?.loadApprovedListings)Android.loadApprovedListings();
})();
