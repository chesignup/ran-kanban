const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
await p.evaluate(()=>{const t=I.find(x=>x.page=='work');Object.assign(t,{address:'רבי עקיבא 50, בני ברק',phone:'052-2301248',notes:'מראה 99×77, לתאם מדידה'});save();draw()});
const id=await p.evaluate(()=>I.find(x=>x.page=='work').id);const get=k=>p.evaluate(([id,k])=>byId(id)[k],[id,k]);
await p.evaluate(id=>edit(id),id);await p.waitForTimeout(500);
const r=await p.$eval('#dbox',e=>{const b=e.getBoundingClientRect();return [b.top,b.height,innerHeight]});console.log('sheet height %',Math.round(r[1]/r[2]*100));
await p.screenshot({path:'v8_task_compact.png'});
await p.fill('[name=notes]','הערה חדשה');await p.waitForTimeout(150);await p.fill('[name=phone]','050-1111111');await p.waitForTimeout(700);
console.log('autosaved:',await get('notes'),await get('phone'),'saved in LS:',await p.evaluate(id=>JSON.parse(localStorage.ran_items_v2).find(t=>t.id==id).phone,id));
// swipe down handle
const top=r[0]+12;await T('touchStart',200,top);for(let i=1;i<=10;i++){await T('touchMove',200,top+20*i);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(500);console.log('swipe-down closed:',!(await p.evaluate(()=>dlg.open)));
await p.evaluate(()=>undo());console.log('one undo reverts session:',await get('notes'),await get('phone'));
// small drag springs back
await p.evaluate(id=>edit(id),id);await p.waitForTimeout(500);await T('touchStart',200,top);for(let i=1;i<=3;i++){await T('touchMove',200,top+10*i);await p.waitForTimeout(16)}await p.waitForTimeout(300);await T('touchEnd');await p.waitForTimeout(600);console.log('small drag stays open:',await p.evaluate(()=>dlg.open));
await p.touchscreen.tap(200,40);await p.waitForTimeout(300);console.log('backdrop closes:',!(await p.evaluate(()=>dlg.open)));
// new item: fab, empty close -> discarded; typed -> added, undo removes
const n0=await p.evaluate(()=>I.length);await p.click('#fab');await p.waitForTimeout(300);await p.touchscreen.tap(200,40);await p.waitForTimeout(300);console.log('empty new discarded:',await p.evaluate(()=>I.length)==n0);
await p.click('#fab');await p.waitForTimeout(300);await p.fill('[name=name]','משימה חדשה');await p.waitForTimeout(600);await p.screenshot({path:'v8_task_new.png'});await p.touchscreen.tap(200,40);await p.waitForTimeout(300);console.log('new added:',await p.evaluate(()=>I.length)-n0);
await p.evaluate(()=>undo());console.log('undo add:',await p.evaluate(()=>I.length)-n0);
await b.close()})();
