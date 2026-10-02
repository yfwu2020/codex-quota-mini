// Documentation captures of the production widget, using only fictional data.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(ROOT, 'plugins/codex-quota-mini');
const OUT = path.join(ROOT, 'docs/images');
const styles = ['soft','crystal','star','trail','color','fine'];
const styleNames = ['原有柔光','晶点','星芒','流光','彩砂','灰度细砂'];

const css = `
html,body{color-scheme:light;background:#f4f4f2;color:#242424;font:14px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
.quota-widget{font:12px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
body{padding:32px}h1{font-size:25px;font-weight:550;margin:0 0 8px;letter-spacing:-.5px}p{color:#747474;line-height:1.6;margin:0}
.grid{display:grid;gap:16px;margin-top:24px}.card{border-radius:18px;background:#fff;padding:22px;position:relative;overflow:hidden}
.label{font-size:14px;color:#666;margin-top:15px;text-align:center}.sample{display:flex;align-items:center;justify-content:center;gap:40px;height:172px}
.large.quota-widget{width:152px}.large .orb{width:144px;height:144px}.small{width:52px}
.dark{background:#252525;color:#ededed;color-scheme:dark}.dark .label{color:#b7b7b7}
.native-details.quota-widget{position:relative;width:236px}
.screen{position:relative;background:#e9e9e6;border:1px solid #deded9;border-radius:12px;overflow:hidden}
.screen.dark{background:#171717;border-color:#353535}.screen-label{position:absolute;top:12px;left:16px;color:#888;font-size:11px;letter-spacing:.3px}
.cursor{position:absolute;z-index:20;width:14px;height:20px;pointer-events:none;filter:drop-shadow(0 1px 1px #0006)}
.row{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:15px 0;border-bottom:1px solid #eee}
.row:last-child{border:0}.row strong{font-weight:500}.row small{display:block;color:#888;font-size:12px;margin-top:6px;line-height:1.5}
.toggle{width:34px;height:20px;background:#232323;border-radius:20px;flex:none;position:relative}.toggle:after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;right:2px;top:2px;background:white}
.number{padding:7px 12px;border:1px solid #ddd;border-radius:8px;min-width:76px;text-align:center;color:#555}
.chip{background:#f1f1ef;color:#666;border-radius:6px;padding:6px 10px;font-size:12px}
.note{margin-top:20px;font-size:12px;color:#888}.session-destination{position:absolute;top:78px;left:385px;width:390px;background:white;border-radius:14px;padding:22px;opacity:0;transform:translateY(5px);transition:none}
.session-destination.visible{opacity:1;transform:none}.session-destination strong{display:block;font-size:17px;margin:8px 0 14px}.line{height:7px;border-radius:5px;background:#e8e8e6;margin-top:12px}.field-title{font-size:15px;margin:22px 0 2px;color:#333}
`;
const cursor = '<svg class="cursor" viewBox="0 0 14 20"><path d="M1 1L1 16L5 12L8 19L11 18L8 11L13 11Z" fill="#222" stroke="white" stroke-width="1.1"/></svg>';
const heading = (title, subtitle, body) => `<h1>${title}</h1><p>${subtitle}</p>${body}`;
const pair = id => `<div class="sample"><div id="${id}-large"></div><div id="${id}-small"></div></div>`;

(async()=>{
 await fs.mkdir(OUT,{recursive:true});
 const temp = await fs.mkdtemp(path.join(os.tmpdir(),'quota-media-'));
 const {Client} = await import(pathToFileURL(path.join(PLUGIN,'server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
 const {StdioClientTransport} = await import(pathToFileURL(path.join(PLUGIN,'server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
 const client = new Client({name:'readme-renderer',version:'1.0.0'});
 let settings;
 try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(PLUGIN,'server/dist/index.mjs')],env:{...process.env,QUOTA_MINI_SUPPORT:temp}}));
  settings=(await client.callTool({name:'quota_read_settings',arguments:{}})).structuredContent;
 }finally{await client.close();}
 const widgetSource=await fs.readFile(path.join(PLUGIN,'ui/quota.js'),'utf8');
 const widgetCss=await fs.readFile(path.join(PLUGIN,'ui/style.css'),'utf8');
 const browser=await chromium.launch({headless:true});
 let page;
 const errors=[];
 async function stage(body,height=390){
  if(page)await page.close();
  page=await browser.newPage({viewport:{width:960,height},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-10-03T03:00:00Z')});
  await page.setContent(`<meta charset="utf-8"><style>${widgetCss}\n${css}</style>${body}`);
  await page.addScriptTag({content:widgetSource});
  await page.evaluate(()=>{
   window.widgets={};
   window.sampleState=(overrides={})=>({remainingFiveHour:62,remainingWeek:78,primaryResetsAt:Date.now()/1000+8100,weeklyResetsAt:Date.now()/1000+194400,activeSessions:1,weightedTokensPerSecond:500,resetSerial:0,accountScope:'readme-demo',status:'live',quotaUpdatedAt:Date.now()/1000,activityUpdatedAt:Date.now()/1000,tokenPaceUpdatedAt:Date.now()/1000,...overrides});
   window.mount=(id,overrides={},size='small',surface='orb')=>{window.quotaSurface=surface;const widget=new QuotaWidget(document.getElementById(id));window.widgets[id]=widget;if(size==='large')widget.root.classList.add('large');widget.update(sampleState(overrides));return widget;};
  });
 }
 async function png(name){await page.clock.runFor(1000);await page.evaluate(()=>{for(const w of Object.values(widgets))if(w.expanded)w.finishDetailsImmediately();});await page.screenshot({path:path.join(OUT,name+'.png')});console.log('Rendered '+name+'.png');}
 async function gif(name,frames,step,action){
  const folder=path.join(temp,name);await fs.mkdir(folder);
  for(let frame=0;frame<frames;frame++){
   if(action)await action(frame);
   await page.clock.runFor(step);
   await page.evaluate(step=>{
    window.captureAnimations ||= new WeakMap();
    for(const animation of document.getAnimations()){
     const elapsed=(captureAnimations.get(animation)||0)+step;
     captureAnimations.set(animation,elapsed);
     animation.pause();animation.currentTime=elapsed;
     if(elapsed>=Number(animation.effect.getTiming().duration))animation.finish();
    }
   },step);
   await page.screenshot({path:path.join(folder,String(frame).padStart(4,'0')+'.png')});
  }
  execFileSync('python3',['-c',`from PIL import Image
from pathlib import Path
import sys
frames=[Image.open(p).convert('RGB') for p in sorted(Path(sys.argv[1]).glob('*.png'))]
sheet=Image.new('RGB',(frames[0].width,frames[0].height*3))
for i,f in enumerate([frames[0],frames[len(frames)//2],frames[-1]]):sheet.paste(f,(0,i*f.height))
palette=sheet.quantize(colors=256)
output=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
output[0].save(sys.argv[2],save_all=True,append_images=output[1:],duration=int(sys.argv[3]),loop=0,optimize=False,disposal=1)
`,folder,path.join(OUT,name+'.gif'),String(step)],{stdio:'pipe'});
  console.log('Rendered '+name+'.gif');
 }
 try {
  await stage(heading('Codex Quota Mini','闭合圆环 · 本周额度　 /　 沙量 · 5 小时额度',`<div class="grid" style="grid-template-columns:1fr 1fr"><div class="card">${pair('light')}<div class="label">浅色 · 放大预览 / 44 px</div></div><div class="card dark">${pair('dark')}<div class="label">深色 · 放大预览 / 44 px</div></div></div>`),398);
  await page.evaluate(()=>{for(const theme of ['light','dark'])for(const size of ['large','small'])mount(theme+'-'+size,{},size);});
  await gif('overview',60,50);

  const quotas=[100,75,50,25,0,null];
  await stage(heading('额度如何变化','圆环和沙量分别表示两个额度窗口；读取失败时显示未知。',`<div class="grid" style="grid-template-columns:repeat(6,1fr)">${quotas.map((q,i)=>`<div class="card" style="padding:16px 5px"><div id="q${i}" style="margin:auto"></div><div class="label">${q===null?'未知':q+'%'}<br><small>两个窗口的示例比例</small></div></div>`).join('')}</div><p class="note">每个图标为 88 px 放大图，便于比较沙量；实际悬浮圆为 44 px。</p>`),315);
  await page.evaluate(quotas=>quotas.forEach((q,i)=>{const w=mount('q'+i,{remainingFiveHour:q,remainingWeek:q,activeSessions:0});w.root.style.width='96px';w.orb.style.width=w.orb.style.height='88px';}),quotas);
  await png('quota-states');

  await stage(heading('悬停查看详情 · 点击会话跳转','轻微缩放与明暗呼应，详情柔和浮现；移入列表后可直接点击会话。',`<div class="screen" style="margin-top:24px;height:370px"><div class="screen-label">示例会话 · 跳转过程示意</div><div id="hover-orb" style="position:absolute;left:153px;top:39px"></div><div id="hover-details" style="position:absolute;left:61px;top:91px"></div>${cursor}<div class="session-destination"><span class="chip">已选择会话 · 跳转目标示意</span><strong id="destination-title">网站动画优化</strong><p>实际使用中会打开对应的 Codex 对话。</p><div class="line"></div><div class="line" style="width:78%"></div><div class="line" style="width:58%"></div></div></div>`),520);
  await page.evaluate(()=>{
   const threads=[{threadId:'11111111-1111-4111-8111-111111111111',title:'网站动画优化'},{threadId:'22222222-2222-4222-8222-222222222222',title:'整理项目文档'}];
   mount('hover-orb',{activeSessions:2,activeThreads:threads});
   const detail=mount('hover-details',{activeSessions:2,activeThreads:threads},'small','details');
   detail.host=m=>{if(m.type==='openThread'){document.querySelector('.session-destination').classList.add('visible');widgets['hover-orb'].setHoverResponse(false);detail.setExpanded(false);}};
  });
  await gif('hover-sessions',80,50,async frame=>{
   await page.evaluate(frame=>{
    const c=document.querySelector('.cursor');let x=185,y=58;
    if(frame<8){x=280-(frame/8)*95;y=135-(frame/8)*77;}
    if(frame>=30&&frame<44){x=185-(frame-30)*3;y=58+(frame-30)*13;}
    if(frame>=44){const row=document.querySelector('#hover-details .session-row').getBoundingClientRect(),screen=document.querySelector('.screen').getBoundingClientRect();x=row.left-screen.left+70;y=row.top-screen.top+row.height/2;}
    c.style.left=x+'px';c.style.top=y+'px';
    if(frame===8){widgets['hover-orb'].setHoverResponse(true);widgets['hover-details'].setExpanded(true);}
    if(frame===44){document.querySelector('#hover-details .session-row').style.background='#f2f2f2';}
    if(frame===55){document.querySelector('#hover-details .session-row').click();}
   },frame);
  });
  if(!await page.evaluate(()=>document.querySelector('.session-destination').classList.contains('visible')&&!widgets['hover-details'].expanded))throw Error('Session navigation demonstration did not complete');

  await stage(heading('跟随 Codex 的浅色与深色外观','悬浮圆与详情使用同一外观设置，也支持跟随系统。',`<div class="grid" style="grid-template-columns:1fr 1fr">${['light','dark'].map(t=>`<div class="card ${t==='dark'?'dark':''}" style="height:354px"><div id="theme-${t}" style="margin:auto"></div><div id="detail-${t}" style="margin:12px auto;width:236px"></div><div class="label">${t==='light'?'浅色模式':'深色模式'}</div></div>`).join('')}</div>`),487);
  await page.evaluate(()=>{for(const theme of ['light','dark']){mount('theme-'+theme);const w=mount('detail-'+theme,{activeSessions:1,activeThreads:[{threadId:'demo',title:'网站动画优化'}]},'small','details');w.setExpanded(true);}});
  await png('appearance');

  const detailHeight=await page.evaluate(()=>{const node=document.createElement('div');node.id='measure-details';node.style.cssText='position:absolute;left:-1000px';document.body.appendChild(node);const w=mount(node.id,{activeSessions:0},'small','details');return Math.ceil(w.root.getBoundingClientRect().height);});
  const nativeOutput=execFileSync('python3',[path.join(__dirname,'render_native_readme.py'),String(detailHeight)],{encoding:'utf8'});
  const placements=JSON.parse(nativeOutput.trim().split('\n').at(-1));
  await stage(heading('详情位置自动适应可用空间','靠近边缘时，详情向有空间的一侧展开。下图坐标由原生布局函数计算。',`<div class="grid" style="grid-template-columns:1fr 1fr">${placements.map((p,i)=>`<div class="card" style="padding:12px"><div class="screen" id="screen${i}" style="width:404px;height:${p.screen[1]}px"><div id="place-orb${i}"></div><div id="place-detail${i}"></div></div><div class="label">${{below:'向下展开',above:'向上展开',left:'向左展开',right:'向右展开'}[p.side]}</div></div>`).join('')}</div>`),850);
  await page.evaluate(placements=>placements.forEach((p,i)=>{const orb=mount('place-orb'+i,{activeSessions:0});const detail=mount('place-detail'+i,{activeSessions:0},'small','details');orb.root.style.position=detail.root.style.position='absolute';orb.root.style.left=p.anchor[0]+'px';orb.root.style.top=p.anchor[1]+'px';detail.root.style.left=p.details[0]+'px';detail.root.style.top=p.details[1]+'px';detail.setPlacement(p.side);detail.setExpanded(true);}),placements);
  await png('adaptive-placement');

  const property=(key,value)=>{const p=settings.schema.properties[key];return `<div class="row"><div><strong>${p.title}</strong><small>${p.description}</small></div>${p.type==='boolean'?'<span class="toggle"></span>':`<span class="number">${value}</span>`}</div>`;};
  await stage(heading('插件设置','在 Codex 设置中搜索「Codex Quota Mini」。此图为设置项示意，文字来自插件设置接口。',`<div class="grid" style="grid-template-columns:1fr 1fr"><div class="card"><h3 style="margin-top:0">悬浮额度圆</h3>${property('visible','')}${property('globalDisplay','')}<div class="field-title">落沙速度</div>${property('modelCoefficient','1')}</div><div class="card"><h3 style="margin-top:0">落沙调试</h3>${property('debugMode','')}${property('sandFlow','1')}${property('sandSparkle','1')}${property('sandSparkleStyle','fine')}</div></div>`),662);
  await png('settings');

  await stage(heading('显示范围 · 拖动定位','全局显示跟随各桌面；关闭全局显示时，仅在 Codex 位于前台且窗口可见时显示。',`<div class="grid" style="grid-template-columns:1fr 1fr">${['全局显示 · Codex 前台','全局显示 · 其他应用前台','仅 Codex · Codex 前台','仅 Codex · 其他应用前台'].map((t,i)=>`<div class="card"><strong>${t}</strong><div class="screen" style="height:120px;margin-top:14px"><div class="screen-label">${i%2?'其他应用 · 示意':'Codex · 示意'}</div><div style="position:absolute;left:20px;top:38px;width:130px"><div class="line"></div><div class="line" style="width:80%"></div></div>${i===3?'<span class="chip" style="position:absolute;right:20px;top:65px">自动隐藏</span>':`<div id="scope${i}" style="position:absolute;right:16px;bottom:12px"></div>`}</div></div>`).join('')}</div><p class="note">可以拖动悬浮圆调整位置；在插件设置中关闭「显示悬浮圆」可随时隐藏。</p>`),545);
  await page.evaluate(()=>[0,1,2].forEach(i=>mount('scope'+i,{activeSessions:0})));
  await png('display-scope');

  await stage(heading('拖动悬浮圆','移动到顺手的位置；结束拖动后，悬停可在新位置展开详情。',`<div class="screen" style="height:230px;margin-top:24px"><div class="screen-label">拖动操作示意 · 44 px</div><div id="drag-orb" style="position:absolute;left:130px;top:140px"></div>${cursor}</div>`),380);
  await page.evaluate(()=>mount('drag-orb',{activeSessions:0}));
  await gif('drag-position',64,50,async frame=>page.evaluate(frame=>{const f=Math.max(0,Math.min(1,(frame-10)/32));const eased=f*f*(3-2*f);const x=130+550*eased,y=140-82*eased;const root=document.getElementById('drag-orb');root.style.left=x+'px';root.style.top=y+'px';const c=document.querySelector('.cursor');c.style.left=x+28+'px';c.style.top=y+26+'px';},frame));

  await stage(heading('原生落沙调试面板','右键悬浮圆 →「调试落沙…」。调试仅改变动效，关闭面板后恢复真实会话驱动。',`<div class="grid" style="grid-template-columns:340px 1fr"><div class="card" style="padding:10px"><img id="native-image" style="width:320px;display:block" alt="原生调试面板"></div><div class="card"><div class="field-title">流量 / 流速：0–4 倍</div><p>0 暂停；细砂通过粗细和密度表现流量，最低流量逐粒落下。</p><div class="field-title">闪耀 / 透光：0–2 倍</div><p>0 关闭亮度变化；细砂保留灰度纹理，1 标准，2 加强。</p><div class="field-title">六种方案 · 恢复默认</div><p>原有柔光、晶点、星芒、流光、彩砂、灰度细砂。关闭调试恢复自动动效。</p></div></div>`),490);
  const nativeData=await fs.readFile(path.join(OUT,'debug-panel-native.png'));
  await page.locator('#native-image').evaluate((node,data)=>node.src='data:image/png;base64,'+data,nativeData.toString('base64'));
  await png('debug-panel');

  await stage(heading('六种落沙方案','调试预览 · 每格同时展示放大图和 44 px 实际尺寸。',`<div class="grid" style="grid-template-columns:repeat(3,1fr)">${styles.map((s,i)=>`<div class="card">${pair(s)}<div class="label">${styleNames[i]}</div></div>`).join('')}</div>`),660);
  await page.evaluate(styles=>styles.forEach(s=>['large','small'].forEach(size=>{const w=mount(s+'-'+size,{remainingFiveHour:90,activeSessions:0},size);w.setDebug({enabled:true,flow:1,sparkle:2,style:s});})),styles);
  await png('sand-styles');

  const flows=[.1,.4,1,4];
  await stage(heading('灰度细砂 · 用粗细表现流量','中心凝实，边缘逐渐稀疏；流量增加时更粗更密，下落速度基本保持一致。',`<div class="grid" style="grid-template-columns:repeat(4,1fr)">${flows.map((f,i)=>`<div class="card" style="padding:18px 5px"><div id="flow${i}" style="margin:auto"></div><div class="label">${f===.1?'0.10 倍 · 逐粒':f.toFixed(2)+' 倍'}<br><small>144 px 放大预览</small></div></div>`).join('')}</div>`),370);
  await page.evaluate(flows=>flows.forEach((flow,i)=>{const w=mount('flow'+i,{remainingFiveHour:90,activeSessions:0},'large');w.setDebug({enabled:true,flow,sparkle:1,style:'fine'});}),flows);
  await gif('fine-flow',60,50);

  await stage(heading('灰度细砂 · 透光程度','只改变亮度，不添加颜色；沙漏外壁和沙堆保持平面表现。',`<div class="grid" style="grid-template-columns:repeat(3,1fr)">${[0,1,2].map((v,i)=>`<div class="card">${pair('shine'+i)}<div class="label">${['0 · 关闭亮度变化','1 · 标准','2 · 加强'][i]}</div></div>`).join('')}</div>`),375);
  await page.evaluate(()=>[0,1,2].forEach(sparkle=>['large','small'].forEach(size=>{const w=mount('shine'+sparkle+'-'+size,{remainingFiveHour:90,activeSessions:0},size);w.setDebug({enabled:true,flow:2,sparkle,style:'fine'});})))
  await png('sand-brightness');

  await stage(heading('会话运行驱动落沙','没有会话时暂停；有会话时，近期 token 速度 × 模型系数影响自动动效。',`<div class="grid" style="grid-template-columns:repeat(3,1fr)">${['idle','slow','fast'].map((s,i)=>`<div class="card">${pair(s)}<div class="label">${['没有运行会话 · 停止','运行中 · 30 加权 token/s','运行中 · 3000 加权 token/s'][i]}</div></div>`).join('')}</div><p class="note">动图使用示例速度；模型系数只影响动效，不改变实际额度。</p>`),415);
  await page.evaluate(()=>['idle','slow','fast'].forEach((s,i)=>['large','small'].forEach(size=>mount(s+'-'+size,{remainingFiveHour:90,activeSessions:i?1:0,weightedTokensPerSecond:[0,30,3000][i]},size))));
  await gif('session-pace',70,50);

  await stage(heading('5 小时额度重置 · 沙漏翻转','确认新的重置窗口后，内部沙漏翻转一次，外层周额度圆环保持原位。',`<div class="grid" style="grid-template-columns:1fr 1fr"><div class="card">${pair('reset-light')}<div class="label">浅色 · 放大预览 / 44 px</div></div><div class="card dark">${pair('reset-dark')}<div class="label">深色 · 放大预览 / 44 px</div></div></div><p class="note" id="reset-label">重置前 · 5 小时剩余 10%</p>`),422);
  await page.evaluate(()=>['light','dark'].forEach(t=>['large','small'].forEach(size=>mount('reset-'+t+'-'+size,{remainingFiveHour:10},size))));
  await gif('quota-reset',64,50,async frame=>{if(frame===18)await page.evaluate(()=>{for(const w of Object.values(widgets))w.update(sampleState({remainingFiveHour:100,resetSerial:1,primaryResetsAt:Date.now()/1000+18000}));document.getElementById('reset-label').textContent='确认额度重置 · 5 小时剩余 100%';});});
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
 console.log('Documentation media complete; only fictional quota and sessions were used.');
})().catch(error=>{console.error(error);process.exitCode=1;});
