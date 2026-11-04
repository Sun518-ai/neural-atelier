const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={console,navigator:{languages:['zh-CN']}};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['locales/en.js','i18n.js','model.js','campaign.js','engine-model.js','original-curriculum.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),ctx,{filename:file});
const M=ctx.NeuralPrologue,O=M.original;
const plain=x=>JSON.parse(JSON.stringify(x));
const close=(a,b,tol=1e-9)=>a?.length===b.length&&a.every((x,i)=>Number.isFinite(x)&&Math.abs(x-b[i])<tol);
test('QKV requires three independently correct projections although V itself does not depend on Q or K',()=>{
 const s=M.solutions('qkv'),input=[1,0,0,1,1,1],ev=M.evaluate(s,input);
 assert.ok(ev.goals.every(g=>g.pass));
 for(const [kind,expected]of [['q',[1,.25,.5,1,1.5,1.25]],['k',[.8,-.5,.2,1,1,.5]],['v',[1,0,0,2,1,2]]])assert.ok(close(ev.goals.find(g=>g.kind===kind).actual,expected));
 s.nodes=s.nodes.filter(n=>n.kind==='v');const onlyV=M.evaluate(s,input);
 assert.ok(close(onlyV.output,M.reference(input,'qkv')));assert.equal(onlyV.error,null);
 assert.deepEqual(plain(onlyV.goals.map(g=>g.pass)),[false,false,true]);assert.ok(onlyV.goals.slice(0,2).every(g=>g.actual===null&&g.id===null));
 const serial=M.solutions('qkv');serial.nodes.find(n=>n.kind==='k').links=['q'];const wrong=M.evaluate(serial,input);
 assert.ok(close(wrong.output,M.reference(input,'qkv')));assert.equal(wrong.goals.find(g=>g.kind==='k').pass,false);
 assert.ok(M.evaluate(M.solutions('scores'),input).goals.length===0,'other lessons keep their numerical outlet goal');
});
const differs=(id,edit)=>{const s=M.solutions(id);edit(s);assert.ok(M.samplesFor(id).slice(0,M.levels[id].sampleCount).some(t=>{const e=M.evaluate(s,t.v);return e.error||!close(e.output,M.reference(t.v,id));}),id+' must reject this incorrect computation');};

test('original concepts are completed before optional modern and engine tracks',()=>{
 assert.equal(M.routes.main.ids.length,27);assert.equal(M.routes.modern.ids.length,13);assert.equal(M.routes.engine.ids.length,9);
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
