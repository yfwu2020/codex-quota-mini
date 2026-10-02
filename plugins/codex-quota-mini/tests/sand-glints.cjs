const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:320,height:240}});
  await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  const update=async(activeSessions=1)=>page.evaluate(activeSessions=>{const now=Date.now()/1000;window.quotaMini.update({remainingFiveHour:50,remainingWeek:80,activeSessions,activityUpdatedAt:now,weightedTokensPerSecond:500,tokenPaceUpdatedAt:now,resetSerial:0,accountScope:'glints',status:'live'});},activeSessions);
  await update();
  assert.ok(await page.locator('.grain-glint').count()>0,'Sunlight glints must accompany falling grains');
  const sand=await page.locator('[data-top]').getAttribute('d');
  const colors=new Set();let sawLit=false,sawDim=false;
  for(let i=0;i<40;i++){
   await page.clock.runFor(75);
   const glints=await page.locator('.grain-glint').evaluateAll(nodes=>nodes.map(e=>({fill:getComputedStyle(e).fill,opacity:Number(e.style.opacity),y:Number(e.getAttribute('cy'))})));
   for(const g of glints){if(g.opacity>.12){colors.add(g.fill);sawLit=true;assert.ok(g.y>=23.15&&g.y<=38,'Sparkles stay inside falling sand');}if(g.opacity<.01)sawDim=true;}
  }
  assert.ok(sawLit&&sawDim,'Glints brighten briefly and fade');
  assert.ok(colors.size>=3,'Reflections contain varied subtle colors');
  assert.equal(await page.locator('[data-top]').getAttribute('d'),sand);
  await update(0);assert.equal(await page.locator('.grain-glint').count(),0);
  await update();await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(32);assert.equal(await page.locator('.grain-glint').count(),0);
  console.log('Colored falling-sand glints, fading, fixed quota and motion guards PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
