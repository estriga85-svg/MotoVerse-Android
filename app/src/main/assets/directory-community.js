(function () {
  'use strict';

  const q = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);
  const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT');
  const placeText = place => [place.address, place.city].filter(Boolean).join(', ');
  const kilometers = (a, b) => {
    const radians = Math.PI / 180;
    const latitude = Math.sin((b.lat-a.lat)*radians/2);
    const longitude = Math.sin((b.lon-a.lon)*radians/2);
    const h = latitude**2 + Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*longitude**2;
    return 12742 * Math.asin(Math.sqrt(Math.min(1,h)));
  };
  const hasCoords = place => place && Number.isFinite(place.lat) && Number.isFinite(place.lon);
  const positionOf = place => hasCoords(place) ? place : {lat:place.areaLat,lon:place.areaLon};
  const directory = Array.isArray(window.mvBusinessDirectory) ? window.mvBusinessDirectory : [];
  const areas = window.mvDirectoryAreas || {};
  const brandsFor = (place, mode) => mode==='workshop' ? (place.workshopBrands||place.brands||[]) : (place.brands||[]);
  const names = (a,b) => a.localeCompare(b,'pt-PT',{sensitivity:'base'});
  const directoryViews = new Map();
  let directoryOrigin = null;
  let directoryZone = null;
  let directoryRequest = 0;
  let directoryLookup = null;
  let ratingRequest = 0;

  const labels = {
    cafezada:'Cafezada', passeio:'Passeio', en2:'Tour EN2', tour:'Tour', trilho:'Trilhos / Off-road', trackday:'Track Day'
  };
  let published = [];
  let interests = {};
  let hasNotifications = false;
  let publishForm = null;
  let openMeetupFromNotification = null;
  let inboxUid = null;
  let seen = new Set();
  let awaitingPreferences = false;

  const css = document.createElement('style');
  css.textContent =
    '.mvDirectoryControls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:10px 0}' +
    '.mvDirectoryControls input,.mvDirectoryControls select{min-width:0;width:100%;padding:10px;border:1px solid var(--line);border-radius:12px;color:var(--text);background:var(--panel)}' +
    '.mvDirectoryControls input{grid-column:1/-1}.mvDirectoryList{display:grid;gap:8px}.mvDirectoryCard{display:block;width:100%;text-align:left;color:var(--text);padding:13px;border-radius:14px;background:var(--panel);border:1px solid var(--line);cursor:pointer}' +
    '.mvDirectoryCard strong,.mvDirectoryCard small{display:block;overflow-wrap:anywhere}.mvDirectoryCard small{margin-top:5px;color:var(--muted)}.mvDirectoryHint{font-size:11px;color:var(--muted);line-height:1.5}.mvDirectoryHint button{font:inherit;color:var(--accent2);background:none;border:0;padding:0;text-align:left;text-decoration:underline}' +
    '.mvDirectoryActions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.mvDirectoryActions button{flex:1}.mvInterestLabel{display:flex;gap:9px;align-items:center;min-height:42px;color:var(--text)}.mvInterestLabel input{accent-color:var(--accent);width:18px;height:18px}' +
    '.mvCommunityDescription{white-space:pre-wrap;overflow-wrap:anywhere}.mvCommunityForm select{width:100%}';
  document.head.appendChild(css);

  function directoryPosition() {
    if (hasCoords(state.locationCoords)) return state.locationCoords;
    return directoryOrigin;
  }

  function updateDirectoryLocation() {
    const zone = state.location;
    if (zone === directoryZone && !hasCoords(state.locationCoords)) return;
    directoryZone = zone;
    directoryOrigin = null;
    clearTimeout(directoryLookup);
    directoryLookup = null;
    const request = ++directoryRequest;
    const area = areas[normalized(zone.trim())];
    if (Array.isArray(area)) directoryOrigin = {lat:area[0],lon:area[1]};
    if (zone !== 'Portugal' && !hasCoords(state.locationCoords) && window.Android?.resolveDirectoryLocation) {
      directoryLookup = setTimeout(() => {
        directoryLookup = null;
        refreshDirectory();
      }, 7000);
      Android.resolveDirectoryLocation(request, zone);
    }
    refreshDirectory();
  }

  window.onDirectoryLocation = function (request, place) {
    if (request !== directoryRequest) return;
    clearTimeout(directoryLookup);
    directoryLookup = null;
    if (hasCoords(place)) directoryOrigin = place;
    refreshDirectory();
  };

  function details(place) {
    const address = placeText(place);
    const destination = [place.name, address, 'Portugal'].filter(Boolean).join(', ');
    const coords = hasCoords(place) ? place.lat + ',' + place.lon : '';
    const origin = directoryPosition();
    const position = positionOf(place);
    const distance = hasCoords(origin) && hasCoords(position) ? kilometers(origin,position) : null;
    const type = [place.stand ? (place.salesConfirmed ? 'Stand' : 'Loja de motas') : '', place.workshop ? 'Oficina' : ''].filter(Boolean).join(' · ');
    openModal('<h2>'+esc(place.name)+'</h2><p class="mvInfo">'+esc(type)+'</p><p class="mvInfo">'+esc(address || 'Morada não publicada · localização disponível no mapa')+
      (place.cityApprox ? '<br>Localidade aproximada' : '')+
      (distance === null ? '' : '<br>'+(!hasCoords(place)?'≈ ':'')+distance.toLocaleString('pt-PT',{maximumFractionDigits:1})+' km em linha reta')+'</p>'+
      (place.stand ? '<p class="mvInfo"><strong>Marcas</strong><br>'+esc((place.brands||[]).join(', ') || 'Por confirmar')+'</p><p class="mvInfo"><strong>Venda</strong><br>'+esc(salesLabel(place))+'</p>' : '')+
      (place.workshopBrands?.length ? '<p class="mvInfo"><strong>Marcas assistidas</strong><br>'+esc(place.workshopBrands.join(', '))+'</p>' : '')+
      '<p class="mvInfo"><strong>Oficina</strong><br>'+ (place.workshop ? 'Sim' : place.repair === false ? 'Não' : 'Por confirmar')+'</p>'+
      '<p class="mvInfo"><strong>Contactos</strong><br>'+esc([place.phone,place.email,place.website].filter(Boolean).join(' · ') || 'Sem contactos publicados na fonte')+'</p>'+
      '<div class="mvDirectoryActions">'+(place.phone ? '<button type="button" class="btn secondary" id="mvBusinessCall">Ligar</button>' : '')+
      (place.email ? '<button type="button" class="btn secondary" id="mvBusinessEmail">E-mail</button>' : '')+
      (place.website ? '<button type="button" class="btn secondary" id="mvBusinessWebsite">Website</button>' : '')+'</div>'+
      '<button type="button" class="btn primary full" id="mvBusinessWaze">Viajar com Waze</button>'+
      '<div class="mvDirectoryActions"><button type="button" class="btn secondary" id="mvBusinessReviews">Avaliações no Google Maps</button>'+
      '<button type="button" class="btn secondary" id="mvBusinessRating">Consultar nota Google</button></div>'+
      '<p id="mvBusinessRatingState" class="mvDirectoryHint" role="status"></p><p class="mvDirectoryHint">Fonte <button type="button" id="mvBusinessSource">'+esc(place.sourceName||'OpenStreetMap')+'</button></p>');
    q('#mvBusinessWaze').onclick = () => Android.openWaze(address ? address+', Portugal' : destination, coords);
    q('#mvBusinessReviews').onclick = () => Android.openGoogleReviews(destination);
    q('#mvBusinessRating').onclick = () => {
      const status = q('#mvBusinessRatingState');
      status.dataset.request = String(++ratingRequest);
      status.textContent = 'A consultar a classificação…';
      Android.loadDirectoryRating(ratingRequest, destination, place.name, coords);
    };
    if (q('#mvBusinessCall')) q('#mvBusinessCall').onclick = () => Android.openBusinessLink('tel:'+place.phone.split(/[;,]/)[0].replace(/[^+0-9]/g,''));
    if (q('#mvBusinessEmail')) q('#mvBusinessEmail').onclick = () => Android.openBusinessLink('mailto:'+place.email.split(/[;,]/)[0].trim());
    if (q('#mvBusinessWebsite')) q('#mvBusinessWebsite').onclick = () => Android.openBusinessLink(place.website);
    q('#mvBusinessSource').onclick = () => Android.openBusinessLink(place.source);
  }

  window.onDirectoryRating = function (request, data) {
    const status = q('#mvBusinessRatingState');
    if (!status || status.dataset.request !== String(request)) return;
    if (data && Number.isFinite(data.rating) && Number.isFinite(data.count)) {
      const rating = data.rating.toLocaleString('pt-PT',{minimumFractionDigits:1,maximumFractionDigits:1});
      status.innerHTML = '★ '+rating+' / 5 · '+data.count.toLocaleString('pt-PT')+' avaliações · <strong>Google Maps</strong>';
    } else {
      status.textContent = 'Nota indisponível na app. Podes consultar as avaliações no Google Maps.';
    }
  };

  function salesLabel(place) {
    if (place.new && place.used) return 'Novas e usadas';
    if (place.new) return place.used === false ? 'Novas' : 'Novas · usadas por confirmar';
    if (place.used) return place.new === false ? 'Usadas' : 'Usadas · novas por confirmar';
    return 'Novas / usadas por confirmar';
  }

  function renderDirectory(view) {
    const { section, entries, mode } = view;
    const search = normalized(section.querySelector('.mvDirectorySearch').value.trim());
    const brand = section.querySelector('.mvDirectoryBrand')?.value;
    const sale = section.querySelector('.mvDirectorySale')?.value;
    const sort = section.querySelector('.mvDirectorySort').value;
    const origin = directoryPosition();
    const selected = entries.filter(place =>
      (!search || normalized([place.name,place.address,place.city,...brandsFor(place,mode)].join(' ')).includes(search)) &&
      (!brand || brandsFor(place,mode).includes(brand)) && (!sale || place[sale] === true))
      .map(place => {
        const position=positionOf(place);
        return {place,distance:hasCoords(origin)&&hasCoords(position)?kilometers(origin,position):Infinity};
      });
    selected.sort((a,b) => (sort === 'nearest' ? a.distance-b.distance : 0) || names(a.place.name,b.place.name));
    const status = section.querySelector('.mvDirectoryStatus');
    status.textContent = selected.length + (selected.length===1?' resultado':' resultados') +
      (origin && sort === 'nearest' ? ' · Distância em linha reta' : directoryLookup && sort === 'nearest' ? ' · A localizar a zona…' :
        sort==='nearest' ? ' · Escolhe a tua localização para ordenar por distância' : '');
    const list = section.querySelector('.mvDirectoryList');
    list.innerHTML = selected.length ? selected.slice(0,view.limit).map(({place,distance}, index) =>
      '<button type="button" class="mvDirectoryCard" data-mv-business="'+index+'"><strong>'+esc(place.name)+'</strong><small>'+
      esc([place.city || place.address,Number.isFinite(distance)?(!hasCoords(place)?'≈ ':'')+distance.toLocaleString('pt-PT',{maximumFractionDigits:1})+' km':'',place.stand?salesLabel(place):'',place.workshop?'Oficina':''].filter(Boolean).join(' · '))+
      '</small>'+(brandsFor(place,mode).length ? '<small>'+esc(brandsFor(place,mode).join(', '))+'</small>' : '')+'</button>').join('') :
      '<div class="empty">Sem resultados para estes filtros.</div>';
    list.querySelectorAll('[data-mv-business]').forEach(button => {
      button.onclick = () => details(selected[Number(button.dataset.mvBusiness)].place);
    });
    section.querySelector('.mvDirectoryMore').hidden = selected.length <= view.limit;
  }

  function refreshDirectory() {
    for (const view of directoryViews.values()) renderDirectory(view);
  }

  function installDirectory(id, title, mode) {
    const section = q('#'+id);
    const entries = directory.filter(place => place[mode]);
    const brands = [...new Set(entries.flatMap(place=>brandsFor(place,mode)))].sort(names);
    const view = { section, entries, mode, limit:25 };
    directoryViews.set(id,view);
    section.innerHTML = '<div class="sectionHead"><h2>'+title+'</h2><button type="button" class="mvDirectoryLocation">Escolher localização</button></div>'+
      '<div class="mvDirectoryControls"><input type="search" class="mvDirectorySearch" aria-label="Pesquisar nome, marca ou localidade" placeholder="Nome, marca ou localidade">'+
      '<select class="mvDirectorySort" aria-label="Ordenar resultados"><option value="nearest">Mais próximo</option><option value="az">Nome A–Z</option></select>'+
      '<select class="mvDirectoryBrand" aria-label="Filtrar por marca"><option value="">Todas as marcas</option>'+brands.map(brand=>'<option>'+esc(brand)+'</option>').join('')+'</select>'+
      (mode==='stand' ? '<select class="mvDirectorySale" aria-label="Filtrar tipo de venda"><option value="">Novas e usadas</option><option value="new">Vende novas</option><option value="used">Vende usadas</option></select>' : '')+'</div>'+
      '<p class="mvDirectoryHint mvDirectoryStatus" role="status"></p><div class="mvDirectoryList"></div>'+
      '<button type="button" class="btn secondary full mvDirectoryMore" style="margin-top:10px">Ver mais</button>'+
      '<p class="mvDirectoryHint">Dados de <button type="button" class="mvDirectoryLicense">© colaboradores OpenStreetMap</button> e das fontes das fichas. Localidades aproximadas de <button type="button" class="mvDirectoryGeoNames">GeoNames</button>. Confirma os dados antes de viajar.</p>';
    section.querySelector('.mvDirectoryLocation').onclick = openLocation;
    section.querySelector('.mvDirectoryLicense').onclick = () => Android.openBusinessLink('https://www.openstreetmap.org/copyright');
    section.querySelector('.mvDirectoryGeoNames').onclick = () => Android.openBusinessLink('https://www.geonames.org/');
    section.querySelector('.mvDirectoryMore').onclick = () => {view.limit+=25;renderDirectory(view);};
    section.querySelector('.mvDirectorySearch').oninput = () => {view.limit=25;renderDirectory(view);};
    section.querySelectorAll('select').forEach(select => {select.onchange = () => {view.limit=25;renderDirectory(view);};});
    renderDirectory(view);
  }

  function markSeen(id) {
    if (!inboxUid) return;
    seen.add(id);
    try {localStorage.setItem('mv_community_seen_'+inboxUid,JSON.stringify([...seen].slice(-300)));}
    catch (error) { /* Device storage may be unavailable. */ }
    renderInbox();
  }

  function eventDetails(event, back) {
    if (event.notifyInterested) markSeen(event.id);
    openModal((back ? '<button type="button" class="btn secondary mvReviewBack" id="mvEventBack">‹ Voltar às notificações</button>' : '')+
      '<h2>'+esc(event.name)+'</h2><p class="mvInfo">'+esc([labels[event.category]||event.type,event.date,event.time].filter(Boolean).join(' · '))+'</p>'+
      '<p class="mvInfo">'+esc(event.location)+'</p>'+
      (event.route ? '<p class="mvInfo mvCommunityDescription"><strong>Percurso</strong><br>'+esc(event.route)+'</p>' : '')+
      (event.description ? '<p class="mvInfo mvCommunityDescription">'+esc(event.description)+'</p>' : '')+
      '<p class="mvInfo">Organizado por '+esc(event.organizerName||'Motociclista')+'</p>'+
      '<button type="button" class="btn primary full" id="mvEventWaze">Viajar para o ponto de encontro</button>');
    if (back) q('#mvEventBack').onclick = openInterests;
    q('#mvEventWaze').onclick = () => Android.openWaze(event.location+', Portugal','');
  }

  function matchingEvents() {
    return published.filter(event => event.notifyInterested && event.organizerUid!==inboxUid &&
      interests[event.category] && Number(event.createdAt)>=interests[event.category])
      .sort((a,b)=>Number(b.createdAt)-Number(a.createdAt));
  }

  function renderInbox() {
    const inbox = q('#mvCommunityInbox');
    const notices = matchingEvents();
    const badge = q('#mvCommunityUnread');
    if (badge) {
      const unread = notices.filter(event=>!seen.has(event.id)).length;
      badge.textContent = unread ? String(unread) : '›';
    }
    if (!inbox) return;
    inbox.innerHTML = notices.length ? notices.slice(0,40).map((event,index) =>
      '<button type="button" class="mvDirectoryCard" data-mv-inbox="'+index+'"><strong>'+(!seen.has(event.id)?'● ':'')+esc(event.name)+'</strong><small>'+
        esc([labels[event.category],event.location,event.date].filter(Boolean).join(' · '))+'</small></button>').join('') :
      '<div class="empty">Ainda não há publicações dos teus interesses.</div>';
    inbox.querySelectorAll('[data-mv-inbox]').forEach(button => {
      button.onclick = () => eventDetails(notices[Number(button.dataset.mvInbox)],true);
    });
  }

  function openInterests() {
    if (!state.user?.uid) return toast('Inicia sessão para guardar os teus interesses.');
    openModal('<h2>Notificações e interesses</h2><p class="mvInfo">Escolhe os tipos de encontros sobre os quais queres receber avisos neste telemóvel.</p>'+
      '<form id="mvCommunityInterests">'+Object.entries(labels).map(([id,label])=>'<label class="mvInterestLabel"><input type="checkbox" value="'+id+'"'+
        (interests[id]?' checked':'')+'> '+label+'</label>').join('')+
      '<button type="submit" class="btn primary full">Guardar interesses</button></form>'+
      '<p id="mvCommunityPermission" class="mvInfo" role="status"></p>'+
      '<button type="button" class="btn secondary full" id="mvCommunitySettings">Definições de notificações</button>'+
      '<h3>Publicações dos teus interesses</h3><div id="mvCommunityInbox" class="mvDirectoryList"></div>');
    q('#mvCommunitySettings').onclick = () => Android.openNotificationSettings();
    q('#mvCommunityInterests').onsubmit = event => {
      event.preventDefault();
      awaitingPreferences = true;
      Android.saveCommunityPreferences(JSON.stringify(all('#mvCommunityInterests input:checked').map(input=>input.value)));
    };
    refreshPermissionLabel();
    renderInbox();
    Android.loadMeetups();
    Android.getCommunityPreferences();
  }

  function refreshPermissionLabel() {
    const status = q('#mvCommunityPermission');
    if (status) status.textContent = hasNotifications ? 'Notificações permitidas pelo Android.' :
      'Os avisos continuam disponíveis aqui. Para os receber no telemóvel, permite as notificações nas definições.';
  }

  window.onCommunityPreferences = (values,allowed) => {
    interests = values || {};
    hasNotifications = allowed;
    all('#mvCommunityInterests input').forEach(input=>{input.checked=Boolean(interests[input.value]);});
    if (awaitingPreferences) {awaitingPreferences=false;toast('Interesses guardados.');}
    refreshPermissionLabel();
    renderInbox();
  };

  function installProfileEntry() {
    const menu = q('#mvProfileMenu');
    if (!menu || q('#mvCommunityProfile')) return;
    const button = document.createElement('button');
    button.id = 'mvCommunityProfile';
    button.type = 'button';
    button.className = 'menuItem';
    button.style.cssText = 'width:100%;text-align:left;color:var(--text)';
    button.innerHTML = '<span>🔔 Notificações e interesses</span><b class="mvCount" id="mvCommunityUnread">›</b>';
    button.onclick = openInterests;
    menu.appendChild(button);
    renderInbox();
  }

  function localDate() {
    const date = new Date();
    return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
  }

  window.openMeetup = function () {
    if (!state.user?.uid) return toast('Inicia sessão para publicar um encontro.');
    openModal('<h2>Publicar na comunidade</h2><form id="mvCommunityForm" class="mvCommunityForm">'+
      '<div class="field"><label for="meetName">Título</label><input id="meetName" name="name" required maxlength="100" placeholder="Ex.: Cafezada em Sesimbra"></div>'+
      '<div class="field"><label for="meetType">Tipo</label><select id="meetType" name="category">'+
      Object.entries(labels).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></div>'+
      '<div class="field"><label for="meetLoc">Ponto de encontro</label><input id="meetLoc" name="location" required maxlength="200" placeholder="Morada ou nome do local e concelho"></div>'+
      '<div class="two"><div class="field"><label for="meetDate">Data</label><input id="meetDate" name="date" required type="date" min="'+localDate()+'"></div>'+
      '<div class="field"><label for="meetTime">Hora</label><input id="meetTime" name="time" required type="time"></div></div>'+
      '<div class="field"><label for="meetRoute">Percurso (opcional)</label><input id="meetRoute" name="route" maxlength="300" placeholder="Ex.: Chaves → Peso da Régua"></div>'+
      '<div class="field"><label for="meetDescription">Descrição (opcional)</label><textarea id="meetDescription" name="description" maxlength="1500" rows="4" placeholder="Ritmo, paragens, dificuldade ou equipamento"></textarea></div>'+
      '<label class="mvInterestLabel"><input name="notify" type="checkbox"> Avisar quem tem interesse neste tipo de encontro</label>'+
      '<button type="submit" class="btn primary full">Publicar encontro</button><p class="mvInfo" id="mvPublishStatus" role="status"></p></form>');
    const form = q('#mvCommunityForm');
    form.onsubmit = event => {
      event.preventDefault();
      if (publishForm || !form.reportValidity()) return;
      const values = new FormData(form);
      const get = key => String(values.get(key)||'').trim();
      const status = form.querySelector('#mvPublishStatus');
      if (!get('name') || !get('location')) {status.textContent='Indica o título e o ponto de encontro.';return;}
      publishForm = form;
      form.querySelector('[type="submit"]').disabled = true;
      status.textContent = 'A publicar…';
      Android.saveMeetup(JSON.stringify({name:get('name'),location:get('location'),date:get('date'),time:get('time'),
        category:get('category'),type:labels[get('category')],route:get('route'),description:get('description'),notifyInterested:values.has('notify')}));
    };
  };

  window.onCommunityPublishFailed = function (message) {
    const form = publishForm;
    publishForm = null;
    if (form?.isConnected) {
      form.querySelector('[type="submit"]').disabled = false;
      form.querySelector('#mvPublishStatus').textContent = message;
    } else toast(message);
  };

  window.onMeetupSaved = function () {
    if (publishForm?.isConnected && q('#modalWrap').classList.contains('show')) closeModal();
    publishForm = null;
    toast('Encontro publicado.');
    Android.loadMyMeetups();
    Android.loadMeetups();
  };

  const previousMeetups = window.onMeetupsLoaded;
  window.onMeetupsLoaded = function (items) {
    published = Array.isArray(items) ? items : [];
    previousMeetups?.(items);
    all('#eventList [data-meetup-id]').forEach(card => {
      const event = published.find(item=>item.id===card.dataset.meetupId);
      const row = card.querySelector('.meetRow');
      if (!event || !row) return;
      row.innerHTML = '<button type="button" class="btn secondary">Ver encontro</button>';
      row.querySelector('button').onclick = () => eventDetails(event,false);
    });
    renderInbox();
    if (openMeetupFromNotification) {
      const event = published.find(item=>item.id===openMeetupFromNotification);
      openMeetupFromNotification = null;
      if (event) eventDetails(event,false);
      else toast('Este encontro já não está disponível.');
    }
  };

  window.mvOpenCommunityMeetup = id => {
    openMeetupFromNotification = id;
    window.go('community');
  };

  window.onCommunityFeedFailed = () => {
    openMeetupFromNotification = null;
    toast('Não foi possível carregar os encontros. Verifica a ligação e tenta novamente.');
  };

  window.onCommunityLive = () => {
    if (q('#community.active') || q('#mvCommunityInbox')) Android.loadMeetups();
  };

  const previousAuth = window.onNativeAuth;
  window.onNativeAuth = function (user) {
    previousAuth?.(user);
    if (inboxUid !== (user?.uid||null)) {
      inboxUid = user?.uid||null;
      interests = {};
      seen = new Set();
      awaitingPreferences = false;
      if (inboxUid) {
        try {seen = new Set(JSON.parse(localStorage.getItem('mv_community_seen_'+inboxUid)||'[]'));}
        catch (error) { /* Start with no locally read notifications. */ }
      }
    }
    installProfileEntry();
    Android.getCommunityPreferences();
  };

  const previousGo = window.go;
  window.go = function (screen, element) {
    previousGo?.(screen,element);
    if (screen==='explore') updateDirectoryLocation();
    if (screen==='profile') {installProfileEntry();Android.getCommunityPreferences();}
  };
  window.addEventListener('mvLocationChanged',updateDirectoryLocation);
  installDirectory('exploreOficinas','Oficinas de motas','workshop');
  installDirectory('exploreStands','Stands e concessionários','stand');
  installProfileEntry();
})();
