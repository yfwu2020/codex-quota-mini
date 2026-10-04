// Capture the real renderer with fictional data; never read local account state.
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const plugin=path.join(ROOT,'plugins/codex-quota-mini');
 const [source,style]=await Promise.all([fs.readFile(path.join(plugin,'ui/quota.js'),'utf8'),fs.readFile(path.join(plugin,'ui/style.css'),'utf8')]);
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1040,height:636},deviceScaleFactor:2});
  await page.clock.install({time:new Date('2026-10-05T00:00:00Z')});
  const labels=['额度可用','仅 5 小时耗尽','仅周额度耗尽','两个窗口均耗尽'];
  await page.setContent(`<meta charset="utf-8"><style>${style}
  body{background:#f2f2f0;padding:28px;color:#242424}h1{font-size:23px;font-weight:500;margin:0 0 8px}p{color:#777;margin:0 0 18px;font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#fff;border-radius:16px;padding:16px;text-align:center}.card.dark{background:#252525;color:#ddd;color-scheme:dark}
  .samples{height:164px;display:flex;align-items:center;justify-content:center;gap:42px}.zoom{transform:scale(2.6);transform-origin:center}.label{font-size:13px;margin-top:8px}.size{font-size:10px;color:#999;margin-top:10px}
  </style><h1>额度耗尽 · 重置倒计时</h1><p>仅 5 小时耗尽：沙漏变暗　 /　 周额度耗尽：整个圆变暗　 /　 两者耗尽：周倒计时优先</p><div class="grid">${['light','dark'].map(theme=>labels.map((label,i)=>`<div class="card ${theme}"><div class="samples"><div class="zoom" id="${theme}-${i}-large"></div><div id="${theme}-${i}-small"></div></div><div class="label">${label}</div><div class="size">${theme==='light'?'浅色':'深色'} · 放大图 / 44 px 实际尺寸</div></div>`).join('')).join('')}</div>`);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>{
   window.quotaSurface='orb';
   for(const theme of ['light','dark'])for(let i=0;i<4;i++)for(const size of ['large','small']){
    const widget=new QuotaWidget(document.getElementById(`${theme}-${i}-${size}`));
    if(size==='large')widget.root.classList.add('zoom');
    widget.update({remainingFiveHour:[50,0,50,0][i],remainingWeek:[70,70,0,0][i],primaryResetsAt:Date.now()/1000+152,weeklyResetsAt:Date.now()/1000+216005,activeSessions:0,status:'live',accountScope:'fictional-demo'});
   }
  });
  await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z'));
  await page.screenshot({path:path.join(ROOT,'docs/images/exhaustion-countdown.png')});
  console.log('Rendered exhaustion-countdown.png using fictional data');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
