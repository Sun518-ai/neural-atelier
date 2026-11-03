/* Deterministic teaching model. Shapes, operators and budgets are deliberately small. */
(function(M){
const flat=rows=>rows.flat(),rows=(v,n=2)=>Array.from({length:v.length/n},(_,i)=>v.slice(i*n,i*n+n));
const mat=(v,w)=>flat(rows(v).map(r=>M.linear(r,w)));
const softmax=v=>{const max=Math.max(...v),e=v.map(x=>Math.exp(x-max)),sum=e.reduce((a,b)=>a+b,0);return e.map(x=>x/sum);};
const rotate=v=>flat(rows(v).map(([x,y],p)=>[x*Math.cos(p)-y*Math.sin(p),x*Math.sin(p)+y*Math.cos(p)]));
const scores=(q,k)=>flat(rows(q).map(a=>rows(k).map(b=>a.reduce((s,x,i)=>s+x*b[i],0)/Math.sqrt(2))));
const causal=s=>s.map((x,i)=>i%3>Math.floor(i/3)?-Infinity:x);
const probabilities=s=>flat(rows(s,3).map(softmax));
const mix=(a,v)=>flat(rows(a,3).map(r=>[0,1].map(j=>r.reduce((sum,p,i)=>sum+p*rows(v)[i][j],0))));
const normalize=v=>flat(rows(v).map(M.norm));
const ffn=v=>flat(rows(v).map(r=>{const z=M.norm(r),g=M.linear(z,M.weights.gate).map(M.silu),u=M.linear(z,M.weights.up);return M.linear(g.map((x,i)=>x*u[i]),M.weights.down);}));
const Wq=[[1,.25],[.5,1]],Wk=[[.8,-.5],[.2,1]],Wv=[[1,0],[0,2]],Wo=[[.9,.1],[-.2,.8]];
const emb=[[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,-1]];
const vocab=[I18n.t("我"),I18n.t("爱"),I18n.t("猫"),I18n.t("你"),I18n.t("恨"),I18n.t("狗")];
const head=[[1,0,1,-1,0,-1],[0,1,1,0,-1,-1]],bias=[0,0,-.75,0,0,-.75];
function logits(v){return flat(rows(v).map(r=>M.linear(r,head).map((x,i)=>x+bias[i])));}
function sample(v){return rows(v,6).map(r=>r.indexOf(Math.max(...r)));}
const decode=v=>sample(logits(v));
const attention=x=>mat(mix(probabilities(causal(scores(rotate(mat(x,Wq)),rotate(mat(x,Wk))))),mat(x,Wv)),Wo);
const block=x=>{const a=attention(normalize(x)),r=x.map((v,i)=>v+a[i]),f=ffn(r);return r.map((v,i)=>v+f[i]);};
const serial=(ids,source='R')=>Object.fromEntries(ids.map((id,i)=>[id,[i?ids[i-1]:source]]));
const def=(name,ins,out,type,hint)=>({name,ins,out,type,hint,x:0,z:0});
Object.assign(M.weights,{q:Wq,k:Wk,v:Wv,output:Wo,lmhead:head});
Object.assign(M.definitions,{
 embedding:def(I18n.t("词向量表"),[3],6,'embedding',I18n.t("Token ID 是词表中的编号。查表取出每个编号对应的两维向量。")),
 norm:def('RMSNorm',[6],6,'norm',I18n.t("每个位置的向量除以自己的均方根。本例缩放权重设为 1；维度与位置顺序不变。")),
 q:def(I18n.t("Q · 查询投影"),[6],6,'linear',I18n.t("每个位置生成查询。相同的权重用于所有位置。")),
 k:def(I18n.t("K · 键投影"),[6],6,'linear',I18n.t("每个位置生成供查询匹配的键。")),
 v:def(I18n.t("V · 值投影"),[6],6,'linear',I18n.t("每个位置生成被注意力加权汇合的内容。")),
 score:def(I18n.t("QKᵀ · 打分"),[6,6],9,'score',I18n.t("把每个 Q 与每个 K 点乘，再除以 √2，得到 3 × 3 分数。")),
 mask:def(I18n.t("因果遮罩"),[9],9,'mask',I18n.t("未来位置设为 −∞；Softmax 后这些位置的权重为 0。")),
 softmax:def('Softmax',[9],9,'softmax',I18n.t("每个查询位置的分数转成和为 1 的非负权重。")),
 ropeq:def(I18n.t("RoPE · 旋转 Q"),[6],6,'rope',I18n.t("位置 p 的向量旋转 p 弧度。真实模型有多对特征和不同频率。")),
 ropek:def(I18n.t("RoPE · 旋转 K"),[6],6,'rope',I18n.t("K 使用与 Q 相同的按位置旋转规则；V 保持原样。")),
 aggregate:def(I18n.t("AV · 汇合内容"),[9,6],6,'mix',I18n.t("每个查询位置用注意力权重对各位置的 V 加权求和，得到该位置的输出向量。")),
 output:def(I18n.t("输出投影 Wo"),[6],6,'linear',I18n.t("汇合结果再乘 Wo，映射回残差流的特征宽度。")),
 attention:def(I18n.t("已完成的 Attention"),[6],6,'attention',I18n.t("内部包括 Q/K/V、RoPE、因果注意力与输出投影。双击可查看。")),
 residual1:def(I18n.t("Attention 残差"),[6,6],6,'residual',I18n.t("把 Attention 的变化量逐项加到原输入。")),
 ffnblock:def(I18n.t("已完成的 FFN"),[6],6,'ffn',I18n.t("对每个位置独立执行归一化、双路投影、SiLU、门控与降维。输出变化量 F。")),
 residual2:def(I18n.t("FFN 残差"),[6,6],6,'residual',I18n.t("把 FFN 变化量加到 Attention 后的残差流。")),
 lmhead:def(I18n.t("词表投影"),[6],18,'vocabulary',I18n.t("每个位置的特征乘词表权重，加偏置，得到六个候选词的分数。")),
 pick:def(I18n.t("取最高分"),[18],3,'pick',I18n.t("演示采用贪心选择：每个位置选最高分的词表 ID。真实生成也可按概率采样。")),
 invert:def(I18n.t("反向投影"),[6],6,'invert',I18n.t("把特征乘 −1。它是本关用于调试的干扰组件。")),
 step:def(I18n.t("下一词模型"),[3],18,'decode',I18n.t("教学小模型：每个词的下一词分布由固定转移表计算。")),
 feedback:def(I18n.t("追加新词"),[3],3,'cache',I18n.t("将最新预测追加到上下文末尾，保留最后三个位置。")),
 load:def(I18n.t("读取权重"),[6],6,'storage',I18n.t("把权重从存储准备到统一内存，供后续计算重复读取。")),
 enembed:def('Embedding',[6],6,'embedding',I18n.t("读取词向量。在这个引擎关卡中输入已映射为两维特征。")),
 enqkv:def(I18n.t("QKV 投影"),[6],18,'attention',I18n.t("本关把三组投影作为一个调度任务，处理三个输入位置。")),
 enattn:def('Attention / KV',[18],6,'attention',I18n.t("按因果注意力汇合内容。解码时只为新位置计算 Q/K/V，旧 K/V 可缓存。")),
 enffn:def('SwiGLU FFN',[6],6,'ffn',I18n.t("对每个位置做两路投影、激活、门控和降维，再接回残差。")),
 enhead:def(I18n.t("词表与采样"),[6],6,'vocabulary',I18n.t("得到词表分数并取最高分；调度任务仍返回数值，结果区显示预测。"))
});
M.extraColors={embedding:0x7d9ea5,norm:0xb8a36a,q:0x789abf,k:0xa394bd,v:0x5da995,score:0x879bb3,mask:0xb4a27d,softmax:0xc9a068,ropeq:0x789abf,ropek:0xa394bd,aggregate:0x64a68f,output:0x6c9a92,attention:0x729ca3,residual1:0xc3a26f,ffnblock:0x9a94b4,residual2:0xc3a26f,lmhead:0xb79b6b,pick:0x639b7a,invert:0xb88475,step:0x7f9aa7,feedback:0xb49769,load:0xa8a18c,enembed:0x7d9ea5,enqkv:0x789abf,enattn:0xa394bd,enffn:0x5da995,enhead:0xb79b6b};
const next=[1,2,0,4,5,3];
M.operations={embedding:([ids])=>flat(ids.map(i=>{if(!emb[i])throw {message:I18n.t("词表中没有这个 ID。")};return emb[i];})),norm:([v])=>normalize(v),q:([x])=>mat(x,Wq),k:([x])=>mat(x,Wk),v:([x])=>mat(x,Wv),score:([q,k])=>scores(q,k),mask:([s])=>causal(s),softmax:([s])=>probabilities(s),ropeq:([q])=>rotate(q),ropek:([k])=>rotate(k),aggregate:([a,v])=>mix(a,v),output:([x])=>mat(x,Wo),attention:([x])=>attention(x),residual1:([a,b])=>a.map((x,i)=>x+b[i]),ffnblock:([x])=>ffn(x),residual2:([a,b])=>a.map((x,i)=>x+b[i]),lmhead:([x])=>logits(x),pick:([x])=>sample(x),invert:([x])=>x.map(n=>-n),step:([ids])=>flat(ids.map(i=>vocab.map((_,j)=>j===next[i]?4:-1))),feedback:([ids],ctx)=>[...ctx.input.slice(1),ids[2]],load:([x])=>x,enembed:([x])=>x,enqkv:([x])=>{const z=normalize(x);return [...mat(z,Wq),...mat(z,Wk),...mat(z,Wv)];},enattn:([x])=>mat(mix(probabilities(causal(scores(rotate(x.slice(0,6)),rotate(x.slice(6,12))))),x.slice(12,18)),Wo),enffn:([x])=>x.map((v,i)=>v+ffn(x)[i]),enhead:([x])=>x};
const sequenceSamples=[{word:I18n.t("我 / 爱 / 猫"),v:[1,0,0,1,1,1]},{word:I18n.t("你 / 恨 / 狗"),v:[-1,0,0,-1,-1,-1]},{word:I18n.t("猫 / 我 / 爱"),v:[1,1,1,0,0,1]}];
const idSamples=[{word:I18n.t("我 / 爱 / 猫"),v:[0,1,2]},{word:I18n.t("你 / 恨 / 狗"),v:[3,4,5]},{word:I18n.t("猫 / 我 / 爱"),v:[2,0,1]}];
const extra={};
function add(id,number,title,nodes,mission,description,options={}){
 const count=nodes.length,positions={};
 nodes.forEach((k,i)=>{positions[k]=count<=3?[(i-(count-1)/2)*3.5,0]:count<=6?[-4.5+(i%3)*4.3,Math.floor(i/3)*4-2]:[-5.5+(i%4)*3.4,Math.floor(i/4)*3.5-2.6];});
 extra[id]={id,chapter:I18n.t("网络 / ")+String(number).padStart(2,'0'),title,nodes,sources:['R'],sourceDim:6,sinkDim:6,sampleCount:3,sequence:true,sourceX:-8.8,sinkX:9,zoom:1.07,boardWidth:23,boardDepth:11,positions,mission,description,summary:description,concept:title,sourceTitle:I18n.t("输入特征 X"),sourceNote:I18n.t("三个输入位置各有一份特征"),outputTitle:I18n.t("结果特征"),shape:'3 × 2',boardText:'NETWORK / '+String(number).padStart(2,'0'),next:null,hints:[I18n.t("双击组件查看输入、输出与计算。试跑后，出口才会比较实际值与目标值。")],...options};
}
add('embedding',1,I18n.t("从词到向量"),['embedding'],I18n.t("让 ID 查到自己的向量"),I18n.t("从六词小词表中取出对应向量。编号只是地址，不能把编号直接当成特征。"),{sourceDim:3,sinkDim:6,sourceTitle:'Token ID',sourceNote:I18n.t("词表编号：0 至 5"),outputTitle:I18n.t("词向量 X"),shape:I18n.t("3 个 ID → 3 × 2")});
add('normalize',2,I18n.t("先整理数值尺度"),['norm'],I18n.t("让每个向量的均方根接近 1"),I18n.t("向量维度不变，三个输入位置的数值尺度统一。这里的 RMSNorm 缩放权重为 1。"),{initialSink:'R',outputTitle:I18n.t("归一化特征 Z")});
add('qkv',3,I18n.t("同一份输入，三个角色"),['q','k','v'],I18n.t("把内容向量送到出口"),I18n.t("Q 用来发起查询，K 用来匹配，V 提供内容。本关目标是 V；三块权重各不相同。"),{initialLinks:{q:['R'],k:['R'],v:['R']},initialSink:'q',outputTitle:I18n.t("内容 V")});
add('scores',4,I18n.t("查询在找谁"),['q','k','score'],I18n.t("得到每个 Q 对每个 K 的分数"),I18n.t("将三个位置的 Q 分别与三个位置的 K 配对，算出九个相关分数。输入口顺序是 Q、K。"),{initialLinks:{q:['R'],k:['R']},sinkDim:9,outputTitle:I18n.t("相关分数 S"),shape:'3 × 2 → 3 × 3'});
add('causal',5,I18n.t("不要偷看未来"),['q','k','score','mask','softmax'],I18n.t("让未来位置的注意力为零"),I18n.t("一次处理整句时，第一个位置也不能读取后面的词。让每个位置只分配权重给自己和过去。"),{initialLinks:{q:['R'],k:['R'],score:['q','k'],softmax:['score']},initialSink:'softmax',sinkDim:9,outputTitle:I18n.t("注意力权重 A"),shape:'3 × 3',attentionReadout:true});
add('rope',6,I18n.t("让位置进入匹配"),['q','k','ropeq','ropek','score'],I18n.t("位置变了，匹配分数也要变"),I18n.t("在点积前给 Q 和 K 注入位置。每个位置的向量旋转自己的角度；不要旋转 V。本例每个位置增加 1 弧度。"),{initialLinks:{q:['R'],k:['R'],score:['q','k']},initialSink:'score',sinkDim:9,outputTitle:I18n.t("带位置的分数"),shape:'3 × 2 → 3 × 3'});
add('attention',7,I18n.t("把关注变成内容"),['q','k','v','ropeq','ropek','score','mask','softmax','aggregate','output'],I18n.t("完成一次因果 Attention"),I18n.t("把前面的小计算连起来，用注意力权重混合 V，再经输出投影。权重表示信息来源比例，不等同于完整的语言理解。"),{initialLinks:{q:['R'],k:['R'],v:['R'],ropeq:['q'],ropek:['k'],score:['ropeq','ropek'],mask:['score']},attentionReadout:true,zoom:1.22,boardWidth:26,boardDepth:14,sourceX:-10.3,sinkX:10.3});
add('block',8,I18n.t("让一层接起来"),['norm','attention','residual1','ffnblock','residual2'],I18n.t("Attention 与 FFN 都要接回原路"),I18n.t("用已经完成的模块搭一层。Attention 先接收归一化输入，FFN 模块内部已含自己的归一化。两次残差要找对各自的原输入。"),{initialLinks:{norm:['R'],attention:['norm']},outputTitle:I18n.t("本层特征 Y")});
add('vocabulary',9,I18n.t("让特征真正变成词"),['lmhead','pick','invert'],I18n.t("让词表分数读出「我爱猫」"),I18n.t("这一关才把特征变成文字。词表投影为每个候选词算分，取最高分。改变特征会改变文字；词一样也不保证全部数值正确。"),{initialLinks:{invert:['R'],lmhead:['invert'],pick:['lmhead']},initialSink:'pick',sinkDim:3,outputTitle:I18n.t("预测 Token ID"),shape:'3 × 2 → 3 × 6 → 3',tokenOutput:true});
add('autoregressive',10,I18n.t("把刚生成的词送回来"),['step','pick','feedback'],I18n.t("让上下文前进一步"),I18n.t("小模型已为下一词算分。输出应是追加新词后的最后三个位置，而不是三个独立预测。连续试跑可以看见解码循环。"),{sourceDim:3,initialLinks:{step:['R'],pick:['step']},initialSink:'pick',sinkDim:3,outputTitle:I18n.t("更新后的上下文"),shape:I18n.t("上下文 → 下一词 → 追加"),tokenOutput:true});
const engineNodes=['load','enembed','enqkv','enattn','enffn','enhead'];
const engineBase={engine:true,sequence:true,initialLinks:serial(engineNodes),initialSink:'enhead',devices:{load:'cpu',enembed:'cpu',enqkv:'gpu',enattn:'gpu',enffn:'gpu',enhead:'cpu'},settings:{},sampleCount:3,boardWidth:25,boardDepth:13,zoom:1.2,sourceX:-10.5,sinkX:10.5,outputTitle:I18n.t("输出特征 / 预测词"),sourceTitle:I18n.t("提示词特征"),sourceNote:I18n.t("调度不同，计算目标相同"),shape:'CPU · GPU · ANE',tokenReadout:true};
function engine(id,num,title,mission,description,options){add(id,num,title,engineNodes,mission,description,{...engineBase,...options});extra[id].chapter=I18n.t("番外 / ")+String(num).padStart(2,'0');extra[id].boardText='ENGINE / '+String(num).padStart(2,'0');}
engine('placement',1,I18n.t("把工作交给合适的芯片"),I18n.t("结果正确，模拟首词 ≤ 110 ms"),I18n.t("拖动组件上方的芯片标记，把任务放到 CPU、GPU 或 ANE 区域。不能只看峰值速度，还要看算子支持与交接。"),{controls:[],settings:{batch:16,layout:'channels',precision:8,cache:true,fusion:true,resident:true,prefix:false,split:0},limits:{ttft:110},devices:Object.fromEntries(engineNodes.map(k=>[k,'cpu']))});
engine('layout',2,I18n.t("让 ANE 读懂布局"),I18n.t("编译成功，模拟首词 ≤ 110 ms"),I18n.t("ANE 上的投影采用通道在前的四维布局。形状相同不等于内存排列相同；布局不兼容会回退或无法编译。"),{controls:['layout'],devices:{...engineBase.devices,enqkv:'ane',enffn:'ane'},settings:{batch:16,layout:'sequence',precision:8,cache:true,fusion:true,resident:true,split:0},limits:{ttft:110,aneMin:10}});
engine('batching',3,I18n.t("一次喂饱矩阵单元"),I18n.t("首词 ≤ 105 ms，临时内存 ≤ 650 MB"),I18n.t("Prefill 可把多个位置一起算。调节每批位置数：太小要反复派发，太大会占用更多临时内存。"),{controls:['batch'],devices:{...engineBase.devices,enqkv:'ane',enffn:'ane'},settings:{batch:1,layout:'channels',precision:8,cache:true,fusion:true,resident:true,split:0},limits:{ttft:105,scratch:650,aneMin:10}});
engine('kv-cache',4,I18n.t("过去的 K/V 留下来"),I18n.t("解码 ≥ 45 token/s，输出必须一致"),I18n.t("每次只生成一个新词。保留旧 K/V，就不必为整段上下文重算投影；查询依然需要读取历史 K/V。"),{controls:['cache'],settings:{batch:16,layout:'channels',precision:8,cache:false,fusion:true,resident:true,split:0},limits:{tps:45}});
engine('quantization',5,I18n.t("把权重装进内存"),I18n.t("权重与 KV ≤ 24 GB，误差 ≤ 0.30"),I18n.t("调节权重精度，实际对教学权重做量化并比较误差。降低位数能减少读权重的带宽与容量，但可能改变词表排名。"),{controls:['precision','context'],settings:{batch:16,layout:'channels',precision:16,cache:true,fusion:true,resident:true,split:0,context:2048},limits:{memory:24,error:.30}});
engine('fusion',6,I18n.t("少落地一次中间结果"),I18n.t("总时间 ≤ 180 ms，交接 ≤ 14 ms"),I18n.t("把连续任务放在合适的芯片上，并融合激活与门控。统一内存也有读写、同步和布局转换成本。"),{controls:['fusion','resident'],settings:{batch:16,layout:'channels',precision:8,cache:true,fusion:false,resident:false,split:0},limits:{total:180,transfer:14}});
engine('parallel',7,I18n.t("GPU 与 ANE 一起工作"),I18n.t("首词 ≤ 78 ms，ANE 工作占比 ≥ 20%"),I18n.t("调整 Prefill 中投影与 FFN 的 ANE 分担比例。过少会闲置 ANE，过多可能让 GPU 等待；同步也花时间。"),{controls:['split','batch'],settings:{batch:16,layout:'channels',precision:8,cache:true,fusion:true,resident:true,split:0},limits:{ttft:78,aneMin:20}});
engine('session',8,I18n.t("下一轮不用从头读"),I18n.t("第二轮首词 ≤ 60 ms，内存 ≤ 24 GB"),I18n.t("两轮提示共用一段前缀。复用匹配的前缀状态，只计算新增部分；更长上下文会增加 KV 内存。"),{controls:['prefix','context','precision'],settings:{batch:16,layout:'channels',precision:8,cache:true,fusion:true,resident:true,split:40,prefix:false,context:2048},limits:{second:60,memory:24,error:.30}});
engine('capstone',9,I18n.t("让引擎真的跑得动"),I18n.t("通过两种负载的验收"),I18n.t("长提示和多轮长上下文都要通过。检查正确性、内存、首词与解码速度；完成后可继续试更快的方案。"),{controls:['layout','batch','cache','precision','fusion','resident','split','prefix','context'],settings:{batch:1,layout:'sequence',precision:16,cache:false,fusion:false,resident:false,split:0,prefix:false,context:2048},limits:{ttft:110,tps:45,memory:24,error:.30,second:65,aneMin:15,scratch:650},workloads:[{prompt:128,context:2048},{prompt:256,context:4096}],devices:Object.fromEntries(engineNodes.map(k=>[k,'cpu']))});
const rationales={
 embedding:{
  title:I18n.t("为什么编号要换成向量？"),
  text:I18n.t("Token ID 只是查表地址，编号相邻不代表含义相近。词向量表把编号换成可参与矩阵计算的特征，后面的层才能处理这些特征之间的关系。"),
  takeaway:I18n.t("真实词向量来自训练；这里的六个向量用于演示查表，不代表已经学会这些词的含义。")
 },
 normalize:{
  title:I18n.t("为什么要整理数值尺度？"),
  text:I18n.t("层层变换可能让向量的数值尺度差异很大，影响后续计算的稳定性。RMSNorm 按每个向量自己的均方根缩放，为后续投影提供较一致的数值尺度。"),
  takeaway:I18n.t("例如 [3, 4] 除以 √((9 + 16) / 2)，约为 [0.85, 1.13]。特征间的比例保留，整体尺度得到调整。")
 },
 qkv:{
  title:I18n.t("为什么同一份输入要分成 Q/K/V？"),
  text:I18n.t("两个位置如何匹配，和匹配后传递哪些内容，需要不同的特征表示。Q/K 用来比较，V 则提供真正要汇入的内容；三套权重可以分别学习这两种用途。"),
  takeaway:I18n.t("给某个位置很高的注意力权重时，汇入的是它的 V。Q/K 的数参与计算权重，不直接充当这份内容。")
 },
 scores:{
  title:I18n.t("为什么先算匹配分数？"),
  text:I18n.t("当前位置需要决定从哪些位置取信息。它的 Q 与各位置的 K 做点积，得到一组随输入变化的匹配分数，为后面的权重分配提供依据。"),
  takeaway:I18n.t("点积再除以 √维度，控制高维点积的尺度，避免 Softmax 过度集中。分数可以为负，还不是概率。")
 },
 causal:{
  title:I18n.t("为什么不能读取未来的词？"),
  text:I18n.t("生成下一个词时，模型只有已经出现的内容。即使训练或 Prefill 一次处理整段文本，每个位置也要遵守同样的限制，否则会用到生成时尚不存在的信息。"),
  takeaway:I18n.t("在“我 / 爱 / 猫”中，“爱”这个位置可以参考“我”和自己。未来的“猫”被遮住，经过 Softmax 后其权重为 0。")
 },
 rope:{
  title:I18n.t("为什么位置会影响匹配？"),
  text:I18n.t("单看 Q/K 的点积，分数取决于特征本身，没有直接表示两个位置相隔多远。按位置同时旋转 Q 和 K，让点积包含相对位置的信息，为注意力提供词序线索。"),
  takeaway:I18n.t("相隔一格和两格，旋转角度差不同，匹配分数也可能不同。本关用一对特征演示；真实 RoPE 在多对特征上使用不同频率。")
 },
 attention:{
  title:I18n.t("为什么算完权重还要汇合 V？"),
  text:I18n.t("注意力权重决定各位置的信息占比，但权重本身还不是新的词特征。按这些比例加权 V，当前位置才真正得到其他位置带来的内容。"),
  takeaway:I18n.t("例如权重 [0.2, 0.8, 0] 表示取第一份 V 的 20%、第二份的 80%。输出投影再把汇合结果转换成下一步需要的特征表示。")
 },
 block:{
  title:I18n.t("为什么一层里要有两种加工？"),
  text:I18n.t("Attention 负责位置之间的信息交流，FFN 负责加工各个位置已有的特征。两者产生的修改量通过残差累积到当前表示上，形成可以交给下一层的新特征。"),
  takeaway:I18n.t("第二次残差以 Attention 更新后的特征为基础。如果又接回最早的输入，就会漏掉前一步已经加入的修改。")
 },
 vocabulary:{
  title:I18n.t("为什么最后还要经过词表？"),
  text:I18n.t("网络里流动的是特征向量，文字要在输出端通过词表读出。词表投影把特征换成每个候选 token 的分数，再由选词规则决定输出哪个。"),
  takeaway:I18n.t("本关总选最高分，用来观察特征如何改变文字。真实生成也可以按概率采样，因此同一组分数不一定每次选出同一个词。")
 },
 autoregressive:{
  title:I18n.t("为什么生成的词要送回来？"),
  text:I18n.t("下一词的预测依赖当前上下文，而刚生成的词会成为下一次预测的条件。把新词追加回来，模型才能继续生成句子。"),
  takeaway:I18n.t("首次处理提示词称为 Prefill；随后反复预测并追加一个新词，就是 Decode。本关用三词窗口和固定转移规则演示这个循环。")
 },
 placement:{
  title:I18n.t("为什么不能全交给最快的芯片？"),
  text:I18n.t("一次推理既有矩阵运算，也有取数、控制和设备交接。把某一步交给更快的单元，收益可能被派发与同步抵消，所以要比较完整链路的首词时间。"),
  takeaway:I18n.t("本关把 CPU、GPU、ANE 的算子支持和交接成本分别计入，让你比较不同分工带来的总耗时。")
 },
 layout:{
  title:I18n.t("为什么形状对了还不够？"),
  text:I18n.t("算子会按约定的轴和内存顺序读取张量。布局不匹配时，即使元素数量相同，也可能需要重排数据、换算子或回退，增加开销。"),
  takeaway:I18n.t("本关用 B/C/1/S 演示 ANE 投影适配。相邻算子采用兼容的布局，才有机会省去反复转换，让加速单元真正用起来。")
 },
 batching:{
  title:I18n.t("为什么 Prefill 可以成批计算？"),
  text:I18n.t("提示词的各个位置已经给定，投影可以让多个位置一起使用同一套权重。这样能复用权重、摊薄派发成本，提高矩阵单元的利用率。"),
  takeaway:I18n.t("批次越大，同时存放的中间特征也越多。本关需要在减少派发次数和控制临时内存之间取舍。")
 },
 'kv-cache':{
  title:I18n.t("为什么过去的 K/V 可以复用？"),
  text:I18n.t("因果注意力中，追加一个词不会改变过去位置已经算出的 K/V。把它们缓存起来，每步只补新位置，就能避免重复投影整段历史。"),
  takeaway:I18n.t("新 Q 仍要读取历史 K/V 来取信息；缓存节省的是重复计算，同时占用内存。这是用空间换解码速度。")
 },
 quantization:{
  title:I18n.t("为什么降低位数能省内存？"),
  text:I18n.t("27B 个权重仅按 16 位存放，就约需 54 GB，还没计入 K/V 和运行空间。用更少的位数表示权重，能减少存储容量和读取它们的数据量。"),
  takeaway:I18n.t("可表示的数值变少，就需要舍入。误差会传到后续计算，甚至改变候选词的排名，所以省内存的同时还要检查输出误差。")
 },
 fusion:{
  title:I18n.t("为什么少写一次内存也能更快？"),
  text:I18n.t("激活和门控分开执行时，前一步写出的中间结果需要被下一步重新读取。融合执行可以减少这些写回、读取和派发，即使乘加次数相近也可能更快。"),
  takeaway:I18n.t("权重驻留则省去反复从存储加载的开销。它保留的是内存中的权重，每一步计算仍然要读取这些权重。")
 },
 parallel:{
  title:I18n.t("为什么两块芯片一起做未必最快？"),
  text:I18n.t("可拆分的投影或 FFN 工作能交给 GPU 和 ANE 并行完成。但后续步骤要等两边都结束；分配不均时，快的一边会空等，同步还会额外花时间。"),
  takeaway:I18n.t("比较分担比例时，要看两边各自的完成时间和交接成本。ANE 工作占比变高，并不自动意味着首词更快。")
 },
 session:{
  title:I18n.t("为什么新一轮能接着上次算？"),
  text:I18n.t("多轮提示常有相同的开头。模型、token 前缀和位置一致时，已有的前缀 K/V 可以继续使用，新一轮就能省去这部分 Prefill。"),
  takeaway:I18n.t("这把生成过程中的 K/V 复用延伸到多轮请求。保留更长前缀需要更多 K/V 内存，第二轮更快也必须装得下。")
 },
 capstone:{
  title:I18n.t("为什么要用两种负载验收？"),
  text:I18n.t("长提示更考验 Prefill，多轮长上下文更考验 K/V 容量和复用。只在一种输入上表现好的配置，换一种负载就可能变慢或超出内存。"),
  takeaway:I18n.t("首词时间、逐词速度、内存和误差需要一起检查。每项优化都有代价，完整引擎要让这些约束在两种负载下同时成立。")
 }
};
for(const [id,rationale]of Object.entries(rationales)){
 if(extra[id].engine)rationale.scope=I18n.t("耗时、内存和芯片支持范围采用教学模型，用于比较方案，不是设备实测。");
 extra[id].rationale=rationale;
}
Object.assign(M.levels,extra);
for(const [id,maxModules]of [['ffn',8],['attention',12],['block',7]]){
 const level=M.levels[id];level.buildable=true;level.maxModules=maxModules;
 level.inventory=Object.fromEntries(level.nodes.map(kind=>[kind,2]));
}
// Combine the two formerly identical stocks without reducing existing circuits' capacity.
M.levels.ffn.inventory.project=4;
M.routes={main:{name:I18n.t("主线 · Transformer"),description:I18n.t("从向量与矩阵开始，亲手搭出 Attention、FFN 和逐词生成。"),ids:Object.keys(M.levels).filter(id=>!M.levels[id].engine)},engine:{name:I18n.t("番外 · 端侧推理"),description:I18n.t("以 Qwen 27B、Kapitsa 与 Apple ANE 为背景的独立挑战，使用教学成本模型。"),ids:Object.keys(M.levels).filter(id=>M.levels[id].engine)}};
for(const [track,route]of Object.entries(M.routes))route.ids.forEach((id,i)=>{M.levels[id].track=track;M.levels[id].next=route.ids[i+1]||null;});
M.samplesFor=id=>M.levels[id]?.sequence?(M.levels[id].sourceDim===3?idSamples:sequenceSamples):M.samples;
const oldReference=M.reference;
M.reference=(v,id)=>{
 if(!extra[id])return oldReference(v,id);
 const q=mat(v,Wq),k=mat(v,Wk),vv=mat(v,Wv);
 if(id==='embedding')return flat(v.map(i=>emb[i]));
 if(id==='normalize')return normalize(v);
 if(id==='qkv')return vv;
 if(id==='scores')return scores(q,k);
 if(id==='causal')return probabilities(causal(scores(q,k)));
 if(id==='rope')return scores(rotate(q),rotate(k));
 if(id==='attention')return attention(v);
 if(id==='block')return block(v);
 if(id==='vocabulary')return decode(v);
 if(id==='autoregressive')return [...v.slice(1),next[v[2]]];
 if(M.levels[id].engine){const a=attention(normalize(v));return a.map((x,i)=>x+ffn(a)[i]);}
 throw new Error('Unknown level '+id);
};
// Incremental attention caches only K and V. Absolute position keeps RoPE consistent.
M.cachedAttention=(input,useCache=true)=>{
 const {rows}=M.math;let keys=[],values=[],processed=0,outputs=[];
 rows(input).forEach((row,p)=>{
  const rotation=(a,pos)=>[a[0]*Math.cos(pos)-a[1]*Math.sin(pos),a[0]*Math.sin(pos)+a[1]*Math.cos(pos)];
  const history=rows(input).slice(0,p+1);
  if(useCache){keys.push(rotation(M.linear(row,Wk),p));values.push(M.linear(row,Wv));processed++;}
  else{keys=history.map((r,j)=>rotation(M.linear(r,Wk),j));values=history.map(r=>M.linear(r,Wv));processed+=history.length;}
  const q=rotation(M.linear(row,Wq),p),a=softmax(keys.map(k=>(q[0]*k[0]+q[1]*k[1])/Math.sqrt(2)));
  outputs.push(M.linear([0,1].map(j=>a.reduce((sum,w,i)=>sum+w*values[i][j],0)),Wo));
 });return {output:outputs.flat(),processed,keys,values};
};
M.readTokens=v=>I18n.joinWords(v.map(i=>vocab[i]??'?'));
M.rollout=(state,input,count=6)=>{let context=[...input],trace=[];for(let i=0;i<count;i++){const ev=M.evaluate(state,context);if(ev.error||!ev.output)return {trace,error:ev.error||I18n.t("没有得到新上下文")};const token=ev.output[2];trace.push({context:[...context],token,next:[...ev.output]});context=ev.output;}return {trace,text:I18n.joinWords([...input.map(i=>vocab[i]),...trace.map(t=>vocab[t.token])])};};
M.decodeFeatures=v=>M.readTokens(decode(v));
M.attentionWeights=ev=>ev.values.softmax||null;
M.extraCard=(id)=>{const d=M.definitions[id];if(!d)return null;return {number:'',seal:d.name[0],english:id.toUpperCase(),family:I18n.t("计算组件"),color:'#477f78',ability:d.name,formula:{q:'Q = XWq',k:'K = XWk',v:'V = XWv',score:'S = QKᵀ / √2',mask:'S[i,j] = −∞  (j > i)',softmax:'Aᵢ = exp(Sᵢ) / Σ exp(Sⱼ)',ropeq:'Q[p] ← R(p) Q[p]',ropek:'K[p] ← R(p) K[p]',aggregate:'O = AV',norm:'x / √(mean(x²) + ε)',output:'O ← OWo',lmhead:I18n.t("L = XW词表 + b"),pick:'token = argmax(L)',invert:'Y = −X',residual1:'R = X + Attention(Norm(X))',residual2:'Y = R + FFN(R)',embedding:'X[p] = E[token_id[p]]'}[id]||I18n.t("输入 → ")+d.name+I18n.t(" → 输出"),meaning:d.hint,purpose:I18n.t("这里展示的是教学缩尺计算。接线决定数据来源，运行轨迹由实际计算得到。"),weight:M.weights[id]?M.weights[id].length+' × '+M.weights[id][0].length:I18n.t("无 / 已封装"),trait:extra[id]?.engine?I18n.t("调度任务"):I18n.t("数值计算"),stage:0};};
M.extraExample=(id,levelId)=>{if(!M.operations[id])return null;const s=M.solutions(levelId),ev=M.evaluate(s,M.samplesFor(levelId)[0].v),n=s.nodes.find(n=>n.id===id);if(!n)return null;return {inputs:n.links.map((k,i)=>[I18n.t("输入 ")+(i+1),ev.values[k]||[]]),output:[I18n.t("结果"),ev.values[id]||[]]};};
// Reference circuits are for automated verification only, never auto-filled by UI.
M.solutions=id=>{const s=M.initial(id,{complete:true}),links={workshop:{project:['R'],sink:'project'},
 wire:{sink:'R'},projection:{project:['R'],sink:'project'},activation:{project:['R'],silu:['project'],sink:'silu'},
 gating:{gate:['R'],project:['R'],silu:['gate'],multiply:['silu','project'],sink:'multiply'},residual:{project:['R'],down:['project'],add:['R','down'],sink:'add'},ffn:{gate:['Z'],project:['Z'],silu:['gate'],multiply:['silu','project'],down:['multiply'],add:['R','down'],sink:'add'},
 embedding:{embedding:['R'],sink:'embedding'},normalize:{norm:['R'],sink:'norm'},qkv:{q:['R'],k:['R'],v:['R'],sink:'v'},scores:{q:['R'],k:['R'],score:['q','k'],sink:'score'},
 causal:{q:['R'],k:['R'],score:['q','k'],mask:['score'],softmax:['mask'],sink:'softmax'},rope:{q:['R'],k:['R'],ropeq:['q'],ropek:['k'],score:['ropeq','ropek'],sink:'score'},
 attention:{q:['R'],k:['R'],v:['R'],ropeq:['q'],ropek:['k'],score:['ropeq','ropek'],mask:['score'],softmax:['mask'],aggregate:['softmax','v'],output:['aggregate'],sink:'output'},
 block:{norm:['R'],attention:['norm'],residual1:['R','attention'],ffnblock:['residual1'],residual2:['residual1','ffnblock'],sink:'residual2'},
 vocabulary:{lmhead:['R'],pick:['lmhead'],invert:['R'],sink:'pick'},autoregressive:{step:['R'],pick:['step'],feedback:['pick'],sink:'feedback'}};
 const l=links[id]||{...serial(engineNodes),sink:'enhead'};
 for(const n of s.nodes)n.links=l[n.id]||n.links;s.sink=l.sink;return s;
};
M.math={rows,mat,rotate,scores,causal,probabilities,mix,logits,decode,normalize,attention,block,emb,vocab};
})(window.NeuralPrologue);
