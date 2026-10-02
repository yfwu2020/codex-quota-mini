const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});try{
 const page=await browser.newPage({colorScheme:'dark'});await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
 assert.equal(await page.evaluate(()=>typeof quotaMini.setAppearance),'function','Codex appearance must be forwarded into the floating renderer');
 const color=async()=>{await page.waitForTimeout(950);return page.locator('.orb').evaluate(n=>getComputedStyle(n).backgroundColor)};
 await page.evaluate(()=>{quotaMini.update({remainingFiveHour:50,remainingWeek:70,activeSessions:0,status:'live'});quotaMini.setDebug({enabled:true,flow:1,sparkle:1,style:'fine'})});
 const paths=await page.locator('[data-top],[data-bottom]').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
 await page.evaluate(()=>quotaMini.setAppearance('light'));assert.equal(await color(),'rgb(255, 255, 255)');
 await page.evaluate(()=>quotaMini.setAppearance('dark'));assert.equal(await color(),'rgb(37, 37, 37)');
 await page.evaluate(()=>quotaMini.setAppearance('light'));assert.equal(await color(),'rgb(255, 255, 255)');
 await page.evaluate(()=>quotaMini.setAppearance('system'));assert.equal(await color(),'rgb(37, 37, 37)');
 await page.emulateMedia({colorScheme:'light'});assert.equal(await color(),'rgb(255, 255, 255)');
 await page.evaluate(()=>quotaMini.setAppearance('unexpected'));assert.equal(await color(),'rgb(255, 255, 255)');
 assert.deepEqual(await page.locator('[data-top],[data-bottom]').evaluateAll(ns=>ns.map(n=>n.getAttribute('d'))),paths);assert.equal(await page.locator('.fine-sand').count(),1);
 console.log('Codex light/dark overrides system; system follows OS; theme switch preserves fine debug and quota geometry PASS');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
