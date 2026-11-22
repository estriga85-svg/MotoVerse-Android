const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();
const categories = new Set(['cafezada','passeio','en2','tour','trilho','trackday']);
const placesKey = defineSecret('MOTOVERSE_PLACES_API_KEY');
const region = 'europe-west1';

exports.notifyCommunityInterests = onDocumentCreated({ document:'meetups/{id}', region, maxInstances: 4 }, async event => {
  const meetup = event.data?.data();
  if (!meetup || meetup.status!=='active' || meetup.notifyInterested!==true || !categories.has(meetup.category)
      || !/^[A-Za-z0-9_-]{1,130}$/.test(meetup.organizerUid || '') || typeof meetup.createdAt?.toMillis!=='function') return;
  const created = meetup.createdAt.toMillis();
  if (Math.abs(created-Date.parse(event.time)) > 120000) return;

  const rate = db.collection('_functionLimits').doc('community_'+meetup.organizerUid);
  const day = new Date(created).toISOString().slice(0,10);
  const allowed = await db.runTransaction(async tx => {
    const current = (await tx.get(rate)).data();
    const count = current?.day===day ? current.count : 0;
    if (count >= 12) return false;
    tx.set(rate,{day,count:count+1,updatedAt:FieldValue.serverTimestamp()});
    return true;
  });
  if (!allowed) return;
  await getMessaging().send({
    topic: 'mv_community_'+meetup.category,
    android: {priority:'high',ttl:24*60*60*1000},
    data: {
      kind:'community', id:event.params.id, category:meetup.category, createdAt:String(created),
      name:String(meetup.name||'Novo encontro').slice(0,100),
      location:String(meetup.location||'').slice(0,200), organizer:meetup.organizerUid
    }
  });
});

function normalize(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim();
}

function sameBusiness(place, name, query, coords) {
  const candidate = normalize(place.displayName?.text);
  const wanted = normalize(name);
  if (!candidate || !wanted) return false;
  if (candidate!==wanted && !(' '+candidate+' ').includes(' '+wanted+' ') && !(' '+wanted+' ').includes(' '+candidate+' ')) return false;
  if (coords) {
    const lat = place.location?.latitude;
    const lon = place.location?.longitude;
    if (!Number.isFinite(lat)||!Number.isFinite(lon)) return false;
    const delta = Math.hypot(lat-coords[0], (lon-coords[1])*Math.cos(coords[0]*Math.PI/180));
    return delta<=0.012;
  }
  const zip = query.match(/\b\d{4}-\d{3}\b/)?.[0];
  if (zip) return String(place.formattedAddress||'').includes(zip);
  const city = query.split(',').at(-2);
  return Boolean(city && normalize(city).length>=3 && normalize(place.formattedAddress).includes(normalize(city)));
}

exports.directoryGoogleRating = onRequest({ region, secrets:[placesKey], timeoutSeconds:20, maxInstances:4 }, async (req,res) => {
  res.set('Cache-Control','no-store');
  if (req.method!=='POST') return res.sendStatus(405);
  const token = req.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  let uid;
  try {uid=(await getAuth().verifyIdToken(token||'')).uid;}
  catch (error) {return res.sendStatus(401);}
  const {query,name,coordinates} = req.body || {};
  if (typeof query!=='string'||typeof name!=='string'||typeof coordinates!=='string' ||
      !query.trim() || query.length>350 || !name.trim() || name.length>160 || coordinates.length>45) return res.sendStatus(400);
  let coords = null;
  if (coordinates) {
    const numbers=coordinates.split(',').map(Number);
    if (numbers.length!==2 || !numbers.every(Number.isFinite) || numbers[0]<30 || numbers[0]>43 || numbers[1]<-32 || numbers[1]>-6) return res.sendStatus(400);
    coords=numbers;
  }

  const rate = db.collection('_functionLimits').doc('places_'+uid);
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0,10);
  const minute = Math.floor(now/60000);
  const allowed = await db.runTransaction(async tx => {
    const current = (await tx.get(rate)).data();
    const dailyCount = current?.day===day ? current.dailyCount : 0;
    const minuteCount = current?.minute===minute ? current.minuteCount : 0;
    if (dailyCount>=50 || minuteCount>=6) return false;
    tx.set(rate,{day,minute,dailyCount:dailyCount+1,minuteCount:minuteCount+1,updatedAt:FieldValue.serverTimestamp()});
    return true;
  });
  if (!allowed) return res.sendStatus(429);

  try {
    const body = {textQuery:query, languageCode:'pt-PT', regionCode:'PT', maxResultCount:5};
    if (coords) body.locationBias={circle:{center:{latitude:coords[0],longitude:coords[1]},radius:1000}};
    const response = await fetch('https://places.googleapis.com/v1/places:searchText',{
      method:'POST', signal:AbortSignal.timeout(9000),
      headers:{'Content-Type':'application/json','X-Goog-Api-Key':placesKey.value(),
        'X-Goog-FieldMask':'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount'},
      body:JSON.stringify(body)
    });
    if (!response.ok) return res.sendStatus(502);
    const {places=[]}=await response.json();
    const matching=places.filter(place=>sameBusiness(place,name,query,coords));
    if (matching.length!==1 || !Number.isFinite(matching[0].rating) || !Number.isInteger(matching[0].userRatingCount)) return res.sendStatus(204);
    return res.json({rating:matching[0].rating,count:matching[0].userRatingCount});
  } catch (error) {
    return res.sendStatus(502);
  }
});
