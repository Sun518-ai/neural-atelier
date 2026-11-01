const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={console,navigator:{languages:['zh-CN']}};ctx.window=ctx;vm.createContext(ctx);for(const f of ['locales/en.js','i18n.js','music.js','shell.js','model.js','campaign.js','engine-model.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),ctx,{filename:f});
const M=ctx.NeuralPrologue;
const close=(a,b,tol=1e-9)=>a.length===b.length&&a.every((x,i)=>Number.isFinite(x)&&Math.abs(x-b[i])<=tol);
test('random arrangements fit the table, keep modules apart, and do not change the circuit',()=>{
 const rng=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(const id of Object.keys(M.levels)){
  const s=M.solutions(id),links=JSON.stringify(s.nodes.map(n=>n.links)),a=JSON.stringify(M.arrange(s,rng(2)).nodes.map(n=>[n.x,n.z]));
  M.arrange(s,rng(71));if(s.nodes.length)assert.notEqual(JSON.stringify(s.nodes.map(n=>[n.x,n.z])),a);
  assert.equal(JSON.stringify(s.nodes.map(n=>n.links)),links);const b=M.bounds(M.levels[id]);
  for(const n of s.nodes){assert.ok(n.x>=b.left&&n.x<=b.right&&n.z>=b.back&&n.z<=b.front);for(const m of s.nodes)if(n!==m)assert.ok(Math.abs(n.x-m.x)>=2.65||Math.abs(n.z-m.z)>=2.9,id+' overlaps');}
 }
});
test('disconnect removes one selected branch and reconnect restores the computation',()=>{
 const s=M.solutions('gating');assert.ok(M.disconnect(s,'multiply',0));assert.deepEqual(Array.from(s.nodes.find(n=>n.id==='multiply').links),[null,'up']);assert.equal(s.sink,'multiply');assert.equal(M.disconnect(s,'multiply',0),false);
 assert.equal(M.connect(s,'silu','multiply',0),null);assert.ok(close(M.evaluate(s,[1,1]).output,M.reference([1,1],'gating')));
 assert.ok(M.disconnect(s,'sink',0));assert.equal(s.sink,null);assert.equal(s.nodes.find(n=>n.id==='multiply').links[0],'silu');
});
test('construction levels can be built from the shelf, reject invalid placement, and remove dependent wires',()=>{
 for(const id of ['workshop','ffn','attention','block']){
  const s=M.initial(id),solution=M.solutions(id);assert.equal(s.nodes.length,0);assert.equal(s.sink,null);
  const first=solution.nodes[0];assert.equal(M.addNode(s,first.id,999,0),false);assert.equal(M.addNode(s,'unknown',0,0),false);
  for(const n of solution.nodes)assert.equal(M.addNode(s,n.id,n.x,n.z),true);assert.equal(M.addNode(s,first.id,first.x,first.z),false);
  for(const n of solution.nodes)for(const [port,from]of n.links.entries())assert.equal(M.connect(s,from,n.id,port),null);
  assert.equal(M.connect(s,solution.sink,'sink',0),null);const input=M.samplesFor(id)[0].v;assert.ok(close(M.evaluate(s,input).output,M.reference(input,id)));
  assert.ok(M.removeNode(s,solution.sink));assert.equal(s.sink,null);assert.ok(s.nodes.every(n=>!n.links.includes(solution.sink)));
  const removed=solution.nodes.find(n=>n.id===solution.sink);if(s.nodes.length)assert.equal(M.addNode(s,removed.id,s.nodes[0].x,s.nodes[0].z),false,'overlap must be rejected');assert.equal(M.addNode(s,removed.id,removed.x,removed.z),true);
 }
});
for(const id of Object.keys(M.levels))test(id+' reference circuit matches three / five inputs',()=>{
 const s=M.solutions(id);if(M.levels[id].engine)s.settings.precision=16;
 for(const t of M.samplesFor(id).slice(0,M.levels[id].sampleCount)){const e=M.evaluate(s,t.v);assert.equal(e.error,null);assert.ok(close(e.output,M.reference(t.v,id)),id+': '+e.output+' ≠ '+M.reference(t.v,id));}
});
test('main and bonus tracks are separate, complete and have no dangling links',()=>{const visited=[];for(const [track,route]of Object.entries(M.routes)){let id=route.ids[0],ids=[];while(id){assert.ok(!visited.includes(id));assert.equal(M.levels[id].track,track);visited.push(id);ids.push(id);id=M.levels[id].next;}assert.deepEqual(ids,Array.from(route.ids));}assert.equal(visited.length,Object.keys(M.levels).length);assert.equal(M.levels.autoregressive.next,null);assert.equal(M.routes.main.ids.length,17);assert.equal(M.routes.engine.ids.length,9);for(const id of visited){const s=M.initial(id),allowed=new Set([...s.nodes.map(n=>n.id),...M.levels[id].sources]);for(const n of s.nodes)for(const link of n.links)assert.ok(link===null||allowed.has(link));}});
test('causal attention cannot read future V',()=>{const s=M.solutions('attention'),a=M.evaluate(s,[1,0,0,1,1,1]),b=M.evaluate(s,[1,0,0,1,-8,3]);assert.ok(close(a.output.slice(0,4),b.output.slice(0,4)));const weights=a.values.softmax;for(let i=0;i<3;i++){assert.ok(Math.abs(weights.slice(i*3,i*3+3).reduce((a,b)=>a+b,0)-1)<1e-12);for(let j=i+1;j<3;j++)assert.equal(weights[i*3+j],0);}});
test('RoPE preserves each vector norm and position zero',()=>{const x=[2,3,4,5,-1,2],r=M.math.rotate(x);assert.deepEqual(Array.from(r.slice(0,2)),[2,3]);for(let i=0;i<3;i++)assert.ok(Math.abs(r[2*i]**2+r[2*i+1]**2-x[2*i]**2-x[2*i+1]**2)<1e-12);});
test('same dimensions but wrong activation branch fails',()=>{const s=M.solutions('gating');s.nodes.find(n=>n.id==='silu').links=['up'];s.nodes.find(n=>n.id==='multiply').links=['silu','gate'];assert.ok(M.samples.some(t=>!close(M.evaluate(s,t.v).output,M.reference(t.v,'gating'))));});
test('wrong features produce computed words, not canned failure text',()=>{const initial=M.evaluate(M.initial('vocabulary'),M.samplesFor('vocabulary')[0].v);assert.equal(M.readTokens(initial.output),'你恨狗');const correct=M.evaluate(M.solutions('vocabulary'),M.samplesFor('vocabulary')[0].v);assert.equal(M.readTokens(correct.output),'我爱猫');});
test('autoregression appends only the last position prediction',()=>{const s=M.solutions('autoregressive');let input=[0,1,2];input=M.evaluate(s,input).output;assert.deepEqual(Array.from(input),[1,2,0]);input=M.evaluate(s,input).output;assert.deepEqual(Array.from(input),[2,0,1]);});
test('cycle fails; disconnected branch still runs for visible animation',()=>{const s=M.solutions('attention');s.nodes.find(n=>n.id==='ropeq').links=['ropeq'];assert.ok(M.evaluate(s,M.samplesFor('attention')[0].v).error);const p=M.solutions('projection');p.sink=null;const e=M.evaluate(p,[1,1]);assert.ok(e.error);assert.ok(close(e.values.project,[1,1,1.5,-.5]));});
test('quantization changes actual numbers; cache and batches do not',()=>{const s=M.solutions('quantization'),x=M.samplesFor('quantization')[0].v;s.settings.precision=16;const a=M.evaluate(s,x).output;s.settings.precision=2;const b=M.evaluate(s,x).output;assert.ok(!close(a,b));s.settings.precision=16;s.settings.cache=false;s.settings.batch=1;assert.ok(close(M.evaluate(s,x).output,a));});
// Only vary controls exposed to players, plus dragging tasks to supported devices.
for(const id of Object.keys(M.levels).filter(id=>M.levels[id].engine))test(id+' is solvable using only visible controls',()=>{
 const level=M.levels[id],initial=M.initial(id);assert.equal(M.engineReport(initial).pass,false,id+' unexpectedly starts solved');
 let found=null;
 const proposals=[{}, {batch:16,layout:'channels',cache:true,precision:4,fusion:true,resident:true,split:40,prefix:true,context:4096}, {batch:32,layout:'channels',cache:true,precision:4,fusion:true,resident:true,split:60,prefix:true,context:4096}];
 for(const proposal of proposals)for(const device of ['gpu','ane']){
  const s=M.solutions(id);for(const key of level.controls)if(key in proposal)s.settings[key]=proposal[key];
  for(const n of s.nodes)n.device=['enqkv','enffn'].includes(n.id)?device:['load','enembed','enhead'].includes(n.id)?'cpu':'gpu';
  const report=M.engineReport(s);if(report.pass){for(const t of M.samplesFor(id)){const ev=M.evaluate(s,t.v);assert.equal(ev.error,null);assert.ok(close(ev.output,M.reference(t.v,id),level.limits.error||.06));}found={settings:s.settings,devices:s.nodes.map(n=>[n.id,n.device]),metrics:report.runs.map(r=>r.metrics)};break;}
 }
 assert.ok(found,id+' has no player-accessible solution');
});
test('correct circuit can fail performance without changing generated result',()=>{const s=M.solutions('kv-cache');const x=M.samplesFor(s.levelId)[0].v,a=M.evaluate(s,x).output;assert.ok(close(a,M.reference(x,s.levelId),.06));assert.equal(M.engineReport(s).pass,false);s.settings.cache=true;assert.ok(close(a,M.evaluate(s,x).output));assert.equal(M.engineReport(s).pass,true);});
test('ANE incompatible layout and unsupported ops fail compilation',()=>{const s=M.solutions('layout');assert.ok(M.engineReport(s).errors.some(e=>e.includes('布局')));s.settings.layout='channels';s.nodes.find(n=>n.id==='enattn').device='ane';assert.ok(M.engineReport(s).errors.some(e=>e.includes('支持集合')));});
test('KV cache reuses three rows instead of six and preserves Attention output',()=>{const x=M.samplesFor('attention')[0].v,a=M.cachedAttention(x,true),b=M.cachedAttention(x,false);assert.equal(a.processed,3);assert.equal(b.processed,6);assert.ok(close(a.output,b.output));assert.ok(close(a.output,M.math.attention(x)));});
test('more reserved KV capacity consumes memory even when prompt is unchanged',()=>{const s=M.solutions('quantization');s.settings.context=2048;const a=M.engineReport(s).metrics.memory;s.settings.context=8192;assert.ok(M.engineReport(s).metrics.memory>a);});

test('multiple projection and residual instances have independent edges, values and removable stock',()=>{
 const s=M.initial('ffn'),kinds=['project','down','project','down','add','add'],coords=[[-4.7,-2],[-1.4,-2],[1.9,-2],[5.2,-2],[-4.7,2],[-1.4,2]];
 kinds.forEach((kind,i)=>assert.equal(M.addNode(s,kind,...coords[i]),true));
 assert.deepEqual(Array.from(s.nodes,n=>n.id),['project','down','project-2','down-2','add','add-2']);
 const edges=[['R','project',0],['project','down',0],['down','project-2',0],['project-2','down-2',0],['down','add',0],['down-2','add',1],['add','add-2',0],['R','add-2',1],['add-2','sink',0]];
 for(const edge of edges)assert.equal(M.connect(s,...edge),null);
 const ev=M.evaluate(s,[1,0]);assert.equal(ev.error,null);assert.ok(close(ev.values.down,[.55,.35]));assert.ok(close(ev.values['down-2'],[.3725,.2275]));assert.ok(close(ev.output,[1.9225,.5775]));assert.notDeepEqual(ev.values.project,ev.values['project-2']);
 assert.equal(M.addNode(s,'project',1.9,2),false,'per-kind stock is enforced');
 assert.equal(M.removeNode(s,'down-2'),true);assert.deepEqual(Array.from(s.nodes.find(n=>n.id==='add').links),['down',null]);assert.deepEqual(Array.from(s.nodes.find(n=>n.id==='down').links),['project']);assert.equal(M.stock(s,'down'),1);assert.equal(M.addNode(s,'down',5.2,-2),true);
});
test('construction limits count current instances and fixed lessons cannot create modules',()=>{
 for(const id of ['wire','projection','activation','gating','residual'])assert.equal(M.canAdd(M.initial(id),'project'),false);
 const tutorial=M.initial('workshop');assert.equal(M.addNode(tutorial,'project',0,0),true);assert.equal(M.canAdd(tutorial,'project'),false);assert.equal(M.removeNode(tutorial,'project'),true);assert.equal(M.canAdd(tutorial,'project'),true);
 const s=M.initial('ffn'),kinds=['project','project','down','down','add','add','gate','up'];
 kinds.forEach((kind,i)=>assert.equal(M.addNode(s,kind,[-4.7,-1.4,1.9,5.2][i%4],i<4?-2:2),true));
 assert.equal(s.nodes.length,M.moduleLimit(M.levels.ffn));assert.equal(M.stock(s,'silu'),2);assert.equal(M.canAdd(s,'silu'),false,'free stock cannot exceed the table limit');
 M.removeNode(s,'up');assert.equal(M.canAdd(s,'silu'),true);
});
test('an alternate attention instance uses its own operator and its connected attention map',()=>{
 const s=M.solutions('attention'),original=s.nodes.find(n=>n.id==='softmax');original.id='softmax-2';original.kind='softmax';s.nodes.find(n=>n.id==='aggregate').links[0]='softmax-2';
 const ev=M.evaluate(s,M.samplesFor('attention')[0].v);assert.equal(ev.error,null);assert.ok(close(ev.output,M.reference(M.samplesFor('attention')[0].v,'attention')));assert.equal(M.valueForKind(s,ev,'softmax'),ev.values['softmax-2']);
});
