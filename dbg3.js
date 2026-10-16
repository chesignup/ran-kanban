const {chromium,devices}=require('/var/tmp/sand-playwright-runtime/027a8436321ea13b428b526eda17eed1/node_modules/playwright-core');(async()=>{
const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7']});await c.addInitScript(()=>localStorage.onb=1);const p=await c.newPage();
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(1200);
console.log(await p.evaluate(()=>{const e=document.querySelector('.empty'),s=getComputedStyle(e);return [s.position,s.top,e.offsetParent&&e.offsetParent.tagName+'.'+e.offsetParent.className,e.offsetTop,e.parentElement.getBoundingClientRect().top,innerHeight]}));await b.close()})();
