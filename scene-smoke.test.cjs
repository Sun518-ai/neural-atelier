const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
async function boot({reduced=true,frameMs=1000,onFrame=()=>{},languages=['zh-CN']}={}){
 const Three=await import('./vendor/three.module.js');
 const {document,window}=parseHTML(fs.readFileSync(__dirname+'/index.html','utf8'));const native=document.createElement.bind(document);
 document.createElement=function(name){const el=native(name);if(name==='canvas')el.getContext=()=>({fillRect(){},fillText(){},measureText(t){return {width:String(t).length*60}}});return el;};
 for(const el of document.querySelectorAll('dialog')){el.showModal=function(){this.open=true};el.close=function(){this.open=false};}
 for(const el of document.querySelectorAll('*')){Object.defineProperty(el,'clientWidth',{get:()=>el.id==='scene'?1400:100});Object.defineProperty(el,'clientHeight',{get:()=>el.id==='scene'?760:60});el.focus=()=>{};el.scrollIntoView=()=>{};}
 let view,renderedCamera;const scenes=[];class Renderer{constructor(){this.domElement=native('canvas');this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};}setPixelRatio(){}setClearColor(){}setSize(){}render(scene,camera){renderedCamera=camera;view={position:camera.position.toArray(),width:camera.right-camera.left};scenes.push(scene);scene.updateMatrixWorld();camera.updateMatrixWorld();scene.traverse(o=>{if(o.isMesh)assert.ok(o.matrixWorld.elements.every(Number.isFinite),'nonfinite transform '+o.type);});}}
 const storage=new Map();let now=0;const c={document,console,navigator:{languages},T:{...Three,WebGLRenderer:Renderer},devicePixelRatio:2,ResizeObserver:class{observe(){}},requestAnimationFrame:cb=>setImmediate(()=>{now+=frameMs;onFrame({now,document,window});cb(now);}),cancelAnimationFrame:clearImmediate,performance:{now:()=>now},matchMedia:()=>({matches:reduced}),setTimeout,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};c.window=c;vm.createContext(c);
 for(const f of ['locales/en.js','i18n.js','music.js','shell.js','model.js','campaign.js','engine-model.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),c,{filename:f});
 for(const f of ['module-cards.js','level-progress.js','scene-art.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8').replaceAll('export ',''),c,{filename:f});
 let src=fs.readFileSync(__dirname+'/game.js','utf8').replace(/^import .*\n/gm,'').replace("const T=await import('./vendor/three.module.js');",'const T=window.T;').replace(/const \{createSceneArt\}=await import\('\.\/scene-art\.js\?v=[^']+'\);/,'');
 src+='\nwindow.testAPI={switchLevel,run,togglePause,refresh,select,assignDevice,chooseOutput,chooseInput,chooseModule,placeModule,getState:()=>state,setState:s=>state=s,getWorld:()=>world,getFault:()=>fault};';
 await vm.runInContext('(async()=>{'+src+'})()',c);
 assert.ok(c.testAPI.getWorld(),'3D boot failed');return {c,document,window,api:c.testAPI,scenes,time:()=>now,view:()=>view,camera:()=>renderedCamera};
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
test('port badges fade around moving and fanned-out features, then recover as vectors leave',async()=>{
 let app;const seen=new Set();
 const opacity=el=>Number(el.style.opacity||1);
 app=await boot({reduced:false,frameMs:100,onFrame:()=>{
  if(!app)return;
  const input=app.document.querySelector('[data-input="project:0"]'),output=app.document.querySelector('[data-output="project"]'),sink=app.document.querySelector('[data-input="sink:0"]');
  if(!input)return;
  if(opacity(input)<.12){seen.add('input');if(opacity(sink)===1)seen.add('distant stays opaque');}
  if(opacity(output)<.12)seen.add('output');
  if(opacity(input)>.12&&opacity(input)<.95)seen.add('gradual fade');
  const projecting=app.scenes.at(-1).children.find(o=>o.visible&&o.userData.processing==='project'&&o.userData.routing);
  if(projecting&&projecting.children.some(o=>o.visible&&o.userData.featureValue!=null)&&opacity(input)<.12)seen.add('fanned features');
  if(seen.has('input')&&opacity(input)===1&&app.document.querySelector('.packet:not([hidden])'))seen.add('departed');
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 for(const mark of ['input','output','distant stays opaque','gradual fade','fanned features','departed'])assert.ok(seen.has(mark),mark);
 assert.ok([...app.document.querySelectorAll('.port')].every(el=>opacity(el)===1));
 assert.equal(app.document.querySelector('#level-complete').open,true);
});

test('paused port fading follows the camera and stopping restores every badge',async()=>{
 let app,phase=0,frames=0,before,stop;
 app=await boot({reduced:false,frameMs:100,onFrame:()=>{
  if(!app)return;const port=app.document.querySelector('[data-input="project:0"]');if(!port)return;
  if(!phase&&Number(port.style.opacity||1)<.12){app.api.togglePause();before=port.style.opacity;phase=1;}
  else if(phase===1&&++frames===3){
   assert.equal(port.style.opacity,before,'pause freezes the vector and its fading');
   const scene=app.document.querySelector('#scene'),event=(target,type,props)=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,props);target.dispatchEvent(e);};
   const view=app.view();event(scene,'pointerdown',{clientX:600,clientY:300});event(app.document,'pointermove',{clientX:800,clientY:350});event(app.document,'pointerup',{});
   assert.notDeepEqual(app.view().position,view.position);
   assert.ok([...app.document.querySelectorAll('.port')].every(el=>Number.isFinite(Number(el.style.opacity||1))));
   stop=app.api.run();phase=2;
  }
 }});
 app.document.querySelector('#welcome').close();app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();await stop;
 assert.equal(phase,2);assert.ok([...app.document.querySelectorAll('.port')].every(el=>Number(el.style.opacity||1)===1));assert.ok(!app.document.querySelector('#level-complete').open);
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
test('all matrix labels switch abstraction together and a close-up preserves the board mode',async()=>{
 const app=await boot();app.api.switchLevel('residual');app.api.setState(app.c.NeuralPrologue.solutions('residual'));app.api.getWorld().rebuild();
 const faces=[];app.scenes.at(-1).traverse(o=>{if(o.userData.detailText)faces.push(o);});
 assert.ok(new Set(faces.map(o=>o.userData.detailText.fontFraction)).size>1,'short numbers and decimals have different fitted sizes');
 const wheel=deltaY=>{const e=new app.window.Event('wheel',{bubbles:true,cancelable:true});e.deltaY=deltaY;app.document.querySelector('#scene').dispatchEvent(e);};
 const uniform=()=>{assert.equal(new Set(faces.map(o=>o.visible)).size,1,'no partly abstracted matrix or neighboring module');return faces[0].visible;};
 assert.equal(uniform(),true,'normal-size modules keep every number, including decimals');
 wheel(-2000);assert.equal(uniform(),true);
 let steps=0;while(uniform()&&steps++<50)wheel(25);
 assert.equal(uniform(),false,'a small module footprint abstracts every matrix');
 // Return slightly across the entry threshold: hysteresis keeps the board
 // abstract, and opening a detailed card must not reset that decision.
 wheel(-25);assert.equal(uniform(),false);
 app.api.getWorld().focus('project');await new Promise(setImmediate);
 assert.ok(faces.filter(o=>o.parent.userData.node==='project').every(o=>o.visible));
 app.document.querySelector('#card-close').onclick();assert.equal(uniform(),false);
 while(!uniform()&&steps-- >0)wheel(-25);
 assert.equal(uniform(),true,'all numbers return together when readable');
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

test('elementwise multiplication pairs both real inputs and keeps each product until the output vector gathers',async()=>{
 let app;const products=new Map(),trails=new Map(),counts=new Set(),cases=new Set();let gathering=0;
 app=await boot({reduced:false,frameMs:40,onFrame:({document})=>{
  if(!app)return;const label=document.querySelector('.processing-packet[data-node="multiply"]');if(!label||label.hidden)return;
  const sample=Number.parseInt(document.querySelector('#pass-count').textContent),M=app.c.NeuralPrologue,ev=M.evaluate(app.api.getState(),M.samples[sample].v);
  const scene=app.scenes.at(-1),unit=scene.children.flatMap(o=>o.children).find(o=>o.userData.node==='multiply'),meshes=[scene.children.find(o=>o.userData.processing==='multiply'),scene.children.find(o=>o.userData.processingSecondary==='multiply')];
  const inputs=[ev.values.silu,ev.values.up],calc=document.querySelector('.projection-calculation[data-node="multiply"]'),out=scene.children.find(o=>o.userData.processingOutput==='multiply');
  for(const [slot,mesh]of meshes.entries()){
   if(!mesh.visible)continue;
   for(const {bar}of mesh.userData.featureRoutes){
    const i=bar.userData.feature;assert.equal(bar.userData.value,inputs[slot][i],'each colored input carries the value from its own wire');
    if(bar.material.opacity<=0)continue;
    const pos=bar.getWorldPosition(new app.c.T.Vector3()),key=sample+':'+slot+':'+i;
    if(!trails.has(key))trails.set(key,[]);trails.get(key).push(pos);
    if(bar.userData.mappingProgress===1){
     assert.ok(Math.abs(pos.z-(unit.position.z+(i-1.5)*.43))<1e-9,'same-index inputs share one channel');
     assert.equal(bar.userData.mappedInput,i);
     const partner=meshes[1-slot].userData.featureRoutes[i].bar;
     assert.notEqual(bar.material.color.getHex(),partner.material.color.getHex(),'the two inputs retain distinct colors');
     if(bar.userData.pairProgress>.99)assert.ok(pos.distanceTo(partner.getWorldPosition(new app.c.T.Vector3()))<.015,'the two factors meet at the same multiplication ring');
    }
   }
  }
  unit.traverse(o=>{
   if(o.userData.multiplyFeature==null||!o.visible)return;const d=o.userData,i=d.multiplyFeature;
   assert.equal(d.inputA,inputs[0][i]);assert.equal(d.inputB,inputs[1][i]);assert.equal(d.value,d.inputA*d.inputB);
   products.set(sample+':'+i,d.value);
   if(d.value===0){cases.add('zero');assert.ok(o.material.wireframe);assert.ok(o.scale.x>=.6,'a zero still has a visible hollow carrier');}
   if(d.value<0)cases.add('negative');if(d.inputA<0&&d.inputB<0){cases.add('negative times negative');assert.ok(d.value>0);}
   if(Math.abs(d.inputA)>1||Math.abs(d.inputB)>1)cases.add('not binary');
  });
  if(!calc.hidden){
   const i=Number(calc.dataset.column),fmt=v=>Number(v.toFixed(2)).toString(),factor=v=>v<0?'('+fmt(v)+')':fmt(v),values=[inputs[0][i],inputs[1][i],ev.values.multiply[i]];
   const rounded=values.some(v=>Math.abs(v-Number(v.toFixed(2)))>1e-9);
   assert.equal(calc.querySelector('.projection-equation').textContent,factor(values[0])+' × '+factor(values[1])+(rounded?' ≈ ':' = ')+fmt(values[2]));
   assert.equal(calc.querySelector('.projection-sum-symbol').textContent,'×');
   assert.equal(document.querySelectorAll('.projection-result[data-node="multiply"]:not([hidden])').length,i,'only already-computed products remain visible');
   if(Number(calc.style.getPropertyValue('--calculation-focus'))>.9){
    assert.equal(unit.userData.activePair,i);
    const sockets=unit.children.filter(o=>o.geometry?.type==='SphereGeometry'&&o.position.x===.68&&o.userData.multiplyFeature==null);
    assert.ok(sockets[i].material.emissiveIntensity>.8);assert.ok(sockets.filter((_,j)=>i!==j).every(o=>o.material.emissiveIntensity<.1));
    for(const selector of ['[data-input="multiply:0"]','[data-input="multiply:1"]','[data-output="multiply"]'])assert.ok(Number(document.querySelector(selector).style.opacity)<.12,'dimension badges do not cover the calculation');
   }
  }
  if(out.visible){
   const bars=out.children.filter(o=>o.visible&&o.userData.feature!=null);counts.add(bars.length);
   if(out.userData.gather>0){gathering++;assert.equal(bars.length,4,'wait for all products before transporting the vector');}
   for(const bar of bars){const i=bar.userData.feature;assert.equal(bar.userData.value,ev.values.multiply[i]);if(out.userData.gather===0)assert.ok(Math.abs(bar.getWorldPosition(new app.c.T.Vector3()).z-(unit.position.z+(i-1.5)*.43))<1e-9);}
  }
 }});
 app.api.switchLevel('gating');app.api.setState(app.c.NeuralPrologue.solutions('gating'));app.api.getWorld().rebuild();await app.api.run();
 assert.equal(products.size,20);for(const kind of ['zero','negative','negative times negative','not binary'])assert.ok(cases.has(kind),kind);
 assert.deepEqual([...counts].filter(Boolean).sort(),[1,2,3,4]);assert.ok(gathering>0);
 for(const trail of trails.values())assert.ok(trail.every((p,i)=>!i||p.distanceTo(trail[i-1])<.3),'factor carriers never teleport between sockets');
 assert.equal(app.document.querySelectorAll('#test-results .pass').length,5);
 assert.equal(app.document.querySelectorAll('.packet,.projection-calculation,.projection-result').length,0);
 app.scenes.at(-1).traverse(o=>{if(o.userData.multiplyFeature!=null)assert.equal(o.visible,false);if(o.userData.node==='multiply')assert.equal(o.userData.activePair,null);assert.equal(o.userData.processingSecondary,undefined,'the extra input tray is removed at completion');});
});

test('every elementwise pair uses the same pace and obeys the speed slider',async()=>{
 let app,runIndex=0;const runs=[new Map(),new Map()],departures=[[],[]];
 app=await boot({reduced:false,frameMs:20,onFrame:({document,now})=>{
  if(!app)return;const label=document.querySelector('.processing-packet[data-node="multiply"][data-row="2"]'),wire=document.querySelector('.packet[data-motion="wire"][data-from="multiply"][data-row="2"]');
  if(wire&&!wire.hidden)departures[runIndex].push(now);
  if(!label||label.hidden)return;
  app.scenes.at(-1).traverse(o=>{if(!o.visible||o.userData.multiplyFeature==null)return;const i=o.userData.multiplyFeature;if(!runs[runIndex].has(i))runs[runIndex].set(i,[]);runs[runIndex].get(i).push(now);});
 }});
 app.api.switchLevel('gating');app.api.setState(app.c.NeuralPrologue.solutions('gating'));app.api.getWorld().rebuild();
 for(const rate of [.25,.5]){
  const slider=app.document.querySelector('#playback-speed');slider.value=String(rate);slider.dispatchEvent(new app.window.Event('input',{bubbles:true}));await app.api.run();
  const spans=runs[runIndex];assert.equal(spans.size,4);const widths=[...spans.values()].map(a=>a.at(-1)-a[0]);assert.ok(Math.max(...widths)-Math.min(...widths)<=20);
  for(let i=1;i<4;i++)assert.ok(spans.get(i-1).at(-1)<spans.get(i)[0]);
  assert.ok(departures[runIndex][0]>spans.get(3).at(-1));runIndex++;
 }
 for(let i=0;i<4;i++){const width=r=>runs[r].get(i).at(-1)-runs[r].get(i)[0];assert.ok(Math.abs(width(0)-2*width(1))<=40);}
});

test('paused multiplication keeps both inputs, products and formulas stable across camera and language changes',async()=>{
 let app,phase=0,frames=0,snapshot,restart;
 const visual=()=>{const data=[];app.scenes.at(-1).traverse(o=>{if(o.userData.multiplyFeature!=null||o.userData.multiplyInput!=null)data.push([o.visible,o.position.toArray(),o.scale.toArray(),o.material.opacity,o.material.emissiveIntensity]);});return JSON.stringify(data);};
 const wheel=deltaY=>{const e=new app.window.Event('wheel',{bubbles:true,cancelable:true});e.deltaY=deltaY;app.document.querySelector('#scene').dispatchEvent(e);};
 app=await boot({reduced:false,frameMs:40,onFrame:({document})=>{
  if(!app)return;const calc=document.querySelector('.projection-calculation[data-node="multiply"]');if(!calc||calc.hidden)return;
  if(!phase&&calc.dataset.column==='1'&&Number(calc.querySelector('b').style.opacity)>.1){phase=1;app.api.togglePause();snapshot=visual();return;}
  if(phase!==1)return;assert.equal(visual(),snapshot);frames++;
  if(frames===2){const scale=Number(calc.style.getPropertyValue('--calculation-scale'));wheel(2000);assert.equal(calc.dataset.detail,'abstract');assert.ok(Number(calc.style.getPropertyValue('--calculation-scale'))<scale);assert.equal(calc.querySelector('.projection-sum-symbol').textContent,'×');}
  if(frames===3){wheel(-2000);assert.equal(calc.dataset.detail,'full');app.c.I18n.setPreference('en');assert.equal(visual(),snapshot,'language rebuild restores the same pair and product');}
  if(frames===5){
   const saved=JSON.stringify(app.api.getState());app.api.run();assert.equal(app.document.querySelectorAll('.packet,.projection-calculation,.projection-result').length,0);
   app.scenes.at(-1).traverse(o=>{if(o.userData.multiplyFeature!=null)assert.equal(o.visible,false);assert.equal(o.userData.processingSecondary,undefined);});
   assert.equal(JSON.stringify(app.api.getState()),saved);phase=2;restart=app.api.run();
  }
 }});
 app.api.switchLevel('gating');app.api.setState(app.c.NeuralPrologue.solutions('gating'));app.api.getWorld().rebuild();await app.api.run();await restart;
 assert.equal(phase,2);assert.equal(app.document.querySelectorAll('#test-results .pass').length,5);
});

test('duplicated multiplication modules animate their actual wiring even in an incorrect circuit',async()=>{
 let app;const seen=new Set();
 app=await boot({reduced:false,frameMs:80,onFrame:({document})=>{
  if(!app)return;
  for(const id of ['multiply','multiply-2']){
   const label=document.querySelector(`.processing-packet[data-node="${id}"]`);if(!label||label.hidden)continue;
   const M=app.c.NeuralPrologue,state=app.api.getState(),node=state.nodes.find(n=>n.id===id),ev=M.evaluate(state,M.samples[0].v),calc=document.querySelector(`.projection-calculation[data-node="${id}"]`);
   assert.ok(calc,'each operator instance has its own two-factor equation');
   app.scenes.at(-1).children.flatMap(o=>o.children).find(o=>o.userData.node===id).traverse(o=>{if(o.userData.multiplyFeature==null||!o.visible)return;const i=o.userData.multiplyFeature;assert.equal(o.userData.inputA,ev.values[node.links[0]][i]);assert.equal(o.userData.inputB,ev.values[node.links[1]][i]);assert.equal(o.userData.value,ev.values[id][i]);seen.add(id);});
  }
 }});
 app.api.switchLevel('ffn');const M=app.c.NeuralPrologue,s=M.initial('ffn');
 const coords=[[-4.7,-2],[-1.4,-2],[1.9,-2],[5.2,-2],[-4.7,2]];
 ['project','gate','multiply','multiply','down'].forEach((kind,i)=>assert.ok(M.addNode(s,kind,...coords[i])));
 for(const edge of [['R','project',0],['R','gate',0],['gate','multiply',0],['project','multiply',1],['multiply','multiply-2',0],['gate','multiply-2',1],['multiply-2','down',0],['down','sink',0]])assert.equal(M.connect(s,...edge),null);
 app.api.setState(s);app.api.getWorld().rebuild();await app.api.run();assert.deepEqual([...seen],['multiply','multiply-2']);assert.equal(app.document.querySelectorAll('#test-results .fail').length,1);
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
  if(calc&&!calc.hidden){const column=Number(calc.dataset.column);assert.equal(calc.querySelector('.projection-equation').textContent,['1 × 0.4 + 0 × 0 + 1 × 0.2 + 0.5 × (-0.1) = 0.55','1 × 0 + 0 × 0.3 + 1 × 0.2 + 0.5 × 0.3 = 0.35'][column]);formulas.add(column);}
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

test('projection keeps computed values by their own output spheres before gathering, with zoomable formulas',async()=>{
 let app,zoomChecked=false,zoomPhase=0;const columns=new Map(),counts=new Set(),trails=new Map();let gathered=0;
 const wheel=deltaY=>{const e=new app.window.Event('wheel',{bubbles:true,cancelable:true});e.deltaY=deltaY;app.document.querySelector('#scene').dispatchEvent(e);};
 app=await boot({reduced:false,frameMs:40,onFrame:({document})=>{
  if(!app)return;
  const calc=document.querySelector('.projection-calculation[data-node="project"]'),out=app.scenes.at(-1).children.find(o=>o.userData.processingOutput==='project');
  if(!calc||!out)return;
  const unit=app.api.getState().nodes.find(n=>n.id==='project'),labels=[...document.querySelectorAll('.projection-result[data-node="project"]')];
  if(!calc.hidden&&out.userData.row==='0'){
   const column=Number(calc.dataset.column);columns.set(column,parseFloat(calc.style.top));
   assert.equal(labels.filter(el=>!el.hidden).length,column,'previous results persist; future results are not revealed');
   assert.ok(Number(document.querySelector('[data-output="project"]').style.opacity)<.12,'the output dimension badge stays transparent while computing');
   if(column===2&&!zoomChecked){
    zoomChecked=true;zoomPhase=1;app.api.togglePause();const scale=Number(calc.style.getPropertyValue('--calculation-scale'));
    wheel(2000);assert.equal(calc.dataset.detail,'abstract');assert.ok(Number(calc.style.getPropertyValue('--calculation-scale'))<scale);
    assert.ok(labels.every(el=>el.style.visibility==='hidden'),'abstract view retains the 3D result blocks instead of tiny digits');
   }else if(zoomPhase===1){
    zoomPhase=2;wheel(-2000);assert.equal(calc.dataset.detail,'full');assert.ok(Number(calc.style.getPropertyValue('--calculation-scale'))>1);app.api.togglePause();
   }
  }
  if(!out.visible)return;
  const bars=out.children.filter(o=>o.userData.feature!=null),visible=bars.filter(o=>o.visible),gather=out.userData.gather;
  counts.add(visible.length);
  if(gather>0){gathered++;assert.equal(visible.length,4,'gather starts only after all four results exist');}
  for(const bar of visible){
   const j=bar.userData.feature,pos=bar.getWorldPosition(new app.c.T.Vector3()),key=out.userData.row+':'+j;
   if(!trails.has(key))trails.set(key,[]);trails.get(key).push(pos);
   if(gather===0){assert.ok(Math.abs(pos.x-(unit.x+.98))<1e-9);assert.ok(Math.abs(pos.z-(unit.z+(j-1.5)*.4))<1e-9,'computed value stays at its corresponding sphere');}
   if(out.userData.row==='0')assert.equal(labels[j].textContent,String([1,0,1,.5][j]));
  }
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 assert.equal(columns.size,4);assert.equal(new Set(columns.values()).size,4,'the equation follows each sphere, not a fixed panel below');
 assert.deepEqual([...counts].sort(),[1,2,3,4]);assert.ok(gathered>0);assert.equal(zoomPhase,2);
 for(const trail of trails.values())assert.ok(trail.every((v,i)=>!i||v.distanceTo(trail[i-1])<.3),'registered results move continuously into the outgoing vector');
 assert.equal(app.document.querySelectorAll('.projection-result,.projection-calculation,.packet').length,0);
 assert.equal(Number(app.document.querySelector('[data-output="project"]').style.opacity||1),1);
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
  assert.equal(document.querySelector('#pause').disabled,true);assert.equal(document.querySelectorAll('.packet,.projection-calculation,.projection-result').length,0);
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

test('shelf cards inspect every available kind without placing a node, including exhausted stock',async()=>{
 const app=await boot({languages:['en-US']}),doc=app.document,M=app.c.NeuralPrologue;doc.querySelector('#welcome').close();
 const event=(target,type,properties={})=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);target.dispatchEvent(e);};
 for(const level of ['workshop','ffn','attention','block']){
  app.api.switchLevel(level);const saved=JSON.stringify(app.api.getState()),view=app.view();
  for(const kind of Object.keys(M.inventory(M.levels[level]))){
   const card=doc.querySelector(`[data-add-module="${kind}"]`);event(card,'click');event(card,'dblclick');await new Promise(setImmediate);
   assert.equal(doc.querySelector('#module-card').open,true,kind);assert.equal(doc.querySelector('#card-name').textContent,M.definitions[kind].name);
   assert.doesNotMatch(doc.querySelector('#module-card').textContent,/[\u3400-\u9fff]/,kind);
   assert.ok(app.scenes.at(-1).children.some(o=>o.userData.shelfPreview));assert.equal(JSON.stringify(app.api.getState()),saved);
   doc.querySelector('#camera-reset').onclick();await new Promise(setImmediate);doc.querySelector('#card-close').onclick();
   assert.equal(app.scenes.at(-1).children.some(o=>o.userData.shelfPreview),false);assert.deepEqual(app.view(),view);assert.equal(app.api.placeModule(0,0),false,'inspection leaves no placement gesture pending');
  }
 }
 app.api.switchLevel('workshop');app.api.setState(M.solutions('workshop'));app.api.getWorld().rebuild();app.api.refresh();
 const card=doc.querySelector('[data-add-module="project"]');assert.equal(card.dataset.addDisabled,'true');assert.equal(card.getAttribute('aria-disabled'),'false');
 const saved=JSON.stringify(app.api.getState());event(card,'dblclick');await new Promise(setImmediate);assert.equal(doc.querySelector('#module-card').open,true);doc.querySelector('#card-close').onclick();assert.equal(JSON.stringify(app.api.getState()),saved);
 await app.api.run();assert.equal(doc.querySelectorAll('#test-results .pass').length,3,'preview did not replace the real operator used for execution');
});

test('clicking a placed module offers deletion, preserves other wiring and remains compatible with double-click',async()=>{
 const app=await boot(),doc=app.document,M=app.c.NeuralPrologue;doc.querySelector('#welcome').close();app.api.switchLevel('ffn');app.api.setState(M.solutions('ffn'));app.api.getWorld().rebuild();app.api.refresh();
 const event=(target,type,properties={})=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);target.dispatchEvent(e);};
 doc.querySelector('#scene').getBoundingClientRect=()=>({left:0,top:0,width:1400,height:760,right:1400,bottom:760});
 const saved=JSON.stringify(app.api.getState());event(doc.querySelector('[data-node="down"]'),'click');assert.ok(doc.querySelector('[data-delete-node="down"]'));
 event(doc.querySelector('[data-close-node]'),'click');assert.equal(doc.querySelector('.node-actions'),null);assert.equal(JSON.stringify(app.api.getState()),saved);
 event(doc.querySelector('[data-node="down"]'),'click');event(doc.querySelector('[data-delete-node="down"]'),'click');
 assert.equal(app.api.getState().nodes.some(n=>n.id==='down'),false);assert.deepEqual(Array.from(app.api.getState().nodes.find(n=>n.id==='add').links),['R',null]);assert.equal(app.api.getState().nodes.find(n=>n.id==='multiply').links[1],'up');assert.equal(M.stock(app.api.getState(),'down'),2);
 doc.querySelector('#undo').onclick();assert.equal(JSON.stringify(app.api.getState()),saved);
 for(let i=0;i<2;i++){event(doc.querySelector('[data-node="down"]'),'pointerdown',{clientX:650,clientY:350});event(doc,'pointerup',{clientX:650,clientY:350});if(!i)assert.ok(doc.querySelector('.node-actions'));}
 await new Promise(setImmediate);assert.equal(doc.querySelector('#module-card').open,true);assert.equal(doc.querySelector('.node-actions'),null);doc.querySelector('#card-close').onclick();assert.equal(JSON.stringify(app.api.getState()),saved);
 app.api.switchLevel('projection');event(doc.querySelector('[data-node="project"]'),'click');assert.equal(doc.querySelector('.node-actions'),null,'fixed introductory modules remain fixed');
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

test('transport takes two-thirds of its former time while matrix processing keeps its slow duration',async()=>{
 let app;const spans=new Map();
 app=await boot({reduced:false,frameMs:20,onFrame:({document,now})=>{
  if(!app)return;
  for(const el of document.querySelectorAll('.packet:not([hidden])')){
   const key=[el.dataset.row,el.dataset.motion,el.dataset.from].join(':');
   if(!spans.has(key))spans.set(key,{start:now,end:now});spans.get(key).end=now;
  }
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 assert.equal(app.document.querySelector('#playback-speed').value,'0.25');
 for(const row of ['0','1','2']){
  for(const from of ['R','project']){const span=spans.get(row+':wire:'+from);assert.ok(span);assert.ok(Math.abs(span.end-span.start-650/.25/1.5)<40,'travel is faster for every input');}
  const process=spans.get(row+':process:project');assert.ok(Math.abs(process.end-process.start-2.2*650/.25)<40,'computation keeps its former duration');
 }
});

test('one whole weight column, its output sphere and its attached formula highlight together',async()=>{
 let app,pausedFrames=0,snapshot=null;const columns=new Set(),directions=new Set();
 const allUnits=()=>app.scenes.at(-1).children.flatMap(o=>o.children).filter(o=>o.userData.node==='project');
 app=await boot({reduced:false,frameMs:40,onFrame:({document})=>{
  if(!app)return;const calc=document.querySelector('.projection-calculation[data-node="project"]');if(!calc||calc.hidden||Number(calc.style.getPropertyValue('--calculation-focus'))<.9)return;
  const unit=allUnits()[0],col=Number(calc.dataset.column),cues=unit.children.filter(o=>o.userData.projectionColumn!=null),spheres=unit.children.filter(o=>o.geometry?.type==='SphereGeometry'&&o.position.x===.7);
  columns.add(col);assert.equal(unit.userData.activeColumn,col);assert.deepEqual(cues.filter(o=>o.visible).map(o=>o.userData.projectionColumn),[col]);
  const active=cues[col],faces=unit.children.filter(o=>o.userData.detailText&&Math.abs(o.position.x-active.position.x)<1e-9);
  assert.equal(faces.length,2,'both weights of the column participate, including zeros');
  assert.ok(faces.every(o=>o.material.color.getHex()!==0xffffff));
  assert.ok(unit.children.filter(o=>o.userData.detailText&&!faces.includes(o)).every(o=>o.material.color.getHex()===0xffffff));
  assert.ok(spheres[col].material.emissiveIntensity>.8);assert.ok(spheres.filter((_,i)=>i!==col).every(o=>o.material.emissiveIntensity<.1),'only the sphere being computed glows');
  assert.equal(calc.style.getPropertyValue('--calculation-color'),'#'+active.children[1].material.color.getHexString());
  const screen=spheres[col].getWorldPosition(new app.c.T.Vector3()).project(app.camera()),x=(screen.x+1)*700,y=(1-screen.y)*380,scale=Number(calc.style.getPropertyValue('--calculation-scale'));
  const radius=.115*spheres[col].scale.x*1400/app.view().width,side=calc.dataset.side;
  directions.add(side);assert.ok(Math.abs(parseFloat(calc.style.top)-y)<1e-7,'formula stays level with its sphere');
  assert.ok(Math.abs(Math.abs(parseFloat(calc.style.left)-x)-radius-9*scale)<1e-7,'the pointer reaches the sphere edge');
  if(col===1&&pausedFrames<3){
   if(!pausedFrames){app.api.togglePause();snapshot={col,opacity:active.children[0].material.opacity,scale};}
   assert.equal(col,snapshot.col);assert.equal(active.children[0].material.opacity,snapshot.opacity,'pause also freezes the highlight');
   const e=new app.window.Event('wheel',{bubbles:true,cancelable:true});e.deltaY=pausedFrames===0?-150:pausedFrames===1?300:0;document.querySelector('#scene').dispatchEvent(e);
   if(!pausedFrames)assert.ok(Number(calc.style.getPropertyValue('--calculation-scale'))>snapshot.scale,'formula grows with the board');
   if(pausedFrames===1)assert.ok(Number(calc.style.getPropertyValue('--calculation-scale'))<snapshot.scale,'formula shrinks with the board');
   if(++pausedFrames===3)app.api.togglePause();
  }
 }});
 app.api.switchLevel('projection');app.api.setState(app.c.NeuralPrologue.solutions('projection'));app.api.getWorld().rebuild();await app.api.run();
 assert.deepEqual([...columns].sort(),[0,1,2,3]);assert.equal(pausedFrames,3);assert.ok(directions.has('right'));
 for(const unit of allUnits()){assert.equal(unit.userData.activeColumn,null);assert.ok(unit.children.filter(o=>o.userData.projectionColumn!=null).every(o=>!o.visible));}
 assert.equal(app.document.querySelectorAll('.projection-calculation,.projection-result').length,0);
});
