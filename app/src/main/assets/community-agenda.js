(function () {
  'use strict';

  const q = selector => document.querySelector(selector);
  const events = Array.isArray(window.mvAgendaEvents) ? window.mvAgendaEvents : [];
  const categories = {
    convivio:'Cafezadas e convívios', passeio:'Passeios', concentracao:'Concentrações', solidario:'Solidariedade',
    foto:'Fotografia', trilho:'Off-road e enduro', tour:'Tours e moto-ralis', circuito:'Circuito', salao:'Salões e feiras'
  };
  const statuses = {
    announced:'Anunciado', listed:'Divulgado em agenda', provisional:'A confirmar',
    recurring:'Recorrente', unscheduled:'Sem data marcada'
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT');
  const dateFormat = new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'short',year:'numeric'});
  const dateText = value => dateFormat.format(new Date(value+'T12:00:00'));
  const fullDate = event => event.date ? dateText(event.date) +
    (event.endDate && event.endDate!==event.date ? ' – '+dateText(event.endDate) : '') :
    event.cadence || 'Data por anunciar';
  const localToday = () => {
    const now = new Date();
    return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  };
  const agenda = q('#mvAgenda');
  const posts = q('#mvCommunityPosts');
  const scheduleTab = q('#mvAgendaTab');
  const postsTab = q('#mvCommunityPostsTab');
  let pageLimit = 20;

  function showTab(isAgenda) {
    agenda.hidden = !isAgenda;
    posts.hidden = isAgenda;
    scheduleTab.classList.toggle('active',isAgenda);
    postsTab.classList.toggle('active',!isAgenda);
    scheduleTab.setAttribute('aria-pressed',String(isAgenda));
    postsTab.setAttribute('aria-pressed',String(!isAgenda));
    if (isAgenda) render();
  }

  window.mvShowCommunityPosts = () => showTab(false);
  window.mvShowCommunityAgenda = () => showTab(true);
  window.mvOpenAgendaEvent = id => {
    const item = events.find(event=>event.id===id);
    if (!item) return;
    const hasLocation = Boolean(item.location);
    const description = item.description ? '<p class="mvInfo">'+escape(item.description)+'</p>' : '';
    openModal('<h2>'+escape(item.name)+'</h2>'+
      '<p class="mvInfo">'+escape([statuses[item.status],categories[item.type]].filter(Boolean).join(' · '))+'</p>'+
      '<p class="mvInfo"><strong>'+escape(fullDate(item))+'</strong>'+(item.time?' · '+escape(item.time):'')+'</p>'+
      '<p class="mvInfo">'+escape(item.location||'Local a anunciar')+'</p>'+
      (item.organizerName?'<p class="mvInfo">Organização: '+escape(item.organizerName)+'</p>':'')+description+
      '<button class="btn primary full" type="button" id="mvAgendaSource">Ver fonte e detalhes · '+escape(item.sourceName)+'</button>'+
      (hasLocation ? '<button class="btn secondary full" type="button" id="mvAgendaWaze" style="margin-top:8px">Viajar com Waze</button>':''));
    q('#mvAgendaSource').onclick = () => Android.openBusinessLink(item.url);
    if (hasLocation) q('#mvAgendaWaze').onclick = () => Android.openWaze(item.location+', Portugal','');
  };

  function render() {
    const today = localToday();
    const year = q('#mvAgendaYear').value;
    const type = q('#mvAgendaType').value;
    const search = normalize(q('#mvAgendaSearch').value.trim());
    const selected = events.filter(item => {
      if (year==='next' && item.date && (item.endDate||item.date)<today) return false;
      if (year==='recurring' && item.date) return false;
      if (year==='2026' || year==='2027') {
        if (!item.date && String(item.year)!==year) return false;
        if (item.date && !item.date.startsWith(year)) return false;
      }
      if (type && item.type!==type) return false;
      return !search || normalize([item.name,item.location,item.organizerName,categories[item.type]].join(' ')).includes(search);
    });
    q('#mvAgendaCount').textContent = selected.length+(selected.length===1?' resultado':' resultados');
    const list = q('#mvAgendaList');
    list.innerHTML = selected.length ? selected.slice(0,pageLimit).map(item => {
      const meta = [fullDate(item),item.time,item.location].filter(Boolean).join(' · ');
      return '<button type="button" class="mvDirectoryCard" data-mv-agenda-event="'+escape(item.id)+'"><strong>'+escape(item.name)+'</strong>'+
        '<small>'+escape(meta)+'</small><small>'+escape([categories[item.type],statuses[item.status],item.sourceName].join(' · '))+'</small></button>';
    }).join('') : '<div class="empty">Sem eventos para estes filtros.</div>';
    list.querySelectorAll('[data-mv-agenda-event]').forEach(button=>{
      button.onclick = () => window.mvOpenAgendaEvent(button.dataset.mvAgendaEvent);
    });
    q('#mvAgendaMore').hidden = selected.length<=pageLimit;
  }

  q('#mvAgendaType').insertAdjacentHTML('beforeend',Object.entries(categories)
    .map(([key,value])=>'<option value="'+key+'">'+value+'</option>').join(''));
  const filter = () => {pageLimit=20;render();};
  q('#mvAgendaYear').onchange=filter;
  q('#mvAgendaType').onchange=filter;
  q('#mvAgendaSearch').oninput=filter;
  q('#mvAgendaMore').onclick=()=>{pageLimit+=20;render();};
  scheduleTab.onclick=window.mvShowCommunityAgenda;
  postsTab.onclick=window.mvShowCommunityPosts;
  render();
})();
