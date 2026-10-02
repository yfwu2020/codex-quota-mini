import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readVisibility,writeVisibility} from '../server/preferences.mjs';

test('Missing preferences default hidden and reads do not create files',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-settings-'));
 try{const file=path.join(dir,'control.json');assert.equal(await readVisibility(file),false);await assert.rejects(readFile(file),{code:'ENOENT'});}finally{await rm(dir,{recursive:true});}
});

test('Price refresh updates managed coefficients while preserving manual changes and removals',async()=>{
 const preferences=await import('../server/preferences.mjs');
 assert.equal(typeof preferences.applyApiPrices,'function','Safe price refresh is missing');
 const dir=await mkdtemp(path.join(tmpdir(),'quota-price-refresh-'));
 const source=name=>`https://developers.openai.com/api/docs/models/${name}`;
 const old={verifiedOn:'2026-10-02',currency:'USD',unit:'per-million-tokens',baseline:'gpt-6.1-sol',inputShare:.5,outputShare:.5,models:{'gpt-6.1-sol':{input:2,output:10,source:source('gpt-6.1-sol')},'gpt-6-astra':{input:10,output:50,source:source('gpt-6-astra')},'gpt-6-luna':{input:.1,output:.5,source:source('gpt-6-luna')}}};
 try {
  const paceFile=path.join(dir,'pace.json'),priceFile=path.join(dir,'prices.json');
  await preferences.writePaceSettings(paceFile,{defaultCoefficient:1.5,models:{'gpt-6.1-sol':1,'gpt-6-astra':3}});
  const catalog=structuredClone(old);catalog.models['gpt-6.1-sol'].input=1;catalog.models['gpt-6.1-sol'].output=5;
  catalog.models['gpt-5.6-sol']={input:4,output:20,source:source('gpt-5.6-sol')};
  const result=await preferences.applyApiPrices({paceFile,priceFile,fallbackCatalog:old,catalog});
  assert.equal(result.coefficients.defaultCoefficient,1.5);
  assert.equal(result.coefficients.models['gpt-6.1-sol'],1);
  assert.equal(result.coefficients.models['gpt-6-astra'],3,'Manual weight survives price changes');
  assert.equal(result.coefficients.models['gpt-6-luna'],undefined,'Explicit removal stays removed');
  assert.equal(result.coefficients.models['gpt-5.6-sol'],4,'New priced models receive normalized weights');
  assert.deepEqual(result.preservedModels,['gpt-6-astra','gpt-6-luna']);
  assert.deepEqual(JSON.parse(await readFile(priceFile,'utf8')),catalog);
  const invalid=structuredClone(catalog);invalid.models['gpt-6-astra'].source='https://untrusted.example/prices';
  await assert.rejects(preferences.applyApiPrices({paceFile,priceFile,fallbackCatalog:old,catalog:invalid}));
  assert.deepEqual(await preferences.readPaceSettings(paceFile),result.coefficients,'Invalid prices leave configuration unchanged');
 }finally{await rm(dir,{recursive:true});}
});

test('API-price weights below 0.1 persist without raising their price ratio',async()=>{
 const preferences=await import('../server/preferences.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'quota-low-price-'));
 try {
  const file=path.join(dir,'pace.json');
  await preferences.writePaceSettings(file,{models:{'gpt-6-luna':.05}});
  assert.equal((await preferences.readPaceSettings(file)).models['gpt-6-luna'],.05);
  await assert.rejects(preferences.writePaceSettings(file,{models:{'gpt-6-luna':.0001}}));
  assert.equal((await preferences.readPaceSettings(file)).models['gpt-6-luna'],.05);
 }finally{await rm(dir,{recursive:true});}
});
test('Visibility round trips without permitting nonboolean controls',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-settings-'));
 try{const file=path.join(dir,'control.json');await writeVisibility(file,true);assert.equal(await readVisibility(file),true);await writeVisibility(file,false);assert.equal(await readVisibility(file),false);await assert.rejects(writeVisibility(file,'yes'));assert.equal(await readVisibility(file),false);}finally{await rm(dir,{recursive:true});}
});


test('Display scope survives visibility changes and upgrades legacy preferences',async()=>{
 const {readSettings,writeSettings}=await import('../server/preferences.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'quota-settings-'));
 try{
  const file=path.join(dir,'control.json');
  await writeFile(file,JSON.stringify({visible:true}));
  assert.deepEqual(await readSettings(file),{visible:true,globalDisplay:true});
  await writeSettings(file,{globalDisplay:false});
  assert.deepEqual(await readSettings(file),{visible:true,globalDisplay:false});
  await writeVisibility(file,false);await writeVisibility(file,true);
  assert.deepEqual(await readSettings(file),{visible:true,globalDisplay:false});
  await assert.rejects(writeSettings(file,{globalDisplay:'yes'}));
  await assert.rejects(writeSettings(file,{unexpected:true}));
  assert.deepEqual(await readSettings(file),{visible:true,globalDisplay:false});
 }finally{await rm(dir,{recursive:true});}
});

test('Token weights default to one, merge overrides and remove them independently of visibility',async()=>{
 const preferences=await import('../server/preferences.mjs');
 assert.equal(typeof preferences.readPaceSettings,'function','Token weight preferences are missing');
 const dir=await mkdtemp(path.join(tmpdir(),'quota-weights-'));
 try {
  const file=path.join(dir,'pace.json');
  assert.deepEqual(await preferences.readPaceSettings(file),{defaultCoefficient:1,models:{}});
  await preferences.writePaceSettings(file,{models:{'model-a':2}});
  await preferences.writePaceSettings(file,{defaultCoefficient:1.5});
  assert.deepEqual(await preferences.readPaceSettings(file),{defaultCoefficient:1.5,models:{'model-a':2}});
  await preferences.writePaceSettings(file,{models:{'model-a':null,'model-b':3}});
  assert.deepEqual(await preferences.readPaceSettings(file),{defaultCoefficient:1.5,models:{'model-b':3}});
  await assert.rejects(preferences.writePaceSettings(file,{defaultCoefficient:0}));
  await assert.rejects(preferences.writePaceSettings(file,{models:{'model-b':Infinity}}));
  assert.deepEqual(await preferences.readPaceSettings(file),{defaultCoefficient:1.5,models:{'model-b':3}});
  await assert.rejects(readFile(path.join(dir,'control.json')),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true});}
});

test('Debug settings preserve slider changes, permit pause and reject invalid values',async()=>{
 const {readDebugSettings,writeDebugSettings}=await import('../server/preferences.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'quota-debug-'));const file=path.join(dir,'debug.json');
 try{
  assert.deepEqual(await readDebugSettings(file),{enabled:false,flow:1,sparkle:1,style:'soft'});
  await writeDebugSettings(file,{enabled:true,flow:0});await writeDebugSettings(file,{sparkle:2});
  assert.deepEqual(await readDebugSettings(file),{enabled:true,flow:0,sparkle:2,style:'soft'});
  for(const set of [{flow:-1},{flow:5},{sparkle:3},{sparkle:NaN},{enabled:'yes'},{unknown:1}])await assert.rejects(writeDebugSettings(file,set));
  await writeDebugSettings(file,{style:'star'});assert.equal((await readDebugSettings(file)).style,'star');await assert.rejects(writeDebugSettings(file,{style:'bad'}));await writeDebugSettings(file,{style:'soft'});
  await writeDebugSettings(file,{enabled:false});assert.deepEqual(await readDebugSettings(file),{enabled:false,flow:0,sparkle:2,style:'soft'});
 }finally{await rm(dir,{recursive:true});}
});
