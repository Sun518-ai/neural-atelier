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
 for(const file of ['locales/en.js','i18n.js','music.js','shell.js','model.js','campaign.js','engine-model.js','original-curriculum.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),c,{filename:file});
 for(const file of ['module-cards.js','level-progress.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8').replaceAll('export ',''),c,{filename:file});
 let code=fs.readFileSync(__dirname+'/game.js','utf8').replace(/^import .*\n/gm,'');code=code.slice(0,code.indexOf("try{\n const T="));
 vm.runInContext(code+`\nworld={relocalize(){},labels(){},rebuild(){},beforeStage(){},setStage(){},clearPackets(){},focused(){return null},async animate(){}};refresh();`,c);
 return {c,document,window,storage,location,navigation,hashchange,eval:code=>vm.runInContext(code,c)};
}
test('QKV passes with only V placed or with Q/K left disconnected, while wrong outlet values fail',async()=>{
 const app=boot();app.eval("switchLevel('qkv');state=M.initial('qkv');M.addNode(state,'v',0,0);M.connect(state,'R','v',0);M.connect(state,'v','sink',0)");
 let played=0;app.c.worldForTest={async animate(){played++;assert.equal(app.eval('fault'),null);assert.ok(app.document.querySelector('#run-report').hidden);}};
 app.eval('world.animate=worldForTest.animate');await app.eval('run()');
 assert.equal(played,3);assert.equal(app.eval('levelPassed()'),true);assert.equal(app.eval('fault'),null);assert.equal(app.document.querySelector('.projection-checks'),null);assert.equal(app.document.querySelector('#level-complete').open,true);
 app.eval("state=M.solutions('qkv');state.nodes.find(n=>n.id==='q').links=[null];state.nodes.find(n=>n.id==='k').links=[null]");await app.eval('run()');assert.equal(app.eval('levelPassed()'),true);
 app.eval("state=M.solutions('qkv');state.sink='q'");await app.eval('run()');assert.equal(app.eval('levelPassed()'),false);assert.equal(app.eval('fault.id'),'sink');assert.ok(!app.document.querySelector('#level-complete').open);
});
test('QKV keeps saved V-only circuits and badges from before or during the temporary stricter rule',async()=>{
 const setup=boot(),M=setup.c.NeuralPrologue,key='neural-atelier-level-qkv-v1',meta='neural-atelier-chapters-v1';
 const saved=M.solutions('qkv');saved.nodes.find(n=>n.id==='q').links=[null];saved.nodes.find(n=>n.id==='k').links=[null];
 for(const completed of [['qkv','scores'],['scores']]){
  const storage=new Map([[key,JSON.stringify(saved)],[meta,JSON.stringify({current:'qkv',completed,goalRevisions:{qkv:1}})]]),app=boot(storage,'#qkv');
  assert.equal(app.eval("progress.completed('qkv')"),completed.includes('qkv'));assert.equal(app.eval("progress.completed('scores')"),true);
  const before=app.eval('JSON.stringify(state)');assert.deepEqual(JSON.parse(before),JSON.parse(JSON.stringify(saved)));await app.eval('run()');assert.equal(app.eval('levelPassed()'),true);assert.equal(app.eval("progress.completed('qkv')"),true);assert.equal(app.eval('JSON.stringify(state)'),before);
 }
});
test('all levels automatically display their report beside the run controls',async()=>{
 const app=boot(),M=app.c.NeuralPrologue;
 for(const id of Object.keys(M.levels)){
  app.eval(`switchLevel('${id}');state=M.solutions(stageId);if(stage().engine)state.settings.precision=16;`);
  assert.ok(app.document.querySelector('.mission h2').textContent.length);
  const reason=app.document.querySelector('#mission-reason'),example=app.document.querySelector('#mission-reason-example'),hasExample=['gating','residual','ffn','wider-features'].includes(id)||!!M.levels[id].packages?.length;
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
   for(const [role,key]of [['content','project'],['scale','silu'],['result','multiply']])assert.equal(Number(row.querySelector(`[data-factor="${role}"]`).textContent),round(ev.values[key][2]));
   contents.push(ev.values.project[2]);factors.push(ev.values.silu[2]);
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
 app.eval("switchLevel('vocabulary');state=M.solutions(stageId);state.nodes.find(n=>n.id==='lmhead').links=['invert']");await app.eval('run()');
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
 app.eval('deleteWire()');assert.equal(app.eval("state.nodes.find(n=>n.id==='multiply').links[0]"),null);assert.equal(app.eval("state.nodes.find(n=>n.id==='multiply').links[1]"),'project');
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
 const app=boot(new Map(),'', ['en-US']);app.eval('levelMenu()');assert.equal(app.document.querySelectorAll('[data-level]').length,29);assert.equal(app.document.querySelector('[data-level="placement"]'),null);
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

test('composite rewards wait for a win and their animation, then remain usable without replacing the saved board',async()=>{
 const app=boot(new Map(),'#self-attention'),doc=app.document,selector='[data-add-module="single-attention"]';
 let count=0,begin,finish;const started=new Promise(resolve=>begin=resolve);
 app.c.fuse=reward=>{count++;assert.equal(reward.kind,'single-attention');return new Promise(resolve=>{finish=resolve;begin();});};app.eval('world.fuse=window.fuse');
 assert.equal(doc.querySelector(selector),null);app.eval("chooseModule('single-attention')");assert.equal(app.eval('placeModule(0,0)'),false);
 await app.eval('run()');assert.equal(count,0);assert.equal(app.eval("progress.completed('self-attention')"),false);assert.equal(doc.querySelector(selector),null);
 app.eval("state=M.solutions(stageId);checkpoint();state.nodes[0].z+=.2;save()");const board=app.eval('JSON.stringify(state)'),undo=app.eval('JSON.stringify(history)');
 const running=app.eval('run()');await started;
 assert.equal(app.eval('levelPassed()'),true);assert.equal(app.eval('busy'),true);assert.ok(!doc.querySelector('#level-complete').open);
 assert.equal(doc.querySelector(selector).getAttribute('aria-disabled'),'true','the reward is visible but cannot be placed while its ceremony runs');
 finish(true);await running;assert.equal(app.eval('busy'),false);assert.equal(doc.querySelector('#level-complete').open,true);
 assert.equal(doc.querySelector('#complete-reward').hidden,false);assert.match(doc.querySelector('#complete-reward').textContent,/单头自注意力/);
 assert.equal(app.eval('JSON.stringify(state)'),board);assert.equal(app.eval('JSON.stringify(history)'),undo);
 const restored=boot(app.storage,'#self-attention');assert.ok(restored.document.querySelector(selector));assert.equal(restored.eval('JSON.stringify(state)'),board);
 restored.eval("for(const n of [...state.nodes])removeModule(n.id);chooseModule('single-attention')");assert.equal(restored.eval('placeModule(0,0)'),true);
 restored.eval("chooseOutput('R');chooseInput('single-attention',0);chooseOutput('single-attention');chooseInput('sink',0)");await restored.eval('run()');
 assert.equal(restored.eval('levelPassed()'),true,'the earned component really computes the complete lesson');
 const packed=restored.eval('JSON.stringify(state)'),reloaded=boot(app.storage,'#self-attention');assert.equal(reloaded.eval('JSON.stringify(state)'),packed);
 reloaded.eval("switchLevel('multihead')");assert.ok(reloaded.document.querySelector(selector),'later compatible lessons retain the component');assert.equal(reloaded.document.querySelector('[data-add-module="two-head-attention"]'),null,'the next lesson still needs to be built');
 for(const lang of ['en','zh']){app.c.I18n.setPreference(lang);assert.equal(doc.querySelector('#complete-reward>strong').textContent,app.c.NeuralPrologue.definitions['single-attention'].name);if(lang==='en')assert.doesNotMatch(doc.querySelector('#complete-reward').textContent,/[\u3400-\u9fff]/);}
 assert.deepEqual([...app.c.I18n.missing],[]);
});
test('a failed celebration cannot strand a valid completion or take away its reward',async()=>{
 const app=boot(new Map(),'#self-attention'),errors=[];app.c.console={...console,error:(...args)=>errors.push(args)};
 app.eval("state=M.solutions(stageId);world.fuse=async()=>{throw new Error('presentation unavailable')}");const saved=app.eval('JSON.stringify(state)');await app.eval('run()');
 assert.equal(errors.length,1);assert.equal(app.eval('busy'),false);assert.equal(app.document.querySelector('#level-complete').open,true);assert.ok(app.document.querySelector('[data-add-module="single-attention"]'));assert.equal(app.eval('JSON.stringify(state)'),saved);
});
test('all reusable-network milestones celebrate, while fixed prologue rewards are collected for later building lessons',async()=>{
 const app=boot(),M=app.c.NeuralPrologue,doc=app.document,seen=[];let completedPrologue;
 for(const id of ['original-ffn','pack-ffn','pack-scores','plain-ffn','swiglu','ffn','encoder-decoder','block'])assert.ok(M.fusions[id],id+' has a collection milestone');
 app.c.collect=reward=>{seen.push(app.eval('stageId'));assert.equal(app.eval('levelPassed()'),true);assert.ok(!doc.querySelector('#level-complete').open);assert.ok(doc.querySelector('[data-add-module="'+reward.kind+'"]'));};app.eval('world.fuse=window.collect');
 for(const [id,reward]of Object.entries(M.fusions)){
  app.eval(`switchLevel('${id}');state=M.solutions(stageId)`);const saved=app.eval('JSON.stringify(state)'),count=seen.length;
  await app.eval('run()');assert.equal(seen.length,count+1,id+' celebrates');assert.equal(app.eval('JSON.stringify(state)'),saved);assert.equal(doc.querySelector('#level-complete').open,true);
  assert.equal(doc.querySelector('#complete-reward>strong').textContent,M.definitions[reward.kind].name);assert.equal(doc.querySelector('#module-shelf').hidden,false);
  if(!M.levels[id].buildable){
   completedPrologue=new Map(app.storage);
   assert.equal(doc.querySelector('#module-shelf').dataset.mode,'collection');assert.equal(doc.querySelectorAll('[data-add-module]').length,1);assert.match(doc.querySelector('#complete-reward>small').textContent,/后续搭建关/);
   app.eval(`chooseModule('${reward.kind}')`);assert.equal(app.eval('placeModule(0,0)'),false);assert.equal(app.eval('JSON.stringify(state)'),saved);
  }
  app.eval('state.sink=null');await app.eval('run()');assert.equal(seen.length,count+1,id+' does not celebrate a failure');
 }
 assert.deepEqual(seen,Object.keys(M.fusions));
 const reload=boot(completedPrologue,'#original-ffn');assert.equal(reload.document.querySelector('#module-shelf').hidden,false);assert.ok(reload.eval('state.nodes.every(n=>n.links.every(x=>x===null))'),'collected rewards do not prewire a new prologue attempt');
 for(const id of ['pack-ffn','pack-scores']){
  const fresh=boot(new Map(),'#'+id),kind=M.fusions[id].kind;
  assert.ok(fresh.document.querySelector('[data-add-module="'+kind+'"]'),'the packaging lesson can use the already taught block before passing');
  fresh.eval(`chooseModule('${kind}')`);assert.equal(fresh.eval('placeModule(0,0)'),true);
 }
});
test('wider-feature examples compare actual embedding tables for the same token in both languages',()=>{
 const app=boot(new Map(),'#wider-features'),M=app.c.NeuralPrologue,saved=app.eval('JSON.stringify(state)');
 for(const language of ['zh','en']){
  app.c.I18n.setPreference(language);const example=app.document.querySelector('.embedding-width-example');assert.ok(example);
  for(const width of [2,4]){
   const row=example.querySelector('[data-width="'+width+'"]');assert.equal(row.querySelector('.embedding-lookup>b').textContent,M.math.vocab[2]);
   assert.deepEqual([...row.querySelectorAll('.embedding-coordinates>span')].map(el=>Number(el.textContent)),Array.from(M.original.embed([2],width)));
  }
  if(language==='en')assert.doesNotMatch(app.document.querySelector('.mission').textContent,/[\u3400-\u9fff]/);
  assert.equal(app.eval('JSON.stringify(state)'),saved,'explanations never change the player’s wiring');
 }
 assert.deepEqual([...app.c.I18n.missing],[]);
});

test('completion waits for every input, replay preserves the circuit and undo, and next loads the saved destination',async()=>{
 const app=boot(),dialog=app.document.querySelector('#level-complete');app.document.querySelector('#run').focus=()=>{};
 app.eval("switchLevel(M.levels.workshop.next);state=M.solutions(stageId);state.nodes[0].x+=.2;save();window.destination=JSON.stringify(state);switchLevel('workshop');state=M.solutions(stageId);checkpoint();state.nodes[0].z+=.25;save();setPlaybackSpeed(.5)");
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
 app.document.querySelector('#complete-next').onclick();assert.equal(dialog.open,false);assert.equal(app.location.hash,'#'+app.c.NeuralPrologue.levels.workshop.next);assert.equal(app.eval('JSON.stringify(state)'),app.c.destination);
 app.eval("switchLevel('workshop')");assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.eval('state.sink'),null);
 assert.equal(app.document.querySelector('#restore-layout').hidden,false);app.document.querySelector('#restore-layout').onclick();
 assert.equal(app.eval('JSON.stringify(state)'),before);assert.equal(app.eval('busy'),false);assert.equal(runs,2*app.eval('stage().sampleCount'),'restoring never runs the circuit');
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
test('speed stays in the run toolbar while persisted audio controls remain in settings',()=>{
 const app=boot();assert.ok(app.document.querySelector('.run-toolbar #playback-speed'));assert.equal(app.document.querySelector('#settings #playback-speed'),null);
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
 assert.equal(app.eval('selected'),'project-2');assert.equal(app.document.querySelector('[data-add-module="project"]').getAttribute('data-add-disabled'),'false');assert.equal(app.eval("M.stock(state,'project')"),2);
 const saved=app.eval('JSON.stringify(state)'),reloaded=boot(app.storage,'#ffn');assert.equal(reloaded.eval('JSON.stringify(state)'),saved);
 reloaded.eval("select('project');$('#remove-module').onclick()");assert.equal(reloaded.eval("state.nodes[0].id"),'project-2');assert.equal(reloaded.eval("state.nodes[0].links[0]"),'Z');assert.equal(reloaded.document.querySelector('[data-add-module="project"]').getAttribute('data-add-disabled'),'false');
 reloaded.eval("$('#undo').onclick()");assert.equal(reloaded.eval('JSON.stringify(state)'),saved);
 const corrupt=JSON.parse(saved);corrupt.nodes[1].kind='down';const storage=new Map([['neural-atelier-prologue-v1',JSON.stringify(corrupt)]]);assert.equal(boot(storage,'#ffn').eval('state.nodes.length'),0,'invalid ID/type pair does not become a different operator');
});
test('legacy content projections merge without losing coexisting copies, wiring, positions or completion',async()=>{
 const seed=boot(),M=seed.c.NeuralPrologue;
 const snapshot=s=>JSON.stringify(s.nodes.map(n=>[n.id,n.x,n.z,n.links]));
 for(const id of ['gating','ffn']){
  const solved=M.solutions(id),old=JSON.parse(JSON.stringify(solved));
  const linear=old.nodes.find(n=>n.id==='project');linear.id='up';linear.kind='up';linear.x=2.345;linear.z=-1.234;
  for(const n of old.nodes)n.links=n.links.map(k=>k==='project'?'up':k);
  old.palette=['up',...solved.palette];
  if(id==='ffn'){
   // Both earlier stocks can coexist. References to the spare copy must also survive.
   old.nodes.push({id:'project',kind:'project',x:6,z:3,links:['R']},{id:'up-2',kind:'up',x:6,z:-3,links:['R']});
   old.nodes.find(n=>n.id==='gate').links=['Z'];
  }else for(const n of old.nodes)delete n.kind;
  const key=id==='ffn'?'neural-atelier-prologue-v1':'neural-atelier-level-gating-v1';
  const store=new Map([[key,JSON.stringify(old)],['neural-atelier-chapters-v1',JSON.stringify({current:id,completed:[id]})],['neural-atelier-language-v1','en'],['neural-atelier-playback-speed-v1','.5']]);
  const app=boot(store,'#'+id),migrated=app.eval('state'),content=id==='ffn'?'project-2':'project';
  assert.equal(migrated.nodes.length,old.nodes.length);assert.equal(app.eval('playbackSpeed'),.5);assert.equal(app.eval('progress.completed(stageId)'),true);
  assert.equal(migrated.nodes.find(n=>n.id===content).x,linear.x);assert.equal(migrated.nodes.find(n=>n.id===content).z,linear.z);
  assert.equal(migrated.nodes.find(n=>n.id==='multiply').links[1],content);
  assert.ok(migrated.nodes.every(n=>n.kind!=='up'&&!/^up(?:-|$)/.test(n.id)));
  assert.equal(migrated.palette.filter(k=>k==='project').length,1);assert.ok(!migrated.palette.includes('up'));
  if(id==='ffn'){assert.equal(migrated.nodes.find(n=>n.id==='project').links[0],'R');assert.equal(migrated.nodes.find(n=>n.id==='project-3').links[0],'R');assert.equal(app.eval("M.stock(state,'project')"),1);}
  const saved=snapshot(migrated);await app.eval('run()');assert.ok(app.eval('results.every(r=>r.pass)'));assert.equal(snapshot(app.eval('state')),saved);
  const reloaded=boot(store,'#'+id);assert.equal(snapshot(reloaded.eval('state')),saved);
  if(id==='ffn'){
   reloaded.eval("select('project-2');$('#remove-module').onclick()");assert.equal(reloaded.eval("state.nodes.find(n=>n.id==='multiply').links[1]"),null);assert.equal(reloaded.eval("M.stock(state,'project')"),2);
   reloaded.eval("$('#undo').onclick()");assert.equal(snapshot(reloaded.eval('state')),saved);
  }
 }
 // All four former copies are retained, including a saved outlet into an old content copy.
 const full={version:1,levelId:'ffn',palette:['up','project'],sink:'up-2',nodes:['project','up','project-2','up-2'].map((id,i)=>({id,kind:id.startsWith('up')?'up':'project',x:i*3-4,z:1,links:['R']}))};
 const all=boot(new Map([['neural-atelier-prologue-v1',JSON.stringify(full)]]),'#ffn');
 assert.deepEqual(Array.from(all.eval('state.nodes'),n=>n.id),['project','project-3','project-2','project-4']);assert.equal(all.eval('state.sink'),'project-4');assert.equal(all.eval("M.stock(state,'project')"),0);
 all.eval('save()');assert.equal(boot(all.storage,'#ffn').eval('state.sink'),'project-4');
});

test('SwiGLU objective connects familiar modules to the FFN while keeping residual addition outside it',()=>{
 const app=boot(new Map(),'#ffn'),doc=app.document,saved=app.eval('JSON.stringify(state)');
 for(const language of ['zh','en']){
  app.c.I18n.setPreference(language);
  const primer=doc.querySelector('.swiglu-primer');assert.ok(primer);assert.match(primer.textContent,/SwiGLU/);assert.match(primer.textContent,language==='zh'?/归一化输入和残差/:/normalized input and residual/);assert.match(primer.textContent,/SiLU/);
  assert.equal(primer.querySelectorAll('.swiglu-branches>div').length,2);assert.equal(primer.querySelectorAll('.swiglu-merge b').length,2);
  assert.match(doc.querySelector('#mission-reason-takeaway').textContent,language==='zh'?/FFN 外/:/outside the FFN/);
  assert.match(doc.querySelector('#mission-reason-scope').textContent,/Swish/);
  assert.equal(doc.querySelectorAll('[data-add-module="project"]').length,1);assert.equal(doc.querySelector('[data-add-module="up"]'),null);
  assert.doesNotMatch(doc.querySelector('#module-shelf').textContent,/内容投影|Content projection/);
  if(language==='en')assert.doesNotMatch(doc.querySelector('.mission').textContent,/[\u3400-\u9fff]/);
  assert.equal(app.eval('JSON.stringify(state)'),saved);
 }
 app.eval("switchLevel('gating')");assert.equal(doc.querySelector('.swiglu-primer'),null);assert.ok(doc.querySelector('#mission-reason-example table'));
 app.eval("switchLevel('projection')");assert.equal(doc.querySelector('#mission-reason-example').hidden,true);
 app.eval("switchLevel('ffn')");assert.ok(doc.querySelector('.swiglu-primer'));assert.equal(app.eval('JSON.stringify(state)'),saved);
 assert.deepEqual([...app.c.I18n.missing],[]);
});
test('the simple placement lesson introduces one familiar module before the original network chapter',()=>{
 const app=boot(new Map(),'#workshop',['en-US']);assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.document.querySelectorAll('[data-add-module]').length,1);assert.equal(app.document.querySelector('#module-count').textContent,'0 / 1');assert.equal(app.eval('M.levels.residual.next'),'workshop');assert.equal(app.eval('M.levels.workshop.next'),'embedding');assert.doesNotMatch(app.document.querySelector('#module-shelf').textContent,/[\u3400-\u9fff]/);
});

test('the shelf remains usable after the placement tutorial and original lessons begin empty',()=>{
 const app=boot(),M=app.c.NeuralPrologue,shelf=app.document.querySelector('#module-shelf');
 for(const [index,id]of M.routes.main.ids.entries()){
  app.eval(`switchLevel('${id}')`);assert.equal(shelf.hidden,index<6,id+' shelf visibility');
  if(index>=6){assert.equal(app.eval('state.nodes.length'),0,id+' requires taking modules from the shelf');assert.equal(app.eval('state.sink'),null);}
 }
 for(const id of [...M.routes.modern.ids,...M.routes.engine.ids]){
  app.eval(`switchLevel('${id}')`);assert.equal(shelf.hidden,false,id);
  assert.equal(app.document.querySelectorAll('[data-add-module]').length,Object.keys(M.inventory(M.levels[id])).filter(kind=>M.fusions[id]?.kind!==kind||app.eval(`progress.completed('${id}')`)).length,id+' exposes unlocked stock');
 }
 app.eval("switchLevel('normalize')");assert.equal(app.eval('state.nodes.length'),1,'prepared arithmetic lessons keep their starting modules');
 shelf.removeAttribute('open');app.eval("switchLevel('embedding');switchLevel('normalize')");assert.equal(shelf.hidden,false);assert.equal(shelf.hasAttribute('open'),false,'the player can still collapse the persistent shelf');
 app.eval("switchLevel('workshop')");assert.equal(app.eval('state.nodes.length'),0,'the placement tutorial still requires taking a module');
});

test('encoder groups old parts without hiding useful distractors or prewiring the challenge',()=>{
 const app=boot(new Map(),'#encoder-layer'),doc=app.document;
 const current=()=>[...doc.querySelectorAll('.shelf-current [data-add-module]')].map(e=>e.dataset.addModule);
 assert.deepEqual(current(),['self-heads','original-ffn-block','encoder-add','ln-attn','wide-position']);
 assert.equal(doc.querySelector('[data-add-module="ffn-add"]'),null);assert.equal(doc.querySelector('[data-add-module="ln-ffn"]'),null);
 assert.equal(doc.querySelector('[data-add-module="original-encoder"]'),null,'the answer package still requires a win');
 assert.equal(doc.querySelector('[data-earlier-parts]').hasAttribute('open'),false);
 assert.ok(doc.querySelector('.shelf-earlier [data-add-module="v"]'),'earlier learned choices remain inspectable and usable');
 assert.ok(doc.querySelector('.shelf-current [data-add-module="wide-position"]'),'same-width distractor remains in the compact view');
 assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.eval('state.sink'),null);
 doc.querySelector('[data-earlier-parts]').setAttribute('open','');app.eval("chooseModule('v');placeModule(0,0)");
 assert.equal(app.eval("state.nodes[0].kind"),'v');assert.equal(doc.querySelector('[data-earlier-parts]').hasAttribute('open'),true);
 const saved=app.eval('JSON.stringify(state)');
 for(const language of ['en','zh']){
  app.c.I18n.setPreference(language);
  assert.equal(doc.querySelectorAll('[data-encoder-job]').length,2);assert.equal(doc.querySelectorAll('.encoder-job svg').length,2);
  assert.equal(doc.querySelector('.encoder-formulas').hasAttribute('open'),false);
  assert.equal(doc.querySelector('[data-earlier-parts]').hasAttribute('open'),true);
  assert.equal(app.eval('JSON.stringify(state)'),saved);
  if(language==='en')for(const selector of ['.mission','#module-shelf'])assert.doesNotMatch(doc.querySelector(selector).textContent,/[\u3400-\u9fff]/);
 }
 assert.deepEqual([...app.c.I18n.missing],[]);
 app.eval("switchLevel('causal')");assert.equal(doc.querySelector('.encoder-primer'),null);assert.equal(doc.querySelector('[data-earlier-parts]'),null);
});

test('encoder retains saved named copies, wiring and badges while grouped stock refunds correctly',async()=>{
 const base=boot(),M=base.c.NeuralPrologue,old=M.solutions('encoder-layer');old.nodes[0].x=-3.19;
 const key='neural-atelier-level-encoder-layer-v1',meta='neural-atelier-chapters-v1';
 const storage=new Map([[key,JSON.stringify(old)],[meta,JSON.stringify({current:'encoder-layer',completed:['multihead','encoder-layer']})]]),app=boot(storage,'#encoder-layer');
 assert.equal(app.eval('JSON.stringify(state)'),JSON.stringify(old));assert.equal(app.eval("progress.completed('encoder-layer')"),true);
 assert.equal(app.document.querySelector('[data-add-module="encoder-add"] .stock-count').textContent,'0');
 assert.ok(app.document.querySelector('.shelf-current [data-add-module="original-encoder"]'),'earned composite stays visible for collection');
 await app.eval('run()');assert.equal(app.eval('levelPassed()'),true);assert.equal(app.eval('JSON.stringify(state)'),JSON.stringify(old));
 app.eval("removeModule('ffn-add')");assert.equal(app.document.querySelector('[data-add-module="encoder-add"] .stock-count').textContent,'1');
 app.document.querySelector('#undo').onclick();assert.equal(app.eval('JSON.stringify(state)'),JSON.stringify(old));
 const extra=JSON.parse(JSON.stringify(old));extra.nodes.push({id:'encoder-add-2',kind:'encoder-add',x:6,z:3,links:[null,null]});
 const legacy=boot(new Map([[key,JSON.stringify(extra)]]),'#encoder-layer');
 assert.equal(legacy.eval('JSON.stringify(state)'),JSON.stringify(extra),'preexisting extra copies are kept, even beyond the new shared shelf quota');
 assert.equal(legacy.eval("M.stock(state,'encoder-add')"),0);
});

test('a lesson with a single reference module retains choices and saves manual placement',()=>{
 const app=boot(new Map(),'#layernorm'),M=app.c.NeuralPrologue;
 assert.equal(app.eval('state.nodes.length'),0);assert.ok(app.document.querySelectorAll('[data-add-module]').length>1);
 assert.equal(app.document.querySelector('#module-count').textContent,'0 / 3');
 app.eval("chooseModule('layernorm2');placeModule(0,0)");assert.equal(app.eval('state.nodes.length'),1);assert.equal(app.eval("M.canAdd(state,'layernorm2')"),true);
 const saved=app.eval('JSON.stringify(state)'),reopened=boot(app.storage,'#layernorm');assert.equal(reopened.eval('JSON.stringify(state)'),saved);
 reopened.document.querySelector('#reset').onclick();assert.equal(reopened.eval('state.nodes.length'),0);assert.equal(reopened.eval("M.stock(state,'layernorm2')"),2);
});

test('expanded shelves preserve an old circuit, palette order and completion badges',()=>{
 const base=boot(),M=base.c.NeuralPrologue,old=M.solutions('scores');
 old.palette=['k','score','q'];old.nodes[0].x=-3.25;old.nodes[0].z=1.75;
 const key='neural-atelier-level-scores-v1',storage=new Map([[key,JSON.stringify(old)],['neural-atelier-chapters-v1',JSON.stringify({current:'scores',completed:['qkv','scores','softmax']})]]);
 const app=boot(storage,'#scores'),state=JSON.parse(app.eval('JSON.stringify(state)'));
 assert.deepEqual(state.nodes,JSON.parse(JSON.stringify(old.nodes)));assert.equal(state.sink,old.sink);
 assert.deepEqual(state.palette.slice(0,3),old.palette);assert.ok(state.palette.includes('v'));
 assert.equal(app.eval("progress.completed('qkv')&&progress.completed('scores')&&progress.completed('softmax')"),true);
 assert.ok(app.document.querySelector('[data-add-module="v"]'));assert.equal(app.document.querySelector('[data-add-module="softmax"]'),null);
});

test('packaging introductions explain the old operations in both languages',()=>{
 for(const language of ['zh-CN','en-US'])for(const [id,kind]of [['pack-ffn','relu-ffn'],['pack-scores','original-weights']]){
  const app=boot(new Map(),'#'+id,[language]),doc=app.document;
  assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.eval('state.sink'),null);
  assert.ok(doc.querySelector('.package-primer[open]'));assert.ok(doc.querySelector('[data-package="'+kind+'"]'));
  assert.match(doc.querySelector('#mission-reason-example').textContent,id==='pack-ffn'?/ReLU/:/QKᵀ/);
  if(language==='en-US')assert.doesNotMatch(doc.querySelector('.mission').textContent,/[\u3400-\u9fff]/);
 }
});

test('old auto-filled original starts are archived once and can be restored without running',()=>{
 const fixture=boot(),M=fixture.c.NeuralPrologue;
 for(const id of ['embedding','positions','layernorm','softmax','vocabulary-scores']){
  const legacy=M.initial(id,{complete:true,random:()=>.5});delete legacy.placementRevision;
  const key='neural-atelier-level-'+id+'-v1',raw=JSON.stringify(legacy),storage=new Map([[key,raw]]),app=boot(storage,'#'+id);
  assert.equal(app.eval('state.nodes.length'),0,id);assert.equal(storage.get(key+'-before-placement'),raw);
  const restore=app.document.querySelector('#restore-layout');assert.equal(restore.hidden,false);restore.onclick();
  assert.equal(app.eval('busy'),false);assert.equal(app.eval('JSON.stringify(state.nodes)'),JSON.stringify(legacy.nodes));
  const reopened=boot(storage,'#'+id);assert.equal(reopened.eval('state.nodes.length'),legacy.nodes.length,'explicitly restored layouts are not retired again');
  app.document.querySelector('#undo').onclick();assert.equal(app.eval('state.nodes.length'),0,'restoring remains undoable');
 }
});

test('original placement migration preserves wired, completed and partly built saves',()=>{
 const fixture=boot(),M=fixture.c.NeuralPrologue;
 for(const mode of ['wired','completed','partial']){
  const state=mode==='wired'?M.solutions('positions'):M.initial('positions',{complete:true});delete state.placementRevision;
  if(mode==='partial')state.nodes.pop();
  const key='neural-atelier-level-positions-v1',storage=new Map([[key,JSON.stringify(state)]]);
  if(mode==='completed')storage.set('neural-atelier-chapters-v1',JSON.stringify({current:'positions',completed:['positions']}));
  const app=boot(storage,'#positions');assert.equal(app.eval('JSON.stringify(state.nodes)'),JSON.stringify(state.nodes),mode);assert.equal(app.eval('state.sink'),state.sink);assert.equal(storage.has(key+'-before-placement'),false);
  if(mode==='completed')assert.equal(app.eval("progress.completed('positions')"),true);
 }
});

test('a failed archive write leaves the former original board intact',()=>{
 const app=boot(),legacy=app.eval("M.initial('embedding',{complete:true})");delete legacy.placementRevision;
 const key='neural-atelier-level-embedding-v1',raw=JSON.stringify(legacy),storage=new Map([[key,raw]]);
 app.c.limitedStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(k.endsWith('-before-placement'))throw new Error('full');storage.set(k,v);}};
 assert.equal(app.eval("JSON.stringify(createProgress(M,limitedStorage).load('embedding').nodes)"),JSON.stringify(legacy.nodes));assert.equal(storage.get(key),raw);
});

test('formerly fixed saved modules can be returned, placed and reconnected with undo and engine defaults',()=>{
 const first=boot(),storage=new Map(),saved=first.eval("M.solutions('normalize')");saved.nodes[0].x=-.75;saved.nodes[0].z=.8;
 storage.set('neural-atelier-level-normalize-v1',JSON.stringify(saved));const app=boot(storage,'#normalize');
 assert.equal(app.eval('state.nodes[0].x'),-.75);assert.equal(app.eval('state.sink'),'norm');
 app.eval("select('norm');removeModule()");assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.eval('state.sink'),null);assert.equal(app.eval("M.stock(state,'norm')"),2);
 app.eval("chooseModule('norm');placeModule(0,0);link('R','norm',0);link('norm','sink',0)");assert.equal(app.eval("M.stock(state,'norm')"),1);
 const again=boot(storage,'#normalize');assert.equal(again.eval('state.nodes.length'),1);assert.equal(again.eval('state.nodes[0].x'),0);assert.equal(again.eval('state.sink'),'norm');
 app.eval("$('#undo').onclick()");assert.equal(app.eval('state.sink'),null);assert.equal(app.eval('state.nodes[0].links[0]'),'R');
 app.eval("switchLevel('placement');const removed=state.nodes.find(n=>n.id==='enqkv');const position=[removed.x,removed.z];removeModule('enqkv');chooseModule('enqkv');placeModule(...position)");
 assert.equal(app.eval("state.nodes.find(n=>n.id==='enqkv').device"),app.c.NeuralPrologue.levels.placement.devices?.enqkv||'gpu');
 assert.equal(app.eval("M.canAdd(state,'enqkv')"),false,'returning a task does not enlarge its allowed stock');
});

test('reordered chapters retain completion and advanced saves while finished prologues restart',()=>{
 const storage=new Map(),app=boot(storage),kept=new Map();
 for(const id of ['activation','gating','residual','workshop','ffn','normalize','attention']){
  app.eval(`switchLevel('${id}');state=M.solutions(stageId);state.nodes[0].x+=.17;save();progress.complete(stageId)`);
  kept.set(id,app.eval('JSON.stringify(state)'));
 }
 const reopened=boot(storage,'#gating');assert.equal(reopened.location.hash,'#gating');
 for(const [id,circuit]of kept){
  reopened.eval(`switchLevel('${id}')`);assert.equal(reopened.eval('progress.completed(stageId)'),true);
  if(reopened.c.NeuralPrologue.levels[id].practice){
   assert.equal(reopened.eval('state.sink'),null);assert.ok(reopened.eval('state.nodes.every(n=>n.links.every(x=>x===null))'));
   assert.equal(reopened.document.querySelector('#restore-layout').hidden,false);reopened.document.querySelector('#restore-layout').onclick();
  }else assert.equal(reopened.document.querySelector('#restore-layout').hidden,true);
  assert.equal(reopened.eval('JSON.stringify(state)'),circuit);
 }
 reopened.eval("switchLevel('down-projection')");assert.equal(reopened.eval('progress.completed(stageId)'),false);assert.equal(reopened.eval('state.sink'),null);
 reopened.eval("switchLevel('gating');levelMenu()");assert.match(reopened.document.querySelector('[data-level="gating"]').textContent,/现代扩展/);
 reopened.c.I18n.setPreference('en');assert.doesNotMatch(reopened.document.querySelector('#level-list').textContent,/[\u3400-\u9fff]/);
 assert.deepEqual([...reopened.c.I18n.missing],[]);
});

test('every fresh prologue requires wiring and the placement lesson requires taking a module',async()=>{
 const app=boot(),M=app.c.NeuralPrologue,ids=['wire','projection','relu','down-projection','original-ffn','residual','workshop'];
 assert.deepEqual(Array.from(M.routes.main.ids).filter(id=>M.levels[id].practice),ids);
 for(const id of ids){
  app.eval(`switchLevel('${id}')`);
  assert.equal(app.eval('state.sink'),null,id+' starts with no output wire');
  assert.ok(app.eval('state.nodes.every(n=>n.links.every(x=>x===null))'),id+' has no preset connections');
  assert.equal(app.eval('state.nodes.length'),id==='workshop'?0:M.levels[id].nodes.length);
  assert.equal(app.document.querySelector('#restore-layout').hidden,true,'no previous solution is supplied');
  await app.eval('run()');assert.equal(app.eval('levelPassed()'),false,id+' cannot pass without playing');
  assert.ok(!app.document.querySelector('#level-complete').open);assert.equal(app.eval('progress.completed(stageId)'),false);
 }
});

test('a legacy completed workshop opens empty and its solution is restored only on request with undo',()=>{
 const fixture=boot(),solution=fixture.c.NeuralPrologue.solutions('workshop');solution.nodes[0].x=.42;solution.nodes[0].z=-.31;
 const saved=JSON.stringify(solution),storage=new Map([
  ['neural-atelier-chapters-v1',JSON.stringify({current:'workshop',completed:['workshop']})],
  ['neural-atelier-level-workshop-v1',saved]
 ]),app=boot(storage,'#workshop',['en-US']),button=app.document.querySelector('#restore-layout'),fresh=app.eval('JSON.stringify(state)');
 assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.eval('state.sink'),null);assert.equal(app.eval('progress.completed(stageId)'),true);
 assert.equal(storage.get('neural-atelier-level-workshop-v1-completed'),saved);assert.equal(app.document.querySelector('#module-count').textContent,'0 / 1');
 assert.equal(button.hidden,false);assert.equal(button.textContent,'Restore previous solution');
 app.eval('busy=true;refresh()');assert.equal(button.disabled,true);button.onclick();assert.equal(app.eval('JSON.stringify(state)'),fresh);
 app.eval('busy=false;refresh();window.runs=0;world.animate=async()=>runs++');button.onclick();
 assert.equal(app.eval('JSON.stringify(state)'),saved);assert.equal(button.hidden,true);assert.equal(app.eval('busy'),false);assert.equal(app.c.runs,0);
 app.document.querySelector('#undo').onclick();assert.equal(app.eval('JSON.stringify(state)'),fresh);assert.equal(button.hidden,false);
 app.c.I18n.setPreference('zh');assert.equal(button.textContent,'恢复上次方案');button.onclick();assert.equal(app.eval('JSON.stringify(state)'),saved);
 app.document.querySelector('#reset').onclick();assert.equal(app.eval('state.nodes.length'),0);assert.equal(app.eval('state.sink'),null);
 app.document.querySelector('#undo').onclick();assert.equal(app.eval('JSON.stringify(state)'),saved);
 const reloaded=boot(storage,'#workshop');assert.equal(reloaded.eval('JSON.stringify(state)'),saved,'an explicitly restored attempt continues until it is finished');
 assert.equal(reloaded.eval('busy'),false);assert.ok(!reloaded.document.querySelector('#level-complete').open);
 assert.deepEqual([...app.c.I18n.missing],[]);
});

test('legacy prologue migration preserves unfinished work and archives only completed answers',()=>{
 const fixture=boot(),M=fixture.c.NeuralPrologue;
 for(const id of Object.keys(M.levels).filter(id=>M.levels[id].practice))for(const completed of [false,true])for(const wired of [false,true]){
  const state=M.solutions(id);if(state.nodes.length)state.nodes[0].z+=.12;if(!wired)state.sink=null;
  const saved=JSON.stringify(state),storage=new Map([
   ['neural-atelier-chapters-v1',JSON.stringify({current:id,completed:completed?[id]:[]})],
   [`neural-atelier-level-${id}-v1`,saved]
  ]),app=boot(storage,'#'+id);
  assert.equal(app.eval('progress.completed(stageId)'),completed);
  if(completed&&wired){
   assert.equal(app.eval('state.sink'),null);assert.ok(app.eval('state.nodes.every(n=>n.links.every(x=>x===null))'));
   assert.equal(storage.get(`neural-atelier-level-${id}-v1-completed`),saved);
  }else{
   assert.equal(app.eval('JSON.stringify(state)'),saved,id+' keeps an unfinished attempt');
   assert.equal(storage.has(`neural-atelier-level-${id}-v1-completed`),false);
  }
 }
 const wrong=M.solutions('activation');wrong.sink='project';assert.equal(M.evaluate(wrong,M.samples[0].v).error,null);
 const storage=new Map([
  ['neural-atelier-chapters-v1',JSON.stringify({current:'activation',completed:['activation']})],
  ['neural-atelier-level-activation-v1',JSON.stringify(wrong)]
 ]),app=boot(storage,'#activation');
 assert.equal(app.eval('JSON.stringify(state)'),JSON.stringify(wrong),'a fully connected but incorrect attempt is still unfinished');
 assert.equal(storage.has('neural-atelier-level-activation-v1-completed'),false);
});

test('migration retains the only saved solution when browser storage cannot archive it',()=>{
 const app=boot(),solution=app.c.NeuralPrologue.solutions('workshop'),saved=JSON.stringify(solution),storage=new Map([
  ['neural-atelier-chapters-v1',JSON.stringify({current:'workshop',completed:['workshop']})],
  ['neural-atelier-level-workshop-v1',saved]
 ]);
 app.c.limitedStorage={getItem:key=>storage.get(key)||null,setItem(key,value){if(key.endsWith('-completed'))throw new Error('Storage quota exceeded');storage.set(key,value);}};
 assert.equal(app.eval("JSON.stringify(createProgress(M,limitedStorage).load('workshop'))"),saved);
 assert.equal(storage.get('neural-atelier-level-workshop-v1'),saved,'do not overwrite a solution before it is archived');
});

test('finishing a prologue restarts it once while a rebuilt untested circuit survives reload',async()=>{
 const app=boot(),M=app.c.NeuralPrologue;
 for(const id of Object.keys(M.levels).filter(id=>M.levels[id].practice)){
  app.eval(`switchLevel('${id}');state=M.solutions(stageId)`);await app.eval('run()');
  const solved=app.eval('JSON.stringify(state)'),reopened=boot(app.storage,'#'+id),fresh=reopened.eval('JSON.stringify(state)');
  assert.equal(reopened.eval('state.sink'),null);assert.ok(reopened.eval('state.nodes.every(n=>n.links.every(x=>x===null))'));
  assert.equal(boot(app.storage,'#'+id).eval('JSON.stringify(state)'),fresh,'reload preserves the newly started attempt and its positions');
  reopened.c.previous=JSON.parse(solved);reopened.eval('state=previous;changed()');
  const pending=boot(app.storage,'#'+id);assert.equal(pending.eval('JSON.stringify(state)'),solved,'a rebuilt answer has not finished until the player runs it');
  assert.equal(pending.eval('results.length'),0);assert.equal(pending.eval('busy'),false);
 }
});

test('editing a completed prologue keeps the unfinished attempt across navigation and reload',async()=>{
 const app=boot(new Map(),'#workshop');app.eval('state=M.solutions(stageId)');await app.eval('run()');
 app.document.querySelector('#run').focus=()=>{};app.document.querySelector('#complete-replay').onclick();
 app.eval("chooseInput('sink',0);deleteWire()");
 const unfinished=app.eval('JSON.stringify(state)');assert.equal(app.eval('state.sink'),null);
 app.eval("switchLevel('projection');switchLevel('workshop')");assert.equal(app.eval('JSON.stringify(state)'),unfinished);
 const reloaded=boot(app.storage,'#workshop');assert.equal(reloaded.eval('JSON.stringify(state)'),unfinished);assert.equal(reloaded.eval('state.nodes.length'),1);
 assert.equal(reloaded.document.querySelector('#restore-layout').hidden,false);
 reloaded.document.querySelector('#restore-layout').onclick();assert.equal(reloaded.eval('state.sink'),'project');assert.equal(reloaded.eval('busy'),false);
});

test('bridge cards explain only their actual inputs and calculations in both languages',()=>{
 const app=boot(),M=app.c.NeuralPrologue;
 for(const language of ['zh','en']){
  app.c.I18n.setPreference(language);
  for(const id of ['down-projection','plain-ffn','gate-projection','pairwise','swiglu']){
   app.eval(`switchLevel('${id}')`);const s=M.solutions(id);
   for(const n of s.nodes){
    const c=app.eval(`cardFor('${n.kind}','${id}')`),e=app.eval(`exampleFor(M,'${n.kind}','${id}')`),ev=M.evaluate(s,e.exampleSource[1]);
    assert.deepEqual(Array.from(e.output[1]),Array.from(ev.values[n.id]));
    e.inputs.forEach((input,i)=>assert.deepEqual(Array.from(input[1]),Array.from(ev.values[n.links[i]])));
    if(language==='en')assert.doesNotMatch(c.meaning+c.purpose,/[\u3400-\u9fff]/);
    if(id==='pairwise'||id==='gate-projection'){assert.equal(e.comparison,undefined);assert.equal(e.activation,undefined);}
    if(id==='plain-ffn'&&n.kind==='down')assert.equal(c.formula,'F = S × Wd');
    if(id==='down-projection'&&n.kind==='down')assert.equal(c.formula,'F = P × Wd');
   }
  }
 }
 assert.deepEqual([...app.c.I18n.missing],[]);
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
