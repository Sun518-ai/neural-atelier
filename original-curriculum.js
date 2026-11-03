/* Original Transformer first. Existing modern circuits keep their IDs and arithmetic. */
(function(M){
// Keep each new lesson's English copy next to its Chinese source.
const L=(zh,en)=>{globalThis.AtelierEnglish[zh]=en;return I18n.t(zh);};
L('原版基础','Original');L('现代扩展','Modern');L('源序列','Source sequence');L('目标前缀','Target prefix');
L('3 个位置 × 4 个特征','3 positions × 4 features');
L('这里只展开第一个位置的归一化，其他位置分别计算。','The calculation below expands the first position; other positions are normalized independently.');
L('残差相加结果','Residual sum');
const {rows,mat,scores,probabilities,mix,causal}=M.math,flat=x=>x.flat(),plus=(a,b)=>a.map((x,i)=>x+b[i]);
const relu=x=>Math.max(0,x),eps=1e-6;
const wide={
 q:[[1,.2,0,-.1],[.1,1,.3,0],[.2,-.1,.8,.1],[0,.2,.1,1]],
 k:[[.8,0,.1,-.2],[-.1,1,.2,.1],[.3,.1,1,0],[0,-.2,.1,.9]],
 v:[[1,.1,0,.2],[0,.9,.2,0],[.1,0,.8,.1],[-.2,.1,0,1]],
 output:[[.9,.1,0,.1],[-.1,.8,.2,0],[.2,0,.9,-.1],[0,.1,.2,.8]],
 up:[[1,0,0,.5,1,-.5,.2,.4],[0,1,.5,0,.2,1,-.3,.1],[.2,0,1,-.2,.5,.2,1,-.3],[0,.3,-.2,1,-.1,.5,.2,1]],
 down:[[.4,0,.1,0],[0,.3,0,.1],[.1,.1,.4,0],[-.1,.2,.1,.3],[.2,.1,-.1,.2],[0,.2,.1,-.1],[.1,-.2,.3,.1],[-.1,.1,0,.2]],
 embedding:[[1,0,.3,-.4],[0,1,-.2,.5],[1,1,.4,.2],[-1,0,-.3,.4],[0,-1,.2,-.5],[-1,-1,-.4,-.2]],
 vocabulary:[[1,0,1,-1,0,-1],[0,1,1,0,-1,-1],[.3,-.2,.1,-.3,.2,-.1],[-.1,.3,.2,.1,-.3,-.2]]
};
const project=(v,w)=>flat(rows(v,w.length).map(r=>M.linear(r,w)));
function ln(v){const mean=v.reduce((a,b)=>a+b,0)/v.length,variance=v.reduce((s,x)=>s+(x-mean)**2,0)/v.length;return v.map(x=>(x-mean)/Math.sqrt(variance+eps));}
const lnSequence=v=>flat(rows(v,v.length/3).map(ln));
const classicFFN=v=>M.linear(M.linear(v,v.length===4?wide.up:M.weights.project).map(relu),v.length===4?wide.down:M.weights.down);
const sequenceFFN=v=>flat(rows(v,v.length/3).map(classicFFN));
const position=v=>{const width=v.length/3;return flat(rows(v,width).map((r,p)=>r.map((x,j)=>Math.sqrt(width)*x+(j%2?Math.cos:Math.sin)(p/10000**(2*Math.floor(j/2)/width)))));};
const embed=(ids,width=2)=>flat(ids.map(i=>(width===4?wide.embedding:M.math.emb)[i]));
const unmaskedWeights=x=>probabilities(scores(mat(x,M.weights.q),mat(x,M.weights.k)));
const scoreWide=(q,k)=>flat(rows(q,4).map(a=>rows(k,4).map(b=>a.reduce((s,x,i)=>s+x*b[i],0)/2)));
const mixWide=(a,v)=>flat(rows(a,3).map(r=>[0,1,2,3].map(j=>r.reduce((s,p,i)=>s+p*rows(v,4)[i][j],0))));
const vocabulary=v=>flat(rows(v,4).map(r=>M.linear(r,wide.vocabulary).map((x,i)=>x+[0,0,-.75,0,0,-.75][i])));
const singleAttention=(qSource,kvSource=qSource)=>qSource.length===12?project(mixWide(probabilities(scoreWide(project(qSource,wide.q),project(kvSource,wide.k))),project(kvSource,wide.v)),wide.output):mat(mix(probabilities(scores(mat(qSource,M.weights.q),mat(kvSource,M.weights.k))),mat(kvSource,M.weights.v)),M.weights.output);
function head(qSource,kvSource,index,masked=false){
 const width=qSource.length/3,headWidth=width/2,w=width===4?wide:M.weights;
 const split=(v,m)=>rows(project(v,m),width).map(r=>r.slice(index*headWidth,(index+1)*headWidth)),q=split(qSource,w.q),k=split(kvSource,w.k),v=split(kvSource,w.v);
 const s=flat(q.map(a=>k.map(b=>a.reduce((sum,x,j)=>sum+x*b[j],0)/Math.sqrt(headWidth)))),a=rows(probabilities(masked?causal(s):s),3);
 return flat(a.map(row=>Array.from({length:headWidth},(_,j)=>row.reduce((sum,p,i)=>sum+p*v[i][j],0))));
}
const concat=(a,b)=>flat(rows(a,a.length/3).map((r,i)=>[...r,...rows(b,b.length/3)[i]]));
const multi=(q,kv=q,masked=false)=>project(concat(head(q,kv,0,masked),head(q,kv,1,masked)),q.length===12?wide.output:M.weights.output);
function encoder(x){const a=lnSequence(plus(x,multi(x)));return lnSequence(plus(a,sequenceFFN(a)));}
function decoderSelf(x){return lnSequence(plus(x,multi(x,x,true)));}
function decoder(x,e){const a=decoderSelf(x),b=lnSequence(plus(a,multi(a,e)));return lnSequence(plus(b,sequenceFFN(b)));}
const sourceIds=[2,0,1],sourceFeatures=()=>position(embed(sourceIds,4)),memory=()=>encoder(sourceFeatures());
const def=(name,ins,out,type,hint,extra={})=>({name,ins,out,type,hint,x:0,z:0,...extra});
const labels={
 relu:L('ReLU · 负数归零','ReLU · zero negative values'),
 ln:L('LayerNorm · 减均值再缩放','LayerNorm · center and scale'),
 ffn:L('原版 FFN · ReLU','Original FFN · ReLU'),
 attn:L('双头自注意力','Two-head self-attention'),
 masked:L('双头因果注意力','Two-head masked attention'),
 cross:L('双头交叉注意力','Two-head cross-attention'),
 position:L('正弦位置编码','Sinusoidal positions')
};
const lnHint=L('每个 token 单独减去特征均值，再除以标准差。本例 γ = 1、β = 0；不会混合不同 token。','Center each token by its own feature mean, then divide by its standard deviation. Here γ = 1 and β = 0; different tokens are not mixed.');
const ffnHint=L('每个 token 分别经过 Linear → ReLU → Linear。两次投影的偏置在本例设为 0；内部没有门分支和归一化。','Each token follows Linear → ReLU → Linear. Both biases are zero in this example; there is no gate branch or normalization inside.');
const positionHint=L('原版先把词向量乘 √d_model，再加正弦/余弦位置编码。本例 d_model = 2，位置 p 加 [sin(p), cos(p)]。','The original scales embeddings by √d_model, then adds sinusoidal positions. Here d_model = 2, and position p adds [sin(p), cos(p)].');
const widePositionHint=L('四维词向量乘 √4，再加 [sin(p), cos(p), sin(p/100), cos(p/100)]。两对特征使用不同频率，仍是原版的相加位置编码。','Scale four-feature embeddings by √4, then add [sin(p), cos(p), sin(p/100), cos(p/100)]. The two pairs use different frequencies, still using the original additive encoding.');
Object.assign(M.definitions,{
 relu:def(labels.relu,[4],4,'activation',L('每个数计算 max(0, x)：负数变 0，正数保持原值。维度不变。','Apply max(0, x) to each value: negatives become zero and positives stay unchanged. Dimensions are preserved.'),{activation:'relu'}),
 layernorm2:def(labels.ln,[2],2,'layernorm',lnHint),
 'relu-ffn':def(labels.ffn,[2],2,'ffn',ffnHint,{glyphs:['W1','ReLU','W2']}),
 position:def(labels.position,[6],6,'position',positionHint),
 'original-weights':def(L('已学的打分与 Softmax','Scores and Softmax'),[6],9,'attention',L('把 Q/K 投影、缩放点积和 Softmax 封装起来。三个位置彼此可见，没有 RoPE 和因果遮罩。','Packages Q/K projections, scaled dot products and Softmax. All three positions are visible, without RoPE or a causal mask.')),
 'head-a':def(L('注意力头 A','Attention head A'),[6],3,'attention',L('用第一组 Q/K/V 权重各投影到一个特征，独立打分、Softmax 和汇合；每个位置输出一个数。','Use the first set of Q/K/V weights to project to one feature, then independently score, apply Softmax and aggregate. Outputs one value per position.'),{glyphs:['Q₁','K₁','V₁']}),
 'head-b':def(L('注意力头 B','Attention head B'),[6],3,'attention',L('用第二组 Q/K/V 权重做独立注意力。输入相同，权重不同，因此可以得到另一种信息组合。','Use a second set of Q/K/V weights for independent attention. The same input with different weights can yield a different combination of information.'),{glyphs:['Q₂','K₂','V₂']}),
 concat:def(L('按特征拼接','Concatenate features'),[3,3],6,'concat',L('把同一位置的头 A、头 B 输出并排放成两个特征。保留三个 token 的顺序，不相加、不把 token 接到序列尾部。','Place head A and head B side by side at each position. Keep token order; do not add the heads or append tokens to the sequence.')),
 'self-heads':def(labels.attn,[6],6,'attention',L('两个头分别计算 Q/K/V、缩放点积、Softmax 和汇合，再按特征拼接并乘 Wo。所有位置互相可见。','Two heads independently project Q/K/V, compute scaled scores, apply Softmax and aggregate, then concatenate features and apply Wo. All positions can see each other.')),
 'masked-heads':def(labels.masked,[6],6,'attention',L('双头注意力在 Softmax 前遮住未来位置。当前 token 只能读取自己和前面的目标 token。','Both heads mask future positions before Softmax. Each token may read only itself and earlier target tokens.'),{causal:true}),
 'cross-heads':def(labels.cross,[6,6],6,'attention',L('第一个输入提供解码器查询 Q，第二个输入提供编码器的 K 和 V。目标位置可读取完整源序列，无需遮住源序列的后面。','The first input supplies decoder queries Q; the second supplies encoder K and V. Every target position can read the whole source sequence without a future mask on the source.')),
 'ln-attn':def(L('Attention 后的 LayerNorm','LayerNorm after Attention'),[6],6,'layernorm',lnHint),
 'ln-ffn':def(L('FFN 后的 LayerNorm','LayerNorm after FFN'),[6],6,'layernorm',lnHint),
 'ln-cross':def(L('交叉注意力后的 LayerNorm','LayerNorm after cross-attention'),[6],6,'layernorm',lnHint),
 'original-ffn-block':def(labels.ffn,[6],6,'ffn',ffnHint,{glyphs:['W1','ReLU','W2']}),
 'cross-add':def(L('交叉注意力残差','Cross-attention residual'),[6,6],6,'residual',L('将交叉注意力得到的更新加回发起查询的解码器特征。不要加到编码器的源特征上。','Add the cross-attention update back to the decoder features that supplied the queries, not to the encoder source features.')),
 'original-encoder':def(L('已完成的原版编码器','Completed original encoder'),[6],6,'encoder',L('双头自注意力 → 残差相加 → LayerNorm → ReLU FFN → 残差相加 → LayerNorm。本例只用一层。','Two-head self-attention → residual addition → LayerNorm → ReLU FFN → residual addition → LayerNorm. This example uses one layer.')),
 'original-decoder':def(L('已完成的原版解码器','Completed original decoder'),[6,6],6,'decoder',L('目标输入先做因果自注意力，再以编码器输出为 K/V 做交叉注意力，最后经过 ReLU FFN。三段都先加残差，再做 LayerNorm。','The target first uses masked self-attention, then cross-attends to encoder K/V, then uses a ReLU FFN. Each sublayer adds its residual before LayerNorm.')),
 'source-embed':def(L('源词向量与位置','Source embeddings and positions'),[3],6,'position',positionHint),
 'target-embed':def(L('目标词向量与位置','Target embeddings and positions'),[3],6,'position',positionHint)
});
for(const id of ['self-heads','masked-heads','cross-heads','ln-attn','ln-ffn','ln-cross','original-ffn-block','cross-add','original-encoder','original-decoder']){
 const d=M.definitions[id];d.ins=d.ins.map(()=>12);d.out=12;
}
for(const id of ['source-embed','target-embed']){M.definitions[id].out=12;M.definitions[id].hint=widePositionHint;}
Object.assign(M.definitions,{
 'wide-embedding':def(L('词向量表 · 四维','Embedding table · four features'),[3],12,'embedding',L('同样是按 ID 查表，这次每个词取出四个特征。词的数量不变。','Look up each ID as before, now retrieving four features per token. The token count stays the same.')),
 'wide-position':def(labels.position,[12],12,'position',widePositionHint),
 'encoder-add':def(L('Attention 残差','Attention residual'),[12,12],12,'residual',L('把注意力更新加到当前子层输入，随后交给 LayerNorm。','Add the attention update to the current sublayer input, then send the sum to LayerNorm.')),
 'ffn-add':def(L('FFN 残差','FFN residual'),[12,12],12,'residual',L('将 FFN 更新加到进入 FFN 前的特征，随后交给 LayerNorm。','Add the FFN update to the features entering the FFN, then send the sum to LayerNorm.')),
 'original-score':def(L('QKᵀ · 四维打分','QKᵀ · four-feature scores'),[12,12],9,'score',L('每个四维 Q 与每个四维 K 点乘，再除以 √4。三个目标位置对三个源位置得到九个分数。','Dot each four-feature Q with each four-feature K and divide by √4. Three target positions against three source positions produce nine scores.')),
 'original-aggregate':def(L('AV · 汇合四维内容','AV · aggregate four-feature values'),[9,12],12,'mix',L('每个目标位置按三个注意力权重加权汇合源 V，保留四个输出特征。','Each target position uses its three attention weights to combine source V while retaining four output features.')),
 'original-head':def(L('词表投影 · 四维','Vocabulary projection · four features'),[12],18,'vocabulary',L('为每个目标位置的四维特征计算六个候选词分数，并加入固定偏置。','Compute six candidate-token scores from each target’s four features and add the fixed bias.'))
});
for(const [kind,name]of [['q',L('Q · 查询投影','Q · query projection')],['k',L('K · 键投影','K · key projection')],['v',L('V · 值投影','V · value projection')],['output',L('输出投影 Wo','Output projection Wo')]]){
 M.definitions['original-'+kind]=def(name,[12],12,'linear',L('每个位置的四个特征乘同一套 4 × 4 权重，产生四个新特征。不会在这里混合不同 token。','Each position’s four features use the same 4 × 4 weights to produce four new features. Tokens are not mixed by this projection.'));
 M.weights['original-'+kind]=wide[kind];
}
M.weights['original-head']=wide.vocabulary;
Object.assign(M.operations,{
 relu:([x])=>x.map(relu),layernorm2:([x])=>ln(x),'relu-ffn':([x])=>classicFFN(x),position:([x])=>position(x),
 'original-weights':([x])=>unmaskedWeights(x),'head-a':([x])=>head(x,x,0),'head-b':([x])=>head(x,x,1),concat:([a,b])=>concat(a,b),
 'self-heads':([x])=>multi(x),'masked-heads':([x])=>multi(x,x,true),'cross-heads':([q,kv])=>multi(q,kv),
 'ln-attn':([x])=>lnSequence(x),'ln-ffn':([x])=>lnSequence(x),'ln-cross':([x])=>lnSequence(x),
 'original-ffn-block':([x])=>sequenceFFN(x),'cross-add':([a,b])=>plus(a,b),
 'original-encoder':([x])=>encoder(x),'original-decoder':([x,e])=>decoder(x,e),
 'source-embed':([ids])=>position(embed(ids,4)),'target-embed':([ids])=>position(embed(ids,4)),
 'wide-embedding':([ids])=>embed(ids,4),'wide-position':([x])=>position(x),
 'encoder-add':([a,b])=>plus(a,b),'ffn-add':([a,b])=>plus(a,b),
 'original-score':([q,k])=>scoreWide(q,k),'original-aggregate':([a,v])=>mixWide(a,v),'original-head':([v])=>vocabulary(v),
 'original-q':([x])=>project(x,wide.q),'original-k':([x])=>project(x,wide.k),'original-v':([x])=>project(x,wide.v),'original-output':([x])=>project(x,wide.output)
});
const operatorIds=['relu','layernorm2','relu-ffn','position','original-weights','head-a','head-b','concat','self-heads','masked-heads','cross-heads','ln-attn','ln-ffn','ln-cross','original-ffn-block','cross-add','original-encoder','original-decoder','source-embed','target-embed','wide-embedding','wide-position','encoder-add','ffn-add','original-score','original-aggregate','original-head','original-q','original-k','original-v','original-output'];
for(const id of operatorIds){
 const d=M.definitions[id];M.extraColors[id]=({linear:0x789abf,score:0x879bb3,mix:0x64a68f,vocabulary:0xb79b6b,embedding:0x7d9ea5,activation:0xc6a574,layernorm:0xb8a36a,ffn:0x759c88,position:0xb49b6a,attention:0x789abf,concat:0x9b86b4,residual:0xc3a26f,encoder:0x6a9c93,decoder:0x9387ad})[d.type];
}
M.extraColors['head-b']=0xa394bd;
M.extraColors['original-k']=0xa394bd;M.extraColors['original-v']=0x5da995;
for(const id of ['mask','attention','attentionweights','enattn'])M.definitions[id].causal=true;
const zeroBias=L('使用原版的运算顺序；为了看清数值，特征宽度缩为 2、FFN 展开到 4，偏置设为 0。固定教学权重不代表训练好的语言模型。','Uses the original operation order with width 2, FFN width 4 and zero biases so the numbers are readable. Fixed teaching weights do not represent a trained language model.');
const scope=L('这是原版结构的缩尺推理：基础算子用两维，完整编码器和解码器用四维、两个头、一层；LayerNorm 的 γ = 1、β = 0，FFN 偏置为 0。省略训练和推理时关闭的 dropout，不复刻论文规模。','Scaled-down original inference: two features for basic operators, then four features, two heads and one layer for the encoder and decoder. LayerNorm uses γ = 1 and β = 0, and FFN biases are zero. Training and inference-disabled dropout are omitted; the paper’s scale is not reproduced.');
const added={},solutions={},references={};
function lesson(id,title,nodes,mission,description,why,takeaway,links,reference,options={}){
 const scalar=options.scalar,count=nodes.length;
 added[id]={id,title,nodes,sources:['R'],sourceDim:scalar?2:6,sinkDim:scalar?2:6,sampleCount:scalar?5:3,sequence:!scalar,
  sourceX:count>6?-10.3:-8.8,sinkX:count>6?10.3:9,zoom:count>6?1.22:1.07,boardWidth:count>6?26:23,boardDepth:count>6?14:11,
  sourceTitle:scalar?I18n.t('输入 X'):I18n.t('输入特征 X'),sourceNote:'',outputTitle:I18n.t('结果特征'),shape:scalar?'2 → 2':'3 × 2',
  mission,description,summary:description,concept:title,hints:[],rationale:{title:L('为什么需要这一步？','Why is this step needed?'),text:why,takeaway,scope:scalar?zeroBias:scope},...options};
 solutions[id]=links;references[id]=reference;
}
lesson('relu',L('让负数停在零','Stop negative values at zero'),['project','relu'],
 L('让四个投影特征经过 ReLU','Apply ReLU to four projected features'),
 L('连起投影和 ReLU，让每个负数变为 0，正数保持原值。五组输入都要匹配。','Wire the projection and ReLU so negative values become zero and positive values stay unchanged. Match all five inputs.'),
 L('连续两次线性投影可合并成一块矩阵：(XW1)W2 = X(W1W2)。ReLU 按输入的正负选择性地归零，使整个变换通常无法再合并成固定矩阵。','Two linear projections collapse into one matrix: (XW1)W2 = X(W1W2). ReLU selectively zeros values according to their sign, so the complete transformation generally cannot collapse into one fixed matrix.'),
 L('例如 [2, −3, 0, 1] 变成 [2, 0, 0, 1]。这是 2017 年原版 FFN 使用的激活；此时没有门投影。','For example, [2, −3, 0, 1] becomes [2, 0, 0, 1]. This is the activation used by the original 2017 FFN, without a gate projection.'),
 {project:['R'],relu:['project'],sink:'relu'},x=>M.linear(x,M.weights.project).map(relu),{scalar:true,sinkDim:4,shape:'2 → 4 → 4',sourceX:-6,sinkX:6,boardWidth:17,boardDepth:7,zoom:.83,outputTitle:L('ReLU 输出 A','ReLU output A')});
lesson('original-ffn',L('接出原版 FFN','Build the original FFN'),['project','relu','down'],
 L('展开、ReLU，再组合回原宽度','Expand, apply ReLU, then return to the original width'),
 L('用三个学过的组件完成 Linear → ReLU → Linear。每个 token 单独加工，还没有残差和归一化。','Build Linear → ReLU → Linear from three familiar modules. Process each token separately; residual addition and normalization come later.'),
 L('第一次投影产生更多特征组合，ReLU 改变数值关系，第二次投影把这些结果组合回后续网络需要的宽度。','The first projection creates more feature combinations, ReLU changes their numerical relationships, and the second projection combines them back to the width needed downstream.'),
 L('FFN(x) = ReLU(xW1 + b1)W2 + b2。本例 b1、b2 为 0。FFN 加工同一 token 的特征，Attention 才负责跨 token 取信息。','FFN(x) = ReLU(xW1 + b1)W2 + b2. Here b1 and b2 are zero. The FFN processes features within each token; Attention reads across tokens.'),
 {project:['R'],relu:['project'],down:['relu'],sink:'down'},classicFFN,{scalar:true,shape:'2 → 4 → 4 → 2'});
lesson('layernorm',L('先减均值，再看尺度','Center before scaling'),['layernorm2'],
 L('把每个向量整理到零均值','Center each vector at zero'),
 L('把输入送过 LayerNorm。它先减去这组特征的均值，再除以标准差；所有输入都要匹配。','Pass the input through LayerNorm. Subtract the feature mean and divide by the standard deviation. Match every input.'),
 L('叠很多层时，特征的整体偏移和尺度会变化。LayerNorm 以每个 token 自己的特征为一组，去掉共同偏移并调整尺度，方便后续层处理。','Across many layers, features can shift and change scale. LayerNorm treats each token’s features as one group, removing a shared offset and adjusting their scale for subsequent layers.'),
 L('[1, 3] 的均值是 2、标准差是 1，归一化后约为 [−1, 1]；[6, 8] 也约为 [−1, 1]。学习到的 γ 和 β 还可以重新缩放和平移。','[1, 3] has mean 2 and standard deviation 1, giving approximately [−1, 1]. [6, 8] gives the same result. Learned γ and β can then rescale and shift it.'),
 {layernorm2:['R'],sink:'layernorm2'},ln,{scalar:true});
lesson('add-norm',L('先相加，再归一化','Add first, normalize second'),['relu-ffn','add','layernorm2'],
 L('算出 LayerNorm(X + FFN(X))','Compute LayerNorm(X + FFN(X))'),
 L('FFN 已封装成一块熟悉的组件。让修改量加回原输入，再把相加后的结果交给 LayerNorm。','The familiar FFN is packaged as one module. Add its update to the original input, then apply LayerNorm to the sum.'),
 L('残差让支路只需学习修改量；LayerNorm 则整理相加后的尺度。两个目的不同，因此原版在每个子层外保留这两步。','The residual lets a branch learn an update, while LayerNorm adjusts the scale after addition. These serve different purposes, so the original wraps each sublayer with both steps.'),
 L('2017 年原版使用 Post-LN：先子层计算，再加残差，最后 LayerNorm。把归一化提前会改变计算，现代 Pre-LN 留到扩展章。','The 2017 model uses Post-LN: sublayer computation, residual addition, then LayerNorm. Moving normalization earlier changes the computation; modern Pre-LN comes in the extensions.'),
 {'relu-ffn':['R'],add:['R','relu-ffn'],layernorm2:['add'],sink:'layernorm2'},x=>ln(plus(x,classicFFN(x))),{scalar:true});
lesson('positions',L('同一个词也有不同位置','The same word at different positions'),['embedding','position'],
 L('把位置加进词向量','Add positions to embeddings'),
 L('查表取词向量，再加入原版的正弦位置编码。改变词的顺序，位置相加后的特征也应改变。','Look up embeddings, then add the original sinusoidal positions. Reordering tokens must change the position-enriched features.'),
 L('仅靠词向量，注意力不知道词出现在哪里。把确定的位置模式加进输入，后续 Q/K/V 就能同时利用词和位置。','Embeddings alone do not tell Attention where a token occurs. Adding a deterministic position pattern lets later Q/K/V projections use both the token and its position.'),
 L('本例只有一对特征：PE(p) = [sin(p), cos(p)]。原版更宽的向量使用多组频率；这是相加，不是 RoPE 对 Q/K 做旋转。','This example has one feature pair: PE(p) = [sin(p), cos(p)]. Wider original models use multiple frequencies. This adds to embeddings; it does not rotate Q/K as RoPE does.'),
 {embedding:['R'],position:['embedding'],sink:'position'},ids=>position(embed(ids)),{sourceDim:3,sourceTitle:'Token ID',shape:'3 ID → 3 × 2'});
lesson('weighted-sum',L('按比例取回内容','Read content in proportion'),['original-weights','v','aggregate'],
 L('用注意力权重组合 V','Combine V using attention weights'),
 L('前面学过的打分和 Softmax 已封装。将它算出的比例与 V 送入汇合模块，为每个位置得到两个输出特征。','Scoring and Softmax are packaged from earlier lessons. Feed their proportions and V into aggregation to produce two output features per position.'),
 L('分数只回答更关注哪里，还没有拿回信息。AV 先用比例缩放各来源的 V，再把来源贡献相加，当前 token 才得到上下文内容。','Scores only decide where to attend; they have not retrieved information. AV scales each source V by its weight and adds the contributions to give the current token context.'),
 L('取 [2, 0] 的 25% 和 [0, 4] 的 75%，得到 [0.5, 3]。这里在不同 token 之间加权求和，和后面门控的逐元素相乘不同。','Taking 25% of [2, 0] and 75% of [0, 4] gives [0.5, 3]. This weighted sum across tokens differs from the elementwise multiplication used in later gating.'),
 {'original-weights':['R'],v:['R'],aggregate:['original-weights','v'],sink:'aggregate'},x=>mix(unmaskedWeights(x),mat(x,M.weights.v)),{attentionReadout:true});
lesson('self-attention',L('拼成单头自注意力','Assemble single-head self-attention'),['q','k','v','score','softmax','aggregate','output'],
 L('把匹配、比例和内容接起来','Connect matching, proportions and content'),
 L('从组件架搭建完整单头：Q/K 打分、Softmax、按权重汇合 V、输出投影。所有位置互相可见。','Build a complete head from the shelf: score Q/K, apply Softmax, aggregate V by its weights, then project the output. All positions can see one another.'),
 L('Q/K 决定每个位置从谁读取，V 提供被读取的内容，Wo 把汇合结果组合到网络需要的特征空间。三种角色共同完成一次信息交换。','Q/K decide whom each position reads from, V provides the content, and Wo maps the aggregate into the feature space needed by the network. Together they perform an exchange of information.'),
 L('这是原版编码器的单头计算，没有 RoPE、因果遮罩或 FFN。下一关只改变头的数量。','This is one head of original encoder attention, without RoPE, a causal mask or an FFN. The next lesson changes only the number of heads.'),
 {q:['R'],k:['R'],v:['R'],score:['q','k'],softmax:['score'],aggregate:['softmax','v'],output:['aggregate'],sink:'output'},x=>singleAttention(x),{buildable:true,maxModules:9,attentionReadout:true});
lesson('multihead',L('让两个头各看一遍','Let two heads look independently'),['head-a','head-b','concat','output'],
 L('两个头分别计算，再按特征拼接','Compute two heads, then concatenate their features'),
 L('让两个头收到同一份输入。它们各输出三个位置的一个特征；按同一位置拼成两个特征，再经过 Wo。','Send the same input to both heads. Each outputs one feature for each of three positions. Concatenate matching positions into two features, then apply Wo.'),
 L('一个头只能得到一套匹配比例。不同投影权重让多个头形成各自的匹配与内容组合，拼接可以把这些结果一起交给后续投影。','One head produces one attention pattern. Different projection weights let multiple heads form independent patterns and content mixtures. Concatenation presents all of their results to the output projection.'),
 L('本例 d_model = 2、头数 = 2，每头 d_k = d_v = 1。缩放因此除以 √1。拼接沿特征方向进行，三个 token 仍然是三个。','Here d_model = 2 with two heads, so each has d_k = d_v = 1 and scales by √1. Concatenation is along features; three tokens remain three tokens.'),
 {'head-a':['R'],'head-b':['R'],concat:['head-a','head-b'],output:['concat'],sink:'output'},x=>multi(x),{shapes:{3:'3 × 1'}});
lesson('encoder-layer',L('接成一层原版编码器','Build one original encoder layer'),['self-heads','residual1','ln-attn','original-ffn-block','residual2','ln-ffn'],
 L('两段子层，各自 Add & Norm','Give both sublayers their own Add & Norm'),
 L('输入已是带位置的词特征。先让自注意力交换信息，再让 FFN 加工各个位置；每段都加回自己的输入，再归一化。','The input already contains embeddings and positions. Exchange information with self-attention, then process each position with the FFN. Each sublayer adds back its own input before normalization.'),
 L('注意力负责跨 token 交换信息，FFN 负责各 token 内部加工。残差与归一化包住每个子层，才能按同样结构继续堆叠。','Attention exchanges information across tokens; the FFN processes features within each token. Residuals and normalization wrap each sublayer so the structure can be stacked.'),
 L('编码器可以看完整源序列，不使用因果遮罩。两次残差分别保留各自子层的输入，不都从最左侧取数。','The encoder can see the whole source sequence and uses no causal mask. Each residual uses its own sublayer input, not always the far-left input.'),
 {'self-heads':['R'],residual1:['R','self-heads'],'ln-attn':['residual1'],'original-ffn-block':['ln-attn'],residual2:['ln-attn','original-ffn-block'],'ln-ffn':['residual2'],sink:'ln-ffn'},encoder,{buildable:true,maxModules:8,positioned:true});
lesson('decoder-self',L('只看已给出的目标词','Read only the available target prefix'),['masked-heads','residual1','ln-attn'],
 L('给因果自注意力接回残差','Add the residual around masked self-attention'),
 L('沿用双头计算，但目标位置只能看自己和前面。把更新加回目标输入，再做 LayerNorm。','Reuse two-head attention, but let each target position see only itself and earlier positions. Add the update to the target input, then apply LayerNorm.'),
 L('训练时整段目标可以同时出现，下一词预测却不能偷看后面的答案。因果遮罩限制可见范围，残差和归一化的顺序仍与编码器一致。','Training can present a whole target sequence at once, but next-token prediction must not peek at later answers. The causal mask restricts visibility while retaining the encoder’s residual and normalization order.'),
 L('目标输入表示已经给出的前缀，预测对齐下一词；不是把待预测的答案原样喂给当前位置。这里演示计算，不进行训练。','Target inputs represent the available prefix and predictions align with the next token. The answer is not fed into the position predicting it. This demonstrates computation, not training.'),
 {'masked-heads':['R'],residual1:['R','masked-heads'],'ln-attn':['residual1'],sink:'ln-attn'},decoderSelf,{positioned:true});
const dual={dualSource:true,sources:['R','Z'],secondaryTokenIds:sourceIds,sourcePorts:{R:'D',Z:'E'},sourceNames:{R:L('目标前缀 D','Target prefix D'),Z:L('编码器输出 E','Encoder output E')},sourceTitle:L('目标前缀 D','Target prefix D'),secondaryTitle:L('源序列 · 猫 / 我 / 爱','Source · cats / I / love'),positioned:true};
lesson('cross-attention',L('目标去读取源句','Let the target read the source'),['q','k','v','score','softmax','aggregate','output'],
 L('Q 来自目标，K/V 来自编码器','Take Q from the target and K/V from the encoder'),
 L('台面左侧有 D 和 E 两份输入。目标特征发起查询，从编码器的完整源序列取回内容，再做输出投影。','The left side supplies D and E. Target features issue queries to retrieve content from the encoder’s complete source sequence, followed by the output projection.'),
 L('自注意力只在同一序列内部交换信息。交叉注意力让解码器根据当前目标上下文，选择源序列中有用的内容，因此 Q 与 K/V 的来源不同。','Self-attention exchanges information within one sequence. Cross-attention lets the decoder use the current target context to select source information, so Q and K/V come from different sources.'),
 L('三个输出仍对应目标位置。源句已经完整给定，不能把目标侧的因果遮罩机械套到源序列上。本关先练单头，完整解码器使用双头。','The three outputs still correspond to target positions. The source is fully available, so the target’s future mask should not be applied to it. Practice one head here; the full decoder uses two.'),
 {q:['R'],k:['Z'],v:['Z'],score:['q','k'],softmax:['score'],aggregate:['softmax','v'],output:['aggregate'],sink:'output'},x=>singleAttention(x,memory()),{...dual,buildable:true,maxModules:9});
lesson('decoder-layer',L('接成一层原版解码器','Build one original decoder layer'),['masked-heads','residual1','ln-attn','cross-heads','cross-add','ln-cross','original-ffn-block','residual2','ln-ffn'],
 L('先读目标前缀，再读源句，最后加工特征','Read the prefix, read the source, then process features'),
 L('组合已学过的因果自注意力、交叉注意力和原版 FFN。三段各有自己的残差和 LayerNorm，编码器输出只作为交叉注意力的来源。','Combine masked self-attention, cross-attention and the original FFN. Each has its own residual and LayerNorm; encoder output supplies only cross-attention.'),
 L('解码器同时需要已生成的目标上下文和源句信息。先整理目标前缀，再查询编码器，最后逐个加工目标特征，三段职责不同。','The decoder needs both the generated target context and the source. It first processes the prefix, queries the encoder, then transforms target features independently. Each sublayer has a distinct role.'),
 L('每次残差都加回当前子层的输入。原版是三次 Post-LN；不要跳过交叉注意力，也不要把所有残差都接回最初的 D。','Each residual adds back that sublayer’s input. The original has three Post-LN steps: do not skip cross-attention or connect every residual to the initial D.'),
 {'masked-heads':['R'],residual1:['R','masked-heads'],'ln-attn':['residual1'],'cross-heads':['ln-attn','Z'],'cross-add':['ln-attn','cross-heads'],'ln-cross':['cross-add'],'original-ffn-block':['ln-cross'],residual2:['ln-cross','original-ffn-block'],'ln-ffn':['residual2'],sink:'ln-ffn'},x=>decoder(x,memory()),{...dual,buildable:true,maxModules:11});
lesson('encoder-decoder',L('把原版两半接起来','Connect both halves of the original'),['source-embed','target-embed','original-encoder','original-decoder','lmhead'],
 L('源句经过编码器，目标前缀经过解码器','Encode the source and decode the target prefix'),
 L('两份 ID 分别查词向量并加入位置。源句交给编码器；目标前缀和编码器输出一起交给解码器，最后为候选词打分。','Look up both ID sequences and add positions. Send the source to the encoder, then the target prefix and encoder output to the decoder. Finally score candidate tokens.'),
 L('原版 Transformer 是编码器—解码器模型。编码器整理已给定的源句，解码器结合源句与目标前缀预测下一词；并非只有一条自注意力链。','The original Transformer is an encoder–decoder model. The encoder processes the given source; the decoder combines it with the target prefix to predict the next token. It is more than one self-attention chain.'),
 L('输出是每个目标位置的六个候选分数。真实生成会做 Softmax 和选词，并追加到目标前缀；本例只验证结构与数值，不宣称这些手工权重能翻译。','The output contains six candidate scores per target position. Generation applies Softmax and token selection, then appends to the prefix. This checks structure and arithmetic; these hand-written weights are not a translation model.'),
 {'source-embed':['Z'],'target-embed':['R'],'original-encoder':['source-embed'],'original-decoder':['target-embed','original-encoder'],lmhead:['original-decoder'],sink:'lmhead'},ids=>vocabulary(decoder(position(embed(ids,4)),memory())),{...dual,positioned:false,sourceDim:3,sinkDim:18,sourcePorts:{R:'D ID',Z:'S ID'},sourceNames:{R:L('目标前缀 ID','Target prefix IDs'),Z:L('源序列 ID','Source sequence IDs')},sourceTitle:L('目标前缀 ID','Target prefix IDs'),shape:'2 × 3 ID → 3 × 6',buildable:true,maxModules:7});
lesson('wider-features',L('词不变，特征变宽','Same tokens, wider features'),['wide-embedding','wide-position'],
 L('给三个 token 各准备四个特征','Prepare four features for each of three tokens'),
 L('仍然是查词向量、加位置。这次每个 token 使用四个特征；三个 token 不会变成四个。为后面的完整层准备输入。','Look up embeddings and add positions as before, now with four features per token. Three tokens do not become four. Prepare inputs for a complete layer.'),
 L('更多特征可以保留更丰富的关系。两维归一化几乎只剩正负方向，完整层改用四维后，能更清楚地观察注意力和 FFN 对这些关系的改变。','More features retain richer relationships. Two-feature normalization leaves almost only a sign direction. Using four features in complete layers makes changes from Attention and FFNs easier to observe.'),
 L('原论文的 base 模型使用 512 维、8 个头。本例完整层用 4 维、2 个头，每头 2 维，计算公式相同；位置编码也从一对频率扩为两对。','The paper’s base model used 512 features and eight heads. Our complete layer uses four features and two heads with two features each, using the same formulas. Position encoding expands from one frequency pair to two.'),
 {'wide-embedding':['R'],'wide-position':['wide-embedding'],sink:'wide-position'},ids=>position(embed(ids,4)),{sourceDim:3,sinkDim:12,sourceTitle:'Token ID',shape:'3 ID → 3 × 4',wide:true});
// Keep the early arithmetic tiny; complete Post-LN stacks need enough features
// to retain observable differences instead of collapsing to two signed values.
const wideAliases={residual1:'encoder-add',residual2:'ffn-add',q:'original-q',k:'original-k',v:'original-v',score:'original-score',aggregate:'original-aggregate',output:'original-output',lmhead:'original-head'};
for(const id of ['encoder-layer','decoder-self','cross-attention','decoder-layer','encoder-decoder']){
 const l=added[id],rename=k=>wideAliases[k]||k;l.wide=true;l.nodes=l.nodes.map(rename);
 const links=solutions[id];solutions[id]=Object.fromEntries(Object.entries(links).map(([k,v])=>[rename(k),Array.isArray(v)?v.map(rename):rename(v)]));
 if(id!=='encoder-decoder'){l.sourceDim=l.sinkDim=12;l.shape='3 × 4';}
}
Object.assign(M.levels,added);
for(const level of Object.values(added))if(level.buildable)level.inventory=Object.fromEntries(level.nodes.map(kind=>[kind,2]));
const originalPrologue=['wire','projection','relu','down-projection','original-ffn','residual','workshop'];
const originalNetwork=['embedding','positions','layernorm','add-norm','qkv','scores','softmax','weighted-sum','self-attention','multihead','wider-features','encoder-layer','causal','decoder-self','cross-attention','decoder-layer','encoder-decoder','vocabulary-scores','vocabulary','autoregressive'];
const modern=['activation','plain-ffn','gate-projection','pairwise','gating','swiglu','normalize','ffn','rotation','rope','aggregation','attention','block'];
for(const level of Object.values(M.levels))level.practice=false;
for(const [ids,prefix,board]of [[originalPrologue,L('序章 / ','Prologue / '),'PROLOGUE'],[originalNetwork,L('原版基础 / ','Original / '),'ORIGINAL'],[modern,L('现代扩展 / ','Modern / '),'MODERN']])ids.forEach((id,i)=>{
 const l=M.levels[id];l.chapter=prefix+String(i+1).padStart(2,'0');l.boardText=board+' / '+String(i+1).padStart(2,'0');l.practice=board==='PROLOGUE';l.original=board!=='MODERN';
 if(l.original){delete l.initialLinks;delete l.initialSink;}
});
M.routes.main={name:L('主线 · 原版基础','Main · Original Transformer'),description:L('先用 ReLU FFN、LayerNorm 和正弦位置编码打基础，再从单头、多头搭到编码器与解码器。所有起点都需要自己连线。','Start with ReLU FFNs, LayerNorm and sinusoidal positions, then build from single heads to multi-head attention and the encoder–decoder. Every starting circuit needs your wiring.'),ids:[...originalPrologue,...originalNetwork]};
M.routes.modern={name:L('扩展 · 现代模型','Extensions · Modern models'),description:L('学过原版后再比较：SiLU 与 SwiGLU 改了 FFN，RMSNorm 与 Pre-LN 改了归一化，RoPE 改了位置的用法。旧关卡与存档仍可继续。','After the original, compare how SiLU and SwiGLU change FFNs, RMSNorm and Pre-LN change normalization, and RoPE changes position handling. Existing levels and saves remain available.'),ids:modern};
M.routes={main:M.routes.main,modern:M.routes.modern,engine:M.routes.engine};
for(const [track,route]of Object.entries(M.routes))route.ids.forEach((id,i)=>{M.levels[id].track=track;M.levels[id].next=route.ids[i+1]||null;});
M.levels.qkv.description=L('三块投影尚未接线，同一份输入可产生 Q、K、V。本关出口需要 V；后面分别用 Q/K 打分，再用 V 取内容。','The three projections start disconnected. One input can produce Q, K and V. This outlet needs V; later lessons use Q/K for scoring and V for content.');
M.levels.softmax.description=L('将已学过的 Q/K 投影和打分接起来，再把分数交给 Softmax。每组权重的和应为 1，本关不遮住未来位置。','Connect the familiar Q/K projections and scoring, then feed the scores to Softmax. Each weight row should sum to 1; this level has no future mask.');
M.levels.residual.rationale.scope=L('这里先用线性支路练习残差。进入原版基础章后，会把它包在 ReLU FFN 和 Attention 外，再加入 LayerNorm。','Practice the residual with a linear branch here. The original chapter then wraps ReLU FFNs and Attention with residuals and LayerNorm.');
M.levels.ffn.description=L('将已学的 SwiGLU 和残差组合起来。R 是原输入，Z = RMSNorm(R) 已准备好；这里比较现代 Pre-LN 与原版先相加后归一化的区别。','Combine SwiGLU with a residual. R is the original input and Z = RMSNorm(R) is ready. Compare modern Pre-LN with the original’s addition before normalization.');
M.levels.ffn.rationale.text=L('这一现代实现先归一化输入，再算 SwiGLU 修改量并加回 R。它改变了原版的激活、分支结构和归一化位置，不应当当作原版 FFN 的起点。','This modern version normalizes the input first, computes a SwiGLU update and adds it to R. It changes the original activation, branch structure and normalization placement.');
M.levels.block.title=L('现代解码器的一层','A modern decoder layer');
M.levels.block.rationale.scope=L('这里展示 Pre-LN、RMSNorm、SwiGLU 与 RoPE 组成的现代解码器块，没有编码器交叉注意力。它不是 2017 年原版编码器—解码器。','This modern decoder block combines Pre-LN, RMSNorm, SwiGLU and RoPE without encoder cross-attention. It is not the original 2017 encoder–decoder.');
M.levels.vocabulary.rationale.scope=L('取最大分与取 Softmax 后的最大概率等价，本关直接按分数选词。概率采样会有不同的选择方式。','Selecting the largest logit is equivalent to selecting the largest Softmax probability, so this lesson selects directly from scores. Probability sampling can make different choices.');
M.definitions.step.name=L('教学下一词表','Teaching next-token table');
M.levels.autoregressive.description=L('用固定转移表为下一词算分，再选词、追加到上下文。这里单独练生成循环，不把它当作前面完整 Transformer 的真实预测。','Use a fixed transition table to score the next token, select it and append it to context. This practices the generation loop separately; these are not predictions from the preceding complete Transformer.');
M.levels.autoregressive.rationale.scope=L('本关的固定转移表用于隔离控制流程，不是训练好的语言模型。前面的编码器—解码器关验证原版结构和候选分数。','The fixed transition table isolates control flow; it is not a trained language model. The preceding encoder–decoder lesson validates the original structure and candidate scores.');
const previousSamples=M.samplesFor,previousSources=M.sourceValues,previousReference=M.reference,previousSolutions=M.solutions,previousExample=M.extraExample,previousCard=M.extraCard;
M.samplesFor=id=>M.levels[id]?.positioned?previousSamples('embedding').map(s=>({...s,v:position(embed(s.v,M.levels[id].wide?4:2))})):previousSamples(id);
M.sourceValues=(state,v)=>M.levels[state.levelId]?.dualSource?{R:v,Z:state.levelId==='encoder-decoder'?[...sourceIds]:memory()}:previousSources(state,v);
M.reference=(v,id)=>references[id]?references[id](v):previousReference(v,id);
M.solutions=id=>{if(!solutions[id])return previousSolutions(id);const s=M.initial(id,{complete:true}),links=solutions[id];for(const n of s.nodes)n.links=[...links[n.id]];s.sink=links.sink;return s;};
const cards={};
for(const id of operatorIds){
 const d=M.definitions[id],w=M.weights[id];cards[id]={number:'',seal:id.slice(0,1).toUpperCase(),english:id.toUpperCase().replaceAll('-',' '),family:L('原版 Transformer','Original Transformer'),color:'#'+M.extraColors[id].toString(16).padStart(6,'0'),ability:d.name,meaning:d.hint,purpose:scope,weight:w?w.length+' × '+w[0].length:L('无 / 已封装','None / packaged'),trait:L('数值计算','Numerical computation'),stage:0};
}
Object.assign(cards.relu,{formula:'Aᵢ = max(0, Pᵢ)',purpose:L('正值沿直线通过，负值停在 0。输入符号会改变通过的特征，因此在线性层之间加入非线性。','Positive values pass along a straight line; negative values stop at zero. The input sign changes which features pass, adding nonlinearity between linear layers.')});
for(const id of ['layernorm2','ln-attn','ln-ffn','ln-cross'])cards[id].formula='LN(x) = (x − μ) / √(variance(x) + ε) · γ + β';
for(const id of ['relu-ffn','original-ffn-block'])cards[id].formula='FFN(x) = ReLU(xW1 + b1)W2 + b2';
cards.position.formula='X[p] = √2 · Embedding[p] + [sin(p), cos(p)]';
for(const id of ['wide-position','source-embed','target-embed'])cards[id].formula='X[p] = 2 · Embedding[p] + [sin(p), cos(p), sin(p/100), cos(p/100)]';
cards['wide-embedding'].formula='X[p] = EmbeddingTable[token_id[p]]';
cards['encoder-add'].formula='R = X + MHA(X)';cards['ffn-add'].formula='R = A + FFN(A)';
cards['original-score'].formula='S = QKᵀ / √4';cards['original-aggregate'].formula='O = AV';cards['original-head'].formula='L = DW_vocab + b';
cards['original-q'].formula='Q = DWq';cards['original-k'].formula='K = EWk';cards['original-v'].formula='V = EWv';cards['original-output'].formula='Y = OWo';
cards['original-q'].meaning=L('从目标 D 的四个特征产生查询 Q，用来决定当前目标位置想从源句取什么信息。','Project queries Q from the target D’s four features to select source information for each target position.');
for(const id of ['original-k','original-v'])cards[id].meaning=L('从编码器输出 E 的四个特征产生键或值，供目标侧查询匹配和读取。Q 来自目标，K/V 来自源句。','Project keys or values from encoder E’s four features. Target queries match and read them: Q comes from the target, K/V from the source.');
cards['original-weights'].formula='A = softmax(QKᵀ / √2)';cards.concat.formula='C[p] = [headA[p], headB[p]]';
for(const id of ['head-a','head-b'])cards[id].formula='head = softmax(QhKhᵀ / √1)Vh';
cards['self-heads'].formula='MHA(X) = Concat(headA, headB)Wo';cards['masked-heads'].formula='head = softmax(mask(QhKhᵀ / √2))Vh';
cards['cross-heads'].formula='Q = DWq; K = EWk; V = EWv';cards['cross-add'].formula='C = D + CrossAttention(D, E)';
cards['original-encoder'].formula='A = LN(X + MHA(X)); E = LN(A + FFN(A))';
cards['original-decoder'].formula='A = LN(D + MaskedMHA(D)); B = LN(A + Cross(A,E)); Y = LN(B + FFN(B))';
I18n.prepare(cards);
M.original={relu,ln,position,embed,wide,project,vocabulary,classicFFN,sequenceFFN,head,concat,multi,singleAttention,encoder,decoderSelf,decoder,sourceIds,
 exampleLabels(levelId){return {Oa:L('自注意力更新','Self-attention update'),Om:L('因果注意力更新','Masked attention update'),Oc:L('交叉注意力更新','Cross-attention update'),A:['relu','original-ffn'].includes(levelId)?L('ReLU 输出','ReLU output'):I18n.t('注意力'),E:L('编码器输出','Encoder output'),D:L('目标特征','Target features'),Xs:L('源词向量与位置','Source embeddings and positions'),Xt:L('目标词向量与位置','Target embeddings and positions'),Xp:L('含位置的特征','Position-enriched features'),H_A:L('头 A 的结果','Head A output'),H_B:L('头 B 的结果','Head B output'),C:L('拼接结果','Concatenated features'),X1:L('第一次归一化','First normalized state'),X2:L('交叉注意力后的特征','Features after cross-attention'),R1:L('Attention 残差结果','Attention residual result'),R2:L('FFN 残差结果','FFN residual result'),Rc:L('交叉注意力残差结果','Cross-attention residual result')};},
 card(id,levelId){
  if(cards[id]){
   const c={...cards[id]},decoderLevel=levelId==='decoder-layer';
   const formulas={'self-heads':'Oa = MHA(X)','masked-heads':'Om = MaskedMHA('+(decoderLevel?'D':'X')+')','encoder-add':'R1 = '+(decoderLevel?'D': 'X')+' + '+(levelId==='encoder-layer'?'Oa':'Om'),'ln-attn':'X1 = LayerNorm(R1)','cross-heads':'Oc = CrossAttention(X1, E)','cross-add':'Rc = X1 + Oc','ln-cross':'X2 = LayerNorm(Rc)','original-ffn-block':'F = FFN('+(decoderLevel?'X2':'X1')+')','ffn-add':'R2 = '+(decoderLevel?'X2':'X1')+' + F','ln-ffn':'Y = LayerNorm(R2)'};
   if(formulas[id])c.formula=formulas[id];
   return c;
  }
  if(!M.levels[levelId]?.original)return null;
  if(id==='down'&&levelId==='original-ffn')return {number:'',seal:I18n.t('归'),english:'DOWN PROJECTION',family:I18n.t('投影'),color:'#637e63',ability:L('把特征组合回两个数','Combine features back into two values'),formula:'F = A × W2',meaning:L('四个输入特征与每列的四个权重相乘再求和，形成两个输出。这里没有门控；输入来自前面接入的投影或 ReLU。','Weight and sum all four input features for each column to form two outputs. There is no gating here; the input comes from the connected projection or ReLU.'),purpose:I18n.t(zeroBias),weight:'4 × 2',trait:I18n.t('线性变换')};
  if(id==='add'&&levelId==='add-norm')return {number:'',seal:I18n.t('续'),english:'RESIDUAL ADDITION',family:I18n.t('残差'),color:'#a17949',ability:L('把 FFN 的修改量加回 X','Add the FFN update back to X'),formula:'R = X + FFN(X)',meaning:M.definitions.add.hint,purpose:L('先相加，再把总和交给 LayerNorm。这样归一化处理的是残差合并后的特征。','Add first, then send the sum to LayerNorm so normalization processes the merged residual features.'),weight:I18n.t('无'),trait:I18n.t('对应位置相加')};
  return null;
 }
};
M.extraCard=(id,levelId)=>{
 const own=M.original.card(id,levelId);if(own)return own;
 const c=previousCard(id,levelId);if(!M.levels[levelId]?.original)return c;
 if(id==='output')c.formula='Y = O × Wo';
 if(['residual1','residual2'].includes(id)){c.formula='R = X_sublayer + Sublayer(X_sublayer)';c.meaning=L('加回当前子层自己的输入。相加之后才进入本段的 LayerNorm。','Add back the current sublayer’s own input. LayerNorm follows the addition.');}
 if(levelId==='cross-attention'&&['q','k','v'].includes(id)){c.formula={q:'Q = DWq',k:'K = EWk',v:'V = EWv'}[id];c.meaning=id==='q'?L('从目标 D 产生查询，决定这一步想从源句取什么。','Project queries from target D to select information from the source.'):L('从编码器输出 E 产生键或值，供目标侧查询匹配和读取。','Project keys or values from encoder output E so target queries can match and retrieve source information.');}
 return c;
};
M.extraExample=(id,levelId)=>{
 if(!M.levels[levelId]?.original)return previousExample(id,levelId);
 const s=M.solutions(levelId),sampleIndex=levelId==='relu'?2:0,input=M.samplesFor(levelId)[sampleIndex].v,ev=M.evaluate(s,input),n=s.nodes.find(n=>n.id===id);if(!n)return null;
 const names={R:M.levels[levelId].dualSource?'D':'X',Z:levelId==='encoder-decoder'?'Source ID':'E',project:'P',relu:'A',down:'F',add:'R',layernorm2:'Y',q:'Q',k:'K',v:'V',score:'S',softmax:'A',aggregate:'O',output:'Y','original-q':'Q','original-k':'K','original-v':'V','original-score':'S','original-aggregate':'O','original-output':'Y','original-head':'L','wide-embedding':'X','wide-position':'Xp',position:'Xp','head-a':'H_A','head-b':'H_B',concat:'C','original-weights':'A','relu-ffn':'F','original-ffn-block':'F','self-heads':'O','masked-heads':'O','cross-heads':'O','cross-add':'Rc','source-embed':'Xs','target-embed':'Xt','original-encoder':'E','original-decoder':'D','encoder-add':'R1','ffn-add':'R2','ln-attn':'X1','ln-cross':'X2','ln-ffn':'Y'};
 names['self-heads']='Oa';names['masked-heads']='Om';names['cross-heads']='Oc';
 names.add=levelId==='add-norm'?'R':'Y';
 const ex={sampleIndex,exampleSource:[names.R,input],inputs:n.links.map(k=>[names[k]||k,ev.values[k]]),output:[names[id]||id,ev.values[id]]};
 if(id==='relu')ex.activation={kind:'relu',feature:3};
 if(M.definitions[id].type==='add')ex.addition={feature:0};
 if(M.definitions[id].type==='layernorm'){const width=M.definitions[id].ins[0]===12?4:2,v=ev.values[n.links[0]].slice(0,width),mean=v.reduce((a,b)=>a+b,0)/width,variance=v.reduce((s,x)=>s+(x-mean)**2,0)/width;ex.normalization={mean,variance,epsilon:eps};}
 return ex;
};
})(window.NeuralPrologue);
