const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{const t=I.find(x=>x.page=='work');Object.assign(t,{address:'רבי עקיבא 50, בני ברק',phone:'052-2301248',notes:'מראה 99×77, לתאם מדידה',when:'2026-10-18T10:00'});save();draw()});
const r=await (await p.$('.page:nth-child(3) .it')).boundingBox();await p.touchscreen.tap(r.x+100,r.y+20);await p.waitForTimeout(500);await p.screenshot({path:'v6_menu_wa.png'});
await p.evaluate(()=>{window.__u=null;window.open=u=>{window.__u=u}});
await p.click('.btn.wa');await p.waitForTimeout(500);const u=await p.evaluate(()=>window.__u);console.log('share API:',await p.evaluate(()=>!!navigator.share));console.log(u.slice(0,40));console.log(decodeURIComponent(u.split('text=')[1]));
await p.evaluate(()=>{window.__s=null;navigator.share=async d=>{window.__s=d};navigator.canShare=()=>true});await p.evaluate(()=>shareWA(I.find(x=>x.page=='work').id));console.log('navigator.share path ok:',!!(await p.evaluate(()=>window.__s&&window.__s.text)));
await b.close()})();
