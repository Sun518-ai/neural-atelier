const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const {parseHTML}=require('linkedom');
function boot(storage=new Map(),hash='',languages=['zh-CN']){
 const {document,window}=parseHTML(fs.readFileSync(__dirname+'/index.html','utf8'));
 window.HTMLElement.prototype.scrollIntoView=function(){};
 for(const el of document.querySelectorAll('dialog')){el.showModal=function(){this.open=true};el.close=function(){this.open=false};}
 const location=new URL('https://hacking.pub/games/neural-atelier/?version=campaign-1'+hash),listeners=new Map(),entries=[location.href];let cursor=0;
 const hashchange=()=>listeners.get('hashchange')?.();
 const navigation={pushState(_,title,url){location.href=new URL(url,location.href).href;entries.splice(++cursor);entries.push(location.href);},replaceState(_,title,url){location.href=new URL(url,location.href).href;entries[cursor]=location.href;},back(){if(cursor){location.href=entries[--cursor];hashchange();}},forward(){if(cursor+1<entries.length){location.href=entries[++cursor];hashchange();}},get length(){return entries.length;}};
 const c={window:{},document,console,navigator:{languages},location,history:navigation,addEventListener:(type,fn)=>listeners.set(type,fn),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};c.window=c;vm.createContext(c);
 for(const file of ['locales/en.js','i18n.js','music.js','shell.js','model.js','campaign.js','engine-model.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),c,{filename:file});
 for(const file of ['module-cards.js','level-progress.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8').replaceAll('export ',''),c,{filename:file});
 let code=fs.readFileSync(__dirname+'/game.js','utf8').replace(/^import .*\n/gm,'');code=code.slice(0,code.indexOf("try{\n const T="));
 vm.runInContext(code+`\nworld={relocalize(){},labels(){},rebuild(){},beforeStage(){},setStage(){},clearPackets(){},focused(){return null},async animate(){}};refresh();`,c);
 return {c,document,window,storage,location,navigation,hashchange,eval:code=>vm.runInContext(code,c)};
}
test('all 26 levels automatically display their report beside the run controls',async()=>{
 const app=boot(),M=app.c.NeuralPrologue;
 for(const id of Object.keys(M.levels)){
  app.eval(`switchLevel('${id}');state=M.solutions(stageId);if(stage().engine)state.settings.precision=16;`);
  assert.ok(app.document.querySelector('.mission h2').textContent.length);
  const reason=app.document.querySelector('#mission-reason'),example=app.document.querySelector('#mission-reason-example'),hasExample=['gating','residual'].includes(id);
  assert.equal(reason.hidden,false,id+' explains its purpose');
  for(const field of ['title','text','takeaway'])assert.ok(app.document.querySelector('#mission-reason-'+field).textContent.trim(),id+' '+field);
  assert.equal(example.hidden,!hasExample);assert.equal(example.hasChildNodes(),hasExample,'text-only lessons clear earlier worked examples');
  const scope=app.document.querySelector('#mission-reason-scope');assert.equal(scope.hidden,!M.levels[id].rationale.scope);
  assert.equal(app.document.querySelectorAll('[data-setting]').length,M.levels[id].controls?.length||0);
  await app.eval('run()');assert.equal(app.eval('busy'),false);
  const panel=app.document.querySelector('#run-report');
  assert.ok(panel.querySelector('.run-report-content').textContent.length);
  assert.equal(panel.hidden,false);
  assert.equal(panel.parentElement.className,'run-toolbar');
  assert.equal(app.document.querySelector('#report-toggle'),null);
  for(const n of M.levels[id].nodes){app.eval(`select('${n}')`);assert.ok(app.document.querySelector('#inspect-name').textContent.length);const card=app.eval(`cardFor('${n}',stageId)||M.extraCard('${n}',stageId)`);assert.ok(card.meaning);const example=app.eval(`M.extraExample('${n}',stageId)||exampleFor(M,'${n}',stageId)`);assert.ok(example.output[1].every(Number.isFinite)||n==='mask');}
 }
});
test('gating rationale uses actual weights to show equal content receiving different scales',()=>{
 const app=boot(),M=app.c.NeuralPrologue,doc=app.document,round=v=>Number(v.toFixed(2));
 for(const language of ['zh','en']){
  app.c.I18n.setPreference(language);app.eval("switchLevel('gating')");
  const saved=app.eval('JSON.stringify(state)'),reason=doc.querySelector('#mission-reason');assert.equal(reason.hidden,false);
  const rows=[...reason.querySelectorAll('tbody tr')],contents=[],factors=[];assert.equal(rows.length,2);
  for(const row of rows){
   const input=JSON.parse(row.querySelector('td').textContent),ev=M.evaluate(M.solutions('gating'),input);
   for(const [role,key]of [['content','up'],['scale','silu'],['result','multiply']])assert.equal(Number(row.querySelector(`[data-factor="${role}"]`).textContent),round(ev.values[key][2]));
   contents.push(ev.values.up[2]);factors.push(ev.values.silu[2]);
  }
  assert.equal(contents[0],contents[1]);assert.ok(factors[0]>0&&factors[0]<1);assert.ok(factors[1]>1);
  assert.equal(app.eval('JSON.stringify(state)'),saved,'the comparison never prewires the player’s circuit');
  if(language==='en')assert.doesNotMatch(reason.textContent,/[\u3400-\u9fff]/);
  app.eval("switchLevel('activation')");assert.equal(reason.hidden,false);assert.equal(reason.querySelector('table'),null);assert.equal(doc.querySelector('#mission-reason-example').hidden,true);assert.equal(doc.querySelector('#mission-reason-scope').hidden,true);
 }
 assert.deepEqual([...app.c.I18n.missing],[]);
});
test('inline report appears without clicking, stays during scene interaction, dismisses independently and returns next run',async()=>{
 const app=boot(),panel=app.document.querySelector('#run-report');app.document.querySelector('#run').focus=()=>{};
 assert.equal(panel.hidden,true);
 app.eval("switchLevel('vocabulary')");await app.eval('run()');
 assert.ok(panel.textContent.includes('你恨狗'));assert.equal(panel.hidden,false);
 const state=app.eval('JSON.stringify(state)'),fault=app.eval('JSON.stringify(fault)'),results=app.eval('JSON.stringify(results)');
 app.document.querySelector('#scene').dispatchEvent(new app.window.Event('pointerdown',{bubbles:true}));assert.equal(panel.hidden,false);
 app.document.querySelector('[data-close-report]').dispatchEvent(new app.window.Event('click',{bubbles:true}));assert.equal(panel.hidden,true);
 assert.equal(app.eval('JSON.stringify(state)'),state);assert.equal(app.eval('JSON.stringify(fault)'),fault);assert.equal(app.eval('JSON.stringify(results)'),results);
 await app.eval('run()');assert.equal(panel.hidden,false);
 app.eval('changed()');assert.equal(panel.hidden,true);assert.equal(panel.textContent,'');
});
test('device assignment saves and undo restores; controls survive reload',()=>{const app=boot();app.eval("switchLevel('capstone');select('enffn');assignDevice('enffn','ane')");assert.equal(app.eval("state.nodes.find(n=>n.id==='enffn').device"),'ane');app.eval("$('#undo').onclick()");assert.equal(app.eval("state.nodes.find(n=>n.id==='enffn').device"),'cpu');app.eval("state.settings.precision=4;save();switchLevel('wire');switchLevel('capstone')");assert.equal(app.eval('state.settings.precision'),4);});

test('wire deletion and undo preserve other branches and survive reload',()=>{
 const app=boot();app.eval("switchLevel('gating');state=M.solutions(stageId);chooseInput('multiply',0)");assert.equal(app.eval('selectedWire.from'),'silu');assert.equal(app.eval("state.nodes.find(n=>n.id==='multiply').links[0]"),'silu');
 app.eval('deleteWire()');assert.equal(app.eval("state.nodes.find(n=>n.id==='multiply').links[0]"),null);assert.equal(app.eval("state.nodes.find(n=>n.id==='multiply').links[1]"),'up');
 const restored=boot(app.storage,'#gating');assert.equal(restored.eval("state.nodes.find(n=>n.id==='multiply').links[0]"),null);app.eval("$('#undo').onclick()");assert.equal(app.eval("state.nodes.find(n=>n.id==='multiply').links[0]"),'silu');
});
test('partially constructed tables and older complete saves retain their positions and connections',()=>{
 const app=boot();app.eval("switchLevel('ffn');chooseModule('gate');placeModule(-3,-2);chooseOutput('Z');chooseInput('gate',0)");assert.equal(app.eval('state.nodes.length'),1);
 const saved=app.eval('JSON.stringify(state)'),reloaded=boot(app.storage,'#ffn');assert.equal(reloaded.eval('JSON.stringify(state)'),saved);assert.equal(reloaded.document.querySelector('[data-add-module="gate"]').getAttribute('data-add-disabled'),'false');
 reloaded.eval("select('gate');$('#remove-module').onclick()");assert.equal(reloaded.eval('state.nodes.length'),0);reloaded.eval("$('#undo').onclick()");assert.equal(reloaded.eval('JSON.stringify(state)'),saved);
 const old=app.eval("M.solutions('ffn')");delete old.palette;old.nodes[0].x=1.234;
 const legacy=boot(new Map([['neural-atelier-prologue-v1',JSON.stringify(old)]]));assert.equal(legacy.eval('stageId'),'ffn');assert.equal(legacy.eval('state.nodes.length'),6);assert.equal(legacy.eval('state.nodes[0].x'),1.234);assert.equal(legacy.eval('state.sink'),'add');
});
test('bonus levels are accessible separately and never follow the main finale',()=>{
 const app=boot(new Map(),'', ['en-US']);app.eval('levelMenu()');assert.equal(app.document.querySelectorAll('[data-level]').length,17);assert.equal(app.document.querySelector('[data-level="placement"]'),null);
 app.document.querySelector('[data-track="engine"]').dispatchEvent(new app.window.Event('click',{bubbles:true}));assert.equal(app.document.querySelectorAll('[data-level]').length,9);assert.ok(app.document.querySelector('[data-level="placement"]'));assert.doesNotMatch(app.document.querySelector('#level-menu').textContent,/[\u3400-\u9fff]/);
 app.eval("switchLevel('autoregressive');progress.complete(stageId);refresh()");assert.equal(app.document.querySelector('#next-level').hidden,true);app.eval("switchLevel('kv-cache');levelMenu()");assert.equal(app.eval('menuTrack'),'engine');
});

test('all input rows use the same base animation timing',async()=>{
 const app=boot();app.eval("state=M.solutions('projection');switchLevel('projection');state=M.solutions(stageId);window.timings=[];world.animate=async(ev,ms)=>{timings.push(ms)}");
 await app.eval('run()');assert.deepEqual(Array.from(app.c.timings),[650,650,650]);
});

function completedCircuit(M,id){
 const level=M.levels[id];if(!level.engine)return M.solutions(id);
 const proposal={batch:32,layout:'channels',cache:true,precision:4,fusion:true,resident:true,split:60,prefix:true,context:4096};
 for(const device of ['gpu','ane']){
  const s=M.solutions(id);for(const key of level.controls)if(key in proposal)s.settings[key]=proposal[key];
  for(const n of s.nodes)n.device=['enqkv','enffn'].includes(n.id)?device:['load','enembed','enhead'].includes(n.id)?'cpu':'gpu';
  if(M.engineReport(s).pass)return s;
 }
 throw new Error('No completed circuit fixture: '+id);
}

test('completion waits for every input, replay preserves the circuit and undo, and next loads the saved destination',async()=>{
 const app=boot(),dialog=app.document.querySelector('#level-complete');app.document.querySelector('#run').focus=()=>{};
 app.eval("switchLevel('ffn');state=M.solutions(stageId);state.nodes[0].x+=.2;save();window.destination=JSON.stringify(state);switchLevel('workshop');state=M.solutions(stageId);checkpoint();state.nodes[0].z+=.25;save();setPlaybackSpeed(.5)");
 const before=app.eval('JSON.stringify(state)'),undo=app.eval('JSON.stringify(history)');
 let runs=0;
 app.eval('world.animate=async()=>{window.checkAnimation()}');
 app.c.checkAnimation=()=>{runs++;assert.ok(!dialog.open,'no completion before all animation has finished');};
 await app.eval('run()');
 assert.equal(dialog.open,true);assert.equal(runs,app.eval('stage().sampleCount'));
 assert.equal(app.document.querySelector('#complete-title').textContent,'本关完成');
 app.c.I18n.setPreference('en');assert.equal(app.document.querySelector('#complete-title').textContent,'Level complete');assert.doesNotMatch(dialog.textContent,/[\u3400-\u9fff]/);
 app.document.querySelector('#complete-replay').onclick();
 assert.equal(dialog.open,false);assert.equal(app.eval('busy'),false);assert.equal(runs,app.eval('stage().sampleCount'));assert.equal(app.eval('results.length'),0);assert.equal(app.document.querySelector('#run-report').hidden,true);
 assert.equal(app.eval('JSON.stringify(state)'),before);assert.equal(app.eval('JSON.stringify(history)'),undo);assert.equal(app.eval('playbackSpeed'),.5);
 await app.eval('run()');assert.equal(dialog.open,true);assert.equal(runs,2*app.eval('stage().sampleCount'));
 app.document.querySelector('#complete-next').onclick();assert.equal(dialog.open,false);assert.equal(app.location.hash,'#ffn');assert.equal(app.eval('JSON.stringify(state)'),app.c.destination);
 app.eval("switchLevel('workshop')");assert.equal(app.eval('JSON.stringify(state)'),before);
});

test('failure, cancellation and unmet engine constraints never show completion; every solved level does',async()=>{
 const app=boot(),dialog=app.document.querySelector('#level-complete'),M=app.c.NeuralPrologue;
 await app.eval('run()');assert.ok(!dialog.open,'unfinished wiring must fail');
 app.eval('state=M.solutions(stageId);world.animate=()=>new Promise(resolve=>window.finishAnimation=resolve)');
 const cancelled=app.eval('run()');await app.eval('run()');app.c.finishAnimation();await cancelled;assert.ok(!dialog.open,'a stopped run is not a win');
 app.eval('world.animate=async()=>{}');
 for(const id of Object.keys(M.levels)){
  app.eval(`switchLevel('${id}')`);app.c.solved=completedCircuit(M,id);app.eval('state=solved');await app.eval('run()');
  assert.equal(dialog.open,true,id+' completes');
  app.document.querySelector('#complete-close').onclick();assert.equal(dialog.open,false);
  app.eval('refresh()');assert.equal(dialog.open,false,'dismissed completion stays dismissed');
 }
 app.eval("switchLevel('capstone');state=M.solutions(stageId);state.settings.precision=16");await app.eval('run()');
 assert.ok(app.eval('results.every(r=>r.pass)'));assert.equal(app.eval('engineReport.pass'),false);assert.equal(dialog.open,false);
});

test('finale completion stays on its track and stale dialogs close on circuit or level changes',async()=>{
 const app=boot(),dialog=app.document.querySelector('#level-complete'),M=app.c.NeuralPrologue;
 for(const [id,track]of [['autoregressive','main'],['capstone','engine']]){
  app.eval(`switchLevel('${id}')`);app.c.solved=completedCircuit(M,id);app.eval('state=solved');await app.eval('run()');
  assert.equal(app.document.querySelector('#complete-next').textContent,'选择关卡');
  app.document.querySelector('#complete-next').onclick();assert.equal(dialog.open,false);assert.equal(app.document.querySelector('#level-menu').open,true);assert.equal(app.eval('stageId'),id);assert.equal(app.eval('menuTrack'),track);
 }
 app.eval("switchLevel('projection');state=M.solutions(stageId)");await app.eval('run()');assert.equal(dialog.open,true);
 app.eval('changed()');assert.equal(dialog.open,false);
 await app.eval('run()');assert.equal(dialog.open,true);
 app.location.hash='#wire';app.hashchange();assert.equal(dialog.open,false);
});
test('speed slider updates while running, persists across levels and reloads, and leaves circuit and results intact',async()=>{
 const app=boot(),slider=app.document.querySelector('#playback-speed');
 assert.equal(app.eval('playbackSpeed'),.25);
 app.eval("state=M.solutions(stageId)");await app.eval('run()');
 const state=app.eval('JSON.stringify(state)'),results=app.eval('JSON.stringify(results)');
 app.eval('busy=true');slider.value='2';slider.dispatchEvent(new app.window.Event('input',{bubbles:true}));
 assert.equal(app.eval('playbackSpeed'),2);assert.equal(app.document.querySelector('#playback-rate').textContent,'2×');assert.equal(slider.getAttribute('aria-valuetext'),'2 倍速');
 assert.equal(app.eval('JSON.stringify(state)'),state);assert.equal(app.eval('JSON.stringify(results)'),results);
 app.eval("busy=false;switchLevel('projection')");assert.equal(app.eval('playbackSpeed'),2);
 const reloaded=boot(app.storage);assert.equal(reloaded.eval('playbackSpeed'),2);assert.equal(reloaded.document.querySelector('#playback-speed').value,'2');
 for(const invalid of ['0','NaN','999']){app.storage.set('neural-atelier-playback-speed-v1',invalid);assert.equal(boot(app.storage).eval('playbackSpeed'),.25);}
});

test('level fragments open directly and browser back/forward restore each saved circuit',()=>{
 const app=boot();assert.equal(app.location.hash,'#wire');assert.equal(app.navigation.length,1);
 app.eval("state.sink='R';switchLevel('projection')");assert.equal(app.location.hash,'#projection');assert.equal(app.location.search,'?version=campaign-1');
 app.eval("state.nodes[0].x=1.25;switchLevel('rope')");assert.equal(app.location.hash,'#rope');
 app.navigation.back();assert.equal(app.eval('stageId'),'projection');assert.equal(app.eval('state.nodes[0].x'),1.25);
 app.navigation.back();assert.equal(app.eval('stageId'),'wire');assert.equal(app.eval('state.sink'),'R');
 app.navigation.forward();assert.equal(app.eval('stageId'),'projection');
 const direct=boot(app.storage,'#wire');assert.equal(direct.eval('stageId'),'wire');assert.equal(direct.eval('state.sink'),'R');
 for(const id of Object.keys(app.c.NeuralPrologue.levels))assert.equal(boot(new Map(),'#'+id).eval('stageId'),id);
});
test('invalid fragments fall back safely and changing a fragment stops an active run',async()=>{
 for(const hash of ['#missing','#%E0%A4%A','#constructor']){const app=boot(new Map(),hash);assert.equal(app.eval('stageId'),'wire');assert.equal(app.location.hash,'#wire');}
 const app=boot();app.eval("state=M.solutions(stageId);world.animate=()=>new Promise(resolve=>window.finishAnimation=resolve)");const running=app.eval('run()');assert.equal(app.eval('busy'),true);
 app.location.hash='#projection';app.hashchange();assert.equal(app.eval('busy'),false);assert.equal(app.eval('stageId'),'projection');app.c.finishAnimation();await running;
 assert.equal(app.location.hash,'#projection');assert.equal(app.eval('results.length'),0);
});

test('browser language is recommended on first visit and a saved choice overrides it',()=>{
 for(const [languages,expected] of [[['zh-TW'],'zh'],[['en-GB'],'en'],[['fr-FR','en-US','zh-CN'],'en'],[['ja-JP'],'en']]){
  const app=boot(new Map(),'',languages);assert.equal(app.c.I18n.language(),expected);assert.equal(app.document.documentElement.lang,expected==='zh'?'zh-CN':'en');
 }
 const storage=new Map([['neural-atelier-language-v1','zh']]);const saved=boot(storage,'',['en-US']);assert.equal(saved.c.I18n.language(),'zh');
 saved.c.I18n.setPreference('auto');assert.equal(saved.c.I18n.language(),'en');assert.equal(boot(storage,'',['en-US']).c.I18n.language(),'en');
});
test('language changes preserve the current circuit, results, level hash and speed',async()=>{
 const app=boot();app.eval("switchLevel('projection');state=M.solutions(stageId);state.nodes[0].x=1.75;setPlaybackSpeed(2)");await app.eval('run()');
 const before=app.eval('JSON.stringify(state)'),results=app.eval('JSON.stringify(results)'),hash=app.location.hash;
 app.c.I18n.setPreference('en');assert.equal(app.document.querySelector('#settings-title').textContent,'Game settings');assert.match(app.document.querySelector('#run').textContent,/Run my network/);assert.equal(app.eval('JSON.stringify(state)'),before);assert.equal(app.eval('JSON.stringify(results)'),results);assert.equal(app.location.hash,hash);assert.equal(app.eval('playbackSpeed'),2);assert.equal(app.eval('M.samples[1].word'),'love');assert.equal(app.eval("M.readTokens([0,1,2])"),'I love cats');
 app.c.I18n.setPreference('zh');assert.equal(app.document.querySelector('#settings-title').textContent,'游戏设置');assert.equal(app.eval('JSON.stringify(state)'),before);assert.equal(app.eval('M.samples[1].word'),'爱');
});
test('English covers every level, inspector, module card and generated report',async()=>{
 const app=boot(new Map(),'', ['en-US']),M=app.c.NeuralPrologue;
 for(const id of Object.keys(M.levels)){
  app.eval(`switchLevel('${id}');state=M.solutions(stageId);if(stage().engine)state.settings.precision=16;`);await app.eval('run()');
  assert.doesNotMatch(app.document.querySelector('.mission').textContent,/[\u3400-\u9fff]/,id+' mission');
  assert.doesNotMatch(app.document.querySelector('#run-report').textContent,/[\u3400-\u9fff]/,id+' report');
  for(const n of M.levels[id].nodes){app.eval(`select('${n}')`);assert.doesNotMatch(app.document.querySelector('.inspector').textContent,/[\u3400-\u9fff]/);const card=app.eval(`cardFor('${n}',stageId)||M.extraCard('${n}',stageId)`);assert.doesNotMatch(card.meaning+card.purpose,/[\u3400-\u9fff]/);}
 }
 assert.deepEqual([...app.c.I18n.missing],[]);
});
test('speed and persisted audio controls live together in the settings dialog',()=>{
 const app=boot();assert.ok(app.document.querySelector('#settings #playback-speed'));assert.equal(app.document.querySelector('.run-toolbar #playback-speed'),null);
 app.document.querySelector('#settings-open').onclick();assert.equal(app.document.querySelector('#settings').open,true);
 const volume=app.document.querySelector('#music-volume');volume.value='20';volume.dispatchEvent(new app.window.Event('input',{bubbles:true}));app.document.querySelector('#music-enabled').onclick();
 assert.deepEqual(JSON.parse(app.storage.get('neural-atelier-audio-v1')),{enabled:false,volume:.2});const reloaded=boot(app.storage);assert.equal(reloaded.document.querySelector('#music-volume').value,'20');assert.equal(reloaded.document.querySelector('#music-enabled').getAttribute('aria-checked'),'false');
});

test('opening settings from the intro and skipping it never changes the saved circuit',()=>{
 const app=boot();app.c.setTimeout=fn=>fn();app.document.querySelector('#run').focus=()=>{};app.document.querySelector('#welcome-settings').focus=()=>{};app.document.querySelector('#settings-open').focus=()=>{};
 const welcome=app.document.querySelector('#welcome');assert.equal(welcome.open,true);const state=app.eval('JSON.stringify(state)');
 app.document.querySelector('#welcome-settings').onclick();assert.equal(app.document.querySelector('#settings').open,true);app.document.querySelector('#settings-done').onclick();assert.equal(app.document.querySelector('#settings').open,false);assert.equal(welcome.open,true);
 app.document.querySelector('#enter-workshop').onclick();assert.equal(welcome.open,false);assert.equal(app.eval('JSON.stringify(state)'),state);app.document.querySelector('#intro-replay').onclick();assert.equal(welcome.open,true);assert.equal(app.eval('JSON.stringify(state)'),state);
 app.document.querySelector('#enter-workshop').onclick();let prevented=false;const hash=app.location.hash;app.document.querySelector('#home-open').onclick({preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(welcome.open,true);assert.equal(app.eval('JSON.stringify(state)'),state);assert.equal(app.location.hash,hash);
});

test('pause is bilingual and a hash change cancels it without carrying pause into another level',async()=>{
 const app=boot();app.c.performance={now:()=>100};
 const control=app.document.querySelector('#pause');assert.equal(control.disabled,true);assert.equal(control.parentElement.className,'run-toolbar');
 app.eval('busy=true;refresh();togglePause()');assert.equal(control.getAttribute('aria-pressed'),'true');assert.equal(control.textContent,'▶ 继续');
 app.c.I18n.setPreference('en');assert.equal(control.textContent,'▶ Resume');
 app.location.hash='#projection';app.hashchange();assert.equal(app.eval('busy||paused'),false);assert.equal(control.disabled,true);assert.equal(control.textContent,'Ⅱ Pause');
 app.eval('state=M.solutions(stageId)');await app.eval('run()');assert.equal(app.eval('paused'),false);assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);
});

test('multiple module saves preserve instance identities and undo refunds only the removed copy',()=>{
 const app=boot();assert.equal(app.document.querySelector('#shuffle-layout'),null);
 app.eval("switchLevel('ffn');chooseModule('project');placeModule(-3,-2);chooseModule('project');placeModule(1,-2);chooseOutput('Z');chooseInput('project-2',0)");
 assert.equal(app.eval('selected'),'project-2');assert.equal(app.document.querySelector('[data-add-module="project"]').getAttribute('data-add-disabled'),'true');
 const saved=app.eval('JSON.stringify(state)'),reloaded=boot(app.storage,'#ffn');assert.equal(reloaded.eval('JSON.stringify(state)'),saved);
 reloaded.eval("select('project');$('#remove-module').onclick()");assert.equal(reloaded.eval("state.nodes[0].id"),'project-2');assert.equal(reloaded.eval("state.nodes[0].links[0]"),'Z');assert.equal(reloaded.document.querySelector('[data-add-module="project"]').getAttribute('data-add-disabled'),'false');
 reloaded.eval("$('#undo').onclick()");assert.equal(reloaded.eval('JSON.stringify(state)'),saved);
 const corrupt=JSON.parse(saved);corrupt.nodes[1].kind='down';const storage=new Map([['neural-atelier-prologue-v1',JSON.stringify(corrupt)]]);assert.equal(boot(storage,'#ffn').eval('state.nodes.length'),0,'invalid ID/type pair does not become a different operator');
});
test('the simple placement lesson introduces one familiar module between residuals and the FFN',()=>{
 const app=boot(new Map(),'#workshop',['en-US']);assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.document.querySelectorAll('[data-add-module]').length,1);assert.equal(app.document.querySelector('#module-count').textContent,'0 / 1');assert.equal(app.eval('M.levels.residual.next'),'workshop');assert.equal(app.eval('M.levels.workshop.next'),'ffn');assert.doesNotMatch(app.document.querySelector('#module-shelf').textContent,/[\u3400-\u9fff]/);
});
test('shelf sizing persists independently of circuits, language and the current level',()=>{
 const app=boot(new Map(),'#ffn',['en-US']),shelf=app.document.querySelector('#module-shelf');
 assert.equal(shelf.dataset.size,'small');assert.equal(app.document.querySelector('.shelf-open-label').textContent,'Hide shelf');const state=app.eval('JSON.stringify(state)');
 app.document.querySelector('#shelf-smaller').onclick();assert.equal(shelf.dataset.size,'small');assert.equal(app.document.querySelector('#shelf-smaller').disabled,true);
 app.c.I18n.setPreference('zh');assert.equal(shelf.dataset.size,'small');assert.equal(app.eval('JSON.stringify(state)'),state);
 app.eval("switchLevel('workshop')");assert.equal(shelf.dataset.size,'small');
 const reloaded=boot(app.storage,'#ffn');assert.equal(reloaded.document.querySelector('#module-shelf').dataset.size,'small');assert.equal(reloaded.eval('JSON.stringify(state)'),state);
 reloaded.document.querySelector('#shelf-larger').onclick();reloaded.document.querySelector('#shelf-larger').onclick();assert.equal(reloaded.document.querySelector('#module-shelf').dataset.size,'large');assert.equal(reloaded.document.querySelector('#shelf-larger').disabled,true);
});
