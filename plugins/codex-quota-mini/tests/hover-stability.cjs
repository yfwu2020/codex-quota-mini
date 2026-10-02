const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:480},colorScheme:'light'});
  await page.addInitScript(()=>window.quotaSurface='orb');
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  await page.evaluate(()=>window.quotaMini.update({remainingFiveHour:50,remainingWeek:80,activeSessions:0}));
  const fixed=await page.locator('#orb').boundingBox();
  await page.locator('#orb').hover();
  await page.waitForTimeout(820);
  // Native detail dismissal can arrive after the pointer has entered the orb.
  // Exercise the real renderer entry point used by dismissDetails().
  await page.evaluate(()=>window.quotaMini.setHoverResponse(false));
  await page.waitForTimeout(930);
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(50, 50, 50)',
   'Dismissing details must not darken an orb that the pointer still hovers');
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).filter),'none',
   'Hover lightness must be painted as colors, without a brightness compositing filter');
  for(let i=0;i<3;i++){
   await page.evaluate(()=>window.quotaMini.update({...window.quotaMini.state,activityUpdatedAt:Date.now()/1000}));
   await page.waitForTimeout(100);
   assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(50, 50, 50)');
  }
  assert.ok(Math.abs(await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a)-1.02)<.0001);
  assert.deepEqual(await page.locator('#orb').boundingBox(),fixed);
  await page.mouse.move(350,400);
  await page.waitForTimeout(930);
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(36, 36, 36)',
   'The actual pointer exit still restores the orb');
  assert.equal(await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a),1);
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await page.locator('#orb').hover();
  await page.evaluate(()=>window.quotaMini.setHoverResponse(false));
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(52, 52, 52)');
  assert.equal(await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a),1);
  console.log('Native orb retains hover brightness after detail dismissal; pointer exit, fixed hit area and reduced motion PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
