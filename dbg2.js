const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7']});await c.addInitScript(()=>localStorage.onb=1);const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
await p.evaluate(()=>{window.L=[];document.addEventListener('touchmove',e=>L.push([dragging,dragX0,Math.round(e.touches[0].clientX),curPage]),{capture:true,passive:true})});
const r=await (await p.$('.page:nth-child(3) .it')).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;await T('touchStart',x,y);await p.waitForTimeout(500);
for(let i=1;i<=20;i++){await T('touchMove',x-140*i/20,y+i);await p.waitForTimeout(20)}await T('touchEnd');
console.log(await p.evaluate(()=>{try{dragging=true;dragX0=300;dragMove(100);return [curPage,hintEl.className]}catch(e){return e.message}}));await b.close()})();
