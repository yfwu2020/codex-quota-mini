const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:520}});
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  await page.locator('#orb').hover();
  assert.ok(await page.locator('#details').evaluate(e=>e.getAnimations().length)>0,'Opening floats in rather than appearing instantly');
  await page.waitForTimeout(75);
  const opacity=await page.locator('#details').evaluate(e=>Number(getComputedStyle(e).opacity));
  assert.ok(opacity>0&&opacity<1,'Fade has intermediate opacity');
  await page.waitForTimeout(280);
  await page.evaluate(()=>{window.quotaMini.closeDetails();window.quotaMini.hoverEnter();});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#details').isVisible(),true,'Reenter cancels closing, preventing flicker');
  await page.close();
  const orb=await browser.newPage();
  await orb.addInitScript(()=>window.quotaSurface='orb');
  await orb.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  const before=await orb.locator('#orb').boundingBox();
  await orb.locator('#orb').hover();await orb.locator('#orb').click();
  assert.deepEqual(await orb.locator('#orb').boundingBox(),before,'Native orb is never resized or moved by details');
  assert.equal(await orb.locator('#details').isVisible(),false,'Native details live on a separate surface');
  const detail=await browser.newPage();
  await detail.addInitScript(()=>window.quotaSurface='details');
  await detail.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  assert.equal(await detail.locator('#orb').isVisible(),false);
  await detail.evaluate(()=>{window.quotaMini.setPlacement('above');window.quotaMini.setExpanded(true);});
  assert.ok(await detail.locator('#details').evaluate(e=>e.getAnimations().length)>0);
  await detail.waitForTimeout(320);
  assert.equal(await detail.locator('#details').evaluate(e=>Number(getComputedStyle(e).opacity)),1);
  console.log('Floating fade, interruption recovery and fixed native orb surface PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
