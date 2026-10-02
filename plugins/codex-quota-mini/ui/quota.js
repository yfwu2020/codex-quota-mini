class QuotaWidget {
 constructor(root) {
  this.root=root;
  this.state={remainingFiveHour:null,remainingWeek:null,activeSessions:null,status:'connecting',resetSerial:0,accountScope:null};
  this.flip=null;this.raf=0;this.particleSpeed=.45;this.expanded=false;this.initialized=false;this.hoverTimer=0;this.sessionsKey='';this.detailMotion=null;this.surface=window.quotaSurface||'standalone';
  this.debug={enabled:false,flow:1,sparkle:1,style:'soft'};this.motion=matchMedia('(prefers-reduced-motion: reduce)');
  root.className='quota-widget unknown';if(this.surface!=='standalone')root.classList.add('native-'+this.surface);
  root.innerHTML=`<div id="orb" class="orb" role="img" aria-label="Codex 额度，悬停查看详情">
  <svg class="chart" viewBox="0 0 48 48" aria-hidden="true">
   <circle class="ring-track" data-track cx="24" cy="24" r="20.4"></circle>
   <circle class="ring" data-week cx="24" cy="24" r="20.4" pathLength="100" transform="rotate(-90 24 24)" stroke-dasharray="100 100"></circle>
   <g class="hourglass"><path class="shell" data-shell fill-rule="evenodd"></path><path class="sand" data-top></path><path class="sand" data-bottom></path><g data-grains></g></g>
  </svg></div>
  <section class="details" id="details" aria-label="剩余额度" hidden>
   <div class="detail-row"><span>5 小时</span><strong data-five-value>—</strong></div><p class="reset-time" data-five-reset></p>
   <div class="detail-row"><span>本周</span><strong data-week-value>—</strong></div><p class="reset-time" data-week-reset></p>
   <div class="sessions"><div class="sessions-heading">运行中的会话 <span data-session-count></span></div><div class="session-list" data-sessions></div></div>
  </section><span class="sr-only" role="status" aria-live="polite" data-announcement></span>`;
  this.orb=root.querySelector('.orb');this.glass=root.querySelector('.hourglass');this.details=root.querySelector('#details');if(this.surface==='details'){this.details.hidden=false;this.details.inert=true;}
  this.upper=this.profile();this.lower=[...this.upper].reverse().map(p=>({y:48-p.y,w:p.w}));
  const frame='M11.4 10 C11.4 8.3 36.6 8.3 36.6 10 C36.6 15 25.5 20.5 25.5 24 C25.5 27.5 36.6 33 36.6 38 C36.6 39.7 11.4 39.7 11.4 38 C11.4 33 22.5 27.5 22.5 24 C22.5 20.5 11.4 15 11.4 10 Z';
  root.querySelector('[data-shell]').setAttribute('d',`${frame} ${this.path(this.upper)} ${this.path(this.lower)} M23.45 23 H24.55 V25 H23.45 Z`);
  root.addEventListener('pointerenter',()=>this.hoverEnter());
  root.addEventListener('pointerleave',()=>this.hoverLeave());
  root.addEventListener('keydown',event=>{if(event.key==='Escape')this.closeDetails();});
  root.querySelector('[data-sessions]').addEventListener('click',event=>{const button=event.target.closest('.session-row');if(button&&this.activityFresh()){this.host({type:'openThread',threadId:button.dataset.threadId});button.blur();this.closeDetails();}});
  this.motion.addEventListener('change',()=>{if(this.motion.matches){this.cancelFlip();this.finishDetailsImmediately();}this.renderSand();this.syncParticles();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancelFlip();this.renderSand();this.syncParticles();});
  window.addEventListener('pagehide',()=>{clearTimeout(this.hoverTimer);this.cancelFlip();this.stopParticles();});
  this.render();if(this.surface==='details')this.notifyLayout();
  this.clock=setInterval(()=>{this.renderDetails();this.syncParticles();},1000);
 }
 host(message){window.webkit?.messageHandlers?.quota?.postMessage(message);}
 notifyLayout(){if(this.surface==='details')this.host({type:'detailsSize',height:Math.ceil(this.root.getBoundingClientRect().height)});}
 setPlacement(side){this.root.dataset.placement=side;}
 setAppearance(theme){if(!['light','dark','system'].includes(theme))return;if(theme==='system')document.documentElement.style.removeProperty('color-scheme');else document.documentElement.style.colorScheme=theme;}
 setHoverResponse(value){if(this.surface!=='details')this.root.classList.toggle('responding',value);}
 finishDetailsImmediately(){this.detailMotion?.cancel();this.detailMotion=null;this.details.style.opacity=this.expanded?'1':'0';if(this.surface!=='details'){this.details.hidden=!this.expanded;this.root.classList.toggle('expanded',this.expanded);}if(!this.expanded&&this.surface==='details')this.host({type:'detailsHidden'});}
 setExpanded(value){if(this.surface==='orb'||value===this.expanded)return;this.setHoverResponse(value);const closing=this.detailMotion,wasHidden=this.details.hidden||getComputedStyle(this.details).opacity==='0';const fromOpacity=wasHidden?'0':getComputedStyle(this.details).opacity;const fromTransform=closing?getComputedStyle(this.details).transform:null;closing?.cancel();this.detailMotion=null;this.expanded=value;this.details.inert=!value;
  if(value){this.details.hidden=false;this.root.classList.add('expanded');this.notifyLayout();}
  if(this.motion.matches){this.finishDetailsImmediately();return;}
  const side=this.root.dataset.placement||'below',offset={above:'translateY(6px) scale(.985)',below:'translateY(-6px) scale(.985)',left:'translateX(6px) scale(.985)',right:'translateX(-6px) scale(.985)'}[side];
  const motion=this.details.animate([{opacity:fromOpacity,transform:fromTransform|| (value?offset:'none')},{opacity:value?'1':'0',transform:value?'none':offset}],{duration:value?280:150,easing:value?'cubic-bezier(.22,1,.36,1)':'cubic-bezier(.4,0,1,1)',fill:'forwards'});this.detailMotion=motion;
  motion.onfinish=()=>{if(this.detailMotion!==motion)return;this.details.style.opacity=value?'1':'0';motion.cancel();this.detailMotion=null;if(!value){if(this.surface==='details')this.host({type:'detailsHidden'});else{this.details.hidden=true;this.root.classList.remove('expanded');}}};
 }
 hoverEnter(){clearTimeout(this.hoverTimer);this.setHoverResponse(true);if(this.surface==='standalone')this.setExpanded(true);else this.host({type:'hover',inside:true});}
 hoverLeave(){clearTimeout(this.hoverTimer);if(this.surface==='standalone')this.hoverTimer=setTimeout(()=>this.setExpanded(false),170);else this.host({type:'hover',inside:false});}
 closeDetails(){clearTimeout(this.hoverTimer);if(this.surface==='standalone')this.setExpanded(false);else this.host({type:'closeDetails'});}
 renderSessions(){const s=this.state,threads=this.activityFresh()&&Array.isArray(s.activeThreads)?s.activeThreads:null,key=JSON.stringify(threads);if(key===this.sessionsKey)return;this.sessionsKey=key;const list=this.root.querySelector('[data-sessions]');list.replaceChildren();this.root.querySelector('[data-session-count]').textContent=threads?.length?String(threads.length):'';
  this.root.querySelector('.sessions').hidden=!threads?.length;
  for(const thread of threads||[]){if(typeof thread.threadId!=='string')continue;const button=document.createElement('button');button.type='button';button.className='session-row';button.dataset.threadId=thread.threadId;button.textContent=thread.title||'未命名会话';button.title=button.textContent;button.setAttribute('aria-label',`打开会话：${button.textContent}`);list.appendChild(button);}
  if(this.expanded||this.surface==='details')this.notifyLayout();
 }
 profile(){const points=[[35.4,11],[35.4,15.4],[24.65,21],[24.65,23]],edge=Array.from({length:241},(_,i)=>{const t=i/240,k=1-t;return {y:k*k*k*points[0][1]+3*k*k*t*points[1][1]+3*k*t*t*points[2][1]+t*t*t*points[3][1],w:2*(k*k*k*points[0][0]+3*k*k*t*points[1][0]+3*k*t*t*points[2][0]+t*t*t*points[3][0]-24)};});const cap=Array.from({length:61},(_,i)=>{const t=i/60;return {y:10.2+.8*t,w:22.8*Math.sqrt(Math.max(0,1-(1-t)*(1-t)))};});return [...cap,...edge.slice(1)];}
 path(rows){if(rows.length<2)return '';const left=rows.map(p=>`${(24-p.w/2).toFixed(4)},${p.y.toFixed(4)}`),right=[...rows].reverse().map(p=>`${(24+p.w/2).toFixed(4)},${p.y.toFixed(4)}`);return `M${left.join(' L')} L${right.join(' L')} Z`;}
 area(rows){let sum=0;for(let i=1;i<rows.length;i++)sum+=(rows[i].y-rows[i-1].y)*(rows[i].w+rows[i-1].w)/2;return sum;}
 upperFill(percent){const rows=this.upper;if(percent<=0)return '';if(percent>=100)return this.path(rows);const target=this.area(rows)*percent/100;let sum=0;for(let i=rows.length-1;i>0;i--){const b=rows[i],a=rows[i-1],dy=b.y-a.y,segment=dy*(a.w+b.w)/2;if(sum+segment>=target){let lo=0,hi=1;for(let j=0;j<25;j++){const f=(lo+hi)/2,p=dy*(b.w*f+(a.w-b.w)*f*f/2);if(p<target-sum)lo=f;else hi=f;}const f=(lo+hi)/2;return this.path([{y:b.y-dy*f,w:b.w+(a.w-b.w)*f},...rows.slice(i)]);}sum+=segment;}return this.path(rows);}
 mound(height){const rows=this.lower,tip=rows.at(-1).y-height,result=[];for(const p of rows)if(p.y>=tip){if(!result.length&&p.y>tip&&tip>=rows[0].y)result.push({y:tip,w:0});result.push({y:p.y,w:Math.min(p.w,Math.max(0,2*(p.y-tip)/.36))});}return result;}
 lowerFill(percent){const rows=this.lower;if(percent<=0)return {d:'',landing:rows.at(-1).y};if(percent>=100)return {d:this.path(rows),landing:rows[0].y};let lo=0,hi=28;const target=this.area(rows)*percent/100;for(let i=0;i<30;i++){const h=(lo+hi)/2;if(this.area(this.mound(h))<target)lo=h;else hi=h;}const h=(lo+hi)/2;return {d:this.path(this.mound(h)),landing:Math.max(rows[0].y,rows.at(-1).y-h)};}
 update(next){const old=this.state,scopeChanged=old.accountScope!==next.accountScope;
  const shouldFlip=!scopeChanged&&this.initialized&&Number.isFinite(next.remainingFiveHour)&&next.status==='live'&&Number(next.resetSerial)>Number(old.resetSerial);
  this.state={...next};if(scopeChanged){this.cancelFlip();this.initialized=false;}if(Number.isFinite(next.remainingFiveHour))this.initialized=true;
  if(shouldFlip&&!this.motion.matches&&!document.hidden&&!this.flip){this.stopParticles();const animation=this.glass.animate([{transform:'rotate(0deg)'},{transform:'rotate(180deg)'}],{duration:760,easing:'cubic-bezier(.45,0,.2,1)'});this.flip=animation;
   animation.onfinish=()=>{if(this.flip!==animation)return;this.flip=null;this.renderSand();this.syncParticles();this.root.querySelector('[data-announcement]').textContent='5 小时额度已重置';};
  }
  this.render();
 }
 cancelFlip(){if(this.flip){this.flip.cancel();this.flip=null;}}
 render(){const s=this.state,known=Number.isFinite(s.remainingWeek);this.root.classList.toggle('unknown',!Number.isFinite(s.remainingFiveHour));const ring=this.root.querySelector('[data-week]');ring.setAttribute('stroke-dashoffset',known?100-Math.max(0,Math.min(100,s.remainingWeek)):100);ring.style.opacity=known&&s.remainingWeek>0?'1':'0';if(!this.flip)this.renderSand();this.renderDetails();this.syncParticles();this.orb.setAttribute('aria-label',`Codex 额度：5 小时 ${this.percent(s.remainingFiveHour)}，本周 ${this.percent(s.remainingWeek)}，悬停查看详情`);}
 renderSand(){const quota=this.state.remainingFiveHour,q=Number.isFinite(quota)?Math.max(0,Math.min(100,quota)):null;if(this.sandQuota===q)return;this.sandQuota=q;if(q===null){this.root.querySelector('[data-top]').setAttribute('d','');this.root.querySelector('[data-bottom]').setAttribute('d','');this.landing=36;return;}const bottom=this.lowerFill(100-q);this.root.querySelector('[data-top]').setAttribute('d',this.upperFill(q));this.root.querySelector('[data-bottom]').setAttribute('d',bottom.d);this.landing=bottom.landing;}
 percent(value){return Number.isFinite(value)?`${Math.round(value)}%`:'—';}
 resetTime(epoch){if(!Number.isFinite(epoch))return '重置时间暂不可用';const secs=epoch-Date.now()/1000;if(secs<=0)return '等待额度更新';if(secs>=86400)return `${Math.floor(secs/86400)} 天 ${Math.floor(secs%86400/3600)} 小时后重置`;return `${Math.floor(secs/3600)} 小时 ${Math.ceil(secs%3600/60)} 分后重置`;}
 activityFresh(){const stamp=this.state.activityUpdatedAt;return Number.isFinite(stamp)&&Math.abs(Date.now()/1000-stamp)<=10;}
 renderDetails(){const s=this.state;this.root.querySelector('[data-five-value]').textContent=this.percent(s.remainingFiveHour);this.root.querySelector('[data-week-value]').textContent=this.percent(s.remainingWeek);this.root.querySelector('[data-five-reset]').textContent=this.resetTime(s.primaryResetsAt);this.root.querySelector('[data-week-reset]').textContent=this.resetTime(s.weeklyResetsAt);this.renderSessions();}
 setDebug(next){const bounded=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;this.debug={enabled:next?.enabled===true,flow:bounded(next?.flow,4)?next.flow:1,sparkle:bounded(next?.sparkle,2)?next.sparkle:1,style:['soft','crystal','star','trail','color','fine'].includes(next?.style)?next.style:'soft'};if(this.debug.enabled)this.particleSpeed=this.debug.flow;this.syncParticles();}
 particlesAllowed(){return this.surface!=='details'&&(this.debug.enabled||(this.state.activeSessions>0&&this.activityFresh()))&&!this.motion.matches&&!document.hidden&&!this.flip;}
 particleTargetSpeed(){if(this.debug.enabled)return this.debug.flow;const s=this.state,rate=s.weightedTokensPerSecond,age=Math.abs(Date.now()/1000-s.tokenPaceUpdatedAt);return Number.isFinite(s.tokenPaceUpdatedAt)&&age<=10&&Number.isFinite(rate)&&rate>=0 ? .45+1.75*rate/(rate+500) : .45;}
 stopParticles(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.particleSpeed=.45;this.root.querySelector('[data-grains]').replaceChildren();}
 syncParticles(){
  if(!this.particlesAllowed()){this.stopParticles();return;}
  const mode=this.debug.enabled&&this.debug.style==='fine'?'fine':'classic';
  if(this.raf&&this.particleMode!==mode)this.stopParticles();
  if(this.raf)return;
  this.particleMode=mode;
  if(mode==='fine'){this.startFineSand();return;}
  const palette=['#d9ad63','#7cbac6','#baa0d4','#d5a0b3','#90b3d5','#d7bc86'];
  const vivid=['#c89432','#359caf','#9870c5','#cb789c','#628fc8','#ce9b48'];
  const container=this.root.querySelector('[data-grains]');
  const makeCircle=(className,r)=>{const el=document.createElementNS('http://www.w3.org/2000/svg','circle');el.setAttribute('class',className);el.setAttribute('r',r);el.setAttribute('cx','24');el.style.opacity='0';container.appendChild(el);return el;};
  const makeMark=className=>{const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('class',className);el.style.opacity='0';container.appendChild(el);return el;};
  const grains=Array.from({length:5},(_,i)=>({el:makeCircle('grain',i%2?'.35':'.42'),halo:makeCircle('grain-glow','1.15'),glint:makeCircle('grain-glint','.53'),light:makeCircle('grain-light','.18'),star:makeMark('grain-star'),trail:makeMark('grain-trail'),phase:i*165,index:i}));
  for(const g of grains)container.appendChild(g.light);
  let previous=performance.now(),elapsed=0;
  const step=now=>{
   if(!this.particlesAllowed()){this.stopParticles();return;}
   const dt=Math.max(0,Math.min(.1,(now-previous)/1000));previous=now;
   if(this.debug.enabled)this.particleSpeed=this.debug.flow;else this.particleSpeed+=(this.particleTargetSpeed()-this.particleSpeed)*(1-Math.exp(-dt/2));elapsed+=dt*1000*this.particleSpeed;
   for(const g of grains){
    const age=elapsed+g.phase,cycle=Math.floor(age/900),t=(age%900)/700;
    if(t>=1){for(const el of [g.el,g.halo,g.glint,g.light,g.star,g.trail])el.style.opacity='0';continue;}
    const y=23.15+(Math.max(25.5,Number.isFinite(this.landing)?this.landing:38)-23.15)*t*t,opacity=t>.9?(1-t)/.1:.86;
    const center=.32+((cycle+g.index*2)%5)*.07;
    const flash=(cycle+g.index)%3===0?0:Math.pow(Math.max(0,1-Math.abs(t-center)/.22),2);
    const color=palette[(cycle+g.index)%palette.length];
    for(const el of [g.el,g.halo,g.glint,g.light])el.setAttribute('cy',y);
    g.el.style.opacity=String(opacity);
    g.halo.style.fill=color;g.glint.style.fill=color;
    const shine=this.debug.enabled?this.debug.sparkle:1;
    g.halo.style.opacity=String(Math.min(1,flash*opacity*.24*shine));g.glint.style.opacity=String(Math.min(1,flash*opacity*shine));g.light.style.opacity=String(Math.min(1,flash*opacity*.9*shine));
    const style=this.debug.enabled?this.debug.style:'soft',amount=Math.min(1,shine),size=1+.3*shine;
    const shimmer=Math.pow(Math.max(0,1-Math.abs(t-(.38+g.index%3*.07))/.38),.65);
    const tint=vivid[(cycle+g.index)%vivid.length],strength=opacity*amount;
    g.el.style.fill='';g.el.setAttribute('r',g.index%2?'.35':'.42');
    g.glint.setAttribute('r','.53');g.halo.setAttribute('r','1.15');g.light.setAttribute('r','.18');
    g.star.style.opacity='0';g.trail.style.opacity='0';
    if(style==='crystal'||style==='star'){
     g.halo.style.fill=tint;g.glint.style.fill=tint;
     g.halo.setAttribute('r',String(1.25*size));g.glint.setAttribute('r',String(.75*size));g.light.setAttribute('r',String(.26*size));
     g.halo.style.opacity=String(shimmer*strength*.22);g.glint.style.opacity=String(shimmer*strength);g.light.style.opacity=String(shimmer*strength);
     if(style==='star'){
      const r=1.45*size,k=.30*size;
      g.star.setAttribute('d',`M24 ${y-r} L${24+k} ${y-k} L${24+r} ${y} L${24+k} ${y+k} L24 ${y+r} L${24-k} ${y+k} L${24-r} ${y} L${24-k} ${y-k} Z`);
      g.star.style.fill=tint;g.star.style.opacity=String(shimmer*strength);
      g.glint.style.opacity=String(shimmer*strength*.4);
     }
    }else if(style==='trail'){
     const length=Math.min(3.4*size,Math.max(0,y-23.15));
     g.trail.setAttribute('d',`M24 ${y-length} L24 ${y}`);g.trail.setAttribute('fill','none');g.trail.setAttribute('stroke',tint);g.trail.setAttribute('stroke-width',String(.48*size));g.trail.setAttribute('stroke-linecap','round');
     g.trail.style.opacity=String(strength*(.35+.5*shimmer));g.glint.style.fill=tint;g.glint.setAttribute('r',String(.50*size));g.glint.style.opacity=String(strength);g.halo.style.opacity='0';g.light.setAttribute('r',String(.22*size));g.light.style.opacity=String(shimmer*strength);
    }else if(style==='color'){
     g.glint.style.fill=tint;g.glint.setAttribute('r',String(.75*size));g.glint.style.opacity=String(strength*(.7+.3*shimmer));
     g.halo.style.fill=tint;g.halo.setAttribute('r',String(.95*size));g.halo.style.opacity=String(strength*.14);g.light.setAttribute('r',String(.22*size));g.light.style.opacity=String(strength*shimmer*.8);
    }
   }
   this.raf=requestAnimationFrame(step);
  };
  this.raf=requestAnimationFrame(step);
 }

 startFineSand(){
  const ns='http://www.w3.org/2000/svg',container=this.root.querySelector('[data-grains]');
  const make=(tag,attributes={},parent=container)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);parent.appendChild(node);return node;};
  const id=`fine-${QuotaWidget.fineSequence=(QuotaWidget.fineSequence||0)+1}`;
  const begin=this.upper.at(-1).y-.2,tileHeight=12.8;
  const defs=make('defs'),interior=make('clipPath',{id:`${id}-inside`},defs);
  make('path',{d:`${this.path(this.upper)} ${this.path(this.lower)} M23.45 23 H24.55 V25 H23.45 Z`},interior);
  const clip=make('clipPath',{id:`${id}-window`},defs);
  const windowRect=make('rect',{class:'fine-window',x:22.55,y:begin,width:2.9,height:1},clip);
  const bounds=make('g',{'clip-path':`url(#${id}-inside)`});
  const stream=make('g',{class:'fine-sand','clip-path':`url(#${id}-window)`},bounds);
  const moving=make('g',{class:'fine-moving'},stream),tile=make('g',{class:'fine-tile'},moving);
  const hash=n=>{const x=Math.sin(n*127.1+91.3)*43758.5453;return x-Math.floor(x);};
  const grains=Array.from({length:1600},(_,i)=>{
   const normal=Math.sqrt(-2*Math.log(Math.max(.00001,hash(i*8+3))))*Math.cos(2*Math.PI*hash(i*8+4));
   const x=i%10===0?(hash(i*8+5)-.5)*2.12:Math.max(-1.02,Math.min(1.02,normal*.28));
   return make('circle',{class:`fine-grain fine-${i%11===0?'bright':i%3===0?'mid':'base'}`,cx:x.toFixed(5),cy:(hash(i*8+6)*tileHeight).toFixed(5),r:(.032+hash(i*8+7)*.047).toFixed(5),opacity:(.52+hash(i*8+8)*.43).toFixed(3)},tile);
  });
  const copy=tile.cloneNode(true);copy.classList.replace('fine-tile','fine-tile-copy');copy.setAttribute('transform',`translate(0 ${tileHeight})`);moving.appendChild(copy);
  const copies=[...copy.children],singleGroup=make('g',{class:'fine-singles'},stream);
  const singles=Array.from({length:3},(_,i)=>make('circle',{class:`fine-single fine-${i===1?'bright':'mid'}`,cx:24,cy:24,r:(.2+hash(i+61)*.055).toFixed(4),opacity:.92},singleGroup));
  let previous=performance.now(),elapsed=470,settingsKey='',landingKey=null;
  const draw=()=>{
   const flow=this.debug.flow,shine=this.debug.sparkle,end=Math.max(begin+.2,Number.isFinite(this.landing)?this.landing+.08:38);
   if(landingKey!==end){windowRect.setAttribute('height',end-begin);landingKey=end;}
   const key=`${flow}/${shine}`;
   if(key!==settingsKey){
    settingsKey=key;const discrete=flow<=.12,count=Math.min(grains.length,Math.round(1040*Math.sqrt(flow)));
    stream.dataset.mode=discrete?'single':'stream';moving.style.display=discrete?'none':'';singleGroup.style.display=discrete?'':'none';
    stream.style.setProperty('--fine-light',`${shine*50}%`);
    for(let i=0;i<grains.length;i++){const display=i<count?'':'none';grains[i].style.display=display;copies[i].style.display=display;}
   }
   moving.setAttribute('transform',`translate(24 ${(begin+(elapsed*.0043)%tileHeight-tileHeight).toFixed(5)}) scale(${Math.sqrt(flow).toFixed(5)} 1)`);
   const flight=(end-begin)/.0043;
   singles.forEach((node,i)=>node.setAttribute('cy',(begin+((elapsed+i*flight/3)%flight)*.0043).toFixed(5)));
  };
  const step=now=>{
   if(!this.particlesAllowed()){this.stopParticles();return;}
   const dt=Math.max(0,Math.min(100,now-previous));previous=now;
   if(this.debug.flow>0)elapsed+=dt;
   draw();this.raf=requestAnimationFrame(step);
  };
  draw();this.raf=requestAnimationFrame(step);
 }

}
window.QuotaWidget=QuotaWidget;
