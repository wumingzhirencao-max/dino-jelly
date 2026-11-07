const http=require('http'),fs=require('fs'),path=require('path');
// ── 调参存档：GET /api/tuning 读、POST /api/tuning 写（文件 tuning.json，与本文件同目录）──
const TUNING=path.join(__dirname,'tuning.json');
function readTuning(){try{return JSON.parse(fs.readFileSync(TUNING,'utf8'))}catch(e){return{}}}
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
if(name==='/api/tuning'){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(readTuning()));return}
  if(req.method==='POST'){let body='';req.on('data',c=>{body+=c;if(body.length>200000)req.destroy()});
    req.on('end',()=>{try{const j=JSON.parse(body||'{}');const cur=readTuning();
      const merge=(k)=>(j[k]?{[k]:Object.assign({},cur[k]||{},j[k])}:{});
      const next=Object.assign({},cur,merge('smk'),merge('caus'),merge('defSmk'),merge('defCaus'));
      try{fs.writeFileSync(TUNING,JSON.stringify(next,null,1))}catch(e){}   /* 同步写：并发 POST 不会互相截断（异步写会写出半个 JSON） */res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({ok:true,file:'tuning.json'}))}
    catch(e){res.writeHead(400).end('bad json')}});
    return}
  res.writeHead(405).end();return}
const file=path.resolve(__dirname,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(__dirname+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data)})}).listen(8795,'127.0.0.1',()=>console.log('Dino Jelly: http://127.0.0.1:8795'));
