const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:820,height:300}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  await page.evaluate(()=>{
   document.body.replaceChildren();document.body.style.display='flex';document.body.style.gap='8px';document.body.style.padding='20px';
   window.studies=[];
   for(const [style,name] of [['soft','原有柔光'],['crystal','晶点'],['star','星芒'],['trail','流光'],['color','彩砂']]){
    const section=document.createElement('section');section.style.width='148px';section.style.flex='none';section.textContent=name;document.body.appendChild(section);
    const enlarged=document.createElement('div');enlarged.style.height='158px';enlarged.style.paddingTop='12px';section.appendChild(enlarged);
    for(const [parent,scale] of [[enlarged,3],[section,1]]){
     const root=document.createElement('div');parent.appendChild(root);const widget=new QuotaWidget(root);root.style.transformOrigin='top left';root.style.transform=`scale(${scale})`;
     widget.update({remainingFiveHour:50,remainingWeek:80,activeSessions:0,status:'live'});widget.setDebug({enabled:true,flow:1,sparkle:2,style});studies.push(widget);
    }
   }
  });
  await page.clock.runFor(280);
  const results=await page.evaluate(()=>studies.filter((_,i)=>i%2).map(w=>({style:w.debug.style,sand:w.root.querySelector('[data-top]').getAttribute('d'),radius:Math.max(...[...w.root.querySelectorAll('.grain-glint')].map(e=>Number(e.getAttribute('r')))),stars:[...w.root.querySelectorAll('.grain-star')].some(e=>Number(e.style.opacity)>.1),trails:[...w.root.querySelectorAll('.grain-trail')].some(e=>Number(e.style.opacity)>.1)})));
  assert.ok(results[1].radius>results[0].radius*1.5,'Crystal reflections must be physically larger, not just more opaque');assert.ok(results[2].stars);assert.ok(results[3].trails);assert.equal(new Set(results.map(r=>r.sand)).size,1);
  await page.screenshot({path:'/tmp/quota-sparkle-styles-light.png'});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'/tmp/quota-sparkle-styles-dark.png'});
  await page.evaluate(()=>studies.forEach(w=>w.setDebug({...w.debug,flow:0,sparkle:0})));await page.clock.runFor(32);
  assert.ok(await page.locator('.grain-glint,.grain-star,.grain-trail,.grain-glow,.grain-light').evaluateAll(es=>es.every(e=>Number(e.style.opacity)===0)),'Every style obeys zero sparkle');
  await page.evaluate(()=>studies.forEach(w=>w.setDebug({...w.debug,enabled:false})));assert.equal(await page.locator('.grain').count(),0);
  assert.deepEqual(errors,[]);console.log('Five distinct reflections, larger crystal marks, star/trail shapes, fixed quota, off/exit controls and themes PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
