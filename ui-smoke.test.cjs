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
