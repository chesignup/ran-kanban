const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
await p.evaluate(()=>{const t=I.find(x=>x.page=='work');Object.assign(t,{address:'רבי עקיבא 50, בני ברק',phone:'052-2301248',notes:'מראה 99×77, לתאם מדידה',when:'2026-10-18T10:00'});save();draw()});
const pageOf=n=>p.evaluate(n=>JSON.parse(localStorage.ran_items_v2).find(t=>t.name==n).page,n),cur=()=>p.evaluate(()=>curPage);
const box=async k=>{const r=await (await p.$('.page:nth-child('+k+') .it')).boundingBox();return [r.x+r.width/2,r.y+r.height/2]};
let [x,y]=await box(3);await p.touchscreen.tap(x+60,y-25);await p.waitForTimeout(600);console.log('tap opens task sheet:',await p.evaluate(()=>dlg.open),'icons WA/cal visible:',await p.isVisible('#iWA'),await p.isVisible('#iCal'),'del visible:',await p.isVisible('#iDel'));await p.screenshot({path:'v7_task_open.png'});
await p.touchscreen.tap(200,40);await p.waitForTimeout(300);console.log('backdrop closes:',!(await p.evaluate(()=>dlg.open)));
// long-press drag to left edge -> trash
let n=await p.$eval('.page:nth-child(3) .it b',e=>e.textContent);[x,y]=await box(3);await T('touchStart',x,y);await p.waitForTimeout(550);for(let i=1;i<=12;i++){await T('touchMove',x-(x-15)*i/12,y);await p.waitForTimeout(25)}
await p.waitForTimeout(1000);await T('touchMove',14,y+4);await T('touchMove',200,250);await T('touchMove',201,252);await p.waitForTimeout(400);await T('touchEnd');await p.waitForTimeout(800);
console.log('drag to edge ->',await pageOf(n),'toast',await p.textContent('#tmsg'));
// on trash: open, icons
[x,y]=await box(4);await p.touchscreen.tap(x+60,y-15);await p.waitForTimeout(600);console.log('trash sheet: del',await p.isVisible('#iDel'),'restore',await p.isVisible('#iRes'),'WA',await p.isVisible('#iWA'));await p.screenshot({path:'v7_task_trash.png'});
await p.click('#iRes');await p.waitForTimeout(500);console.log('restore ->',await pageOf(n));
await p.evaluate(()=>undo());console.log('undo ->',await pageOf(n));
// long-press drag from trash to right edge -> restore (prev page עבודה)
await p.evaluate(()=>go(3,1));await p.waitForTimeout(500);[x,y]=await box(4);await T('touchStart',x,y);await p.waitForTimeout(550);for(let i=1;i<=12;i++){await T('touchMove',x+(400-x)*i/12,y);await p.waitForTimeout(25)}
await p.waitForTimeout(1000);await T('touchMove',402,y+4);await T('touchMove',200,250);await T('touchMove',201,252);await p.waitForTimeout(400);await T('touchEnd');await p.waitForTimeout(1000);
console.log('drag out of trash ->',await pageOf(n),'cal prompt',await p.evaluate(()=>cal.open));await p.touchscreen.tap(200,40);
// permanent delete
await p.evaluate(()=>{mvTo(I.find(x=>x.page=='work').id,'trash')});await p.waitForTimeout(500);await p.evaluate(()=>{cal.close();go(3,1)});await p.waitForTimeout(400);
p.on('dialog',d=>d.accept());[x,y]=await box(4);await p.touchscreen.tap(x+60,y-15);await p.waitForTimeout(400);const c0=await p.evaluate(()=>I.length);await p.click('#iDel');await p.waitForTimeout(400);console.log('perm delete: count',c0,'->',await p.evaluate(()=>I.length));
await p.evaluate(()=>undo());console.log('undo delete ->',await p.evaluate(()=>I.length));
await b.close()})();
