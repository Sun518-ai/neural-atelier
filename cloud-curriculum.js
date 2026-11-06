/* Cloud deployment foundations. Small exact matrices, not GPU performance claims. */
(function(M){
const L=(zh,en)=>{globalThis.AtelierEnglish[zh]=en;return I18n.t(zh);};
const scope=L('单机两卡的数学缩尺：每个组件标明所属 GPU，芯片归属固定，台面位置可自由摆放。本批只验证分片计算与通信结果，不模拟显存容量、真实并发时间或真实 GLM / Kimi 权重。','A mathematical miniature of two GPUs in one server. Module labels fix GPU ownership while workbench positions remain free. These lessons verify sharded computation and communication results, not memory capacity, real concurrency or GLM / Kimi weights.');
const W=[[1,0,1,.5],[0,1,.5,-1]],D=[[.5,.1],[.2,.6],[.3,-.2],[-.1,.4]],relu=x=>Math.max(0,x),plus=(a,b)=>a.map((x,i)=>x+b[i]);
const specs={
 'tp-col-a':[L('GPU 0 · 前半列','GPU 0 · first columns'),[2],2,'linear',W.map(r=>r.slice(0,2)),L('两卡收到同一个输入 X。GPU 0 只存 W 的前两列，算出输出的前两个特征；不是把输入砍成一半。例：[1, 1] 得到 [1, 1]。','Both GPUs receive the same X. GPU 0 stores the first two columns of W and computes the first two output features; the input is not halved. Example: [1, 1] produces [1, 1].'),'Y₀ = XW₀'],
 'tp-col-b':[L('GPU 1 · 后半列','GPU 1 · last columns'),[2],2,'linear',W.map(r=>r.slice(2)),L('GPU 1 存 W 的后两列。输入与 GPU 0 相同，但权重不同，所以输出特征不同。例：[1, 1] 得到 [1.5, −0.5]。','GPU 1 stores the last two columns of W. Its input matches GPU 0, but its weights differ. Example: [1, 1] produces [1.5, −0.5].'),'Y₁ = XW₁'],
 'tp-gather':[L('拼接收集 · Gather','Concatenate · Gather'),[2,2],4,'concat',null,L('两个入口分别接前半、后半输出，把 [a, b] 和 [c, d] 拼成 [a, b, c, d]，不相加。本关在出口收集一份；All-Gather 则会让每张卡都得到完整结果。','The first input is the first half and the second is the last half. Join [a, b] and [c, d] into [a, b, c, d], without addition. This lesson collects one copy at the outlet; All-Gather would distribute a complete result to every GPU.'),'Y = concat(Y₀, Y₁)'],
 'tp-expand':[L('已知投影 · 生成 H','Known projection · make H'),[2],4,'linear',W,L('先得到四个特征 H，作为本关待拆分的输入。下一步两卡会各取其中两个特征，并乘对应的权重行。','Produce the four-feature H that this lesson will split. Each GPU then takes two features and multiplies their matching weight rows.'),'H = XW'],
 'tp-slice-a':[L('取前半特征','Take first features'),[4],2,'linear',[[1,0],[0,1],[0,0],[0,0]],L('取 H 的前两个特征。例如 [1, 1, 1.5, −0.5] 取出 [1, 1]；投影矩阵中的 0 / 1 只负责选取，不做新的特征混合。','Take the first two features of H. For [1, 1, 1.5, −0.5], return [1, 1]. The 0/1 matrix only selects coordinates; it does not learn a new feature mixture.'),'H₀ = H[:2]'],
 'tp-slice-b':[L('取后半特征','Take last features'),[4],2,'linear',[[0,0],[0,0],[1,0],[0,1]],L('取 H 的后两个特征，顺序保持不变。例如 [1, 1, 1.5, −0.5] 取出 [1.5, −0.5]。','Take the last two features of H in their original order. For [1, 1, 1.5, −0.5], return [1.5, −0.5].'),'H₁ = H[2:]'],
 'tp-row-a':[L('GPU 0 · 前半权重行','GPU 0 · first weight rows'),[2],2,'linear',D.slice(0,2),L('用前半特征乘 D 的前两行。得到的是每个输出特征的一部分贡献，不能直接当作完整输出。例：[1, 1] 得到 [0.7, 0.7]。','Multiply the first features by the first rows of D. The result is a partial contribution to every output feature, not a complete output. Example: [1, 1] produces [0.7, 0.7].'),'P₀ = H₀D₀'],
 'tp-row-b':[L('GPU 1 · 后半权重行','GPU 1 · last weight rows'),[2],2,'linear',D.slice(2),L('用后半特征乘 D 的后两行。它和另一张卡计算的是同一组输出坐标的不同贡献，需要逐项相加。例：[1.5, −0.5] 得到 [0.5, −0.5]。','Multiply the last features by the last rows of D. Both GPUs contribute to the same output coordinates, so their partial values must be added. Example: [1.5, −0.5] produces [0.5, −0.5].'),'P₁ = H₁D₁'],
 'tp-reduce':[L('部分和归并 · Reduce','Sum partials · Reduce'),[2,2],2,'add',null,L('把两张卡对同一输出坐标的贡献相加：[0.7, 0.7] + [0.5, −0.5] = [1.2, 0.2]。这里是矩阵乘法的部分和，不是残差；两个入口都不是绕过计算的原始输入。All-Reduce 还会把总和分发给所有卡。','Add both GPUs’ contributions to the same output coordinates: [0.7, 0.7] + [0.5, −0.5] = [1.2, 0.2]. These are partial matrix-product sums, not a residual: neither input is a bypass of the original input. All-Reduce also distributes the sum to every GPU.'),'Y = P₀ + P₁'],
 'tp-relu-a':[L('GPU 0 · 局部 ReLU','GPU 0 · local ReLU'),[2],2,'activation',null,L('ReLU 对每个数单独计算 max(0, x)，不需要知道另一张卡的特征。因此前半特征可留在 GPU 0 上处理，无需先收集完整向量。','ReLU computes max(0, x) independently for each number. It does not need the other GPU’s features, so the first half can stay on GPU 0 without gathering the full vector.'),'A₀ = ReLU(H₀)'],
 'tp-relu-b':[L('GPU 1 · 局部 ReLU','GPU 1 · local ReLU'),[2],2,'activation',null,L('后半特征在 GPU 1 本地经过 ReLU，再交给后半权重行。例：[1.5, −0.5] 变成 [1.5, 0]。这只适用于逐元素运算，不能据此把跨特征归一化也拆开独立计算。','Apply ReLU to the last features on GPU 1, then feed the last weight rows. Example: [1.5, −0.5] becomes [1.5, 0]. This works for elementwise operations; it does not make normalization across features independently separable.'),'A₁ = ReLU(H₁)']
};
const cards={};
for(const [id,[name,ins,out,type,w,hint,formula]]of Object.entries(specs)){
 M.definitions[id]={name,ins,out,type,hint,x:0,z:0,...(type==='activation'?{activation:'relu'}:{})};if(w)M.weights[id]=w;
 M.extraColors[id]=id.endsWith('-b')?0x9b88c4:id.includes('gather')||id.includes('reduce')?0xc7a166:0x659bab;
 cards[id]={number:'',seal:'TP',english:'TENSOR PARALLEL',family:L('云端推理 · 两卡协作','Cloud inference · two GPUs'),ability:name,meaning:hint,purpose:scope,formula,weight:w?w.length+' × '+w[0].length:L('无权重','No weights'),trait:L('分片计算','Sharded computation'),stage:0,color:'#'+M.extraColors[id].toString(16)};
}
M.definitions['tp-reduce'].communication=true;
M.operations['tp-gather']=([a,b])=>[...a,...b];M.operations['tp-reduce']=([a,b])=>plus(a,b);
for(const id of ['tp-relu-a','tp-relu-b'])M.operations[id]=([x])=>x.map(relu);
const definitions=[
 ['tp-columns',L('一块矩阵，两张卡','One matrix, two GPUs'),['tp-col-a','tp-col-b','tp-gather'],4,
 L('把输出特征分给两张卡','Split output features between GPUs'),
 L('两卡分别拿到一半权重列。让完整输出与未拆分的 XW 一致，五组输入都要匹配。','Each GPU holds half the weight columns. Make the complete output match unsharded XW for all five inputs.'),
 L('前面一个投影组件保存整块 W；现在 W 按输出特征拆成两份。两卡各算不同的输出坐标，可以分担权重存储和计算。','Previously one projection held all of W. Now split W by output features. Each GPU computes different output coordinates, sharing weight storage and arithmetic.'),
 L('完整输入要给两张卡，输出才分成两半。拼接顺序决定特征顺序；这里不是把两份结果相加。','Both GPUs need the full input; their outputs are different halves. Concatenation order determines feature order. Do not add those halves.'),
 {'tp-col-a':['R'],'tp-col-b':['R'],'tp-gather':['tp-col-a','tp-col-b'],sink:'tp-gather'},x=>M.linear(x,W)],
 ['tp-rows',L('两份部分和，一个结果','Two partial sums, one result'),['tp-expand','tp-slice-a','tp-slice-b','tp-row-a','tp-row-b','tp-reduce'],2,
 L('输入分开后，如何还原一次投影？','How do split inputs recover one projection?'),
 L('先得到四维 H，再拆给两张卡，各乘对应的两行 D。让输出与未拆分的 HD 一致。','Produce four-feature H, split it across the GPUs, and multiply each half by its matching rows of D. Match the unsharded HD result.'),
 L('每个输出都是四个输入特征的加权和。每张卡只拿到其中两个特征，因此只能算出同一输出的一部分贡献。','Each output is a weighted sum of four input features. A GPU holding only two features can compute only part of that same output.'),
 L('按列拆：输出坐标不同，要拼接。按行拆：输出坐标相同、贡献不完整，要相加。Reduce 与残差都做加法，但数据来源不同。','Column split: different output coordinates must be concatenated. Row split: incomplete contributions to the same coordinates must be summed. Reduce and residual addition both add, but their inputs mean different things.'),
 {'tp-expand':['R'],'tp-slice-a':['tp-expand'],'tp-slice-b':['tp-expand'],'tp-row-a':['tp-slice-a'],'tp-row-b':['tp-slice-b'],'tp-reduce':['tp-row-a','tp-row-b'],sink:'tp-reduce'},x=>M.linear(M.linear(x,W),D)],
 ['tp-ffn',L('让特征留在各自的卡上','Keep features on their GPUs'),['tp-col-a','tp-col-b','tp-relu-a','tp-relu-b','tp-row-a','tp-row-b','tp-reduce'],2,
 L('两张卡完成同一个 FFN','Complete one FFN across two GPUs'),
 L('把前两关的分片组合起来，得到与 XW → ReLU → D 相同的结果。两卡各处理自己的特征，最后收集输出。','Combine both sharding methods to match XW → ReLU → D. Each GPU processes its own features; collect the output at the end.'),
 L('第一层按列拆，恰好把中间特征分在两张卡。ReLU 逐项运算，可留在原卡；第二层按行拆，直接接各卡已有的特征，再归并部分和。','A column-parallel first layer leaves the intermediate features split across GPUs. ReLU is elementwise and stays local. A row-parallel second layer consumes those local features, then reduces partial sums.'),
 L('不必每经过一个组件就拼回完整向量。这是 FFN 张量并行的一种常见组合。真实多卡执行还要考虑通信、同步和显存，后续分开学习。','There is no need to reconstruct the full vector after every module. This is a common tensor-parallel FFN pattern. Real execution also requires communication, synchronization and memory planning, introduced separately later.'),
 {'tp-col-a':['R'],'tp-col-b':['R'],'tp-relu-a':['tp-col-a'],'tp-relu-b':['tp-col-b'],'tp-row-a':['tp-relu-a'],'tp-row-b':['tp-relu-b'],'tp-reduce':['tp-row-a','tp-row-b'],sink:'tp-reduce'},x=>M.linear(M.linear(x,W).map(relu),D)]
];
const links={},refs={},known=new Set();
for(const [i,[id,title,nodes,sinkDim,mission,description,why,takeaway,solution,ref]]of definitions.entries()){
 nodes.forEach(k=>known.add(k));const inventory=Object.fromEntries([...known].map(k=>[k,2]));
 M.levels[id]={id,title,nodes,sources:['R'],sourceDim:2,sinkDim,sampleCount:5,sequence:false,sourceX:-10.3,sinkX:10.3,zoom:1.22,boardWidth:26,boardDepth:14,sourceTitle:L('输入特征 X','Input features X'),sourceNote:'',outputTitle:L('完整计算结果','Complete result'),shape:'2 → '+sinkDim,mission,description,summary:description,concept:title,hints:[],rationale:{title:L('从矩阵运算到两卡协作','From matrix operations to two GPUs'),text:why,takeaway,scope},track:'cloud',cloud:true,chapter:L('云端推理 / 0'+(i+1),'Cloud / 0'+(i+1)),boardText:'CLOUD / 0'+(i+1)+' · 2 GPUs',buildable:true,requirePlacement:true,startWithModules:false,maxModules:nodes.length+2,inventory,next:definitions[i+1]?.[0]||null,
 shelf:{packageKinds:['tp-gather','tp-reduce'],currentKinds:[...known],order:[...known],current:L('两卡计算组件','Two-GPU modules'),packages:L('通信与收集','Communication and collection'),basics:L('分片与局部计算','Shards and local computation'),earlier:L('已学零件','Earlier parts'),note:L('已学组件保留为可选方案，不需要全部使用。GPU 编号表示所属芯片，不由摆放位置决定。','Learned modules remain available as alternatives; not every module is needed. GPU labels identify chip ownership, independently of placement.')}};
 links[id]=solution;refs[id]=ref;
}
M.routes={main:M.routes.main,modern:M.routes.modern,cloud:{name:L('实践 · 云端推理','Practice · Cloud inference'),description:L('先理解两卡如何算同一块矩阵，再扩展到多机部署。首批 3 关可玩：按列分片 → 按行分片 → 两卡 FFN。后续规划：多机拓扑与通信、MoE 专家路由、Prefill / Decode 调度、CUDA Graph、MTP 提议与验证，再用固定版本的 GLM-5.3 / Kimi K3 做部署案例。后续内容尚未开放。','Start with how two GPUs compute one matrix, then expand to multi-node deployment. First three playable lessons: column sharding → row sharding → a two-GPU FFN. Planned next: network topology and communication, MoE routing, Prefill/Decode scheduling, CUDA Graph, MTP proposal and verification, then pinned GLM-5.3 / Kimi K3 deployment cases. Later lessons are not yet available.'),ids:definitions.map(d=>d[0])},engine:M.routes.engine};
const oldExampleLevel=M.exampleLevel;
M.exampleLevel=(kind,id)=>cards[kind]?Object.keys(links).find(l=>links[l][kind]):oldExampleLevel(kind,id);
const oldSamples=M.samplesFor,oldRef=M.reference,oldSolutions=M.solutions,oldCard=M.extraCard,oldExample=M.extraExample;
M.samplesFor=id=>refs[id]?M.samples:oldSamples(id);
M.reference=(v,id)=>refs[id]?refs[id](v):oldRef(v,id);
M.solutions=id=>{if(!links[id])return oldSolutions(id);const s=M.initial(id,{complete:true});for(const n of s.nodes)n.links=[...links[id][n.id]];s.sink=links[id].sink;return s;};
M.extraCard=(kind,id)=>cards[kind]||oldCard?.(kind,id);
M.extraExample=(kind,id)=>{if(!cards[kind])return oldExample?.(kind,id);const stage=Object.keys(links).find(l=>links[l][kind]),s=M.solutions(stage),input=M.samples[2].v,ev=M.evaluate(s,input),n=s.nodes.find(n=>n.id===kind);return {sampleIndex:2,exampleSource:['X',input],inputs:n.links.map(k=>[k==='R'?'X':M.definitions[k].name,ev.values[k]]),output:[M.definitions[kind].name,ev.values[kind]]};};
M.cloud={weights:W,down:D,ids:definitions.map(d=>d[0])};
I18n.prepare({cards,levels:Object.fromEntries(M.cloud.ids.map(id=>[id,M.levels[id]])),route:M.routes.cloud,definitions:Object.fromEntries(Object.keys(specs).map(id=>[id,M.definitions[id]]))});
})(window.NeuralPrologue);
