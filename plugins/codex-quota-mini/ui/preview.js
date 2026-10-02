const widgets=[new QuotaWidget(document.getElementById('large')),new QuotaWidget(document.getElementById('small'))];
widgets[0].root.classList.add('large');
const state={remainingFiveHour:10,remainingWeek:39,primaryResetsAt:Date.now()/1000+300,weeklyResetsAt:Date.now()/1000+172800,activeSessions:1,weightedTokensPerSecond:30,resetSerial:0,accountScope:'demo',status:'live',quotaUpdatedAt:Date.now()/1000};
function render(){state.activityUpdatedAt=Date.now()/1000;state.quotaUpdatedAt=Date.now()/1000;state.tokenPaceUpdatedAt=Date.now()/1000;widgets.forEach(widget=>widget.update(state));document.getElementById('status').textContent=`演示数据 · 5 小时剩余 ${state.remainingFiveHour}% · ${state.activeSessions?'会话运行中':'会话已暂停'}`;}
document.getElementById('reset').onclick=()=>{state.resetSerial++;state.primaryResetsAt+=18000;state.remainingFiveHour=100;render();};
document.getElementById('consume').onclick=()=>{state.remainingFiveHour=Math.max(0,state.remainingFiveHour-25);render();};
const paces=[{rate:30,label:'轻缓'},{rate:500,label:'适中'},{rate:3000,label:'迅速'}];let paceIndex=0;
document.getElementById('pace').onclick=event=>{paceIndex=(paceIndex+1)%paces.length;state.weightedTokensPerSecond=paces[paceIndex].rate;event.target.textContent=`落沙：${paces[paceIndex].label}`;render();};
document.getElementById('running').onclick=event=>{state.activeSessions=state.activeSessions?0:1;event.target.textContent=state.activeSessions?'暂停会话':'启动会话';render();};
render();
setInterval(render,2000);
