const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7']});const p=await c.newPage();
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{const t=I.find(x=>x.page=='work');Object.assign(t,{address:'רבי עקיבא 50, בני ברק',phone:'052-2301248',notes:'x',when:'2026-10-18T10:00'});save();draw()});
const r=await (await p.$('.page:nth-child(3) .it')).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;
console.log(await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e.outerHTML.slice(0,120)},[x,y]));
await p.touchscreen.tap(x,y);await p.waitForTimeout(500);console.log(await p.evaluate(()=>dlg.open));
await b.close()})();
