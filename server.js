
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parse} from 'csv-parse/sync';
import pg from 'pg';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
const root=path.dirname(fileURLToPath(import.meta.url)), app=express();
const countries={CA:'Canada',US:'United States',NG:'Nigeria',GB:'United Kingdom',IN:'India',DE:'Germany',FR:'France',ZA:'South Africa',GH:'Ghana',KE:'Kenya',AE:'United Arab Emirates',AU:'Australia',BR:'Brazil',JP:'Japan',SG:'Singapore'};
const industries=['manufacturing','agriculture','technology','retail','hospitality','healthcare','construction','logistics','finance','other'];
const pool=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:undefined}):null;
const boxes=JSON.parse(fs.readFileSync(path.join(root,'countries.json'),'utf8'));
const store=path.join(root,'data','leads.jsonl');fs.mkdirSync(path.dirname(store),{recursive:true});
let memory=new Map(), ready=false;
const trim=(x,n=500)=>String(x??'').trim().slice(0,n);
const field=(obj,keys)=>{for(const k of keys){const key=Object.keys(obj).find(x=>x.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(key&&obj[key]!==undefined&&obj[key]!==null&&String(obj[key]).trim())return obj[key]}return ''};
function normalize(obj,defaults){
 const company=trim(field(obj,['company','company_name','business','business_name','name','names.primary','displayName']),200);
 const country=trim(field(obj,['country','country_code','countrycode','iso_country'])||defaults.country,2).toUpperCase();
 if(!company||!countries[country])return null;
 const industry=trim(field(obj,['industry','sector','category','taxonomy.primary'])||defaults.industry||'other',80).toLowerCase();
 const email=trim(field(obj,['email','contact:email','contact_email']),200);
 const website=trim(field(obj,['website','url','contact:website']),300);
 const phone=trim(field(obj,['phone','telephone','contact:phone']),100);
 const source=trim(field(obj,['source','source_url','reference_url'])||defaults.source,500);
 const id=trim(field(obj,['id','gers_id','osm_id'])||`${country}|${company.toLowerCase()}|${website.toLowerCase()}`,350);
 return {id,company,country,industry,address:trim(field(obj,['address','formatted_address','location']),400),email,phone,website,source,provider:defaults.provider||'Imported licensed dataset',emailStatus:email?'Published/imported — mailbox not verified':'Not provided'};
}
async function initialize(){
 if(pool){await pool.query(`CREATE TABLE IF NOT EXISTS lzn_leads (id TEXT PRIMARY KEY, country TEXT NOT NULL, industry TEXT NOT NULL, company TEXT NOT NULL, data JSONB NOT NULL)`)}
 else if(fs.existsSync(store)){for(const line of fs.readFileSync(store,'utf8').split('\n')){if(!line.trim())continue;try{const x=JSON.parse(line);memory.set(x.id,x)}catch{}}}
 ready=true;
}
async function putMany(rows){
 if(pool){const client=await pool.connect();try{await client.query('BEGIN');for(const x of rows)await client.query('INSERT INTO lzn_leads(id,country,industry,company,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,country=EXCLUDED.country,industry=EXCLUDED.industry,company=EXCLUDED.company',[x.id,x.country,x.industry,x.company,x]);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
 else {for(const x of rows)memory.set(x.id,x);fs.writeFileSync(store,[...memory.values()].map(x=>JSON.stringify(x)).join('\n')+'\n')}
}
async function getRows(country,industry,limit,offset){
 if(pool){const r=await pool.query(`SELECT data FROM lzn_leads WHERE country=$1 AND ($2='all' OR industry=$2) ORDER BY company LIMIT $3 OFFSET $4`,[country,industry,limit,offset]);const count=await pool.query(`SELECT COUNT(*)::int AS n FROM lzn_leads WHERE country=$1 AND ($2='all' OR industry=$2)`,[country,industry]);return {leads:r.rows.map(x=>x.data),total:count.rows[0].n}}
 const matches=[...memory.values()].filter(x=>x.country===country&&(industry==='all'||x.industry===industry)).sort((a,b)=>a.company.localeCompare(b.company));
 return {leads:matches.slice(offset,offset+limit),total:matches.length};
}
app.disable('x-powered-by');app.use(express.static(path.join(root,'public')));
app.get('/api/options',(_,res)=>res.json({countries,industries:['all',...industries]}));
app.get('/api/health',(_,res)=>res.json({ok:ready,version:5,storage:pool?'PostgreSQL':'local JSONL (ephemeral on Render)',provider:'Overture Places automatic download + licensed dataset imports'}));
app.get('/api/search',async(req,res)=>{try{
 const country=trim(req.query.country,2).toUpperCase(),industry=trim(req.query.industry||'all',80).toLowerCase(),limit=Math.max(1,Math.min(500,Number(req.query.limit)||100)),offset=Math.max(0,Math.min(100000000,Number(req.query.offset)||0));
 if(!countries[country])return res.status(400).json({error:'Invalid country'});
 const data=await getRows(country,industry,limit,offset);
 res.json({...data,notice:data.total?'Records from imported datasets. Contact details are not independently verified.':'No records stored yet. Start the automatic collector and check its status.',storage:pool?'PostgreSQL':'local JSONL'});
 }catch(e){console.error(e);res.status(500).json({error:'Search failed; check server logs'})}});
const uploadAuth=(req,res,next)=>{const key=process.env.ADMIN_IMPORT_KEY;if(!key)return res.status(503).json({error:'Set ADMIN_IMPORT_KEY in Render environment before importing'});if(req.headers['x-admin-key']!==key)return res.status(401).json({error:'Invalid import key'});next()};
app.post('/api/import',uploadAuth,express.raw({type:['text/csv','application/json','application/geo+json'],limit:'12mb'}),async(req,res)=>{
 try{
  const country=trim(req.query.country,2).toUpperCase(),industry=trim(req.query.industry||'other',80).toLowerCase(),source=trim(req.query.source,500);
  if(!countries[country]||!source||!/^https?:\/\//.test(source))return res.status(400).json({error:'Country and original source URL required'});
  const body=req.body?.toString('utf8')||'';let objects=[];
  if(req.is('text/csv'))objects=parse(body,{columns:true,skip_empty_lines:true,bom:true,relax_column_count:true});
  else {const doc=JSON.parse(body);objects=Array.isArray(doc)?doc:doc.type==='FeatureCollection'?doc.features.map(f=>({...f.properties,...f.properties?.names, name:f.properties?.names?.primary||f.properties?.name})):[];}
  if(objects.length>25000)return res.status(413).json({error:'Maximum 25,000 records per import; split larger files'});
  const valid=objects.map(o=>normalize(o,{country,industry,source,provider:'Imported licensed dataset'})).filter(Boolean);
  await putMany(valid);console.log('IMPORT',country,objects.length,valid.length);
  res.json({received:objects.length,imported:valid.length,skipped:objects.length-valid.length,notice:'Source records imported. Emails and phones are NOT verified.'});
 }catch(e){console.error('IMPORT ERROR',e);res.status(400).json({error:e.message})}
});

let job={status:'idle',country:null,completed:0,total:0,imported:0,error:'',started:null};
let stopRequested=false, child=null;
function tilesFor(country){
 const [west,south,east,north]=boxes[country];
 // Country envelope divided into 1.5-degree cells; may include neighboring areas.
 // All records are tagged with the selected country, so warn about border leakage.
 const step=1.5, tiles=[];
 for(let y=south;y<north;y+=step)for(let x=west;x<east;x+=step)
  tiles.push([+x.toFixed(4),+y.toFixed(4),+Math.min(east,x+step).toFixed(4),+Math.min(north,y+step).toFixed(4)]);
 const cx=(west+east)/2,cy=(south+north)/2;
 tiles.sort((a,b)=>((a[0]+a[2])/2-cx)**2+((a[1]+a[3])/2-cy)**2-(((b[0]+b[2])/2-cx)**2+((b[1]+b[3])/2-cy)**2));
 return tiles;
}
async function runJob(country,startIndex){
 const tiles=tilesFor(country);job={status:'running',country,completed:startIndex,total:tiles.length,imported:0,error:'',started:new Date().toISOString()};
 for(let i=startIndex;i<tiles.length;i++){
  if(stopRequested){job.status='stopped';break}
  const bbox=tiles[i], batch=[];
  try{
   await new Promise((resolve,reject)=>{
    child=spawn('python',['worker.py',country,JSON.stringify(bbox),'4000'],{cwd:root,stdio:['ignore','pipe','pipe']});
    let err='',exitCode=null;
    const lines=readline.createInterface({input:child.stdout});
    lines.on('line',line=>{try{batch.push(JSON.parse(line))}catch{}});
    child.stderr.on('data',d=>{err=(err+d.toString()).slice(-1500)});
    child.on('error',reject);
    child.on('close',code=>{child=null;if(code===0)resolve();else reject(Error(err||`Worker exited ${code}`))});
   });
   if(batch.length)await putMany(batch);
   job.imported+=batch.length;job.completed=i+1;job.error='';
   console.log('AUTO COLLECT',country,i+1,tiles.length,batch.length);
  }catch(e){
   job.completed=i+1;job.error=`Tile ${i+1}: ${e.message}`;console.error('AUTO COLLECT ERROR',job.error);
   if(stopRequested){job.status='stopped';break}
  }
 }
 if(job.status==='running')job.status='completed';
}
app.get('/api/job',(_,res)=>res.json(job));
app.post('/api/job/start',uploadAuth,express.json({limit:'2kb'}),(req,res)=>{
 const country=trim(req.body?.country,2).toUpperCase();
 if(!boxes[country])return res.status(400).json({error:'Invalid country'});
 if(job.status==='running')return res.status(409).json({error:'Collector already running'});
 const startIndex=Math.max(0,Math.min(tilesFor(country).length-1,Number(req.body?.startIndex)||0));
 stopRequested=false;runJob(country,startIndex).catch(e=>{job.status='error';job.error=e.message;console.error(e)});
 res.json({started:true,country,startingTile:startIndex,totalTiles:tilesFor(country).length});
});
app.post('/api/job/stop',uploadAuth,(_,res)=>{
 stopRequested=true;if(child)child.kill('SIGTERM');
 res.json({stopping:true});
});

app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.type==='entity.too.large'?'File too large': 'Invalid request'}));
initialize().then(()=>app.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('LZ-N V4 free dataset engine listening'))).catch(e=>{console.error('DATABASE STARTUP ERROR',e);process.exit(1)});
