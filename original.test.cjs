const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={console,navigator:{languages:['zh-CN']}};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['locales/en.js','i18n.js','model.js','campaign.js','engine-model.js','original-curriculum.js','cloud-curriculum.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),ctx,{filename:file});
const M=ctx.NeuralPrologue,O=M.original;
vm.runInContext(fs.readFileSync(__dirname+'/module-cards.js','utf8').replaceAll('export ',''),ctx,{filename:'module-cards.js'});
const plain=x=>JSON.parse(JSON.stringify(x));
const close=(a,b,tol=1e-9)=>a?.length===b.length&&a.every((x,i)=>Number.isFinite(x)&&Math.abs(x-b[i])<tol);
test('QKV accepts only V at the outlet and ignores optional Q/K branches',()=>{
 const state=M.initial('qkv');assert.ok(M.addNode(state,'v',0,0));assert.equal(M.connect(state,'R','v',0),null);assert.equal(M.connect(state,'v','sink',0),null);
 for(const sample of M.samplesFor('qkv')){const ev=M.evaluate(state,sample.v);assert.equal(ev.error,null);assert.ok(close(ev.output,M.reference(sample.v,'qkv')));assert.equal(ev.values.q,undefined);assert.equal(ev.values.k,undefined);}
 assert.ok(close(M.evaluate(state,[1,0,0,1,1,1]).output,[1,0,0,2,1,2]));
 const optional=M.solutions('qkv');optional.nodes.find(n=>n.id==='q').links=['k'];optional.nodes.find(n=>n.id==='k').links=['q'];
 for(const sample of M.samplesFor('qkv')){const ev=M.evaluate(optional,sample.v);assert.equal(ev.error,null);assert.ok(close(ev.output,M.reference(sample.v,'qkv')));}
 for(const sink of ['R','q','k']){const wrong=M.solutions('qkv');wrong.sink=sink;assert.ok(M.samplesFor('qkv').some(sample=>!close(M.evaluate(wrong,sample.v).output,M.reference(sample.v,'qkv'))),sink+' is not the V result');}
});

const differs=(id,edit)=>{const s=M.solutions(id);edit(s);assert.ok(M.samplesFor(id).slice(0,M.levels[id].sampleCount).some(t=>{const e=M.evaluate(s,t.v);return e.error||!close(e.output,M.reference(t.v,id));}),id+' must reject this incorrect computation');};

test('original concepts are completed before optional modern and engine tracks',()=>{
 assert.equal(M.routes.main.ids.length,29);assert.equal(M.routes.modern.ids.length,13);assert.equal(M.routes.engine.ids.length,9);
 assert.deepEqual(plain(M.routes.main.ids.slice(0,7)),['wire','projection','relu','down-projection','original-ffn','residual','workshop']);
 for(const id of M.routes.main.ids){
  const l=M.levels[id];assert.equal(l.original,true);
  assert.ok(!l.nodes.some(k=>['gate','silu','norm','ropeq','ropek','ffnblock','attention','attentionweights'].includes(k)),id+' must not introduce a modern operator');
  const s=M.initial(id);assert.equal(s.sink,null);assert.ok(s.nodes.every(n=>n.links.every(x=>x===null)),id+' has no starting answer');
  if(M.routes.main.ids.indexOf(id)>=6){assert.equal(s.nodes.length,0,id+' begins with an empty workbench');assert.ok(l.buildable);}
 }
 for(const id of ['activation','plain-ffn','gating','ffn','rope','attention','block'])assert.equal(M.levels[id].track,'modern');
 for(const [earlier,later]of [['layernorm','add-norm'],['softmax','weighted-sum'],['self-attention','multihead'],['multihead','encoder-layer'],['causal','decoder-self'],['cross-attention','decoder-layer'],['decoder-layer','encoder-decoder']])assert.ok(M.routes.main.ids.indexOf(earlier)<M.routes.main.ids.indexOf(later));
 assert.equal(M.levels.autoregressive.next,null);assert.equal(M.levels.block.next,null);
});

test('learned shelves accumulate in teaching order without exposing future operators or requiring distractors',()=>{
 const seen=new Set(),sequenceKind=k=>Math.max(...M.definitions[k].ins,M.definitions[k].out)>4;
 for(const route of [M.routes.main,M.routes.modern])for(const id of route.ids){
  const l=M.levels[id];l.nodes.forEach(k=>seen.add(k));if(M.fusions[id])seen.add(M.fusions[id].kind);
  if(l.practice)continue;
  const stock=M.inventory(l);
  for(const kind of seen)if(sequenceKind(kind)===!!l.sequence){
   if(id==='causal'&&kind==='original-weights')assert.equal(stock[kind],0,'causal keeps the unmasked package visible but unavailable');
   else assert.ok(stock[kind]>0,id+' retains '+kind);
  }
  for(const kind of Object.keys(stock))assert.ok(seen.has(kind),id+' must not unlock '+kind+' early');
 }
 assert.equal(M.levels.scores.chapter,'原版基础 / 06');
 const inventory=M.inventory(M.levels.scores);for(const kind of ['q','k','v','embedding','position'])assert.ok(inventory[kind]);
 for(const kind of ['softmax','aggregate','original-weights','ropeq','mask'])assert.equal(inventory[kind],undefined);
 const s=M.solutions('scores');assert.ok(M.addNode(s,'v',0,3.7));
 assert.equal(M.connect(s,'R','v',0),null);
 for(const {v}of M.samplesFor('scores')){const ev=M.evaluate(s,v);assert.equal(ev.error,null);assert.ok(close(ev.output,M.reference(v,'scores')));assert.ok(ev.values.v);}
 assert.ok(M.removeNode(s,'v'));assert.equal(M.stock(s,'v'),inventory.v);
 const wrong=M.solutions('scores');wrong.nodes.find(n=>n.id==='k').kind='v';
 assert.ok(M.samplesFor('scores').some(({v})=>!close(M.evaluate(wrong,v).output,M.reference(v,'scores'))),'V is a real numerical distractor, not an alternate key projection');
 assert.equal(M.inventory(M.levels.workshop).project,1);assert.equal(Object.keys(M.inventory(M.levels.workshop)).length,1);
 for(const id of M.routes.engine.ids)assert.deepEqual(Object.keys(M.inventory(M.levels[id])),Array.from(M.levels[id].nodes),'engine shelves keep costed tasks');
});

test('collected modules compute the same complete circuit, with the original input and output widths',()=>{
 for(const [id,reward]of Object.entries(M.fusions)){
  const level=M.levels[id],definition=M.definitions[reward.kind],packed=M.initial(level.buildable?id:'pack-ffn');packed.nodes=[];packed.sink=null;
  assert.equal(definition.out,level.sinkDim);
  assert.deepEqual(Array.from(definition.ins),Array.from(reward.inputs,()=>level.sourceDim||2));
  assert.ok(M.addNode(packed,reward.kind,0,0),id);
  reward.inputs.forEach((source,i)=>assert.equal(M.connect(packed,source,reward.kind,i),null));
  assert.equal(M.connect(packed,reward.kind,'sink',0),null);
  for(const {v}of M.samplesFor(id)){
   const expected=M.evaluate(M.solutions(id),v),actual=M.evaluate(packed,v);
   assert.equal(actual.error,null,id);assert.ok(close(actual.output,expected.output),id+' keeps its circuit’s weights and operations');
   assert.ok(close(actual.output,M.reference(v,id)),id+' keeps the lesson target');
  }
  assert.ok(M.packages[reward.kind]?.stages.length,id+' keeps its internal diagram');
 }
 const input=M.samplesFor('self-attention')[0].v;
 assert.ok(!close(M.operations['single-attention']([input]),M.operations['two-head-attention']([input])),'one full-width head cannot be mislabeled as two narrow heads');
 const r=[2,-.5],z=[.25,1.5],f=M.operations['swiglu-ffn']([z]);
 assert.ok(close(M.operations['swiglu-residual']([r,z]),r.map((x,i)=>x+f[i])),'R and Z remain independent inputs, with normalization outside this package');
});

test('packaging bridges require wiring and accept numerically equivalent expanded graphs',()=>{
 const main=Array.from(M.routes.main.ids);
 for(const [id,before,after,expanded]of [['pack-ffn','layernorm','add-norm','original-ffn'],['pack-scores','softmax','weighted-sum','softmax']]){
  assert.equal(main[main.indexOf(id)-1],before);assert.equal(main[main.indexOf(id)+1],after);
  const initial=M.initial(id);assert.equal(initial.nodes.length,0);assert.equal(initial.sink,null);assert.ok(M.evaluate(initial,M.samplesFor(id)[0].v).error);
  const packed=M.solutions(id),unpacked=M.solutions(expanded);unpacked.levelId=id;
  for(const {v}of M.samplesFor(id).slice(0,M.levels[id].sampleCount)){
   const a=M.evaluate(packed,v),b=M.evaluate(unpacked,v);assert.equal(a.error,null);assert.equal(b.error,null);
   assert.ok(close(a.output,b.output));assert.ok(close(a.output,M.reference(v,id)));
  }
  for(const n of unpacked.nodes)assert.ok(M.inventory(M.levels[id])[M.nodeKind(n)]);
  assert.ok(unpacked.nodes.length<=M.moduleLimit(M.levels[id]));
 }
 const ff=M.packages['relu-ffn'];assert.ok(ff.stages.some(s=>s.includes('ReLU')));assert.match(ff.note,/不是一次线性/);
 assert.equal(M.moduleShape('head-a',3),'3 × 1');assert.equal(M.moduleShape('embedding',3),'3 个 ID');
 assert.equal(M.moduleShape('layernorm2',2),2);
});

test('every optional shelf module has a real worked example and every package is introduced',()=>{
 for(const level of Object.values(M.levels))for(const kind of Object.keys(M.inventory(level))){
  const id=M.exampleLevel(kind,level.id),d=M.definitions[kind];
  assert.ok(M.levels[id].nodes.includes(kind)||M.fusions[id]?.kind===kind,level.id+' / '+kind);
  const ex=M.extraExample(kind,id)||ctx.exampleFor(M,kind,id);
  assert.equal(ex.inputs.length,d.ins.length,level.id+' / '+kind);
  ex.inputs.forEach(([,values],i)=>assert.equal(values.length,d.ins[i],kind+' input shape'));
  assert.equal(ex.output[1].length,d.out,kind+' output shape');
  for(const values of [...ex.inputs,ex.output])assert.ok(values[1].every(n=>Number.isFinite(n)||n===-Infinity),kind+' values');
 }
 for(const kind of Object.keys(M.packages)){
  const id=M.exampleLevel(kind,'wire');assert.ok(M.levels[id].packages?.includes(kind)||M.fusions[id]?.kind===kind);
 }
});

test('score explanations follow actual Q/K dimensions and show why Softmax does not cancel scaling',()=>{
 for(const [level,kind,width]of [['scores','score',2],['cross-attention','original-score',4],['rope','score',2]]){
  const example=M.extraExample(kind,level),d=ctx.scoreComparison(M,example);
  assert.equal(d.width,width);assert.equal(d.divisor,Math.sqrt(width));
  assert.ok(close(d.scaled,d.raw.map(x=>x/d.divisor)));
  assert.ok(Math.abs(d.q.reduce((sum,x,i)=>sum+x*d.k[i],0)-d.raw[d.key])<1e-12);
  for(const weights of [d.before,d.after]){assert.ok(weights.every(x=>x>=0&&x<=1));assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);}
  assert.ok(!close(d.before,d.after));assert.ok(Math.max(...d.before)>Math.max(...d.after));
  const card=M.extraCard(kind,level);assert.match(card.formula,/√dₖ/);assert.ok(card.formula.includes('dₖ = '+width));
 }
 const two=ctx.scoreComparison(M,M.extraExample('score','scores')).simple;
 assert.ok(close(two.before,[1/(1+Math.exp(2)),1/(1+Math.exp(-2))]));
 assert.ok(close(two.after,[1/(1+Math.exp(Math.SQRT2)),1/(1+Math.exp(-Math.SQRT2))]));
 assert.ok(two.after[0]>two.before[0]);
 const zero=ctx.scoreComparison(M,{inputs:[['Q',Array(6).fill(0)],['K',Array(6).fill(0)]],output:['S',Array(9).fill(0)]});
 assert.ok(close(zero.before,[1/3,1/3,1/3]));assert.ok(close(zero.before,zero.after),'already uniform scores remain uniform');
});

test('AV examples sum weighted whole V vectors for every query, including cross-attention and masked attention',()=>{
 for(const [level,kind,width]of [['weighted-sum','aggregate',2],['self-attention','aggregate',2],['cross-attention','original-aggregate',4],['attention','aggregate',2]]){
  const example=M.extraExample(kind,level),before=JSON.stringify(example);
  for(let query=0;query<3;query++){
   const d=ctx.aggregationExample(M,example,query);
   assert.equal(d.width,width);assert.equal(d.query,query);assert.equal(d.values.length,3);
   assert.ok(close(d.output,example.output[1].slice(query*width,(query+1)*width)),level+' query '+query);
   assert.ok(Math.abs(d.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
   for(let i=0;i<3;i++)assert.ok(close(d.contributions[i],d.values[i].map(x=>x*d.weights[i])));
   assert.ok(close(d.simple.output,[.5,3]));assert.deepEqual(plain(d.simple.contributions),[[.5,0],[0,3]]);
   if(level==='attention')for(let i=query+1;i<3;i++){assert.equal(d.weights[i],0);assert.ok(d.contributions[i].every(x=>x===0));}
  }
  assert.equal(JSON.stringify(example),before);
  assert.equal(M.extraCard(kind,level).formula,'O = A × V');
  assert.match(M.extraCard(kind,level).meaning,/Softmax/);
 }
 const sample={inputs:[['A',[1,0,0,0,1,0,.25,.75,0]],['V',[2,-4,-2,8,0,0]]],output:['O',[2,-4,-2,8,-1,5]]};
 assert.ok(close(ctx.aggregationExample(M,sample).output,[-1,5]),'signed features combine instead of choosing or multiplying paired positions');
});

test('original ReLU FFN keeps positive values and zeros negative features without a gate',()=>{
 assert.deepEqual([-2,0,1,3].map(O.relu),[0,0,1,3]);
 assert.ok(close(O.classicFFN([-1,2]),[0,.6]));assert.ok(close(O.classicFFN([0,1]),[.1,.4]));
 assert.ok(!close(M.reference([0,1],'plain-ffn'),M.reference([0,1],'original-ffn')),'the legacy SiLU calculation is retained separately');
 differs('original-ffn',s=>s.nodes.find(n=>n.id==='down').links=['project']);
});

test('LayerNorm uses population variance per token and differs from RMSNorm',()=>{
 const k=1/Math.sqrt(1+1e-6);assert.ok(close(O.ln([1,3]),[-k,k]));assert.ok(close(O.ln([6,8]),[-k,k]));
 assert.deepEqual(plain(O.ln([5,5])),[0,0]);assert.ok(!close(O.ln([1,3]),M.norm([1,3])));
 const v=[1,3,-2,4,5,5],out=M.operations['ln-attn']([v]);
 assert.ok(close(out.slice(0,2),[-k,k]));assert.ok(close(out.slice(2,4),[-3/Math.sqrt(9+1e-6),3/Math.sqrt(9+1e-6)]));assert.deepEqual(plain(out.slice(4)),[0,0]);
});

test('the original residual wrapper applies LayerNorm after addition rather than before the FFN',()=>{
 const x=[1,3],f=O.classicFFN(x),expected=O.ln(x.map((n,i)=>n+f[i]));
 assert.ok(close(M.reference(x,'add-norm'),expected));
 differs('add-norm',s=>{s.nodes.find(n=>n.id==='layernorm2').links=['R'];s.nodes.find(n=>n.id==='relu-ffn').links=['layernorm2'];s.nodes.find(n=>n.id==='add').links=['R','relu-ffn'];s.sink='add';});
});

test('original sinusoidal positions add to scaled embeddings before Q/K/V',()=>{
 const x=[1,0,1,0,1,0],y=O.position(x);
 assert.ok(close(y,[Math.SQRT2,1,Math.SQRT2+Math.sin(1),Math.cos(1),Math.SQRT2+Math.sin(2),Math.cos(2)]));
 assert.notDeepEqual(plain(y.slice(0,2)),plain(y.slice(2,4)));
 assert.ok(!close(y,M.math.rotate(x)),'additive positions are not RoPE');
 differs('positions',s=>s.sink='embedding');
});

test('original single-head attention can read future source positions and uses no RoPE',()=>{
 const a=[1,0,0,1,1,1],b=[1,0,0,1,-3,2],first=O.singleAttention(a),second=O.singleAttention(b);
 assert.ok(!close(first.slice(0,2),second.slice(0,2)),'encoder attention sees the complete source');
 assert.ok(!close(first,M.math.attention(a)),'modern causal RoPE attention stays a different computation');
 const s=M.solutions('self-attention'),ev=M.evaluate(s,a);assert.ok(close(ev.output,first));
 assert.equal(ev.values.softmax.length,9);for(const row of M.math.rows(ev.values.softmax,3))assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-12);
});

test('two one-dimensional heads score independently with sqrt(d_k)=1 and concatenate features in token order',()=>{
 const x=[1,0,0,1,1,1],a=O.head(x,x,0),b=O.head(x,x,1);
 const softmax=s=>{const e=s.map(Math.exp),total=e.reduce((a,b)=>a+b,0);return e.map(x=>x/total);};
 const expected=softmax([.8,.2,1]).reduce((sum,p,i)=>sum+p*[1,0,1][i],0);
 assert.ok(Math.abs(a[0]-expected)<1e-12);assert.ok(!close(a,b));
 assert.deepEqual(plain(O.concat([1,2,3],[10,20,30])),[1,10,2,20,3,30]);
 const s=M.solutions('multihead'),ev=M.evaluate(s,x);assert.ok(close(ev.values.concat,[a[0],b[0],a[1],b[1],a[2],b[2]]));
 differs('multihead',s=>s.nodes.find(n=>n.id==='concat').links.reverse());
});

test('a complete original encoder has two separate post-norm residual wrappers',()=>{
 const x=O.position(O.embed([0,1,2],4)),s=M.solutions('encoder-layer'),ev=M.evaluate(s,x);
 const a=x.map((v,i)=>v+ev.values['self-heads'][i]);assert.ok(close(ev.values['encoder-add'],a));
 assert.ok(close(ev.values['ln-attn'],M.operations['ln-attn']([a])));
 assert.ok(close(ev.values['ffn-add'],ev.values['ln-attn'].map((v,i)=>v+ev.values['original-ffn-block'][i])));
 assert.ok(close(ev.output,O.encoder(x)));
 differs('encoder-layer',s=>s.nodes.find(n=>n.id==='ffn-add').links[0]='R');
});

test('encoder shelf aliases share stock and build the same layer with repeated generic operators',()=>{
 const level=M.levels['encoder-layer'],s=M.solutions(level.id);
 const rename=id=>({'ffn-add':'encoder-add-2','ln-ffn':'ln-attn-2'})[id]||id;
 for(const n of s.nodes){n.kind=M.shelfKind(level,n.kind);n.id=rename(n.id);n.links=n.links.map(rename);}
 s.sink=rename(s.sink);
 for(const {v}of M.samplesFor(level.id)){
  const ev=M.evaluate(s,v);assert.equal(ev.error,null);assert.ok(close(ev.output,M.reference(v,level.id)));
 }
 for(const [kind,alias]of [['encoder-add','ffn-add'],['ln-attn','ln-ffn']]){
  assert.equal(M.stock(s,kind),0);assert.equal(M.stock(s,alias),0);assert.equal(M.canAdd(s,alias),false);
  assert.notEqual(M.nodeName(s,kind),M.nodeName(s,kind+'-2'));
  assert.ok(M.validNodeId(kind+'-2',kind));
  assert.ok(M.removeNode(s,kind+'-2'));assert.equal(M.stock(s,kind),1);assert.equal(M.stock(s,alias),1);
 }
 const old=M.solutions(level.id);
 assert.equal(M.stock(old,'encoder-add'),0);assert.equal(M.stock(old,'ln-attn'),0);
 assert.equal(M.nodeName(old,'encoder-add'),'残差相加 · 1');assert.equal(M.nodeName(old,'ffn-add'),'残差相加 · 2');
 assert.equal(M.nodeName(old,'ln-attn'),'LayerNorm · 1');assert.equal(M.nodeName(old,'ln-ffn'),'LayerNorm · 2');
 assert.ok(M.removeNode(old,'ffn-add'));assert.equal(M.stock(old,'encoder-add'),1);
 const decoder=M.solutions('decoder-layer');assert.equal(M.stock(decoder,'encoder-add'),1,'other lessons retain their stock rules');
});

test('masked decoder attention cannot read future target positions',()=>{
 const a=[1,0,0,1,1,1],b=[1,0,0,1,-8,3];
 const x=O.multi(a,a,true),y=O.multi(b,b,true);assert.ok(close(x.slice(0,4),y.slice(0,4)));assert.ok(!close(x.slice(4),y.slice(4)));
 const da=O.embed([0,1,2],4),db=[...da.slice(0,8),-8,3,.2,-1],e=O.encoder(O.position(O.embed([2,0,1],4)));assert.ok(close(O.decoder(da,e).slice(0,8),O.decoder(db,e).slice(0,8)));
});

test('cross-attention takes queries from targets and keys/values from independently supplied encoder memory',()=>{
 const s=M.solutions('cross-attention'),input=M.samplesFor('cross-attention')[0].v,ev=M.evaluate(s,input);
 assert.notDeepEqual(plain(ev.values.R),plain(ev.values.Z));
 assert.ok(close(ev.values['original-q'],O.project(input,O.wide.q)));assert.ok(close(ev.values['original-k'],O.project(ev.values.Z,O.wide.k)));assert.ok(close(ev.values['original-v'],O.project(ev.values.Z,O.wide.v)));
 const source1=O.embed([0,1,2],4),source2=[...source1.slice(0,8),-3,2,.5,-.8];
 assert.ok(!close(O.singleAttention(input,source1).slice(0,2),O.singleAttention(input,source2).slice(0,2)),'every target may read the last source position');
 differs('cross-attention',s=>{s.nodes.find(n=>n.id==='original-k').links=['R'];s.nodes.find(n=>n.id==='original-v').links=['R'];});
});

test('decoder cross-attention residual uses decoder state and is followed by its own normalization',()=>{
 const s=M.solutions('decoder-layer'),v=M.samplesFor('decoder-layer')[0].v,ev=M.evaluate(s,v);
 assert.ok(close(ev.values['cross-add'],ev.values['ln-attn'].map((x,i)=>x+ev.values['cross-heads'][i])));
 assert.ok(close(ev.output,O.decoder(v,ev.values.Z)));
 differs('decoder-layer',s=>s.nodes.find(n=>n.id==='cross-add').links[0]='Z');
 differs('decoder-layer',s=>{s.nodes.find(n=>n.id==='original-ffn-block').links=['ln-attn'];s.nodes.find(n=>n.id==='ffn-add').links[0]='ln-attn';});
});

test('the encoder–decoder capstone keeps source and target streams separate all the way to vocabulary scores',()=>{
 const s=M.solutions('encoder-decoder'),ev=M.evaluate(s,[0,1,2]);assert.equal(ev.error,null);
 assert.deepEqual(plain(ev.values.R),[0,1,2]);assert.deepEqual(plain(ev.values.Z),[2,0,1]);
 assert.ok(close(ev.values['source-embed'],O.position(O.embed([2,0,1],4))));assert.ok(close(ev.values['target-embed'],O.position(O.embed([0,1,2],4))));
 assert.equal(ev.output.length,18);assert.ok(close(ev.output,O.vocabulary(ev.values['original-decoder'])));
 differs('encoder-decoder',s=>s.nodes.find(n=>n.id==='original-decoder').links.reverse());
});
