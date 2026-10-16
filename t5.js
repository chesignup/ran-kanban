const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
const id=await p.evaluate(()=>I.find(t=>t.page=='gen').id);
await p.evaluate(id=>mvTo(id,'work'),id);await p.waitForTimeout(900);console.log('sheet after move to work:',await p.evaluate(()=>cal.open));
await p.click('.dchip[data-d]:nth-child(2)');await p.fill('#ctime','14:30');await p.waitForTimeout(400);await p.screenshot({path:'v5_cal_sheet.png'});
await p.click('#cal .btn.p');await p.waitForTimeout(700);console.log('when:',await p.evaluate(id=>byId(id).when,id));await p.screenshot({path:'v5_card_badge.png'});
console.log('toast:',await p.textContent('#tmsg'));
await p.evaluate(()=>undo());console.log('after undo when:',await p.evaluate(id=>byId(id).when,id));
await p.evaluate(()=>undo());console.log('after 2nd undo page:',await p.evaluate(id=>byId(id).page,id));
await p.evaluate(()=>askCal(I[0].id));await p.waitForTimeout(500);await p.touchscreen.tap(200,60);await p.waitForTimeout(300);console.log('backdrop closes:',!(await p.evaluate(()=>cal.open)));
// menu action
const r=await (await p.$('.page:nth-child(3) .it')).boundingBox();await p.touchscreen.tap(r.x+100,r.y+20);await p.waitForTimeout(400);await p.click('#mb .btn:nth-child(2)');await p.waitForTimeout(500);console.log('menu action opens:',await p.evaluate(()=>cal.open));
await p.click('#cal .btn.p');await p.waitForTimeout(500);await p.screenshot({path:'v5_card_badge2.png'});
await b.close()})();
