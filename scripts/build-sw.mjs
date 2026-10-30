import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function walk(path){const out=[];for(const e of await readdir(path,{withFileTypes:true})){const p=path+'/'+e.name;if(e.isDirectory())out.push(...await walk(p));else if(!p.endsWith('/sw.js'))out.push(p);}return out;}
const files=await walk('dist');
const hash=createHash('sha256');for(const f of files)hash.update(await readFile(f));
const version=hash.digest('hex').slice(0,16);
const paths=files.map(f=>'./'+f.replace(/^dist\//,''));
await writeFile('dist/sw.js',`const CACHE='gage-studio-${version}';
const FILES=${JSON.stringify(paths)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gage-studio-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match(new URL('./index.html',self.location).href)));
  else e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
`);
console.log(`Offline cache: ${paths.length} assets (${version})`);
