const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:280,height:300}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-03T03:00:00Z')});
  await page.goto('file://'+path.resolve(__dirname,'../ui/index.html'));
  await page.evaluate(()=>window.quotaMini.update({remainingFiveHour:50,remainingWeek:78,activeSessions:0,status:'live'}));
  const body=await page.locator('[data-shell],[data-top],[data-bottom]').evaluateAll(es=>es.map(e=>e.getAttribute('d')));
  const set=async flow=>{await page.evaluate(flow=>quotaMini.setDebug({enabled:true,flow,sparkle:1,style:'fine'}),flow);await page.clock.runFor(32);};
  await set(1);assert.equal(await page.evaluate(()=>quotaMini.debug.style),'fine','New fine-sand option must be selectable');
  const snapshot=()=>page.evaluate(()=>({transform:document.querySelector('.fine-moving').getAttribute('transform'),mode:document.querySelector('.fine-sand').dataset.mode,points:[...document.querySelectorAll('.fine-single')].map(n=>[n.getAttribute('cx'),n.getAttribute('cy')]),grains:[...document.querySelector('.fine-tile').children].filter(n=>n.style.display!=='none').map(n=>({x:+n.getAttribute('cx'),r:+n.getAttribute('r'),fill:getComputedStyle(n).fill})),body:[...document.querySelectorAll('[data-shell],[data-top],[data-bottom]')].map(e=>e.getAttribute('d'))}));
  let normal=await snapshot();assert.equal(normal.grains.length,1040);assert(normal.grains.every(g=>g.r<.08));assert(normal.grains.filter(g=>Math.abs(g.x)<.3).length>normal.grains.filter(g=>Math.abs(g.x)>.6).length*4);
  assert(normal.grains.every(g=>{const c=g.fill.match(/[\d.]+/g);return c[0]===c[1]&&c[1]===c[2]}),'All sand remains grayscale');
  const tip=await page.evaluate(()=>{const d=document.querySelector('[data-top]').getAttribute('d');return Math.max(...[...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m=>+m[2]))});
  assert(+await page.locator('.fine-window').getAttribute('y')<tip,'Sand stream overlaps upper sand tip');
  const y=s=>+s.transform.match(/translate\(24 ([\d.]+)/)[1],width=s=>+s.transform.match(/scale\(([\d.]+)/)[1];
  const results=[];for(const flow of [.25,1,2]){await set(flow);const a=await snapshot();await page.clock.runFor(128);const b=await snapshot();results.push({width:width(a),count:a.grains.length,travel:y(b)-y(a)});assert.deepEqual(b.body,body);}
  assert(results[0].width<results[1].width&&results[1].width<results[2].width);assert(results[0].count<results[1].count&&results[1].count<results[2].count);assert(Math.max(...results.map(r=>r.travel))/Math.min(...results.map(r=>r.travel))<1.25,'Flow changes width rather than falling speed');
  await set(.1);let a=await snapshot();assert.equal(a.mode,'single');assert.equal(a.points.length,3);assert(a.points.every(p=>p[0]==='24'));await page.clock.runFor(64);assert.notDeepEqual((await snapshot()).points,a.points);
  await set(0);a=await snapshot();await page.clock.runFor(320);assert.deepEqual(await snapshot(),a,'Zero flow pauses immediately');
  await page.evaluate(()=>quotaMini.setDebug({enabled:true,flow:1,sparkle:0,style:'fine'}));await page.clock.runFor(32);assert.equal(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');return new Set(['base','mid','bright'].map(t=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=getComputedStyle(document.querySelector('.fine-'+t)).fill;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].join(',')})).size}),1,'Zero sparkle removes light variation while retaining sand');
  await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>quotaMini.setDebug({enabled:true,flow:2,sparkle:2,style:'fine'}));await page.clock.runFor(64);await page.screenshot({path:'/tmp/quota-fine-debug-dark.png'});
  await page.evaluate(()=>quotaMini.setDebug({enabled:true,flow:1,sparkle:1,style:'soft'}));assert.equal(await page.locator('.fine-sand').count(),0,'Switching schemes removes the fine renderer');assert.equal(await page.locator('.grain').count(),5);
  await set(1);await page.evaluate(()=>quotaMini.setDebug({enabled:false,flow:1,sparkle:1,style:'fine'}));assert.equal(await page.locator('.fine-sand').count(),0);assert.equal(await page.locator('.grain').count(),0);assert.equal(await page.evaluate(()=>quotaMini.state.activeSessions),0);assert.deepEqual(await page.locator('[data-shell],[data-top],[data-bottom]').evaluateAll(es=>es.map(e=>e.getAttribute('d'))),body);
  await page.evaluate(()=>quotaMini.update({...quotaMini.state,activeSessions:1,activityUpdatedAt:Date.now()/1000}));assert.equal(await page.locator('.grain').count(),5,'Debug mode never replaces the normal renderer');
  await set(1);await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(32);assert.equal(await page.locator('.fine-sand').count(),0);assert.deepEqual(errors,[]);console.log('Fine debug: grayscale texture, connected tip, width/density flow, fixed fall speed, discrete minimum, pause, light strength, scheme switch, normal restoration and reduced motion PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
