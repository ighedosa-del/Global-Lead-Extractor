import express from 'express';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'30kb'}));app.use(express.static(path.join(__dirname,'public')));
const countries={CA:'Canada',US:'United States',NG:'Nigeria',GB:'United Kingdom',IN:'India',DE:'Germany',FR:'France',ZA:'South Africa',GH:'Ghana',KE:'Kenya',AE:'United Arab Emirates',AU:'Australia',BR:'Brazil',JP:'Japan',SG:'Singapore'};
const industries={manufacturing:['industrial','manufacturing'],agriculture:['agricultural','farm'],technology:['it','software'],retail:['retail','shop'],hospitality:['hotel','restaurant'],healthcare:['healthcare','clinic'],construction:['construction','contractor'],logistics:['logistics','transport'],finance:['financial','bank']};
const tagFilters={manufacturing:'["industrial"="factory"]',agriculture:'["landuse"="farmyard"]',technology:'["office"="it"]',retail:'["shop"]',hospitality:'["tourism"="hotel"]',healthcare:'["amenity"="clinic"]',construction:'["office"="construction_company"]',logistics:'["office"="logistics"]',finance:'["amenity"="bank"]'};
const cache=new Map();let lastRequest=0;
const overpassEndpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
function clean(v){return typeof v==='string'?v.trim().slice(0,240):''}
function extractEmail(tags){const raw=tags['contact:email']||tags.email||'';return clean(raw.split(/[;,\s]/)[0]).toLowerCase()}
function normalize(item,industry,country){const t=item.tags||{};const email=extractEmail(t);const website=clean(t['contact:website']||t.website);const phone=clean(t['contact:phone']||t.phone);return {id:`${item.type}-${item.id}`,company:clean(t.name||t.brand||t.operator||'Unnamed business'),industry,country,address:clean([t['addr:street'],t['addr:city'],t['addr:state']].filter(Boolean).join(', ')),email,phone,website,role:'Not provided',emailStatus:email?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'Syntax valid (not verified)':'Invalid syntax':'Not listed',source:`https://www.openstreetmap.org/${item.type}/${item.id}`}}
app.get('/api/options',(_,res)=>res.json({countries,industries:Object.keys(industries)}));
app.get('/api/search',async(req,res)=>{try{
 const country=clean(req.query.country).toUpperCase(),industry=clean(req.query.industry).toLowerCase();
 const limit=Math.min(500,Math.max(1,Number(req.query.limit)||100));
 if(!countries[country]||!industries[industry])return res.status(400).json({error:'Select a supported country and industry.'});
 const key=`${country}:${industry}:${limit}`;const hit=cache.get(key);
 if(hit&&Date.now()-hit.at<15*60*1000)return res.json({...hit.value,cached:true});
 if(Date.now()-lastRequest<3000)return res.status(429).json({error:'Please wait 3 seconds between searches to respect public provider limits.'});
 lastRequest=Date.now();
 // OSM data is uneven. Search for tagged businesses by industry and include only genuine named records.
 const filters={manufacturing:'["industrial"="factory"]',agriculture:'["landuse"="farmyard"]',technology:'["office"="it"]',retail:'["shop"]',hospitality:'["tourism"="hotel"]',healthcare:'["amenity"="clinic"]',construction:'["office"="construction_company"]',logistics:'["office"="logistics"]',finance:'["amenity"="bank"]'};
 const query=`[out:json][timeout:35];area["ISO3166-1"="${country}"][admin_level=2]->.searchArea;nwr${filters[industry]}(area.searchArea)[name];out center ${limit};`;
 let data=null,errors=[];
 for(const endpoint of overpassEndpoints){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'LZNGlobalLeads/2.0'},body:new URLSearchParams({data:query}),signal:controller.signal});
   if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();if(!Array.isArray(data.elements))throw Error('Invalid provider response');break;
  }catch(e){errors.push(`${new URL(endpoint).hostname}: ${e.name==='AbortError'?'timeout':e.message}`)}finally{clearTimeout(timer)}
 }
 if(!data)return res.status(502).json({error:'All public data providers failed. Try again later.',diagnostics:errors});
 const leads=[...new Map(data.elements.map(x=>normalize(x,industry,country)).filter(x=>x.company!=='Unnamed business').map(x=>[x.id,x])).values()];
 const value={leads,count:leads.length,notice:'Public OSM listings only. Emails are NOT verified unless checked separately. Some categories/countries may have few mapped records.',attribution:'© OpenStreetMap contributors (ODbL)'};
 cache.set(key,{at:Date.now(),value});res.json(value);
 }catch(err){res.status(500).json({error:'Search error: '+err.message})}});
app.post('/api/check-email',async(req,res)=>{const email=clean(req.body?.email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.json({status:'Invalid format'});try{const mx=await dns.resolveMx(email.split('@')[1]);res.json({status:mx.length?'Domain accepts mail (MX exists; mailbox unverified)':'No MX records'})}catch{res.json({status:'MX lookup failed; mailbox unverified'})}});
app.get('/api/health',(_,res)=>res.json({ok:true}));app.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('LZ-N Lead Extractor listening'));
