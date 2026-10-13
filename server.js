
import express from 'express';
import dns from 'node:dns/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=express(), root=path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');app.use(express.json({limit:'20kb'}));app.use(express.static(path.join(root,'public')));
const countries={CA:'Canada',US:'United States',NG:'Nigeria',GB:'United Kingdom',IN:'India',DE:'Germany',FR:'France',ZA:'South Africa',GH:'Ghana',KE:'Kenya',AE:'United Arab Emirates',AU:'Australia',BR:'Brazil',JP:'Japan',SG:'Singapore'};
const industries=['manufacturing','agriculture','technology','retail','hospitality','healthcare','construction','logistics','finance'];
// Small metro bounding boxes (south,west,north,east), not whole-country queries.
const metros={
 NG:[['Lagos',[6.44,3.32,6.60,3.52]],['Abuja',[9.00,7.39,9.12,7.56]]],
 CA:[['Toronto',[43.62,-79.46,43.73,-79.32]],['Montreal',[45.47,-73.65,45.56,-73.53]]],
 US:[['New York',[40.70,-74.02,40.80,-73.91]],['Los Angeles',[34.00,-118.31,34.10,-118.20]]],
 GB:[['London',[51.47,-0.17,51.55,-0.06]],['Manchester',[53.44,-2.29,53.51,-2.19]]],
 IN:[['Mumbai',[18.94,72.79,19.06,72.91]],['Delhi',[28.59,77.16,28.70,77.28]]],
 DE:[['Berlin',[52.47,13.35,52.56,13.48]]],FR:[['Paris',[48.82,2.29,48.89,2.39]]],
 ZA:[['Johannesburg',[-26.24,28.00,-26.15,28.10]]],GH:[['Accra',[5.54,-0.24,5.63,-0.13]]],
 KE:[['Nairobi',[-1.33,36.78,-1.24,36.89]]],AE:[['Dubai',[25.17,55.23,25.28,55.36]]],
 AU:[['Sydney',[-33.91,151.16,-33.82,151.26]]],BR:[['Sao Paulo',[-23.61,-46.70,-23.52,-46.60]]],
 JP:[['Tokyo',[35.64,139.68,35.73,139.81]]],SG:[['Singapore',[1.27,103.79,1.36,103.90]]]
};
const tags={
 manufacturing:['["industrial"="factory"]','["craft"]'],agriculture:['["shop"="agrarian"]','["landuse"="farmyard"]'],
 technology:['["office"="it"]','["shop"="computer"]'],retail:['["shop"]'],hospitality:['["tourism"="hotel"]','["amenity"="restaurant"]'],
 healthcare:['["amenity"="clinic"]','["amenity"="pharmacy"]'],construction:['["office"="construction_company"]','["craft"="builder"]'],
 logistics:['["office"="logistics"]','["amenity"="post_office"]'],finance:['["amenity"="bank"]','["office"="financial"]']
};
const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
const cache=new Map();let nextAllowed=0;
const clean=v=>typeof v==='string'?v.trim().slice(0,300):'';
const emailOf=t=>clean(t['contact:email']||t.email||'').split(/[;,\s]/)[0].toLowerCase();
function osmLead(x,industry,country,city){
 const t=x.tags||{},email=emailOf(t),name=clean(t.name||t.brand||t.operator);
 if(!name)return null;
 return {id:`osm:${x.type}:${x.id}`,company:name,industry,country,city,address:clean([t['addr:housenumber'],t['addr:street'],t['addr:city']||city].filter(Boolean).join(' ')),email,phone:clean(t['contact:phone']||t.phone),website:clean(t['contact:website']||t.website),role:'Not provided',emailStatus:email?'Published; mailbox unverified':'Not listed',source:`https://www.openstreetmap.org/${x.type}/${x.id}`,provider:'OpenStreetMap'};
}
async function requestJson(url,options={},timeout=12000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try {const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json();}
 finally{clearTimeout(timer);}
}
async function osmSearch(country,industry,metro,limit,diagnostics){
 const [city,bbox]=metro;const bounds=bbox.join(',');
 const selectors=tags[industry].map(t=>`nwr${t}(${bounds})["name"];`).join('');
 const query=`[out:json][timeout:20];(${selectors});out center ${Math.min(limit,250)};`;
 for(const endpoint of endpoints){
  try{
   const data=await requestJson(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query})},11000);
   if(!Array.isArray(data.elements))throw Error('Missing elements');
   diagnostics.push(`${new URL(endpoint).hostname}: ${data.elements.length} map records (${city})`);
   return data.elements.map(x=>osmLead(x,industry,country,city)).filter(Boolean);
  }catch(e){diagnostics.push(`${new URL(endpoint).hostname}: ${e.name==='AbortError'?'timeout':e.message} (${city})`);}
 }
 return [];
}
async function googleSearch(country,industry,city,limit,diagnostics){
 const key=process.env.GOOGLE_PLACES_API_KEY;
 if(!key)return [];
 const found=[];let token;
 for(let page=0;page<Math.min(3,Math.ceil(limit/20));page++){
  const body={textQuery:`${industry} businesses in ${city}, ${countries[country]}`,pageSize:Math.min(20,limit-found.length)};
  if(token)body.pageToken=token;
  try{
   const data=await requestJson('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,nextPageToken'},body:JSON.stringify(body)},15000);
   for(const p of data.places||[])found.push({id:`google:${p.id}`,company:clean(p.displayName?.text),industry,country,city,address:clean(p.formattedAddress),email:'',phone:clean(p.nationalPhoneNumber),website:clean(p.websiteUri),role:'Not provided',emailStatus:'Not listed',source:`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.id)}`,provider:'Google Places'});
   token=data.nextPageToken;if(!token)break;
  }catch(e){diagnostics.push(`Google Places: ${e.message}`);break;}
 }
 diagnostics.push(`Google Places: ${found.length} records (${city})`);return found;
}
app.get('/api/options',(_,res)=>res.json({countries,industries,metros:Object.fromEntries(Object.entries(metros).map(([c,m])=>[c,m.map(x=>x[0])]))}));
app.get('/api/health',(_,res)=>res.json({ok:true,version:3,googlePlacesConfigured:Boolean(process.env.GOOGLE_PLACES_API_KEY)}));
app.get('/api/search',async(req,res)=>{
 const country=clean(req.query.country).toUpperCase(),industry=clean(req.query.industry).toLowerCase(),city=clean(req.query.city);
 const limit=Math.min(500,Math.max(1,parseInt(req.query.limit,10)||100));
 if(!countries[country]||!industries.includes(industry))return res.status(400).json({error:'Unsupported country or industry.'});
 const available=metros[country],metro=available.find(m=>m[0]===city)||available[0];
 const key=[country,industry,metro[0],limit,Boolean(process.env.GOOGLE_PLACES_API_KEY)].join(':');
 const hit=cache.get(key);if(hit&&Date.now()-hit.time<600000)return res.json({...hit.value,cached:true});
 if(Date.now()<nextAllowed)return res.status(429).json({error:'Please wait 5 seconds between searches.'});
 nextAllowed=Date.now()+5000;
 const diagnostics=[];console.log('SEARCH',country,industry,metro[0],limit);
 try{
  const google=await googleSearch(country,industry,metro[0],limit,diagnostics);
  const osm=google.length>=limit?[]:await osmSearch(country,industry,metro,limit-google.length,diagnostics);
  const leads=[...new Map([...google,...osm].map(x=>[x.id,x])).values()].slice(0,limit);
  const value={leads,count:leads.length,diagnostics,notice:leads.length?'These are published business listings, not verified email recipients.':'No records returned. Try a different city/industry or configure GOOGLE_PLACES_API_KEY for an additional provider.',attribution:'© OpenStreetMap contributors (ODbL); Google Places data subject to Google Maps Platform terms'};
  console.log('RESULT',leads.length,diagnostics.join(' | '));cache.set(key,{time:Date.now(),value});
  return res.json(value);
 }catch(e){console.error('SEARCH ERROR',e);return res.status(502).json({error:'Provider search failed',diagnostics:[...diagnostics,e.message]});}
});
app.post('/api/check-email',async(req,res)=>{
 const email=clean(req.body?.email).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.json({status:'Invalid format'});
 try{const mx=await dns.resolveMx(email.split('@')[1]);return res.json({status:mx.length?'Domain has MX records; mailbox NOT verified':'No MX records'});}
 catch{return res.json({status:'MX lookup unavailable; mailbox NOT verified'});}
});
app.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('LZ-N V3 Lead Extractor listening'));
