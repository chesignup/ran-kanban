const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],locale:'he-IL'});const p=await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1500);
const s=await c.newCDPSession(p);const T=(type,x,y)=>s.send('Input.dispatchTouchEvent',{type,touchPoints:type=='touchEnd'?[]:[{x,y}]});
const id=await p.evaluate(()=>{const t=I.find(x=>x.page=='work');t.notes=Array.from({length:12},(_,i)=>'שורה '+(i+1)).join('\n');save();draw();return t.id});
const open_=async()=>{await p.evaluate(id=>edit(id),id);await p.waitForTimeout(500)},isOpen=()=>p.evaluate(()=>dlg.open);
const ctr=async sel=>{const r=await (await p.$(sel)).boundingBox();return [r.x+r.width/2,r.y+r.height/2]};
const drag=async(x,y,d,steps=10)=>{await T('touchStart',x,y);for(let i=1;i<=steps;i++){await T('touchMove',x,y+d*i/steps);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(500)};
await open_();let [x,y]=await ctr('[name=phone]');await p.touchscreen.tap(x,y);await p.waitForTimeout(300);console.log('tap focuses phone:',await p.evaluate(()=>document.activeElement.name),'open',await isOpen());
await drag(x,y,200);console.log('drag down from phone input closes:',!(await isOpen()));
await open_();[x,y]=await ctr('[name=name]');await drag(x,y,200);console.log('drag down from name closes:',!(await isOpen()));
await open_();await drag(200,150,250);console.log('drag down on backdrop closes:',!(await isOpen()));
await open_();[x,y]=await ctr('[name=phone]');await drag(x,y,40);console.log('short drag springs back (open):',await isOpen());
await p.evaluate(()=>{const t=f.notes;t.style.maxHeight='60px';t.scrollTop=200});const st0=await p.evaluate(()=>f.notes.scrollTop);[x,y]=await ctr('[name=notes]');await drag(x,y,200);console.log('notes scrolled (scrollTop',st0,'): sheet stays open:',await isOpen(),'scrollTop now',await p.evaluate(()=>f.notes.scrollTop));
await p.evaluate(()=>{f.notes.scrollTop=0});await drag(x,y,200);console.log('notes at top: closes:',!(await isOpen()));
await open_();await p.fill('[name=phone]','050-2222222');await p.waitForTimeout(100);[x,y]=await ctr('[name=phone]');await drag(x,y,200);console.log('autosave survives swipe-close:',await p.evaluate(id=>byId(id).phone,id));
await b.close()})();
