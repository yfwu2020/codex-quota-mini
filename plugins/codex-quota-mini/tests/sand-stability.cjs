const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>window.quotaSurface='orb');
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  await page.evaluate(()=>{
   window.quotaMini.update({remainingFiveHour:50,remainingWeek:80,activeSessions:0,status:'live',accountScope:'one'});
   window.sandMutations=[];
   window.sandObserver=new MutationObserver(records=>window.sandMutations.push(...records.map(r=>r.attributeName)));
   for(const path of document.querySelectorAll('[data-top],[data-bottom]'))window.sandObserver.observe(path,{attributes:true});
  });
  await page.locator('#orb').hover();
  await page.evaluate(()=>{
   for(let i=0;i<5;i++)window.quotaMini.update({...window.quotaMini.state,remainingWeek:80-i,activityUpdatedAt:Date.now()/1000+i});
   window.quotaMini.renderSand();
  });
  assert.deepEqual(await page.evaluate(()=>window.sandMutations),[],
   'Unchanged five-hour quota must not redraw sand during activity updates or hover');
  const before=await page.locator('[data-top]').getAttribute('d');
  await page.evaluate(()=>window.quotaMini.update({...window.quotaMini.state,remainingFiveHour:49}));
  assert.notEqual(await page.locator('[data-top]').getAttribute('d'),before,'Real quota changes still redraw sand');
  await page.evaluate(()=>window.quotaMini.update({...window.quotaMini.state,remainingFiveHour:null}));
  assert.equal(await page.locator('[data-top]').getAttribute('d'),'');
  assert.equal(await page.locator('[data-bottom]').getAttribute('d'),'');
  await page.evaluate(()=>window.quotaMini.update({...window.quotaMini.state,remainingFiveHour:50}));
  assert.equal(await page.locator('[data-top]').getAttribute('d'),before,'Recovery restores the correct fill');
  console.log('Activity and hover preserve sand without redundant SVG redraws; quota change, unknown state and recovery PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
