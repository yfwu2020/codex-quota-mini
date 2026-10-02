import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {access} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readSettings,writeSettings,readPaceSettings,writePaceSettings,readApiPrices,applyApiPrices,readDebugSettings,writeDebugSettings,sparkleStyles} from './preferences.mjs';
import fallbackCatalog from '../assets/api-prices.json' with {type:'json'};

const support=process.env.QUOTA_MINI_SUPPORT||path.join(homedir(),'Library/Application Support/Codex Quota Mini');
const controls=path.join(support,'control.json');
const paceFile=path.join(support,'pace.json');
const priceFile=path.join(support,'prices.json');
const debugFile=path.join(support,'debug.json');
const app=path.join(support,'Codex Quota Mini.app');
const execute=promisify(execFile);
const capability={readTool:'quota_read_settings',updateTool:'quota_update_settings'};
const server=new McpServer({name:'codex-quota-mini-mcp-server',title:'Codex Quota Mini',version:'0.8.6'},
 {capabilities:{experimental:{'openai/settings':capability}}});
const coefficient=z.number().min(.001).max(10);
const paceSchema=z.object({defaultCoefficient:coefficient,models:z.record(z.string(),coefficient)});
const priceSchema=z.object({verifiedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),currency:z.literal('USD'),unit:z.literal('per-million-tokens'),baseline:z.literal('gpt-6.1-sol'),inputShare:z.literal(.5),outputShare:z.literal(.5),assumptions:z.array(z.string()).optional(),models:z.record(z.string(),z.object({input:z.number().positive().max(10000),output:z.number().positive().max(10000),source:z.url()}).strict())}).strict();
const values=async()=>{const debug=await readDebugSettings(debugFile);return {...await readSettings(controls),modelCoefficient:(await readPaceSettings(paceFile)).defaultCoefficient,debugMode:debug.enabled,sandFlow:debug.flow,sandSparkle:debug.sparkle,sandSparkleStyle:debug.style};};
const settingsSchema=z.object({visible:z.boolean(),globalDisplay:z.boolean(),modelCoefficient:coefficient,debugMode:z.boolean(),sandFlow:z.number().min(0).max(4),sandSparkle:z.number().min(0).max(2),sandSparkleStyle:z.enum(sparkleStyles)});
const annotations={destructiveHint:false,idempotentHint:true,openWorldHint:false};
let updateTail=Promise.resolve();

server.registerTool('quota_read_settings',{
 title:'读取额度圆设置',description:'读取悬浮额度圆的显示和全局显示开关，供插件设置页使用。不会启动应用或读取账户信息。',
 inputSchema:z.object({}).strict(),
 outputSchema:z.object({schema:z.object({type:z.literal('object'),properties:z.record(z.string(),z.unknown())}),values:settingsSchema,layout:z.array(z.unknown())}),
 annotations:{...annotations,readOnlyHint:true}
},async()=>{
 const result={schema:{type:'object',properties:{sandSparkleStyle:{type:'string',title:'落沙方案',enum:sparkleStyles,description:'soft 原有柔光 / crystal 晶点 / star 星芒 / trail 流光 / color 彩砂 / fine 灰度细砂；仅调试时生效。'},debugMode:{type:'boolean',title:'调试落沙',description:'使用手动流速预览，不改变额度。关闭后恢复自动流速。'},sandFlow:{type:'number',title:'调试流量／流速',minimum:0,maximum:4,description:'0 暂停；细砂方案以粗细和密度表示流量，0.01–0.12 逐粒落下，1 标准，4 最多；其他方案调整下落速度。仅调试时生效。'},sandSparkle:{type:'number',title:'调试闪耀程度',minimum:0,maximum:2,description:'0 关闭反光，1 标准，2 加强；细砂方案只改变灰度亮度。仅调试时生效。'},visible:{type:'boolean',title:'显示悬浮圆',description:'打开显示 D4 额度沙漏；关闭隐藏悬浮圆。'},globalDisplay:{type:'boolean',title:'全局显示',description:'开启：在所有应用中显示。关闭：仅在 Codex 位于前台时显示，切换其他应用自动隐藏。'},modelCoefficient:{type:'number',title:'默认模型系数',minimum:.001,maximum:10,description:'未单独设置的模型使用此落沙动效权重，默认 1 倍。不影响实际额度。'}}},values:await values(),layout:[{kind:'group',title:'悬浮额度圆',items:[{kind:'property',property:'visible'},{kind:'property',property:'globalDisplay'}]},{kind:'group',title:'落沙速度',items:[{kind:'property',property:'modelCoefficient'}]},{kind:'group',title:'落沙调试',items:[{kind:'property',property:'debugMode'},{kind:'property',property:'sandFlow'},{kind:'property',property:'sandSparkle'},{kind:'property',property:'sandSparkleStyle'}]}]};
 return {content:[],structuredContent:result};
});

server.registerTool('quota_update_settings',{
 title:'更新额度圆设置',description:'更新本机悬浮额度圆的显示开关和显示范围。开启显示时显示或启动现有应用；全局显示关闭时，仅在 Codex 前台显示。可开关落沙调试并调整流速与闪耀程度；不改变真实额度，不发送推理请求。',
 inputSchema:z.object({set:z.object({visible:z.boolean().optional(),globalDisplay:z.boolean().optional(),modelCoefficient:coefficient.optional(),debugMode:z.boolean().optional(),sandFlow:z.number().min(0).max(4).optional(),sandSparkle:z.number().min(0).max(2).optional(),sandSparkleStyle:z.enum(sparkleStyles).optional()}).strict().refine(set=>Object.keys(set).length>0)}).strict(),
 outputSchema:z.object({values:settingsSchema}),
 annotations:{...annotations,readOnlyHint:false}
},async({set})=>{
 const update=async()=>{
  const previous=await readSettings(controls);
  const previousPace=await readPaceSettings(paceFile);
  const previousDebug=await readDebugSettings(debugFile);
  try{
   if(set.visible===true)await access(path.join(app,'Contents/MacOS/QuotaMini'));
   const display=Object.fromEntries(Object.entries(set).filter(([key])=>['visible','globalDisplay'].includes(key)));
   if('modelCoefficient' in set)await writePaceSettings(paceFile,{defaultCoefficient:set.modelCoefficient});
   const debug={};if('debugMode' in set)debug.enabled=set.debugMode;if('sandFlow' in set)debug.flow=set.sandFlow;if('sandSparkle' in set)debug.sparkle=set.sandSparkle;if('sandSparkleStyle' in set)debug.style=set.sandSparkleStyle;if(Object.keys(debug).length)await writeDebugSettings(debugFile,debug);
   if(Object.keys(display).length)await writeSettings(controls,display);
   if(set.visible===true)await execute('/usr/bin/open',['-g',app],{timeout:10000});
   return {content:[{type:'text',text:'悬浮圆显示设置已更新'}],structuredContent:{values:await values()}};
  }catch(error){await writeSettings(controls,previous);await writePaceSettings(paceFile,previousPace);await writeDebugSettings(debugFile,previousDebug);console.error('Quota display update failed:',error.message);return {isError:true,content:[{type:'text',text:'无法更新设置，请先启动或重新安装 Codex Quota Mini。'}]};}
 };
 const result=updateTail.then(update,update);
 updateTail=result.then(()=>{},()=>{});
 return result;
});

server.registerTool('quota_read_model_coefficients',{
 title:'读取落沙模型系数',description:'读取 token 落沙速度的默认权重与各模型权重；权重只影响动效。',
 inputSchema:z.object({}).strict(),outputSchema:paceSchema,annotations:{...annotations,readOnlyHint:true}
},async()=>({content:[],structuredContent:await readPaceSettings(paceFile)}));
server.registerTool('quota_update_model_coefficients',{
 title:'调整落沙模型系数',description:'调整默认或指定模型的落沙动效权重，默认 1 倍。模型值设为 null 恢复默认。更新在两秒左右生效，不发送推理请求或改变真实额度。',
 inputSchema:z.object({defaultCoefficient:coefficient.optional(),models:z.record(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/),coefficient.nullable()).optional()}).strict().refine(set=>Object.keys(set).length>0),
 outputSchema:paceSchema,annotations:{...annotations,readOnlyHint:false}
},async set=>{
 const result=updateTail.then(async()=>({content:[{type:'text',text:'落沙模型系数已更新'}],structuredContent:await writePaceSettings(paceFile,set)}));
 updateTail=result.then(()=>{},()=>{});
 return result;
});

server.registerTool('quota_read_api_prices',{
 title:'读取模型价格快照',description:'读取用于落沙系数的官方美元价格快照和来源日期，不联网。',
 inputSchema:z.object({}).strict(),outputSchema:priceSchema,annotations:{...annotations,readOnlyHint:true}
},async()=>({content:[],structuredContent:await readApiPrices(priceFile,fallbackCatalog)}));
server.registerTool('quota_apply_api_prices',{
 title:'按官方价格更新模型系数',description:'应用已核对的官方美元价格，以 GPT-6.1 Sol 为基准、输入输出各占一半。只更新仍匹配上次价格结果的模型与新模型；保留手动调整或清除的系数及显示设置。不发送推理请求。',
 inputSchema:z.object({catalog:priceSchema}).strict(),outputSchema:z.object({verifiedOn:z.string(),coefficients:paceSchema,updatedModels:z.array(z.string()),preservedModels:z.array(z.string())}),annotations:{...annotations,readOnlyHint:false}
},async({catalog})=>{
 const result=updateTail.then(async()=>({content:[{type:'text',text:'官方价格快照与模型系数已更新，手动设置已保留'}],structuredContent:await applyApiPrices({paceFile,priceFile,fallbackCatalog,catalog})}));
 updateTail=result.then(()=>{},()=>{});return result;
});

await server.connect(new StdioServerTransport());
