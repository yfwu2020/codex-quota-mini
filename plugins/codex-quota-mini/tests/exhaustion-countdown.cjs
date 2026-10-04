const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');

// Catch reversed quota priority, ring dimming for only five-hour exhaustion,
// frozen countdowns, premature recovery, and unknown quota treated as zero.
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || undefined});
 try {
  const page = await browser.newPage({viewport:{width:320,height:280}});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-10-05T00:00:00Z')});
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  await page.clock.pauseAt(new Date('2026-10-05T00:01:00Z'));
  await page.emulateMedia({reducedMotion:'reduce'});
  const baseline = await page.evaluate(()=>({remainingFiveHour:50,remainingWeek:70,
   primaryResetsAt:Date.now()/1000+62,weeklyResetsAt:Date.now()/1000+216005,
   activeSessions:1,activityUpdatedAt:Date.now()/1000,status:'live',resetSerial:0,accountScope:'demo'}));
  const set=patch=>page.evaluate(state=>quotaMini.update(state),{...baseline,...patch});
  const appearance=()=>page.evaluate(()=>({
   glass:+getComputedStyle(document.querySelector('.hourglass')).opacity,
   chart:+getComputedStyle(document.querySelector('.chart')).opacity,
   paper:getComputedStyle(document.querySelector('.orb')).backgroundColor
  }));
  const countdown=page.locator('[data-countdown]');
  const value=page.locator('[data-countdown-value]');
  await set({}); const normal=await appearance();
  await set({remainingFiveHour:0});
  assert.equal(await countdown.isVisible(),true,'Exhaustion must show a countdown on the orb');
  assert.equal(await value.innerText(),'01:02','Countdown must use the five-hour reset');
  const five=await appearance();
  assert(five.glass<normal.glass,'Only the hourglass must dim for five-hour exhaustion');
  assert.equal(five.chart,normal.chart,'Weekly ring must retain its brightness');
  assert.equal(five.paper,normal.paper,'Orb surface must retain its brightness');
  await page.clock.runFor(1000);
  assert.equal(await value.innerText(),'01:01','Countdown must tick without new snapshots');
  await set({remainingFiveHour:0,remainingWeek:0});
  assert.equal(await value.innerText(),'2天12时','Weekly reset must take priority over the earlier five-hour reset');
  const week=await appearance();
  assert(week.chart<normal.chart,'Weekly exhaustion must dim the whole chart');
  assert.notEqual(week.paper,normal.paper,'Weekly exhaustion must dim the orb surface');
  assert(+await countdown.evaluate(e=>getComputedStyle(e).opacity)>=.9,'Countdown must stay readable');
  await page.locator('.orb').hover();
  assert.notEqual((await appearance()).paper,normal.paper,'Hover must not restore the exhausted orb');
  assert.match(await page.locator('.orb').getAttribute('aria-label'),/本周额度已耗尽/);
  await set({remainingWeek:0,remainingFiveHour:50,weeklyResetsAt:baseline.primaryResetsAt});
  assert.equal(await value.innerText(),'01:01','Weekly exhaustion alone also displays a countdown');
  await set({remainingFiveHour:0,primaryResetsAt:baseline.primaryResetsAt-62});
  assert.equal(await value.innerText(),'00:00');
  assert.match(await countdown.innerText(),/待更新/,'Expired reset must await real quota confirmation');
  assert((await appearance()).glass<normal.glass,'Clock expiry must not restore quota');
  await set({remainingFiveHour:0,primaryResetsAt:null});
  assert.equal(await value.innerText(),'—','Missing reset must never fabricate a countdown');
  await set({remainingWeek:0,remainingFiveHour:0,weeklyResetsAt:null});
  assert.equal(await value.innerText(),'—','Missing weekly time must not fall back to the five-hour countdown');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await set({});
  assert.equal(await page.locator('.grain').count(),5,'Available quota and a running session must animate');
  await set({remainingFiveHour:0});
  assert.equal(await page.locator('.grain').count(),0,'Exhaustion must stop automatic grains');
  await page.evaluate(()=>quotaMini.setDebug({enabled:true,flow:1,sparkle:1,style:'soft'}));
  assert.equal(await page.locator('.grain').count(),5,'Debug demonstrations remain available without altering quota');
  await page.evaluate(()=>quotaMini.setDebug({enabled:false}));
  assert.equal(await page.locator('.grain').count(),0,'Leaving debug must restore exhausted inactivity');
  await page.emulateMedia({reducedMotion:'reduce'});
  await set({remainingFiveHour:null,remainingWeek:null,status:'unavailable'});
  assert.equal(await countdown.isVisible(),false,'Unknown quota must not look exhausted');
  await set({remainingFiveHour:100,remainingWeek:70,resetSerial:1});
  assert.equal(await countdown.isVisible(),false,'A confirmed refill must hide the countdown');
  assert.equal((await appearance()).glass,normal.glass,'Refill must restore hourglass brightness');
  await set({remainingFiveHour:.01,remainingWeek:.01});
  assert.equal(await countdown.isVisible(),false,'A small positive quota must remain available');
  for(const [seconds,want] of [[3600,'01:00'],[3599,'59:59'],[1,'00:01'],[86400,'1天0时']]){
   const epoch=await page.evaluate(seconds=>Date.now()/1000+seconds,seconds);
   await set({remainingFiveHour:0,primaryResetsAt:epoch});
   assert.equal(await value.innerText(),want,'Countdown must handle unit boundaries without rounding up a reset');
  }
  await page.emulateMedia({colorScheme:'dark'});
  await set({});const dark=await appearance();await set({remainingWeek:0});
  assert.notEqual((await appearance()).paper,dark.paper,'Dark theme must also dim the exhausted surface');
  await page.evaluate(()=>{window.quotaSurface='orb';const host=document.createElement('div');document.body.appendChild(host);window.nativeSample=new QuotaWidget(host);nativeSample.update({remainingFiveHour:0,remainingWeek:0,weeklyResetsAt:Date.now()/1000+216005});});
  const native=page.locator('.native-orb [data-countdown]');
  assert.equal(await native.isVisible(),true,'The native orb surface must include the countdown');
  assert(await native.locator('[data-countdown-value]').evaluate(e=>{const text=e.getBoundingClientRect(),orb=e.closest('.orb').getBoundingClientRect();return text.left>=orb.left+3&&text.right<=orb.right-3&&text.top>=orb.top&&text.bottom<=orb.bottom;}),'Countdown text must fit within the 44 px circle');
  assert.deepEqual(errors,[]);
  console.log('Exhaustion: five-hour dimming, weekly priority, readable overlay, ticking, unknown/expired resets, refill and both themes PASS');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
