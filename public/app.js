let leads=[];let offset=0;const $=id=>document.getElementById(id);const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const link=(url,text)=>url&&/^https?:\/\//i.test(url)?`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${safe(text)}</a>`:'—';
async function init(){try{const r=await fetch('/api/options');const data=await r.json();$('country').innerHTML=Object.entries(data.countries).map(([code,name])=>`<option value="${safe(code)}" ${code==='NG'?'selected':''}>${safe(name)}</option>`).join('');$('industry').innerHTML=data.industries.map(x=>`<option value="${safe(x)}">${safe(x[0].toUpperCase()+x.slice(1))}</option>`).join('')}catch{$('message').textContent='Unable to load options. Refresh the page.'}}function render(){const q=$('filter').value.toLowerCase();const filtered=leads.filter(l=>Object.values(l).some(v=>String(v).toLowerCase().includes(q)));$('found').textContent=leads.length;$('emails').textContent=leads.filter(l=>l.email).length;$('phones').textContent=leads.filter(l=>l.phone).length;$('resultCount').textContent=`(${filtered.length})`;$('results').innerHTML=filtered.map(l=>`<tr><td>${safe(l.company)}</td><td>${safe(l.address||l.country)}</td><td>${safe(l.email||'—')}</td><td>${safe(l.phone||'—')}</td><td>${link(l.website,'Visit ↗')}</td><td>${link(l.source,'Source ↗')}</td></tr>`).join('');}
$('search').addEventListener('submit',async e=>{e.preventDefault();$('searchBtn').disabled=true;$('searchBtn').textContent='Searching...';$('message').textContent='Searching public business listings. This can take around 45 seconds.';try{const params=new URLSearchParams({country:$('country').value,industry:$('industry').value,limit:$('limit').value,offset:0});const response=await fetch('/api/search?'+params);const data=await response.json();if(!response.ok)throw Error((data.error||'Search failed')+(data.diagnostics?' — '+data.diagnostics.join('; '):''));leads=data.leads||[];$('message').textContent=`${leads.length} businesses found. ${data.notice} Provider diagnostics: ${(data.diagnostics||[]).join(' | ')}`;render()}catch(err){$('message').textContent=err.message}finally{$('searchBtn').disabled=false;$('searchBtn').textContent='✦ Find Businesses'}});$('filter').addEventListener('input',render);$('csv').addEventListener('click',()=>{if(!leads.length){$('message').textContent='Search for businesses before exporting.';return}const fields=['company','industry','country','address','email','emailStatus','phone','website','role','source'];const esc=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/, match => '\'' + match).replace(/"/g,'""')+'"';const csv=[fields.join(','),...leads.map(l=>fields.map(f=>esc(l[f])).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));a.download='lzn-business-leads.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});init();

$('importForm').addEventListener('submit',async e=>{
 e.preventDefault();const file=$('dataFile').files[0];if(!file)return;
 const btn=$('importBtn');btn.disabled=true;$('importMessage').textContent='Importing licensed records...';
 try{
 const params=new URLSearchParams({country:$('country').value,industry:$('industry').value==='all'?'other':$('industry').value,source:$('sourceUrl').value});
 const r=await fetch('/api/import?'+params,{method:'POST',headers:{'x-admin-key':$('adminKey').value,'Content-Type':file.name.toLowerCase().endsWith('.csv')?'text/csv':'application/json'},body:await file.text()});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Import failed');
 $('importMessage').textContent=`Imported ${d.imported} records; skipped ${d.skipped}. Click Find Businesses to view. Contact information is unverified.`;
 }catch(err){$('importMessage').textContent=err.message}finally{btn.disabled=false}
});

let lastJob={};
async function refreshJob(){
 try{const r=await fetch('/api/job');lastJob=await r.json();$('jobStatus').textContent=`${lastJob.status} — Country: ${lastJob.country||'none'} · Tiles ${lastJob.completed||0}/${lastJob.total||0} · Imported this run: ${lastJob.imported||0}${lastJob.error?' · Last error: '+lastJob.error:''}`;}
 catch(e){$('jobStatus').textContent='Collector status unavailable: '+e.message}
}
async function controlJob(action,resume=false){
 const key=$('adminKey').value;if(!key){$('jobStatus').textContent='Enter your ADMIN_IMPORT_KEY in the Admin import key field below.';return}
 try{
 const body=action==='start'?JSON.stringify({country:$('country').value,startIndex:resume&&lastJob.country===$('country').value?lastJob.completed:0}):undefined;
 const r=await fetch('/api/job/'+action,{method:'POST',headers:{'x-admin-key':key,...(body?{'Content-Type':'application/json'}:{})},body});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Action failed');await refreshJob();
 }catch(e){$('jobStatus').textContent=e.message}
}
$('startJob').addEventListener('click',()=>controlJob('start'));
$('stopJob').addEventListener('click',()=>controlJob('stop'));
$('resumeJob').addEventListener('click',()=>controlJob('start',true));
refreshJob();setInterval(refreshJob,10000);
