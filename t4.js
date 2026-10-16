const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(2000);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
const pageOf=n=>p.evaluate(n=>JSON.parse(localStorage.ran_items_v2).find(t=>t.name==n).page,n),cur=()=>p.evaluate(()=>curPage);
const first=()=>p.$eval('.page:nth-child(3) .it b',e=>e.textContent);
const box=async()=>{const r=await (await p.$('.page:nth-child(3) .it')).boundingBox();return [r.x+r.width/2,r.y+r.height/2]};
await p.screenshot({path:'v4_work.png'});
// 1 horizontal swipe starting on a task changes page, task stays
let n=await first(),[x,y]=await box();await T('touchStart',x,y);for(let i=1;i<=12;i++){await T('touchMove',x+20*i,y);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(1200);
console.log('swipe on task: page 2 ->',await cur(),'| task still',await pageOf(n));
await p.evaluate(()=>go(2,1));await p.waitForTimeout(500);
// 2 long-press + drag to left edge -> moves to next page (זבל)
n=await first();[x,y]=await box();await T('touchStart',x,y);await p.waitForTimeout(550);for(let i=1;i<=12;i++){await T('touchMove',x-(x-15)*i/12,y);await p.waitForTimeout(25)}
await p.waitForTimeout(1000);await T('touchMove',14,y+4);await T('touchMove',200,250);await T('touchMove',201,252);await p.waitForTimeout(400);await T('touchEnd');await p.waitForTimeout(800);
console.log('long-press drag left edge:',n,'->',await pageOf(n),'curPage',await cur());
// undo
await p.evaluate(()=>undo());await p.waitForTimeout(300);console.log('after undo ->',await pageOf(n));
await p.evaluate(()=>go(2,1));await p.waitForTimeout(500);
// 3 reorder
const names=()=>p.$$eval('.page:nth-child(3) .it b',e=>e.map(x=>x.textContent));const bef=(await names())[0];
{const its=await p.$$('.page:nth-child(3) .it');const a=await its[0].boundingBox(),z=await its[2].boundingBox();x=a.x+a.width/2;y=a.y+a.height/2;await T('touchStart',x,y);await p.waitForTimeout(550);for(let i=1;i<=15;i++){await T('touchMove',x,y+(z.y+z.height-y)*i/15);await p.waitForTimeout(30)}await p.waitForTimeout(300);await T('touchEnd');await p.waitForTimeout(600)}
console.log('reorder: index of first now',(await names()).indexOf(bef));await p.screenshot({path:'v4_toast.png'});
await p.evaluate(()=>undo());console.log('undo reorder: index',(await names()).indexOf(bef));
// 4 tap opens menu, backdrop closes
[x,y]=await box();await p.touchscreen.tap(x,y);await p.waitForTimeout(500);console.log('menu open',await p.evaluate(()=>menu.open));await p.screenshot({path:'v4_menu.png'});
await p.touchscreen.tap(200,150);await p.waitForTimeout(300);console.log('after backdrop tap open?',await p.evaluate(()=>menu.open));
// 5 edit with notes + attachment
await p.evaluate(()=>edit(I.find(t=>t.page=='work').id));await p.waitForTimeout(300);
await p.fill('textarea[name=notes]','לתאם מדידה בבוקר');await p.setInputFiles('#upl',{name:'quote.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1')});
await p.setInputFiles('#cap','icon192.png');await p.waitForTimeout(600);await p.screenshot({path:'v4_edit.png'});
await p.click('.btn.p');await p.waitForTimeout(500);await p.screenshot({path:'v4_card_ind.png'});
console.log('saved att count',await p.evaluate(()=>I.find(t=>t.page=='work').att.length),'idb',await p.evaluate(async()=>(await idb('get',I.find(t=>t.page=='work').att[0].id)).size));
await p.evaluate(()=>go(1,1));await p.waitForTimeout(500);await p.screenshot({path:'v4_gen.png'});
await b.close()})();
