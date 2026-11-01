const V="hisn-v39";
const Q="hisn-q";
const CORE=["./","index.html","manifest.webmanifest","icon.png","apple-touch-icon.png"];
const FONT_CSS="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Amiri+Quran&family=Scheherazade+New:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&family=Tajawal:wght@400;700;800&family=Aref+Ruqaa:wght@400&display=swap";
const OPT={ignoreSearch:true,ignoreVary:true};

// تخزين كل ملف على حدة: غياب ملف واحد لا يُفشل التثبيت كما كان يحدث مع addAll
async function put(cache,url,mode){
  try{
    const res=await fetch(new Request(url,{cache:"reload",mode:mode||"no-cors"}));
    if(res&&(res.ok||res.type==="opaque")){await cache.put(url,res.clone());return res}
  }catch(e){}
  return null;
}

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(V);
    await Promise.all(CORE.map(u=>put(c,u,"same-origin")));
    // الخطوط: تنزيل ملف CSS ثم ملفات الخط نفسها لتعمل بدون إنترنت من أول مرة
    try{
      const r=await fetch(FONT_CSS,{mode:"cors"});
      if(r.ok){
        const css=await r.clone().text();
        await c.put(FONT_CSS,r);
        const urls=[...new Set((css.match(/https:\/\/fonts\.gstatic\.com[^)'"\s]+/g)||[]))];
        await Promise.all(urls.map(u=>put(c,u,"cors")));
      }
    }catch(e){}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==Q).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET"||r.headers.has("range"))return;
  const u=new URL(r.url);
  if(/\.mp3$/i.test(u.pathname))return;
  const font=u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com";
  if(u.origin!==location.origin&&!font)return;
  e.respondWith((async()=>{
    const store=await caches.open(/quran\.json$/.test(u.pathname)?Q:V);
    // البحث في كل الكاشات (وليس كاشاً واحداً) مع تجاهل Vary الخاص بخطوط جوجل
    const hit=await caches.match(r,OPT);
    const net=fetch(r).then(res=>{
      if(res&&(res.ok||res.type==="opaque")&&!res.redirected)store.put(r,res.clone()).catch(()=>{});
      return res;
    }).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    const res=await net;
    if(res)return res;
    if(r.mode==="navigate"){
      const f=await caches.match("index.html",OPT)||await caches.match("./",OPT);
      if(f)return f;
    }
    return new Response("",{status:504});
  })());
});
