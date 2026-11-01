const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
async function boot({reduced=true,frameMs=1000,onFrame=()=>{},languages=['zh-CN']}={}){
 const Three=await import('./vendor/three.module.js');
 const {document,window}=parseHTML(fs.readFileSync(__dirname+'/index.html','utf8'));const native=document.createElement.bind(document);
 document.createElement=function(name){const el=native(name);if(name==='canvas')el.getContext=()=>({fillRect(){},fillText(){},measureText(t){return {width:String(t).length*60}}});return el;};
 for(const el of document.querySelectorAll('dialog')){el.showModal=function(){this.open=true};el.close=function(){this.open=false};}
 for(const el of document.querySelectorAll('*')){Object.defineProperty(el,'clientWidth',{get:()=>el.id==='scene'?1400:100});Object.defineProperty(el,'clientHeight',{get:()=>el.id==='scene'?760:60});el.focus=()=>{};el.scrollIntoView=()=>{};}
 let view;const scenes=[];class Renderer{constructor(){this.domElement=native('canvas');this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};}setPixelRatio(){}setClearColor(){}setSize(){}render(scene,camera){view={position:camera.position.toArray(),width:camera.right-camera.left};scenes.push(scene);scene.updateMatrixWorld();camera.updateMatrixWorld();scene.traverse(o=>{if(o.isMesh)assert.ok(o.matrixWorld.elements.every(Number.isFinite),'nonfinite transform '+o.type);});}}
 const storage=new Map();let now=0;const c={document,console,navigator:{languages},T:{...Three,WebGLRenderer:Renderer},devicePixelRatio:2,ResizeObserver:class{observe(){}},requestAnimationFrame:cb=>setImmediate(()=>{now+=frameMs;onFrame({now,document,window});cb(now);}),cancelAnimationFrame:clearImmediate,performance:{now:()=>now},matchMedia:()=>({matches:reduced}),setTimeout,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};c.window=c;vm.createContext(c);
 for(const f of ['locales/en.js','i18n.js','music.js','shell.js','model.js','campaign.js','engine-model.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),c,{filename:f});
 for(const f of ['module-cards.js','level-progress.js','scene-art.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8').replaceAll('export ',''),c,{filename:f});
 let src=fs.readFileSync(__dirname+'/game.js','utf8').replace(/^import .*\n/gm,'').replace("const T=await import('./vendor/three.module.js');",'const T=window.T;').replace(/const \{createSceneArt\}=await import\('\.\/scene-art\.js\?v=[^']+'\);/,'');
 src+='\nwindow.testAPI={switchLevel,run,togglePause,refresh,select,assignDevice,chooseOutput,chooseInput,chooseModule,placeModule,getState:()=>state,setState:s=>state=s,getWorld:()=>world,getFault:()=>fault};';
 await vm.runInContext('(async()=>{'+src+'})()',c);
 assert.ok(c.testAPI.getWorld(),'3D boot failed');return {c,document,window,api:c.testAPI,scenes,time:()=>now,view:()=>view};
}
test('moving trays preserve feature columns and sequence rows through projection',async()=>{
 let app;const checked=new Set();
 app=await boot({reduced:false,frameMs:100,onFrame:()=>{
  if(!app)return;
  for(const mesh of app.scenes.at(-1).children){
   if(mesh.userData.routing||!mesh.visible||(!mesh.userData.packet&&!mesh.userData.processing&&!mesh.userData.processingOutput))continue;
   const bars=mesh.children.filter(o=>o.userData.feature!=null);if(!bars.length)continue;
   const rows=mesh.userData.row==='sequence'?3:1,cols=bars.length/rows;
   assert.ok(mesh.children.some(o=>o.userData.packetTray),'each vector has one shared tray');
   for(let row=0;row<rows;row++){
    const features=bars.slice(row*cols,(row+1)*cols);assert.ok(features.every(o=>o.position.z===features[0].position.z));
    assert.ok(features.every((o,i)=>!i||o.position.x>features[i-1].position.x),'features stay in left-to-right order');
    if(row){assert.ok(features[0].position.z>bars[(row-1)*cols].position.z);assert.equal(features[0].position.x,bars[0].position.x);}
   }
   if(rows===1)assert.equal(bars[0].position.z,0);
   checked.add(rows+'x'+cols);
  }
 }});
 for(const id of ['projection','scores']){app.api.switchLevel(id);app.api.setState(app.c.NeuralPrologue.solutions(id));app.api.getWorld().rebuild();await app.api.run();assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);}
 for(const shape of ['1x2','1x4','3x2','3x3'])assert.ok(checked.has(shape),shape+' should retain its orientation');
});
test('camera drag and zoom remain live during a run without editing the circuit',async()=>{
 let app,checked=false;
 const event=(target,type,properties)=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);target.dispatchEvent(e);};
 app=await boot({reduced:false,frameMs:100,onFrame:({document})=>{
  if(!app||checked||!document.querySelector('.packet:not([hidden])'))return;checked=true;
  const original=JSON.stringify(app.api.getState()),start=app.view();
  event(document.querySelector('#scene'),'pointerdown',{clientX:600,clientY:300});event(document,'pointermove',{clientX:680,clientY:350});event(document,'pointerup',{});
  assert.notDeepEqual(app.view().position,start.position,'dragging the workbench moves the camera');
  const second=app.view(),label=document.querySelector('[data-node="project"]');
  event(label,'pointerdown',{clientX:680,clientY:350});event(document,'pointermove',{clientX:730,clientY:390});event(document,'pointerup',{});
  assert.notDeepEqual(app.view().position,second.position,'dragging a module label during a run also orbits');
  const beforeZoom=app.view().width;event(label,'wheel',{deltaY:-100});assert.ok(app.view().width<beforeZoom);
  app.api.chooseOutput('R');app.api.chooseInput('sink',0);assert.equal(JSON.stringify(app.api.getState()),original,'camera gestures and port clicks must not rewire or move modules');
 }});
 app.document.querySelector('#welcome').close();app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 assert.ok(checked);assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);assert.equal(app.document.querySelectorAll('.packet').length,0);assert.equal(app.document.body.classList.contains('network-running'),false);
});
test('construct every 3D level, run its data through scene updates, open and close every module card',async()=>{
 const app=await boot(),M=app.c.NeuralPrologue;
 for(const id of Object.keys(M.levels)){
  app.api.switchLevel(id);const s=M.solutions(id);if(M.levels[id].engine)s.settings.precision=16;app.api.setState(s);app.api.getWorld().rebuild();app.api.refresh();
  await app.api.run();assert.equal(app.document.querySelector('#loading').hidden,true);assert.equal(app.document.querySelectorAll('.node-value').length,0,'completed runs clear transient vector labels');
  assert.equal(app.document.querySelectorAll('[data-node]').length,M.levels[id].nodes.length);
  for(const n of s.nodes){app.api.getWorld().focus(n.id);assert.equal(app.document.querySelector('#module-card').open,true);assert.ok(app.document.querySelector('#card-name').textContent);app.document.querySelector('#card-close').onclick();assert.equal(app.document.querySelector('#module-card').open,false);assert.ok(app.document.querySelector('.arena > #scene'));}
 }
});
test('small matrices keep their blocks while numbers return when zoomed in',async()=>{
 const app=await boot();app.api.switchLevel('residual');app.api.setState(app.c.NeuralPrologue.solutions('residual'));app.api.getWorld().rebuild();
 const state=JSON.stringify(app.api.getState());
 let down;app.scenes.at(-1).traverse(o=>{if(o.userData.node==='down')down=o;});
 const faces=down.children.filter(o=>o.userData.detailText);assert.equal(faces.length,8);
 const wheel=new app.window.Event('wheel',{bubbles:true,cancelable:true});wheel.deltaY=2000;app.document.querySelector('#scene').dispatchEvent(wheel);
 assert.ok(faces.every(o=>!o.visible),'unreadable matrix numbers are hidden');
 assert.ok(down.children.filter(o=>o.geometry?.type==='BoxGeometry'&&o.visible).length>=8,'the colored weight blocks stay visible');
 await app.api.run();assert.equal(app.document.querySelectorAll('#test-results .pass').length,app.c.NeuralPrologue.levels.residual.sampleCount,'abstract rendering does not change the calculation');
 app.api.getWorld().focus('down');await new Promise(setImmediate);
 assert.ok(faces.every(o=>o.visible),'the close-up restores the actual numbers');
 app.document.querySelector('#card-close').onclick();assert.ok(faces.every(o=>!o.visible),'returning to the distant view restores abstraction immediately');
 assert.equal(JSON.stringify(app.api.getState()),state);
});
test('3D fault bubble and pin dismiss without losing recorded failure',async()=>{
 const app=await boot();app.api.switchLevel('vocabulary');await app.api.run();assert.ok(app.api.getFault());const b=app.document.querySelector('[data-dismiss-result]');assert.ok(b);b.dispatchEvent(new app.window.Event('click',{bubbles:true}));assert.equal(app.api.getFault(),null);assert.equal(app.document.querySelectorAll('.local-fault,.fault-pin').length,0);assert.ok(app.document.querySelector('#test-results .fail'));await app.api.run();assert.ok(app.document.querySelector('[data-dismiss-result]'));
});

test('select a cable, delete it with the visible action or keyboard, and undo it',async()=>{
 const app=await boot();app.document.querySelector('#welcome').close();app.api.switchLevel('gating');app.api.setState(app.c.NeuralPrologue.solutions('gating'));app.api.getWorld().rebuild();
 const selectedPath=()=>app.document.querySelector('.wire-targets path[data-wire-to="multiply"][data-wire-port="0"]');
 selectedPath().dispatchEvent(new app.window.Event('click',{bubbles:true}));assert.ok(app.document.querySelector('[data-delete-wire]'));assert.equal(app.api.getState().nodes.find(n=>n.id==='multiply').links[0],'silu');
 app.document.querySelector('[data-delete-wire]').dispatchEvent(new app.window.Event('click',{bubbles:true}));assert.equal(selectedPath(),null);assert.equal(app.document.querySelector('.wire-actions'),null);assert.equal(app.api.getState().nodes.find(n=>n.id==='multiply').links[1],'up');
 app.document.querySelector('#undo').onclick();selectedPath().dispatchEvent(new app.window.Event('click',{bubbles:true}));const event=new app.window.Event('keydown',{bubbles:true});event.key='Delete';app.document.dispatchEvent(event);assert.equal(selectedPath(),null);
});
test('completed and cancelled wiring clear the dashed drag preview',async()=>{
 const app=await boot();app.document.querySelector('#welcome').close();app.api.switchLevel('projection');app.document.querySelector('#scene').getBoundingClientRect=()=>({left:0,top:0,width:1400,height:760,right:1400,bottom:760});
 const previews=()=>app.scenes.at(-1).children.filter(o=>o.material?.type==='LineDashedMaterial');
 app.api.chooseOutput('R');app.api.getWorld().previewAt(650,340);assert.equal(previews().length,1);app.api.chooseInput('project',0);assert.equal(previews().length,0);
 app.api.chooseOutput('project');app.api.getWorld().previewAt(800,380);assert.equal(previews().length,1);const event=new app.window.Event('keydown',{bubbles:true});event.key='Escape';app.document.dispatchEvent(event);assert.equal(previews().length,0);
});
test('SiLU carriers follow curved channels and shrink by the actual sigmoid gate',async()=>{
 let app;const observed=new Map();let snapshots=0;
 app=await boot({reduced:false,frameMs:20,onFrame:({document})=>{
  const label=document.querySelector('.processing-packet[data-node="silu"]');if(!label||label.hidden)return;
  const key=label.dataset.row;app.scenes.at(-1).traverse(o=>{
   if(o.userData.activationFeature==null||!o.visible)return;const d=o.userData,id=key+':'+d.activationFeature;if(!observed.has(id))observed.set(id,[]);
   assert.ok(Math.abs(d.outputValue-d.inputValue*d.sigmoid)<1e-12);assert.ok(Math.abs(d.value)<=Math.abs(d.inputValue)+1e-12);if(d.inputValue<0)assert.ok(d.value<0,'SiLU must not zero or flip negative inputs');
   observed.get(id).push({scale:o.scale.x,x:o.position.x,y:o.position.y,phase:d.phase});snapshots++;
  });
 }});
 app.api.switchLevel('activation');app.api.setState(app.c.NeuralPrologue.solutions('activation'));app.api.getWorld().rebuild();await app.api.run();assert.ok(snapshots>30);
 const negative=observed.get('1:3');assert.ok(negative.length>4);assert.ok(negative.at(-1).scale<negative[0].scale*.6);assert.ok(negative.at(-1).x>negative[0].x);assert.ok(negative.at(-1).y>negative[0].y+.3);
 app.scenes.at(-1).traverse(o=>{if(o.userData.activationFeature!=null)assert.equal(o.visible,false,'no lingering activation effect');});assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);
});

test('first-level dashed guide demonstrates the connection without creating one and hides once used',async()=>{
 const app=await boot(),visible=()=>{const g=app.document.querySelector('.connection-guide');return !!g&&!g.hasAttribute('hidden');};
 assert.ok(visible());assert.equal(app.api.getState().sink,null);
 assert.match(app.document.querySelector('.connection-guide path').getAttribute('d'),/^M/);
 // Exercise the port actions directly: LinkeDOM caches dataset before later setAttribute calls.
 app.api.chooseOutput('R');assert.equal(visible(),false);assert.equal(app.api.getState().sink,null);
 app.api.chooseInput('sink',0);assert.equal(app.api.getState().sink,'R');assert.equal(visible(),false);
 await app.api.run();assert.equal(visible(),false);assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);
 app.document.querySelector('#reset').onclick();assert.ok(visible());app.api.switchLevel('projection');assert.equal(visible(),false);
});

test('real packet timeline gives every row equal duration and scales with the slider',async()=>{
 const app=await boot({reduced:false,frameMs:50}),world=app.api.getWorld(),original=world.animate,slider=app.document.querySelector('#playback-speed'),totals=[];
 app.api.setState(app.c.NeuralPrologue.solutions('wire'));world.rebuild();
 for(const rate of [.5,1,2]){
  slider.value=String(rate);slider.dispatchEvent(new app.window.Event('input',{bubbles:true}));const durations=[];
  world.animate=async(...args)=>{const start=app.time();await original(...args);durations.push(app.time()-start);};
  await app.api.run();assert.equal(durations.length,3);assert.ok(durations.every(ms=>ms===durations[0]));assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);totals.push(durations[0]);
 }
 assert.ok(Math.abs(totals[0]-2*totals[1])<=50);assert.ok(Math.abs(totals[1]-2*totals[2])<=50);
});
test('changing speed mid-flight keeps packets moving forward and still completes',async()=>{
 let changed=false,firstPacket=null,positions=[];
 const app=await boot({reduced:false,frameMs:50,onFrame:({now,document,window})=>{
  const packet=document.querySelector('.packet');if(!firstPacket&&packet)firstPacket=packet;
  if(packet===firstPacket&&packet){const left=parseFloat(packet.style.left);if(Number.isFinite(left))positions.push(left);}
  if(now>=200&&!changed&&packet){changed=true;const slider=document.querySelector('#playback-speed');slider.value='.25';slider.dispatchEvent(new window.Event('input',{bubbles:true}));}
 }});
 app.api.setState(app.c.NeuralPrologue.solutions('wire'));app.api.getWorld().rebuild();await app.api.run();
 assert.ok(changed);assert.ok(positions.length>10);assert.ok(positions.every((x,i)=>i===0||x>=positions[i-1]));assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);
});

test('stationary rows pulse while labelled vectors follow invisible departure and arrival paths',async()=>{
 let app,tubeCount;const seen=new Map(),arrivals=new Map(),projected=new Map(),rowTones=new Map();
 const tubes=scene=>{let count=0;scene.traverse(o=>{if(o.geometry?.type==='TubeGeometry')count++;});return count;};
 app=await boot({reduced:false,frameMs:10,onFrame:({document})=>{
  const scene=app.scenes.at(-1);if(!scene)return;
  assert.equal(tubes(scene),tubeCount,'running must not draw extra wires inside either rack');
  scene.traverse(o=>{if(o.userData.sourceRow!=null){assert.equal(o.position.y,.65,'input trays stay still');if(o.userData.active){const i=o.userData.sourceRow;if(!rowTones.has(i))rowTones.set(i,new Set());rowTones.get(i).add(o.children[0].material.color.getHex());}}if(o.userData.sinkRow!=null)assert.equal(o.position.y,.66,'output trays stay still');});
  for(const el of document.querySelectorAll('.packet[data-motion="wire"]')){
   const row=Number(el.dataset.row),mesh=scene.children.find(o=>o.userData.packet&&o.userData.from===el.dataset.from);
   if(el.dataset.from==='R'&&!seen.has(row)){
    assert.equal(el.querySelector('.packet-title').textContent,['我','爱','猫'][row]);
    assert.equal(mesh.position.z,-1.05+row*.96);
    const active=[];scene.traverse(o=>{if(o.userData.sourceRow!=null&&o.userData.active)active.push(o.userData.sourceRow);});assert.deepEqual(active,[row]);
    const features=mesh.children.filter(o=>o.userData.feature!=null);
    seen.set(row,{tone:el.style.getPropertyValue('--row-color'),heights:features.map(o=>o.geometry.parameters.height)});
   }
   if(el.dataset.from==='project'&&!el.hidden){
    projected.set(row,JSON.parse(el.querySelector('.packet-values').textContent));
    arrivals.set(row,Math.min(arrivals.get(row)??Infinity,Math.abs(mesh.position.z-(-1.05+row*.96))));
   }
  }
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();tubeCount=tubes(app.scenes.at(-1));await app.api.run();
 assert.equal(seen.size,3);assert.equal(new Set([...seen.values()].map(r=>r.tone)).size,3);
 assert.ok(seen.get(0).heights[0]>4*seen.get(0).heights[1]);assert.ok(seen.get(1).heights[1]>4*seen.get(1).heights[0]);assert.equal(seen.get(2).heights[0],seen.get(2).heights[1]);
 assert.deepEqual([...projected.values()],[[1,0,1,.5],[0,1,.5,-1],[1,1,1.5,-.5]]);
 assert.ok([...rowTones.values()].every(tones=>tones.size>1),'each active row has a visible colour pulse');
 assert.ok([...arrivals.values()].every(d=>d<.15));assert.equal(app.document.querySelectorAll('.packet,.row-marker').length,0);
});

test('sequence packets represent all three rows, and extra validation samples are not a fourth or fifth token row',async()=>{
 let app,mode='sequence',sequenceFrames=0,validationFrames=0;
 app=await boot({reduced:false,frameMs:200,onFrame:({document})=>{
  const el=document.querySelector('.packet');if(!el)return;
  if(mode==='sequence'){
   sequenceFrames++;assert.equal(el.dataset.row,'sequence');assert.match(el.textContent,/整段输入/);assert.equal(document.querySelector('.row-marker'),null);
   const active=[];app.scenes.at(-1).traverse(o=>{if(o.userData.sourceRow!=null&&o.userData.active)active.push(o.userData.sourceRow);});assert.deepEqual(active,[0,1,2]);
  }else if(el.dataset.row==='validation'){
   validationFrames++;assert.match(el.querySelector('.packet-title').textContent,/^新输入 [AB]$/);
   app.scenes.at(-1).traverse(o=>{if(o.userData.sourceRow!=null)assert.equal(o.userData.active,false);});
  }
 }});
 for(const id of ['attention','gating']){mode=id==='attention'?'sequence':'row';app.api.switchLevel(id);app.api.setState(app.c.NeuralPrologue.solutions(id));app.api.getWorld().rebuild();await app.api.run();}
 assert.ok(sequenceFrames>0);assert.ok(validationFrames>0);
});

test('projection travels continuously through the matrix and animates only nonzero weighted contributions',async()=>{
 let app;const paths=new Map(),phases=new Set(),contributions=new Map();
 app=await boot({reduced:false,frameMs:10,onFrame:({document})=>{
  const scene=app.scenes.at(-1);
  for(const row of ['0','1','2']){
   const candidates=Array.from(document.querySelectorAll(`.packet[data-row="${row}"]`));if(!candidates.length)continue;
   const visible=candidates.filter(el=>!el.hidden);
   if(!visible.length){assert.ok(!paths.has(row),'no blank frame between input, processing and output');continue;}
   assert.equal(visible.length,1,'one continuous label for this projection');
   const el=visible[0],inside=el.dataset.motion==='process',mesh=scene.children.find(o=>inside?o.userData.processing==='project':o.userData.packet&&o.userData.from===el.dataset.from);
   if(!paths.has(row))paths.set(row,[]);paths.get(row).push(mesh.position.clone());
   if(inside){phases.add(el.dataset.phase);assert.equal(document.querySelector('.node-value[data-owner="project"]'),null,'result appears only after processing');}
   if(!contributions.has(row))contributions.set(row,new Set());
   scene.traverse(o=>{if(o.userData.contribution&&o.visible)contributions.get(row).add(`${o.userData.input}:${o.userData.output}`);});
  }
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 assert.deepEqual([...phases],['enter','compute','gather']);
 for(const positions of paths.values())assert.ok(positions.every((p,i)=>!i||p.distanceTo(positions[i-1])<.5),'no jump across the module');
 assert.deepEqual([...contributions.get('0')].sort(),['0:0','0:2','0:3']);
 assert.deepEqual([...contributions.get('1')].sort(),['1:1','1:2','1:3']);
 assert.equal(contributions.get('2').size,6);
});

test('two-input processing waits for both branches to reach its ports',async()=>{
 let app,arrived=new Set(),waiting=0,processed=0,lastRow;
 app=await boot({reduced:false,frameMs:10,onFrame:({document})=>{
  const proc=document.querySelector('.processing-packet[data-node="multiply"]');if(!proc)return;
  if(proc.dataset.row!==lastRow){lastRow=proc.dataset.row;arrived=new Set();}
  const n=app.api.getState().nodes.find(n=>n.id==='multiply'),scene=app.scenes.at(-1);
  for(const el of document.querySelectorAll('.packet[data-motion="wire"][data-to="multiply"]')){
   if(el.hidden)continue;const mesh=scene.children.find(o=>o.userData.packet&&o.userData.from===el.dataset.from&&o.userData.to==='multiply'),index=n.links.indexOf(el.dataset.from);
   if(Math.hypot(mesh.position.x-(n.x-1.12),mesh.position.z-(n.z+(index? .55:-.55)))<.2){arrived.add(el.dataset.from);if(proc.hidden)waiting++;}
  }
  if(!proc.hidden){processed++;assert.equal(arrived.size,2,'both inputs arrive before processing');}
 }});
 app.api.switchLevel('gating');app.api.setState(app.c.NeuralPrologue.solutions('gating'));app.api.getWorld().rebuild();await app.api.run();
 assert.ok(waiting>10);assert.ok(processed>0);
});

test('stopping and immediately restarting during processing clears effects without cancelling the new run',async()=>{
 let app,restarted=false,restart;
 app=await boot({reduced:false,frameMs:20,onFrame:({document})=>{
  const proc=document.querySelector('.processing-packet');
  if(!restarted&&proc&&!proc.hidden&&proc.dataset.phase==='compute'){
   restarted=true;app.api.run();assert.equal(document.querySelectorAll('.packet').length,0);
   app.scenes.at(-1).traverse(o=>{if(o.userData.contribution)assert.equal(o.visible,false);});
   restart=app.api.run();
  }
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();await restart;
 assert.ok(restarted);assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);assert.equal(app.document.querySelectorAll('.packet').length,0);
});

test('English scene labels and module cards work, and live language switching keeps a moving run valid',async()=>{
 let app,changed=false;
 app=await boot({reduced:false,frameMs:80,languages:['en-US'],onFrame:({document})=>{
  if(app&&!changed&&document.querySelector('.packet')){changed=true;app.c.I18n.setPreference('zh');app.c.I18n.setPreference('en');}
 }});
 const M=app.c.NeuralPrologue;
 for(const id of Object.keys(M.levels)){
  app.api.switchLevel(id);const s=M.solutions(id);if(M.levels[id].engine)s.settings.precision=16;app.api.setState(s);app.api.getWorld().rebuild();await app.api.run();
  for(const n of s.nodes){app.api.getWorld().focus(n.id);assert.doesNotMatch(app.document.querySelector('#card-meaning').textContent,/[\u3400-\u9fff]/);app.document.querySelector('#card-close').onclick();}
  assert.doesNotMatch(app.document.querySelector('#labels').textContent,/[\u3400-\u9fff]/);
 }
 assert.ok(changed);assert.deepEqual([...app.c.I18n.missing],[]);assert.equal(app.document.querySelectorAll('.packet').length,0);
});

test('down projection routes four feature blocks to matching weight rows and explains each output',async()=>{
 let app;const rows=new Set(),intervals=new Map(),trails=new Map(),formulas=new Set();
 app=await boot({reduced:false,frameMs:40,onFrame:({document,now})=>{
  if(!app)return;const label=document.querySelector('.processing-packet[data-node="down"]');if(!label||label.hidden)return;
  const scene=app.scenes.at(-1),mesh=scene.children.find(o=>o.userData.processing==='down'),unit=scene.children.flatMap(o=>o.children).find(o=>o.userData.node==='down');
  const bars=mesh.children.filter(o=>o.userData.feature!=null);
  const row=label.dataset.row;
  for(const bar of bars){
   const id=document.querySelector('#pass-count').textContent+':'+bar.userData.feature,pos=bar.getWorldPosition(new app.c.T.Vector3());
   if(!trails.has(id))trails.set(id,[]);trails.get(id).push(pos);
   if(bar.userData.mappingProgress!==1||!mesh.visible)continue;
   rows.add(row);const i=bar.userData.feature,expectedZ=unit.position.z+(i-1.5)*1.5/4;
   assert.ok(Math.abs(pos.z-expectedZ)<1e-9,'each coefficient aligns with the matching weight row');
   assert.ok(Math.abs(pos.x-(unit.position.x-1.12))<1e-9,'all four coefficients face their own row');
   assert.equal(bar.userData.mappedInput,i);
   if(row==='0')assert.equal(bar.userData.value,[1,0,1,.5][i]);
  }
  if(row!=='0')return;
  const calc=document.querySelector('.projection-calculation[data-node="down"]');
  if(calc&&!calc.hidden){const column=Number(calc.dataset.column);assert.equal(calc.textContent,['1 × 0.4 + 0 × 0 + 1 × 0.2 + 0.5 × (-0.1) = 0.55','1 × 0 + 0 × 0.3 + 1 × 0.2 + 0.5 × 0.3 = 0.35'][column]);formulas.add(column);}
  unit.traverse(o=>{if(!o.userData.contribution||!o.visible)return;const d=o.userData;
   assert.equal(d.value,[1,0,1,.5][d.input]*app.c.NeuralPrologue.weights.down[d.input][d.output]);
   assert.notEqual(d.value,0,'zero values still align but do not send a nonzero contribution');
   if(!intervals.has(d.output))intervals.set(d.output,[]);intervals.get(d.output).push(now);
  });
 }});
 app.api.switchLevel('residual');app.api.setState(app.c.NeuralPrologue.solutions('residual'));app.api.getWorld().rebuild();await app.api.run();
 assert.equal(formulas.size,2);assert.equal(rows.size,4,'includes three named samples and the extra validation samples');
 for(const points of trails.values())assert.ok(points.every((p,i)=>!i||p.distanceTo(points[i-1])<.35),'components fan out without teleporting');
 assert.ok(Math.max(...intervals.get(0))<Math.min(...intervals.get(1)),'first output is explained before the others');
 const duration=i=>Math.max(...intervals.get(i))-Math.min(...intervals.get(i));assert.ok(Math.abs(duration(0)-duration(1))<=40,'both outputs use the same travel time');
 assert.equal(app.document.querySelectorAll('.projection-calculation,.packet').length,0);
 assert.equal(app.document.querySelectorAll('#test-results .pass').length,5);
});

test('pause freezes processing while camera and speed controls stay live; resume never catches up wall time',async()=>{
 let app,phase='waiting',snapshot,frames=0,resumedPosition;
 const event=(target,type,properties={})=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);target.dispatchEvent(e);};
 const visual=()=>{const data=[];app.scenes.at(-1).traverse(o=>{if(o.userData.feature!=null||o.userData.contribution)data.push([o.visible,o.position.toArray(),o.scale.toArray(),o.material.opacity]);});return JSON.stringify(data);};
 app=await boot({reduced:false,frameMs:40,onFrame:({document})=>{
  if(!app)return;const label=document.querySelector('.processing-packet');if(!label||label.hidden)return;
  const mesh=app.scenes.at(-1).children.find(o=>o.userData.processing==='project');
  if(phase==='waiting'&&mesh.userData.featureRoutes?.[0].bar.userData.mappingProgress===1){
   phase='paused';document.querySelector('#pause').onclick();assert.equal(document.querySelector('#pause').textContent,'▶ 继续');snapshot=visual();return;
  }
  if(phase==='paused'){
   assert.equal(visual(),snapshot,'animation positions, scale and opacity remain frozen');frames++;
   if(frames===3){
    const before=app.view(),circuit=JSON.stringify(app.api.getState());
    event(document.querySelector('#scene'),'pointerdown',{clientX:500,clientY:300});event(document,'pointermove',{clientX:600,clientY:340});event(document,'pointerup');event(label,'wheel',{deltaY:-100});
    assert.notDeepEqual(app.view().position,before.position);assert.ok(app.view().width<before.width);
    app.api.chooseOutput('R');app.api.chooseInput('sink',0);assert.equal(JSON.stringify(app.api.getState()),circuit);
    const slider=document.querySelector('#playback-speed');slider.value='.5';event(slider,'input');
    assert.equal(visual(),snapshot,'camera and settings cannot advance processing');
   }
   if(frames===6){app.c.I18n.setPreference('en');assert.equal(document.querySelector('#pause').textContent,'▶ Resume');assert.equal(visual(),snapshot,'changing language preserves paused effects');}
   if(frames===15){resumedPosition=mesh.position.clone();document.querySelector('#pause').onclick();phase='resuming';}
  }else if(phase==='resuming'){
   assert.ok(mesh.position.distanceTo(resumedPosition)<.1,'resume does not include the paused wall-clock interval');phase='done';
  }
 }});
 app.document.querySelector('#welcome').close();app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 assert.equal(phase,'done');assert.equal(app.document.querySelector('#pause').disabled,true);assert.equal(app.document.querySelector('#pause').getAttribute('aria-pressed'),'false');assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);
});

test('stopping a paused run clears its effects and the next run starts unpaused',async()=>{
 let app,restart,stopped=false;
 app=await boot({reduced:false,frameMs:80,onFrame:({document})=>{
  const calc=document.querySelector('.projection-calculation:not([hidden])');if(!app||stopped||!calc)return;
  stopped=true;app.api.togglePause();app.api.run();
  assert.equal(document.querySelector('#pause').disabled,true);assert.equal(document.querySelectorAll('.packet,.projection-calculation').length,0);
  restart=app.api.run();assert.equal(document.querySelector('#pause').getAttribute('aria-pressed'),'false');
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();await restart;
 assert.ok(stopped);assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);
});

test('dragging a module card previews the operator, places one copy and dismisses the tutorial guide',async()=>{
 const app=await boot(),doc=app.document;doc.querySelector('#welcome').close();app.api.switchLevel('workshop');
 const scene=()=>app.scenes.at(-1),ghost=()=>scene().children.find(o=>o.userData.placementGhost),guide=()=>doc.querySelector('.placement-guide');
 const event=(target,type,properties={})=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);target.dispatchEvent(e);};
 doc.querySelector('#scene').getBoundingClientRect=()=>({left:0,top:0,width:1400,height:760,right:1400,bottom:760});
 assert.equal(guide().hasAttribute('hidden'),false);const card=doc.querySelector('[data-add-module="project"]');
 event(card,'pointerdown',{clientX:120,clientY:160});event(doc,'pointermove',{clientX:700,clientY:380});
 assert.ok(ghost());assert.ok(ghost().children.length>10,'preview is the matrix module, not a placeholder cube');assert.equal(app.api.getState().nodes.length,0);
 event(doc,'pointerup',{clientX:700,clientY:380});card.dispatchEvent(new app.window.Event('click',{bubbles:true}));
 assert.equal(ghost(),undefined);assert.equal(app.api.getState().nodes.length,1);assert.equal(guide().hasAttribute('hidden'),true);assert.equal(doc.querySelector('#module-count').textContent,'1 / 1');
 app.api.chooseOutput('R');app.api.chooseInput('project',0);app.api.chooseOutput('project');app.api.chooseInput('sink',0);await app.api.run();assert.equal(doc.querySelectorAll('#test-results .pass').length,3);
 app.document.querySelector('#reset').onclick();assert.equal(guide().hasAttribute('hidden'),false);
 event(doc.querySelector('[data-add-module="project"]'),'pointerdown',{clientX:120,clientY:160});event(doc,'pointermove',{clientX:700,clientY:380});event(doc,'pointerup',{clientX:1500,clientY:380});assert.equal(ghost(),undefined);assert.equal(app.api.getState().nodes.length,0,'dropping outside does not create or spend a copy');
});

test('duplicate modules render cards, distinct processing and correctly sized weight matrices',async()=>{
 let app;const seen=new Set();
 app=await boot({reduced:false,frameMs:120,onFrame:({document})=>{for(const el of document.querySelectorAll('.processing-packet'))if(!el.hidden)seen.add(el.dataset.node);}});
 app.api.switchLevel('ffn');const s=app.c.NeuralPrologue.initial('ffn');
 const coords=[[-4.7,-2],[-1.4,-2],[1.9,-2],[5.2,-2],[-4.7,2],[-1.4,2]];['project','down','project','down','add','add'].forEach((kind,i)=>app.c.NeuralPrologue.addNode(s,kind,...coords[i]));
 for(const edge of [['R','project',0],['project','down',0],['down','project-2',0],['project-2','down-2',0],['down','add',0],['down-2','add',1],['add','add-2',0],['R','add-2',1],['add-2','sink',0]])app.c.NeuralPrologue.connect(s,...edge);
 app.api.setState(s);app.api.getWorld().rebuild();app.api.refresh();
 for(const id of ['project-2','down-2','add-2']){app.api.getWorld().focus(id);assert.ok(app.document.querySelector('#card-name').textContent.endsWith(' · 2'));app.document.querySelector('#card-close').onclick();}
 await app.api.run();assert.equal(app.document.querySelector('#loading').hidden,true);for(const id of s.nodes.map(n=>n.id))assert.ok(seen.has(id),id+' has an independent processing event');assert.equal(app.document.querySelectorAll('#test-results .fail').length,1,'a freely built incorrect circuit still receives real numerical validation');
});

test('all projection outputs get equal travel time and only the speed slider changes their pace',async()=>{
 let app,runIndex=0;const runs=[new Map(),new Map()],departures=[[],[]];
 app=await boot({reduced:false,frameMs:20,onFrame:({document,now})=>{
  const proc=document.querySelector('.processing-packet[data-node="project"][data-row="2"]');
  if(!app)return;
  const wire=document.querySelector('.packet[data-motion="wire"][data-from="project"][data-row="2"]');
  if(wire&&!wire.hidden)departures[runIndex].push(now);
  if(!proc||proc.hidden)return;
  app.scenes.at(-1).traverse(o=>{if(!o.visible||!o.userData.contribution)return;const d=o.userData;
   if(!runs[runIndex].has(d.output))runs[runIndex].set(d.output,[]);runs[runIndex].get(d.output).push(now);
  });
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();
 for(const rate of [.25,.5]){
  const slider=app.document.querySelector('#playback-speed');slider.value=String(rate);slider.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  await app.api.run();const spans=runs[runIndex];assert.equal(spans.size,4);
  const widths=[...spans.values()].map(times=>Math.max(...times)-Math.min(...times));
  assert.ok(Math.max(...widths)-Math.min(...widths)<=20,'no later output is compressed into a short flash');
  for(let j=1;j<4;j++)assert.ok(Math.max(...spans.get(j-1))<Math.min(...spans.get(j)),'outputs are shown one at a time');
  assert.ok(Math.min(...departures[runIndex])>Math.max(...spans.get(3)),'the outgoing vector waits for the last output');
  assert.equal(app.document.querySelectorAll('#test-results .pass').length,3);runIndex++;
 }
 for(let j=0;j<4;j++){const width=i=>Math.max(...runs[i].get(j))-Math.min(...runs[i].get(j));assert.ok(Math.abs(width(0)-2*width(1))<=40,'the speed slider scales every output equally');}
});
