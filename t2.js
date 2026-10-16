const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(2000);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
const pageOf=n=>p.evaluate(n=>JSON.parse(localStorage.ran_items_v2).find(t=>t.name==n).page,n);
const cur=()=>p.evaluate(()=>curPage);
async function swipe(sel,dx,dy=0,steps=12){const r=await (await p.$(sel)).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;await T('touchStart',x,y);for(let i=1;i<=steps;i++){await T('touchMove',x+dx*i/steps,y+dy*i/steps);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(800)}
let n=await p.$eval('.page:nth-child(3) .it b',e=>e.textContent);
await swipe('.page:nth-child(3) .it',-250);console.log('swipe left on work card:',n,'->',await pageOf(n),'curPage',await cur());
n=await p.$eval('.page:nth-child(3) .it b',e=>e.textContent);
await swipe('.page:nth-child(3) .it',250);console.log('swipe right on work card:',n,'->',await pageOf(n));
n=await p.$eval('.page:nth-child(3) .it b',e=>e.textContent);
await swipe('.page:nth-child(3) .it',-60);console.log('short swipe springs back:',n,'->',await pageOf(n));
// reorder long-press
const names=()=>p.$$eval('.page:nth-child(3) .it b',e=>e.map(x=>x.textContent));const bef=(await names())[0];
{const its=await p.$$('.page:nth-child(3) .it');const a=await its[0].boundingBox(),z=await its[2].boundingBox();let x=a.x+a.width/2,y=a.y+a.height/2;await T('touchStart',x,y);await p.waitForTimeout(500);for(let i=1;i<=15;i++){await T('touchMove',x,y+(z.y+z.height-y)*i/15);await p.waitForTimeout(30)}await p.waitForTimeout(300);await T('touchEnd');await p.waitForTimeout(600)}
console.log('reorder: first was',bef,'now index',(await names()).indexOf(bef));
// empty-space swipe changes page
await T('touchStart',200,820);for(let i=1;i<=10;i++){await T('touchMove',200+20*i,820);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(1200);console.log('empty swipe right: page',await cur());
for(const [j,k] of [[0,'ran'],[1,'gen'],[2,'work'],[3,'trash']]){await p.evaluate(j=>go(j,1),j);await p.waitForTimeout(600);await p.screenshot({path:'v3_'+k+'.png'})}
await p.evaluate(()=>go(2,1));const r=await (await p.$('.page:nth-child(3) .it')).boundingBox();await T('touchStart',r.x+200,r.y+30);for(let i=1;i<=6;i++){await T('touchMove',r.x+200-20*i,r.y+30);await p.waitForTimeout(16)}await p.screenshot({path:'v3_swiping.png'});await T('touchEnd');
await b.close()})();
