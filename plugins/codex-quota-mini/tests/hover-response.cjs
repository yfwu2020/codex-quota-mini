const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:480},colorScheme:'light'});
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  // Freeze the real CSS transitions as soon as hover state changes. A busy
  // runner can delay the 170 ms leave timer past a wall-clock screenshot.
  await page.evaluate(()=>{
   const root=quotaMini.root,targets=[quotaMini.orb,root.querySelector('.chart')];
   let responding=root.classList.contains('responding');window.hoverMotions=[];
   new MutationObserver(()=>{
    const next=root.classList.contains('responding');if(next===responding)return;responding=next;
    window.hoverMotions=targets.flatMap(node=>{getComputedStyle(node).transform;return node.getAnimations();});
    for(const animation of hoverMotions){animation.pause();animation.currentTime=0;}
   }).observe(root,{attributes:true,attributeFilter:['class']});
  });
  const sample=ms=>page.evaluate(ms=>{for(const animation of hoverMotions)animation.currentTime=Math.min(ms,Number(animation.effect.getTiming().duration));},ms);
  await page.evaluate(()=>window.quotaMini.update({remainingFiveHour:50,remainingWeek:80,activeSessions:0}));
  const before=await page.locator('#orb').boundingBox(),sand=await page.locator('[data-top]').getAttribute('d');
  await page.locator('#orb').hover();await sample(70);
  const progress=await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);
  assert.ok(progress>1&&progress<1.0201,'Hover gives a gentle continuous visual response');
  const lightness=await page.locator('#orb').evaluate(e=>Number(getComputedStyle(e).color.match(/rgb\(([^,]+)/)?.[1]));
  assert.ok(lightness>36&&lightness<50,'Neutral color lightness eases in alongside the scale');
  await page.waitForTimeout(800);
  await sample(760);
  const full=await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);
  assert.ok(full>progress&&Math.abs(full-1.02)<.0001,'Hover settles at two percent enlargement');
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).filter),'none');
  assert.equal(await page.locator('.sand').first().evaluate(e=>getComputedStyle(e).opacity),'0.47','Hover leaves sand amount contrast unchanged');
  assert.equal(await page.locator('.ring-track').evaluate(e=>getComputedStyle(e).opacity),'0.13','Hover leaves the closed quota track unchanged');
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(50, 50, 50)','Hover stays neutral and introduces no warm tint');
  assert.deepEqual(await page.locator('#orb').boundingBox(),before,'Response never moves or resizes the hit target');
  assert.equal(await page.locator('[data-top]').getAttribute('d'),sand,'Hover does not change quota geometry');
  await page.locator('#details').hover();await page.waitForTimeout(230);
  assert.equal(await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a),full,'Response stays while using details');
  await page.mouse.move(350,400);
  await page.waitForFunction(()=>!quotaMini.root.classList.contains('responding'));
  await sample(85);
  const leaving=await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);
  assert.ok(leaving>1&&leaving<full,'Leaving softly restores the orb');
  await sample(850);
  assert.equal(await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a),1);
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(36, 36, 36)');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#orb').hover();
  assert.equal(await page.locator('.chart').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a),1,'Reduced motion keeps static hover feedback');
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(50, 50, 50)');
  await page.emulateMedia({colorScheme:'dark'});
  assert.equal(await page.locator('#orb').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)','Dark mode stays neutral');
  console.log('Two percent scale + painted lightness, light/dark neutrality, detail transfer, fixed hit target, quota geometry and reduced motion PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
