import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export async function readSettings(file){
 try{const data=JSON.parse(await readFile(file,'utf8'));return {visible:data?.visible===true,globalDisplay:data?.globalDisplay!==false};}
 catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return {visible:false,globalDisplay:true};throw error;}
}
export async function writeSettings(file,set){
 if(!set||typeof set!=='object'||Object.keys(set).length===0||Object.entries(set).some(([key,value])=>!['visible','globalDisplay'].includes(key)||typeof value!=='boolean'))throw new TypeError('Settings must contain boolean display controls');
 const next={...await readSettings(file),...set};
 await mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const temporary=`${file}.${process.pid}.${randomUUID()}.pending`;
 try{await writeFile(temporary,JSON.stringify(next),{mode:0o600});await rename(temporary,file);}
 finally{await unlink(temporary).catch(()=>{});}
 return next;
}
export async function readVisibility(file){return (await readSettings(file)).visible;}
export async function writeVisibility(file,visible){return writeSettings(file,{visible});}

export const sparkleStyles=['soft','crystal','star','trail','color','fine'];
export async function readDebugSettings(file){
 let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return {enabled:false,flow:1,sparkle:1,style:'soft'};throw error;}
 const bounded=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 return {enabled:data?.enabled===true,flow:bounded(data?.flow,4)?data.flow:1,sparkle:bounded(data?.sparkle,2)?data.sparkle:1,style:sparkleStyles.includes(data?.style)?data.style:'soft'};
}
export async function writeDebugSettings(file,set){
 if(!set||!Object.keys(set).length||Object.entries(set).some(([key,v])=>key==='enabled'?typeof v!=='boolean':key==='style'?!sparkleStyles.includes(v):!['flow','sparkle'].includes(key)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>(key==='flow'?4:2)))throw new TypeError('Invalid sand debug settings');
 const next={...await readDebugSettings(file),...set};
 await mkdir(path.dirname(file),{recursive:true,mode:0o700});const temporary=`${file}.${process.pid}.${randomUUID()}.pending`;
 try{await writeFile(temporary,JSON.stringify(next),{mode:0o600});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
 return next;
}

const validCoefficient=value=>typeof value==='number'&&Number.isFinite(value)&&value>=.001&&value<=10;
const validModel=name=>/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(name);
export async function readPaceSettings(file){
 let data;
 try{data=JSON.parse(await readFile(file,'utf8'));}
 catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return {defaultCoefficient:1,models:{}};throw error;}
 return {defaultCoefficient:validCoefficient(data?.defaultCoefficient)?data.defaultCoefficient:1,
  models:Object.fromEntries(Object.entries(data?.models&&typeof data.models==='object'?data.models:{}).filter(([name,value])=>validModel(name)&&validCoefficient(value)))};
}
export async function writePaceSettings(file,set){
 if(!set||typeof set!=='object'||!Object.keys(set).length||Object.keys(set).some(key=>!['defaultCoefficient','models'].includes(key))||
  ('defaultCoefficient' in set&&!validCoefficient(set.defaultCoefficient))||
  ('models' in set&&(!set.models||typeof set.models!=='object'||Array.isArray(set.models)||Object.entries(set.models).some(([name,value])=>!validModel(name)||(value!==null&&!validCoefficient(value))))))throw new TypeError('Model coefficients must be finite numbers between 0.001 and 10');
 const next=await readPaceSettings(file);
 if('defaultCoefficient' in set)next.defaultCoefficient=set.defaultCoefficient;
 for(const [name,value] of Object.entries(set.models||{})){if(value===null)delete next.models[name];else next.models[name]=value;}
 await mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const temporary=`${file}.${process.pid}.${randomUUID()}.pending`;
 try{await writeFile(temporary,JSON.stringify(next),{mode:0o600});await rename(temporary,file);}
 finally{await unlink(temporary).catch(()=>{});}
 return next;
}

export function apiPriceCoefficients(catalog){
 if(!catalog||catalog.currency!=='USD'||catalog.unit!=='per-million-tokens'||catalog.baseline!=='gpt-6.1-sol'||catalog.inputShare!==.5||catalog.outputShare!==.5||!/^\d{4}-\d{2}-\d{2}$/.test(catalog.verifiedOn)||new Date(catalog.verifiedOn).toISOString().slice(0,10)!==catalog.verifiedOn||!catalog.models||Array.isArray(catalog.models))throw new TypeError('Use the verified USD text price catalog with the existing 1:1 blend and baseline');
 const blended={};
 for(const [model,price] of Object.entries(catalog.models)){
  const host=model.startsWith('gpt-')?'developers.openai.com':model.startsWith('deepseek-')?'api-docs.deepseek.com':model.startsWith('mimo-')?'mimo.mi.com':null;
  const source=new URL(price.source);
  if(!validModel(model)||!host||source.protocol!=='https:'||source.hostname!==host||source.username||source.password||source.port||![price.input,price.output].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=10000))throw new TypeError('Prices require positive amounts and matching official sources');
  blended[model]=(price.input+price.output)/2;
 }
 const baseline=blended[catalog.baseline];
 if(!baseline)throw new TypeError('The baseline price is missing');
 const weights=Object.fromEntries(Object.entries(blended).map(([model,price])=>[model,Number((price/baseline).toPrecision(12))]));
 if(Object.values(weights).some(v=>!validCoefficient(v)))throw new RangeError('Price ratios are outside the supported motion range');
 return weights;
}
export async function readApiPrices(priceFile,fallbackCatalog){
 let catalog;
 try{catalog=JSON.parse(await readFile(priceFile,'utf8'));}
 catch(error){if(error.code==='ENOENT')catalog=fallbackCatalog;else throw error;}
 apiPriceCoefficients(catalog);
 return catalog;
}
export async function applyApiPrices({paceFile,priceFile,fallbackCatalog,catalog}){
 const incoming=apiPriceCoefficients(catalog),previousCatalog=await readApiPrices(priceFile,fallbackCatalog);
 if(catalog.verifiedOn<previousCatalog.verifiedOn)throw new RangeError('A price refresh cannot move the verified date backwards');
 const previousWeights=apiPriceCoefficients(previousCatalog),previousPace=await readPaceSettings(paceFile),set={},preservedModels=[];
 for(const [model,weight] of Object.entries(incoming)){
  const old=previousWeights[model],current=previousPace.models[model];
  const managed=old!==undefined&&current!==undefined&&Math.abs(old-current)<=1e-9*Math.max(1,old);
  if(managed||(old===undefined&&current===undefined))set[model]=weight;else preservedModels.push(model);
 }
 await mkdir(path.dirname(priceFile),{recursive:true,mode:0o700});
 const temporary=`${priceFile}.${process.pid}.${randomUUID()}.pending`;
 let coefficients;
 try{
  await writeFile(temporary,JSON.stringify(catalog),{mode:0o600});
  coefficients=await writePaceSettings(paceFile,{models:set});
  try{await rename(temporary,priceFile);}catch(error){
   await writePaceSettings(paceFile,{models:Object.fromEntries(Object.keys(set).map(model=>[model,previousPace.models[model]??null]))});throw error;
  }
 }finally{await unlink(temporary).catch(()=>{});}
 return {verifiedOn:catalog.verifiedOn,coefficients,updatedModels:Object.keys(set),preservedModels};
}
