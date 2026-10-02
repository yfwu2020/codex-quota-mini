const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  const update=async rate=>page.evaluate(rate=>{const now=Date.now()/1000;window.quotaMini.update({remainingFiveHour:70,remainingWeek:80,primaryResetsAt:now+10000,weeklyResetsAt:now+20000,activeSessions:1,activityUpdatedAt:now,quotaUpdatedAt:now,weightedTokensPerSecond:rate,tokenPaceUpdatedAt:now,consumptionPercentPerMinute:999,resetSerial:0,accountScope:'pace-test',status:'live'});},rate);
  const cycles=async()=>{
   await page.evaluate(()=>{
    window.falls=0;let previous=0;window.observeFalls=true;
    const step=()=>{const grain=document.querySelector('.grain');if(grain&&Number(grain.style.opacity)>.1){const y=Number(grain.getAttribute('cy'));if(previous>y+1)window.falls++;previous=y;}if(window.observeFalls)requestAnimationFrame(step);};requestAnimationFrame(step);
   });
   await page.clock.runFor(4500);
   return page.evaluate(()=>{window.observeFalls=false;return window.falls;});
  };
  await update(null);
  const sand=await page.locator('[data-top]').getAttribute('d');
  const baseline=await cycles();
  assert.ok(baseline>=1,'Running session keeps gentle sand flow without new token samples');
  await update(3000);
  await page.clock.runFor(3000);
  await update(3000);
  const fast=await cycles();
  assert.ok(fast>=baseline+3,`Higher weighted token throughput must create faster visible falls (${baseline} -> ${fast})`);
  assert.equal(await page.locator('[data-top]').getAttribute('d'),sand,'Changing animation speed must never drain displayed quota');
  await update(0);
  await page.clock.runFor(5000);
  await update(0);
  const slow=await cycles();
  assert.ok(slow>=1&&slow<fast-2,'No recent token increase decelerates but does not stop an active session');
  await update(3000);
  await page.evaluate(()=>{window.quotaMini.state.activityUpdatedAt=Date.now()/1000-11;window.quotaMini.syncParticles();});
  assert.equal(await page.locator('.grain').count(),0,'Stale activity still stops sand regardless of consumption rate');
  await page.emulateMedia({reducedMotion:'reduce'});
  await update(3000);
  assert.equal(await page.locator('.grain').count(),0);
  assert.deepEqual(errors,[]);
  console.log(`Particle pace: visible cycles ${baseline} -> ${fast} -> ${slow}, fixed sand amount and activity guards PASS`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
