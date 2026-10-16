const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
const names=()=>p.$$eval('.page:nth-child(3) .it b',e=>e.map(x=>x.textContent));
console.log('before',(await names()).slice(0,3));
const items=await p.$$('.page:nth-child(3) .it');const a=await items[0].boundingBox(),bb=await items[2].boundingBox();
let x=a.x+a.width/2,y=a.y+a.height/2;await T('touchStart',x,y);await p.waitForTimeout(500);
for(let i=1;i<=15;i++){await T('touchMove',x,y+(bb.y+bb.height-y)*i/15);await p.waitForTimeout(30)}
await p.waitForTimeout(300);await T('touchEnd');await p.waitForTimeout(500);console.log('after reorder',(await names()).slice(0,3));
// sideways: drag first item to right edge (RTL prev page = כללי)
const f=await (await p.$('.page:nth-child(3) .it')).boundingBox();x=f.x+f.width/2;y=f.y+f.height/2;const nm=(await names())[0];
await T('touchStart',x,y);await p.waitForTimeout(500);for(let i=1;i<=10;i++){await T('touchMove',x+(410-x)*i/10,y);await p.waitForTimeout(30)}
await p.waitForTimeout(1200);await T('touchMove',405,y+5);await T('touchMove',200,300);await p.waitForTimeout(300);await T('touchEnd');await p.waitForTimeout(800);
const pg=await p.evaluate(n=>JSON.parse(localStorage.ran_items_v2).find(t=>t.name==n).page,nm);console.log('sideways moved',nm,'->',pg);
for(const [j,n] of [[0,'ran'],[1,'gen'],[2,'work']]){await p.evaluate(j=>go(j,1),j);await p.waitForTimeout(500);await p.screenshot({path:`page_${n}.png`})}
await p.evaluate(()=>{const t=JSON.parse(localStorage.ran_items_v2);mvTo(t[t.length-1].id,'trash')});await p.evaluate(()=>go(3,1));await p.waitForTimeout(500);await p.click('.page:nth-child(4) .dots3');await p.waitForTimeout(300);await p.screenshot({path:'page_trash.png'});
await b.close()})();
