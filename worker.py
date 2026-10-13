
import json,sys,subprocess,tempfile,os,signal
country,bbox_json,max_records=sys.argv[1:4]
bbox=json.loads(bbox_json)
with tempfile.TemporaryDirectory() as td:
 output=os.path.join(td,"places.geojsonseq")
 command=["overturemaps","download","--type=place","--bbox="+",".join(map(str,bbox)),"-f","geojsonseq","-o",output]
 p=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
 try:
  _,stderr=p.communicate(timeout=240)
 except subprocess.TimeoutExpired:
  p.kill();p.communicate();print("Overture download exceeded 240 seconds",file=sys.stderr);sys.exit(2)
 if p.returncode:
  print((stderr or "Download failed")[-3000:],file=sys.stderr);sys.exit(p.returncode)
 n=0
 with open(output,encoding="utf-8") as f:
  for line in f:
   if n>=int(max_records):break
   try:
    feature=json.loads(line)
    prop=feature.get("properties") or {}
    name=prop.get("names") or {}
    title=name.get("primary") if isinstance(name,dict) else None
    if not title:continue
    def first(v):
     if isinstance(v,list):
      if not v:return ""
      x=v[0]
      return x.get("value","") if isinstance(x,dict) else str(x)
     return str(v or "")
    websites=first(prop.get("websites"))
    emails=first(prop.get("emails"))
    phones=first(prop.get("phones"))
    category=str(prop.get("basic_category") or "other")
    sources=prop.get("sources") or []
    source=first(sources)
    obj={"id":"overture:"+str(prop.get("id") or feature.get("id") or f"{country}:{title}:{websites}"),
      "company":title,"country":country,"industry":category,"address":"","email":emails,
      "phone":phones,"website":websites,"source":"https://docs.overturemaps.org/",
      "provider":"Overture Maps Places","emailStatus":"Source-listed; mailbox not verified"}
    print(json.dumps(obj,ensure_ascii=False),flush=True);n+=1
   except Exception as e:print("Skip malformed record: "+str(e),file=sys.stderr)
