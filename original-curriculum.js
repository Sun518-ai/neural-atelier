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
const siluFFN=v=>M.linear(M.linear(v,M.weights.project).map(M.silu),M.weights.down);
const swigluFFN=v=>{const g=M.linear(v,M.weights.gate).map(M.silu),u=M.linear(v,M.weights.project);return M.linear(g.map((x,i)=>x*u[i]),M.weights.down);};
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
 'single-attention':def(L('单头自注意力','Single-head self-attention'),[6],6,'attention',L('完整保留本关的 Q/K/V、打分、Softmax、A × V 和 Wo。每个词仍有两个特征，与七块组件的接法计算相同；不含残差、归一化或 FFN。','Contains this lesson’s Q/K/V, scoring, Softmax, A × V and Wo. Every token still has two features, with the same computation as the seven separate modules. Residuals, normalization and FFNs remain outside.')),
 'two-head-attention':def(L('双头自注意力 · 两维','Two-head self-attention · two features'),[6],6,'attention',L('两个头各算一个特征，再拼接并乘 Wo。与两维的双头关卡使用同样的权重；完整编码器里的四维版本另有四维端口。','Each head computes one feature; concatenate the heads and apply Wo. Uses the same weights as the two-feature lesson. The four-feature version in the complete encoder has separate four-feature ports.')),
 'single-cross-attention':def(L('单头交叉注意力','Single-head cross-attention'),[12,12],12,'attention',L('第一个入口提供目标特征，第二个入口提供编码器的源特征。内部保留四维 Q/K/V、打分、Softmax、A × V 和 Wo，与刚搭好的单头交叉注意力一致。','The first input supplies target features; the second supplies source features from the encoder. Contains four-feature Q/K/V, scoring, Softmax, A × V and Wo, matching the single-head cross-attention circuit.')),
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
 'wide-embedding':def(L('词向量表 · 四维','Embedding table · four features'),[3],12,'embedding',L('按 token ID 查表，为每个 token 取出四个数，组成一个四维向量。四个数共同表示同一个 token；每一维是数值坐标，不一定有单独可命名的含义。','Look up each token ID to retrieve four numbers forming one four-dimensional vector. Together they represent the same token; a coordinate does not necessarily have a separately named meaning.')),
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
Object.assign(M.definitions,{
 'silu-ffn':def(L('单支路 FFN · SiLU','Single-branch FFN · SiLU'),[2],2,'ffn',L('把线性投影、SiLU 和降维收在一起。每个 token 的两个数展开为四个，经过 SiLU 后组合回两个；不含门支路、归一化或残差。','Packages the linear projection, SiLU and down projection. Each token expands from two values to four, passes through SiLU, then returns to two. No gate branch, normalization or residual is included.'),{glyphs:['W1','SiLU','W2']}),
 'swiglu-ffn':def(L('SwiGLU FFN','SwiGLU FFN'),[2],2,'ffn',L('同一输入分别产生内容和门值，门值经过 SiLU 后与内容逐元素相乘，再降维。这里只输出修改量 F，归一化与残差仍在外面。','Project the same input into content and gate values, apply SiLU to the gate, multiply them elementwise and project down. This outputs only the update F; normalization and the residual stay outside.'),{glyphs:['W / Wg','SiLU ×','Wd']}),
 'swiglu-residual':def(L('SwiGLU + 残差','SwiGLU + residual'),[2,2],2,'ffn',L('保留 R、Z 两个入口：用 Z 计算 SwiGLU 的修改量，再加到 R。它与刚搭好的 FFN 关完全相同；Z 的归一化仍由组件外提供。','Keeps separate R and Z inputs: compute the SwiGLU update from Z, then add it to R. This matches the completed FFN lesson; normalization that produces Z is still supplied externally.'),{glyphs:['Z → FFN','+ R']}),
 'original-transformer':def(L('原版编码器—解码器','Original encoder–decoder'),[3,3],18,'decoder',L('保留目标与源 token ID 两个入口，包括两边的词向量与位置、编码器、解码器及词表投影。输出每个目标位置的候选词分数；选词与生成循环仍在外面。','Keeps separate target and source token-ID inputs, including their embeddings and positions, encoder, decoder and vocabulary projection. Outputs candidate-token scores at each target position; token selection and the generation loop stay outside.'),{glyphs:['Embed','Enc / Dec','Scores']}),
 'modern-block':def(L('现代解码器层','Modern decoder layer'),[6],6,'decoder',L('包含 RMSNorm、带 RoPE 的因果 Attention、SwiGLU 和两次残差。每段先归一化，再把更新加回自己的输入；三个 token 各保留两个特征。','Contains RMSNorm, causal attention with RoPE, SwiGLU and both residuals. Each sublayer normalizes first, then adds its update to its own input. All three tokens retain two features each.'),{glyphs:['Norm / Attn','+','Norm / FFN','+']})
});
M.weights['original-head']=wide.vocabulary;
Object.assign(M.operations,{
 relu:([x])=>x.map(relu),layernorm2:([x])=>ln(x),'relu-ffn':([x])=>classicFFN(x),position:([x])=>position(x),
 'original-weights':([x])=>unmaskedWeights(x),'single-attention':([x])=>singleAttention(x),'two-head-attention':([x])=>multi(x),'single-cross-attention':([q,kv])=>singleAttention(q,kv),'head-a':([x])=>head(x,x,0),'head-b':([x])=>head(x,x,1),concat:([a,b])=>concat(a,b),
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
Object.assign(M.operations,{
 'silu-ffn':([x])=>siluFFN(x),'swiglu-ffn':([x])=>swigluFFN(x),'swiglu-residual':([r,z])=>plus(r,swigluFFN(z)),
 'original-transformer':([target,source])=>vocabulary(decoder(position(embed(target,4)),encoder(position(embed(source,4))))),
 'modern-block':([x])=>M.math.block(x)
});
const operatorIds=['relu','layernorm2','relu-ffn','position','original-weights','head-a','head-b','concat','self-heads','masked-heads','cross-heads','ln-attn','ln-ffn','ln-cross','original-ffn-block','cross-add','original-encoder','original-decoder','source-embed','target-embed','wide-embedding','wide-position','encoder-add','ffn-add','original-score','original-aggregate','original-head','original-q','original-k','original-v','original-output'];
operatorIds.push('single-attention','two-head-attention','single-cross-attention','silu-ffn','swiglu-ffn','swiglu-residual','original-transformer','modern-block');
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
 L('先交流，再加工','Exchange, then process'),
 L('用双头自注意力让词之间交换信息，再用原版 FFN 加工每个词。两段各自沿用学过的“先相加，再归一化”。','Use two-head self-attention to exchange information between tokens, then an original FFN to process each token. Both stages reuse the familiar “add first, normalize second” pattern.'),
 L('输入 X 已包含词向量和位置：仍是“我 / 爱 / 猫”，每个词有 4 个特征。这一层更新的是这些特征。','Input X already contains embeddings and positions: still I / Love / Cats, with four features per token. This layer updates those features.'),
 L('两段都把计算结果当作修改量，加回本段输入，再用 LayerNorm 整理特征尺度。第二段收到的是交流后的特征，它的残差也从这里取。','Each stage adds its computed update to that stage’s input, then uses LayerNorm to adjust the feature scale. The second stage receives the features after exchange, so its residual starts there too.'),
 {'self-heads':['R'],residual1:['R','self-heads'],'ln-attn':['residual1'],'original-ffn-block':['ln-attn'],residual2:['ln-attn','original-ffn-block'],'ln-ffn':['residual2'],sink:'ln-ffn'},encoder,{buildable:true,maxModules:8,positioned:true});
const encoderLesson=added['encoder-layer'];
encoderLesson.rationale.kind='encoder-layer';
encoderLesson.rationale.title=L('两段，每段都要收尾','Two stages, each with its own finish');
encoderLesson.description=L('先完成“注意力 → 相加 → LayerNorm”，再完成“FFN → 相加 → LayerNorm”。需要两块残差相加、两块 LayerNorm；相加的另一份数据，都来自本段开始的地方。','Finish “attention → add → LayerNorm”, then “FFN → add → LayerNorm”. Use two residual additions and two LayerNorm modules. Each addition also receives the input from the start of its own stage.');
encoderLesson.rationale.scope=L('沿用 2017 原版的 Post-LN 顺序。输入、两段之间、输出都是 3 个词 × 4 个特征；整句互相可见。','Uses the original 2017 Post-LN order. The input, intermediate state and output all have three tokens × four features; every token can read the whole sentence.');
// These pairs differ only in their old positional names, not their operation.
// Do not rewrite stored nodes or wires when presenting a reusable operator.
encoderLesson.componentAliases={'ffn-add':'encoder-add','ln-ffn':'ln-attn'};
encoderLesson.componentNames={
 'encoder-add':L('残差相加','Residual addition'),
 'ln-attn':'LayerNorm'
};
encoderLesson.shelf={
 featureWidth:12,
 order:['self-heads','original-ffn-block','encoder-add','ln-attn','wide-position'],
 current:L('四维组件','4 features'),
 earlier:L('已学零件','Earlier parts'),
 note:L('前面拆开的零件仍可查看、拖出。两维端口不能直接接到本关的四维特征。','Previously expanded parts can still be inspected and placed. Two-feature ports cannot connect directly to this lesson’s four-feature tensors.')
};
encoderLesson.packageLabel=L('熟悉组件的四维版本','A familiar module with four features');
M.encoderGuide={
 tokens:['我','爱','猫'].map(word=>I18n.t(word)),
 exchange:{title:L('词与词之间交流','Exchange between tokens'),tag:labels.attn,text:L('每个词按注意力比例读取整句话的内容。例如，“猫”的特征会参与更新“爱”的特征。','Each token reads from the whole sentence in attention-weighted proportions. For example, features of Cats contribute to updating Love.')},
 process:{title:L('每个词内部加工','Process within each token'),tag:L('原版 FFN','Original FFN'),text:L('再分别加工交流后的每个词：4 → 8 → ReLU → 4。同一套权重用在所有词上，这一步不再从别的词取数。','Process each token after the exchange: 4 → 8 → ReLU → 4. All tokens use the same weights; this step does not read other tokens.')},
 stageNotes:[
  {path:L('双头自注意力 → 残差相加 → LayerNorm','Two-head attention → Residual addition → LayerNorm'),source:L('相加的另一端：原始输入 X。','Other input to addition: original input X.'),finish:L('这一段归一化后，才交给 FFN。','Normalize this stage before passing it to the FFN.')},
  {path:L('原版 FFN → 残差相加 → LayerNorm','Original FFN → Residual addition → LayerNorm'),source:L('相加的另一端：第一段 LayerNorm 的输出。','Other input to addition: the first LayerNorm’s output.'),finish:L('最后一次相加后，还要归一化，再接结果出口。','After the final addition, normalize again before connecting to the output.')}
 ],
 pattern:L('两段都复用同一种结构','Both stages reuse one pattern'),
 operations:[L('计算修改量','Compute an update'),L('残差相加','Residual addition'),'LayerNorm'],
 formulaTitle:L('用公式对照两段','Compare the two stages in formulas'),
 first:L('X1：交流这一段完成后的特征','X1: features after the exchange stage'),
 second:L('Y：加工这一段完成后的特征','Y: features after the processing stage'),
 formulaNote:L('LN 就是 LayerNorm。残差与归一化各用两块相同组件，不需要区分“Attention 专用”和“FFN 专用”。','LN means LayerNorm. Use two copies each of the same residual and normalization operators; there are no separate Attention-only and FFN-only versions.')
};
I18n.prepare(M.encoderGuide);
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
 L('为每个 token 取出四维词向量，再加入位置','Look up four features per token, then add positions'),
 L('前面每个 token 已经用两个数表示。本关重新从 token ID 查四维词表，改用四个数共同表示一个 token，再加入位置信息。三个 token 仍是三个，输出是 3 × 4。','Earlier, each token was already represented by two numbers. Here, start from token IDs and look up a four-feature embedding table, then add positions. Four numbers jointly represent each token. Three tokens remain three; the output is 3 × 4.'),
 L('维度就是一个向量里数值的个数。每一维是一个特征坐标，模型会学习怎样组合这些坐标来表达词和上下文的关系；不必把某一维固定理解成“动物”或“情感”。真实词向量由训练学习，本游戏用固定数值演示。','A vector’s dimension is its number of coordinates. The model learns to combine these feature coordinates to represent tokens and their context; a coordinate need not mean a fixed property such as “animal” or “emotion”. Real embeddings are learned during training; the game uses fixed teaching values.'),
 L('前面用两维是为了方便看计算。接下来一层里有多次 LayerNorm；两个数归一化后常接近 [1, −1] 或 [−1, 1]，许多差异看不出来。换成四维能保留更多相对差异，便于观察 Attention 和 FFN 的作用。','Two features made the earlier arithmetic easy to follow. The next layers apply LayerNorm repeatedly; normalizing two numbers often leaves approximately [1, −1] or [−1, 1], hiding many differences. Four coordinates retain more relative variation, making changes from Attention and FFNs easier to see.'),
 {'wide-embedding':['R'],'wide-position':['wide-embedding'],sink:'wide-position'},ids=>position(embed(ids,4)),{sourceDim:3,sinkDim:12,sourceTitle:'Token ID',shape:'3 ID → 3 × 4',wide:true});
Object.assign(added['wider-features'].rationale,{
 kind:'embedding-width',title:L('四个数，共同表示一个 token','Four coordinates, one token'),
 scope:L('这里是教学上换用更宽的词表，不是把上关的两维输出临时扩成四维。真实 Transformer 通常从第一张词向量表起就采用选定的模型宽度；原版 base 为 512 维。FFN 内部先展开再收回，是另一种宽度变化。','This switches to a wider embedding table for teaching; it does not expand the previous lesson’s two-feature output. A real Transformer typically uses its chosen model width from the initial embedding table; the original base model used 512 features. Expansion and contraction inside an FFN are a separate width change.')
});
M.embeddingWidthExample={
 token:M.math.vocab[2],beforeLabel:L('之前 · 两维词表','Earlier · two-feature table'),afterLabel:L('本关 · 四维词表','Here · four-feature table'),
 before:[...M.math.emb[2]],after:[...wide.embedding[2]]
};
I18n.prepare(M.embeddingWidthExample);
// Keep the early arithmetic tiny; complete Post-LN stacks need enough features
// to retain observable differences instead of collapsing to two signed values.
const wideAliases={residual1:'encoder-add',residual2:'ffn-add',q:'original-q',k:'original-k',v:'original-v',score:'original-score',aggregate:'original-aggregate',output:'original-output',lmhead:'original-head'};
for(const id of ['encoder-layer','decoder-self','cross-attention','decoder-layer','encoder-decoder']){
 const l=added[id],rename=k=>wideAliases[k]||k;l.wide=true;l.nodes=l.nodes.map(rename);
 const links=solutions[id];solutions[id]=Object.fromEntries(Object.entries(links).map(([k,v])=>[rename(k),Array.isArray(v)?v.map(rename):rename(v)]));
 if(id!=='encoder-decoder'){l.sourceDim=l.sinkDim=12;l.shape='3 × 4';}
}
lesson('pack-ffn',L('把三步收进一个组件','Package three steps as one module'),['relu-ffn'],
 L('用组合组件复现刚学过的 FFN','Reproduce the familiar FFN with a packaged module'),
 L('台面仍然是空的。组件架多了一块“原版 FFN”：它内部保留线性投影、ReLU、降维投影。自己放置并接线，让出口得到与这三步相同的结果；也可以用旧组件重新搭一遍。','The table is empty. The shelf now includes Original FFN: it contains the linear projection, ReLU and down projection. Place and wire it to reproduce those three steps, or rebuild them with the familiar modules.'),
 L('网络变大后，可以把反复使用的一段计算收成组件，台面上只留下输入和输出。内部的权重、ReLU 和计算顺序都没有改变。','As a network grows, a reusable computation can become one module with input and output ports. Its weights, ReLU and operation order remain unchanged.'),
 L('这是计算图的封装，不是把三步乘成一块矩阵。ReLU 仍在中间按输入的正负工作；新旧接法应对所有测试输入给出相同结果。','This packages a computation graph; it does not multiply the three steps into one matrix. ReLU still acts on the signs of its inputs. Both versions must agree for every test input.'),
 {'relu-ffn':['R'],sink:'relu-ffn'},classicFFN,{scalar:true,buildable:true,maxModules:5,packages:['relu-ffn']});
lesson('pack-scores',L('把匹配过程收进一个组件','Package the matching computation'),['original-weights'],
 L('用组合组件复现注意力权重','Reproduce attention weights with a packaged module'),
 L('把输入送进“打分与 Softmax”，再把结果接到出口。它内部仍由 Q/K 投影、缩放点积和 Softmax 组成。旧组件都还在，也可以自己接出相同的计算。','Send the input through Scores and Softmax and wire its result to the outlet. Inside are Q/K projections, scaled dot products and Softmax. The familiar modules remain available for an equivalent circuit.'),
 L('下一步要学习怎样按比例读取 V，先把已经学过的匹配计算收在一起。这个组件只输出比例；V 的内容尚未被读取。','The next lesson reads V in proportion to attention weights. Packaging the familiar matching computation lets us focus on that new operation. This module outputs proportions; it has not read any value content.'),
 L('Q/K → 打分 → Softmax 的计算完全保留，三个位置彼此可见，没有遮罩或 RoPE。封装后的 3 × 3 输出就是前一关的注意力权重。','The Q/K → scores → Softmax computation is preserved. All three positions remain visible, with no mask or RoPE. Its 3 × 3 output is exactly the attention weights from the preceding lesson.'),
 {'original-weights':['R'],sink:'original-weights'},unmaskedWeights,{sinkDim:9,shape:'3 × 2 → 3 × 3',buildable:true,maxModules:6,attentionReadout:true,packages:['original-weights']});
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
// Bridge lessons have their own labels so existing chapter numbers and hashes stay stable.
const bridges={'add-norm':'pack-ffn','weighted-sum':'pack-scores'};
for(const [i,id]of Object.values(bridges).entries())Object.assign(M.levels[id],{chapter:L('组件组合 / 0'+(i+1),'Packaging / 0'+(i+1)),boardText:'PACKAGING / 0'+(i+1),original:true});
M.routes.main={name:L('主线 · 原版基础','Main · Original Transformer'),description:L('先用 ReLU FFN、LayerNorm 和正弦位置编码打基础，再从单头、多头搭到编码器与解码器。所有起点都需要自己连线。','Start with ReLU FFNs, LayerNorm and sinusoidal positions, then build from single heads to multi-head attention and the encoder–decoder. Every starting circuit needs your wiring.'),ids:[...originalPrologue,...originalNetwork.flatMap(id=>bridges[id]?[bridges[id],id]:[id])]};
M.routes.modern={name:L('扩展 · 现代模型','Extensions · Modern models'),description:L('学过原版后再比较：SiLU 与 SwiGLU 改了 FFN，RMSNorm 与 Pre-LN 改了归一化，RoPE 改了位置的用法。旧关卡与存档仍可继续。','After the original, compare how SiLU and SwiGLU change FFNs, RMSNorm and Pre-LN change normalization, and RoPE changes position handling. Existing levels and saves remain available.'),ids:modern};
M.routes={main:M.routes.main,modern:M.routes.modern,engine:M.routes.engine};
for(const [track,route]of Object.entries(M.routes))route.ids.forEach((id,i)=>{M.levels[id].track=track;M.levels[id].next=route.ids[i+1]||null;});
// Selection-page chapters describe learning dependencies without changing the
// playable route, stored IDs, or the order of any mathematical operations.
M.routes.main.description=L('从组件到完整模型：先搭编码器，再搭解码器，最后连接两端。输入准备、组件扩展和结构组装会分别标明。','Build from components to a complete model: assemble the encoder, build the decoder, then connect them. Input preparation, component extensions and assembly are labeled separately.');
M.routes.main.groups=[
 {id:'workbench',label:L('动手入门','Getting started'),title:L('序章 · 学会动手搭网络','Prologue · Learn to build'),description:L('从传递一个向量开始，逐步搭出投影、ReLU、FFN 与残差，再学会从组件架取出模块。','Start by routing a vector, build projections, ReLU, an FFN and a residual, then learn to place modules from the shelf.'),ids:originalPrologue},
 {id:'foundations',label:L('词向量与归一化','Inputs and normalization'),title:L('基础准备 · 词向量、位置与归一化','Foundations · Embeddings, positions and normalization'),description:L('把词变成带位置的特征，再学习归一化，以及原版“先相加，再归一化”的结构。后面的完整层会反复用到它们。','Turn tokens into position-aware features, then learn normalization and the original add-then-normalize pattern. Complete layers will reuse these building blocks.'),ids:['embedding','positions','layernorm','pack-ffn','add-norm']},
 {id:'attention',label:L('搭出注意力','Build attention'),title:L('注意力 · 从单头扩展到多头','Attention · From one head to several'),description:L('先学 Q/K 怎样匹配、V 怎样提供内容，再拼成单头。第 10 关扩展头的数量，后面的编码器会复用这套结构。','Learn how Q/K match and V supplies content, then assemble one head. Level 10 adds more heads; the encoder will reuse that structure.'),ids:['qkv','scores','softmax','pack-scores','weighted-sum','self-attention','multihead']},
 {id:'encoder',label:L('组装编码器','Assemble the encoder'),title:L('编码器 · 准备输入，再组装整层','Encoder · Prepare the input, then assemble the layer'),description:L('第 11 关换用每词四个特征的输入；第 12 关沿用已学的双头结构，配上相应尺寸的权重，和 FFN、残差、LayerNorm 组成一层。','Level 11 prepares four features per token. Level 12 reuses the two-head structure with matching weight sizes, then combines it with the FFN, residuals and LayerNorm into one layer.'),ids:['wider-features','encoder-layer'],connections:{sources:[{label:L('已学的计算','Familiar computations'),text:L('10 多头 + FFN + 残差 + LayerNorm','10 Multi-head + FFN + residuals + LayerNorm')},{label:L('准备的输入','Prepared input'),text:L('11 四维词向量与位置','11 Four-feature embeddings and positions')}],target:{label:L('组合起来','Assemble'),text:L('12 一层编码器','12 One encoder layer')}}},
 {id:'decoder',label:L('开始搭解码器','Build the decoder'),title:L('开始搭解码器 · 限制读取，再接入源句','Start the decoder · Limit reading, then bring in the source'),description:L('接下来搭负责预测后续词的另一半。第 13 关开始学习遮住未来；第 15 关重新接入第 12 关的编码器结果，读取源句信息。','Now build the other half, which predicts subsequent tokens. Level 13 introduces masking future positions; level 15 brings back the encoder result from level 12 to read the source sentence.'),ids:['causal','decoder-self','cross-attention','decoder-layer'],connections:{sources:[{label:L('目标侧','Target side'),text:L('13 因果遮罩 → 14 目标自注意力','13 Causal mask → 14 Target self-attention')},{label:L('源句侧','Source side'),text:L('12 编码器的输出','12 Encoder output')}],target:{label:L('在这里汇合','Meet here'),text:L('15 交叉注意力','15 Cross-attention')}}},
 {id:'generation',label:L('连接与生成','Connect and generate'),title:L('连接两端 · 从特征到选词','Connect both halves · From features to token selection'),description:L('把编码器与解码器接成完整模型，再看特征怎样变成词表分数、怎样选出词。最后单独练习把新词追加回输入的生成循环。','Connect the encoder and decoder into a complete model, then turn features into vocabulary scores and select tokens. Finally, practice the generation loop that appends each new token to the input.'),ids:['encoder-decoder','vocabulary-scores','vocabulary','autoregressive']}
];
const menuLesson=(id,kind,label,summary)=>{M.levels[id].menu={kind,label,summary};};
menuLesson('multihead','extend',L('扩展组件','Extend a component'),L('承接第 09 关的单头：让两组权重分别读取信息，拼接后再经过 Wo。第 12 关会复用双头结构。','Extend the single head from level 09: read with two sets of weights, concatenate, then apply Wo. Level 12 will reuse the two-head structure.'));
menuLesson('wider-features','prepare',L('输入准备','Prepare input'),L('从词 ID 重新查表、加位置，准备每个词有四个特征的输入版本。第 12 关会直接提供这份输入。','Start from token IDs, look up embeddings and add positions to prepare four features per token. Level 12 provides this prepared input directly.'));
menuLesson('encoder-layer','assemble',L('组装整层','Assemble a layer'),L('使用第 11 关准备的输入，组合双头注意力、FFN、残差与 LayerNorm，完成“先交流，再加工”的一层编码器。','Use the input prepared in level 11. Combine two-head attention, the FFN, residuals and LayerNorm into an encoder layer that exchanges information, then processes each token.'));
menuLesson('causal','branch',L('进入解码器','Enter the decoder'),L('目标侧预测后续词时不能读取未来。先练习在 Softmax 前遮住未来分数，再在第 14 关用于目标自注意力。','The target side must not read future tokens while predicting what comes next. Practice masking future scores before Softmax, then use it for target self-attention in level 14.'));
menuLesson('decoder-self','reuse',L('复用遮罩','Reuse the mask'),L('把第 13 关的遮罩用进双头自注意力，再加回目标输入并做 LayerNorm，搭好解码器的第一段。','Use the mask from level 13 inside two-head self-attention, then add the target input and apply LayerNorm to build the decoder’s first sublayer.'));
menuLesson('cross-attention','source',L('接回编码器','Read from the encoder'),L('目标侧提供查询 Q，第 12 关的编码器结果提供 K/V。让目标从完整源句读取内容，再做输出投影。','The target supplies queries Q; the encoder result from level 12 supplies K/V. Read content from the complete source sentence, then apply the output projection.'));
menuLesson('decoder-layer','assemble',L('组装另一半','Assemble the other half'),L('组合因果自注意力、交叉注意力和 FFN，给三段各自接上残差与 LayerNorm，搭成一层解码器。','Combine masked self-attention, cross-attention and the FFN, each with its own residual and LayerNorm, into one decoder layer.'));
menuLesson('encoder-decoder','connect',L('连接两端','Connect both halves'),L('前面两半都搭好了。让源句经过编码器、目标前缀经过解码器，把两端接起来，再输出词表分数。','Both halves are ready. Send the source through the encoder and the target prefix through the decoder, connect the two, then produce vocabulary scores.'));
M.levelMenuCopy={stages:L('按学习阶段浏览','Browse learning stages'),progress:L('关已通过','levels completed'),connections:L('这些关卡怎样接起来','How these lessons connect')};
I18n.prepare(M.levelMenuCopy);
// Explain visibility separately from the Q/K scores whose values are checked.
Object.assign(M.levels.causal,{
 mission:L('让每个词只能参考自己和前面的词','Let each token read only itself and earlier tokens'),
 description:L('沿用 Q、K 投影和打分，加入“不能看后面”的限制。出口要得到注意力权重 A；这一关还不需要 V 和内容汇合。','Keep the Q/K projections and scoring, and add a no-looking-ahead restriction. Produce attention weights A at the output; V and value aggregation are not needed in this lesson.'),
 rationale:{kind:'causal',
 title:L('预测“猫”时，不能先读到“猫”','When predicting Cat, do not read Cat first'),
 text:L('在完整解码器里，“爱”位置的结果用来预测它后面的词。如果它提前读到“猫”，就等于看了答案。因此，即使一次送入整句，也要让“爱”只能参考“我、爱”。','In a complete decoder, the result at Love predicts the following token. Reading Cat there would reveal the answer. Even when the whole sentence is supplied at once, Love must read only I and Love.'),
 takeaway:L('遮罩决定“哪些词不能参考”；Q/K 打分和 Softmax 决定“其余词各占多少比例”。本关检查整张 A，不能只把未来的权重变成 0：直接用 X 代替 Q/K，其他比例也会算错。','The mask decides which tokens are forbidden; Q/K scoring and Softmax decide how to divide weight among the rest. This lesson checks all of A, not just future zeros. Using X in place of Q/K changes the remaining proportions.'),
 scope:L('本关只计算参考比例，还没有汇合 V，也不会生成下一个词。','This lesson computes reference weights only. It does not yet aggregate V or generate the next token.')}
});
M.causalGuide={
 caption:L('以“我 / 爱 / 猫”为例：谁能参考谁？','For I / Love / Cat: who may read whom?'),
 reference:L('参考 →','Read →'),allowed:L('可参考','Allowed'),blocked:L('不可参考','Blocked'),
 legend:L('✓ 可参考，由分数决定比例；0 不可参考。','✓ Allowed: scores determine the weight. 0 Blocked.'),
 read:L('看“爱”这一组：三个数依次表示参考“我、爱、猫”的比例，加起来是 1。','For Love, the three numbers are its weights for I, Love and Cat, in that order. They sum to 1.'),
 detail:L('遮罩在计算里改了什么？','What does the mask change in the calculation?'),
 before:L('“爱”的 Q/K 分数','Love’s Q/K scores'),masked:L('遮住后面的“猫”','Mask the later Cat'),after:L('Softmax 后的比例','Weights after Softmax'),
 why:L('把“猫”的分数改成 −∞，Softmax 才会给它 0 权重。不能只把分数改成 0，因为 exp(0) = 1，它仍会分到权重。其余分数保持不变，再由 Softmax 分配合计为 1 的比例。','Set Cat’s score to −∞ so Softmax gives it zero weight. A score of 0 does not block it: exp(0) = 1 still receives weight. Keep all allowed scores unchanged; Softmax then normalizes their weights to sum to 1.'),
 weightsNote:L('每个位置参考各词的比例','Weights for reading each token')
};
I18n.prepare(M.causalGuide);I18n.prepare(M.levels.causal.rationale);
// After the placement tutorial, the shelf remains a usable part of the game.
// Preserve each lesson's prepared table and existing inventory; removing a
// module makes that copy available to place again without changing the puzzle.
for(const level of Object.values(M.levels))if(!level.practice&&!level.buildable){level.buildable=true;level.startWithModules=true;}
for(const id of [...originalNetwork,...Object.values(bridges)]){const l=M.levels[id];l.migratePreparedStart=!!l.startWithModules;l.startWithModules=false;l.requirePlacement=true;}
// A lesson's reference graph is not its shopping list. Keep learned modules in
// teaching order, without marking which ones occur in the reference solution.
// Scalar exercises and whole-sequence circuits have different port contracts.
// The engine track uses its own costed tasks, not raw arithmetic operators.
const sequenceKind=kind=>Math.max(...M.definitions[kind].ins,M.definitions[kind].out)>4;
// A reward has exactly the same inputs, weights and output as its lesson.
// New rewards appear after a win; packaging bridges may use an already taught block.
M.fusions={
 'original-ffn':{kind:'relu-ffn',inputs:['R']},
 'pack-ffn':{kind:'relu-ffn',inputs:['R']},
 softmax:{kind:'original-weights',inputs:['R']},
 'pack-scores':{kind:'original-weights',inputs:['R']},
 'self-attention':{kind:'single-attention',inputs:['R']},
 multihead:{kind:'two-head-attention',inputs:['R']},
 'wider-features':{kind:'source-embed',inputs:['R']},
 'encoder-layer':{kind:'original-encoder',inputs:['R']},
 'cross-attention':{kind:'single-cross-attention',inputs:['R','Z']},
 'decoder-layer':{kind:'original-decoder',inputs:['R','Z']},
 'encoder-decoder':{kind:'original-transformer',inputs:['R','Z']},
 'plain-ffn':{kind:'silu-ffn',inputs:['R']},
 swiglu:{kind:'swiglu-ffn',inputs:['R']},
 ffn:{kind:'swiglu-residual',inputs:['R','Z']},
 attention:{kind:'attention',inputs:['R']},
 block:{kind:'modern-block',inputs:['R']}
};
const fusionOrigins=Object.fromEntries(Object.entries(M.fusions).map(([id,{kind}])=>[kind,id]));
M.fusionCopy={
 gathering:L('把刚搭好的网络收成一个组件','Package the network you just built'),
 formed:L('内部计算相同，外面只需一个组件','The same computation, now inside one module'),
 stored:L('已放入左侧组件架，可拖出使用','Added to the left shelf — drag it onto the workbench'),
 storedLater:L('已收录到左侧，后续搭建关可使用','Collected on the left — available in later building lessons'),
 useLater:L('后续搭建关可用','Use in later building lessons'),
 collected:L('已收录组件','Module collected'),
 collectedShort:L('已收录','Collected'),
 skip:L('跳过动画','Skip animation')
};
I18n.prepare(M.fusionCopy);
const learned=new Set(),origins={};
for(const [track,route]of Object.entries(M.routes)){
 const known=track==='engine'?new Set():learned;
 for(const id of route.ids){
  const l=M.levels[id],own={...M.inventory(l)};
  for(const kind of Object.keys(own)){known.add(kind);origins[kind]??=id;}
  if(M.fusions[id])known.add(M.fusions[id].kind);
  if(l.practice||l.engine)continue;
  const kinds=[...known].filter(kind=>sequenceKind(kind)===!!l.sequence||own[kind]);
  l.inventory=Object.fromEntries(kinds.map(kind=>[kind,Math.max(2,own[kind]||0)]));
  l.maxModules=Math.max(M.moduleLimit(l),l.nodes.length+2);
 }
}
// Cards for optional shelf modules use a real, dimensionally valid example
// from the lesson in which that module was taught, rather than a missing node.
M.exampleLevel=(kind,id)=>M.levels[id].nodes.includes(kind)?id:origins[kind]||fusionOrigins[kind]||id;
M.moduleShape=(kind,dim)=>{
 if(['head-a','head-b','concat'].includes(kind)&&dim===3)return '3 × 1';
 return sequenceKind(kind)?({3:I18n.t('3 个 ID'),6:'3 × 2',9:'3 × 3',12:'3 × 4',18:'3 × 6'}[dim]||dim):dim;
};
const moduleNames=ids=>ids.map(id=>M.definitions[id].name),pack=(stages,note)=>({stages,note});
const ffnStages=[moduleNames(['project']),['ReLU'],moduleNames(['down'])];
const matchingStages=[['Q','K'],['QKᵀ / √d_k'],['Softmax']];
const headStages=[['Q','K','V'],['softmax(QKᵀ / √d_k) V']];
M.packages={
 'silu-ffn':pack([moduleNames(['project']),['SiLU'],moduleNames(['down'])],M.definitions['silu-ffn'].hint),
 'swiglu-ffn':pack([['XW', 'SiLU(XWg)'],['⊙'],['Wd']],M.definitions['swiglu-ffn'].hint),
 'swiglu-residual':pack([['R', 'Z → SwiGLU'],['Y = R + F']],M.definitions['swiglu-residual'].hint),
 'original-transformer':pack([[L('源 ID → 词向量与位置 → 编码器','Source IDs → embeddings and positions → encoder')],[L('目标 ID → 词向量与位置','Target IDs → embeddings and positions'),L('编码器输出','Encoder output')],moduleNames(['original-decoder']),moduleNames(['original-head'])],M.definitions['original-transformer'].hint),
 'modern-block':pack([['RMSNorm → Attention'],['R1 = X + Attention'],['RMSNorm → SwiGLU'],['Y = R1 + FFN']],M.definitions['modern-block'].hint),
 'single-attention':pack([['Q','K','V'],['QKᵀ / √2'],['Softmax'],['A × V'],['Wo']],M.definitions['single-attention'].hint),
 'two-head-attention':pack([moduleNames(['head-a','head-b']),moduleNames(['concat']),['Wo']],M.definitions['two-head-attention'].hint),
 'single-cross-attention':pack([['Q ← D','K, V ← E'],['QKᵀ / √4'],['Softmax'],['A × V'],['Wo']],M.definitions['single-cross-attention'].hint),
 'relu-ffn':pack(ffnStages,L('与序章的三块组件使用同样的权重：2 → 4 → 4 → 2。ReLU 仍在内部，不是一次线性变换。','Uses the same weights as the three prologue modules: 2 → 4 → 4 → 2. ReLU remains inside; this is not one linear transformation.')),
 'original-weights':pack(matchingStages,L('只封装 Q/K 的匹配与比例，不包含 V、内容汇合、遮罩或 RoPE。','Packages only Q/K matching and proportions, without V, value aggregation, masking or RoPE.')),
 'head-a':pack(headStages,L('把已学的 Q/K/V、打分、Softmax、AV 收成一个头。这里各投影到 1 个特征，使用第一组权重；不含 Wo。','Packages Q/K/V, scores, Softmax and AV as one head. Here each projection produces one feature with the first set of weights; Wo is outside.')),
 'head-b':pack(headStages,L('与头 A 的步骤相同，但使用第二组权重，各投影到 1 个特征；两头各算各的比例，不共享 Softmax。','Uses the same steps as head A, with a second set of weights and one feature per projection. Each head computes its own Softmax weights.')),
 'self-heads':pack([moduleNames(['head-a','head-b']),moduleNames(['concat']),['Wo']],L('把两个头、拼接和 Wo 收在一起。完整层使用 4 个特征、每头 2 个；结构沿用前面的双头练习，权重也相应变宽。','Packages both heads, concatenation and Wo. Complete layers use four features, two per head: the same structure as the earlier two-head exercise, with wider weights.')),
 'masked-heads':pack([['Q','K','V'],['softmax(mask(QKᵀ / √d_k)) V'],['Concat(head A, head B) Wo']],L('沿用双头结构，在每个头的 Softmax 前加入已学的因果遮罩。残差和 LayerNorm 仍在组件外。','Reuses two heads, adding the familiar causal mask before each Softmax. Residual addition and LayerNorm stay outside.')),
 'cross-heads':pack([['Q ← D', 'K, V ← E'],['softmax(QKᵀ / √d_k) V'],['Concat(head A, head B) Wo']],L('把刚练过的交叉注意力装进两个独立的头：D 提供查询，E 提供键和值。现在每头 2 个特征，拼接后乘 Wo；不含残差或归一化。','Packages the cross-attention just practiced into two independent heads: D supplies queries, E supplies keys and values. Each head now has two features; concatenate and apply Wo. Residuals and normalization stay outside.')),
 'original-ffn-block':pack(ffnStages,L('内部仍是 Linear → ReLU → Linear。这次对三个 token 分别做 4 → 8 → 4；它把单个向量的练习推广到整段序列，不混合 token。','Still Linear → ReLU → Linear, now applying 4 → 8 → 4 to each of three tokens. This extends the single-vector exercise to a sequence without mixing tokens.')),
 'source-embed':pack(moduleNames(['wide-embedding','wide-position']).map(name=>[name]),L('源 ID 先查四维词向量，再乘 √4 并加位置编码；与“词不变，特征变宽”关相同。','Look up four-feature source embeddings, scale by √4 and add positions, exactly as in Same tokens, wider features.')),
 'target-embed':pack(moduleNames(['wide-embedding','wide-position']).map(name=>[name]),L('对目标前缀做同样的查表与位置相加。源与目标仍从不同的输入口取 ID。','Apply the same lookup and position addition to the target prefix. Source and target IDs still come from separate input ports.')),
 'original-encoder':pack([[labels.attn],['Add → LayerNorm'],[labels.ffn],['Add → LayerNorm']],L('收起已经搭过的一层编码器。每个 Add 都加回当前子层自己的输入；内部保留两次残差和两次 LayerNorm。','Packages the encoder layer already built. Each Add uses its own sublayer input; both residuals and both LayerNorm operations remain inside.')),
 'original-decoder':pack([[labels.masked],['Add → LayerNorm'],[labels.cross],['Add → LayerNorm'],[labels.ffn],['Add → LayerNorm']],L('收起已经搭过的解码器。保留目标和编码器输出两个入口，以及三段各自的残差与 LayerNorm。','Packages the decoder already built. It retains separate target and encoder-memory inputs, plus each of the three residual and LayerNorm wrappers.')),
 attentionweights:pack([['Q','K'],['RoPE'],['QKᵀ / √2'],[M.definitions.mask.name],['Softmax']],L('在原版匹配流程中加入旋转和遮罩，仍只输出比例。V 留在组件外，下一步才读取内容。','Adds rotations and a mask to the original matching pipeline and still outputs only proportions. V remains outside for the next content-reading step.')),
 attention:pack([[M.definitions.attentionweights.name,'V'],['AV'],['Wo']],L('收起现代 Attention 关搭过的整段：Q/K/V、Q/K 的 RoPE、因果遮罩、Softmax、AV 和 Wo。外部的 RMSNorm 与残差不包含在这里。','Packages the modern Attention circuit: Q/K/V, RoPE on Q/K, causal masking, Softmax, AV and Wo. The external RMSNorm and residual are not included.')),
 ffnblock:pack([['RMSNorm'],['U = XW', 'S = SiLU(XWg)'],['S ⊙ U'],[M.definitions.down.name]],L('内部先做 RMSNorm，再算双路 SwiGLU，输出修改量。相加的残差仍在外面；这是现代扩展，不是原版 ReLU FFN。','Runs RMSNorm then the two-branch SwiGLU to output an update. Residual addition remains outside; this is the modern extension, not the original ReLU FFN.')),
 enqkv:pack([['RMSNorm'],['Q','K','V']],L('在引擎章把归一化和三种投影当作一个可分配给芯片的任务；输出按 Q、K、V 分段保存。此处“组合任务”不意味着芯片必然执行为一个融合算子。','The engine chapter schedules normalization and all three projections as one task, with output segments for Q, K and V. A grouped task does not imply one fused hardware operator.')),
 enattn:pack([['RoPE(Q, K)'],['softmax(mask(QKᵀ / √2)) V'],['Wo']],L('读取上一任务的 Q/K/V，完成现代因果注意力。这里仍计算同样的数，后面的关卡才比较缓存和分配到不同芯片的成本。','Reads the previous task’s Q/K/V and completes modern causal attention. The arithmetic remains the same; later lessons compare caching and chip-assignment costs.')),
 enffn:pack([['RMSNorm → SwiGLU'],[M.definitions.add.name]],L('把现代 FFN 及外部残差合成一个调度任务，仍保留归一化、两套投影、SiLU、逐元素相乘、降维与相加。','Groups the modern FFN and its residual as one scheduling task. Normalization, both projections, SiLU, elementwise multiplication, down projection and addition all remain inside.'))
};
L('内部组成','Inside this module');L('新组合组件','New packaged module');
for(const [kind,p]of Object.entries(M.packages)){
 const l=M.levels[origins[kind]];if(l){l.packages??=[];if(!l.packages.includes(kind))l.packages.push(kind);}
}
I18n.prepare(M.packages);
// Use the same shelf organization beyond the encoder. Classify by interfaces
// and package metadata, not by the reference wiring; keep compatible distractors.
const groupedLater=[...M.routes.main.ids.slice(M.routes.main.ids.indexOf('causal')),...M.routes.modern.ids];
for(const id of groupedLater){
 const l=M.levels[id],contract=kind=>JSON.stringify([M.definitions[kind].ins,M.definitions[kind].out]);
 const contracts=new Set(l.nodes.map(contract)),dimensions=new Set(l.nodes.flatMap(kind=>[...M.definitions[kind].ins,M.definitions[kind].out]));
 const kinds=Object.keys(M.inventory(l)),currentKinds=kinds.filter(kind=>contracts.has(contract(kind))||(M.packages[kind]&&[...M.definitions[kind].ins,M.definitions[kind].out].every(dim=>dimensions.has(dim))));
 l.shelf={currentKinds,order:currentKinds,current:L('可用组件','Available modules'),packages:L('组合组件','Combined modules'),basics:L('基础组件','Basic modules'),earlier:L('已学零件','Earlier parts'),note:L('保留之前学过的零件，仍可拖出或双击查看。端口尺寸不同的组件不能直接相连；上方也包含可选组件，并非都要使用。','Earlier parts can still be placed or inspected with a double-click. Different port sizes cannot connect directly. The groups above include optional modules; you do not need to use every one.')};
 I18n.prepare(l.shelf);
}

// Keep the packaged unmasked weights inspectable, but do not offer new copies here.
M.levels.causal.legacyInventory={'original-weights':M.levels.causal.inventory['original-weights']};
M.levels.causal.inventory['original-weights']=0;
M.levels.qkv.mission=L('把内容向量送到出口','Send the value vectors to the outlet');
M.levels.qkv.description=L('本关只检查出口的 V。Q/K 用于后续的注意力打分，这里不要求放置或接线。','This lesson checks only V at the outlet. Q/K are used for attention scoring in later lessons; placing or connecting them is optional here.');
M.levels.qkv.summary=M.levels.qkv.description;
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
for(const id of ['single-attention','single-cross-attention','two-head-attention']){
 cards[id].formula=id==='two-head-attention'?'Y = Concat(head A, head B) × Wo':'Y = softmax(QKᵀ / √'+(id==='single-attention'?'2':'4')+') × V × Wo';
 cards[id].purpose=M.packages[id].note;
}
cards.position.formula='X[p] = √2 · Embedding[p] + [sin(p), cos(p)]';
for(const id of ['wide-position','source-embed','target-embed'])cards[id].formula='X[p] = 2 · Embedding[p] + [sin(p), cos(p), sin(p/100), cos(p/100)]';
cards['wide-embedding'].formula='X[p] = EmbeddingTable[token_id[p]]';
cards['wide-embedding'].purpose=L('例如本游戏中，“猫”的 ID 为 2，查表取出 [1, 1, 0.4, 0.2]。这是同一个 token 的四个坐标，不是四个 token，也不是四个预先命名的属性。位置编码会在下一块组件中加到这四个数上。','For example, Cat has ID 2 in this game and retrieves [1, 1, 0.4, 0.2]. These are four coordinates of one token, not four tokens or four predefined named properties. The next component adds position information to these same four values.');
for(const id of ['silu-ffn','swiglu-ffn','swiglu-residual','modern-block']){cards[id].family=L('现代扩展','Modern extensions');cards[id].purpose=M.packages[id].note;}
cards['silu-ffn'].formula='F = SiLU(XW1)W2';
cards['swiglu-ffn'].formula='F = (SiLU(XWg) ⊙ XW)Wd';
cards['swiglu-residual'].formula='Y = R + SwiGLU(Z)';
cards['modern-block'].formula='R1 = X + Attention(RMSNorm(X)); Y = R1 + SwiGLU(RMSNorm(R1))';
cards['original-transformer'].formula='L = Vocabulary(Decoder(TargetEmbedding, Encoder(SourceEmbedding)))';cards['original-transformer'].purpose=M.packages['original-transformer'].note;
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
const scorePurpose=L('点积把多个特征的乘积相加。特征越多，分数通常波动越大；先除以 √dₖ，避免仅因维度变大就让后面的 Softmax 过早集中到一个位置。Softmax 接着把分数变成和为 1 的比例，两步作用不同。','A dot product adds feature-wise products. More features usually mean a wider score spread. Dividing by √dₖ avoids making Softmax overly concentrated merely because the head is wider. Softmax then turns scores into proportions that sum to 1; the two steps serve different purposes.');
for(const [id,width]of [['score',2],['original-score',4]]){
 const meaning=width===2?L('每个位置的 Q，分别与各位置的 K 对应相乘再求和。这里每个 Q/K 有 2 个特征，所以 dₖ = 2，再把每个点积除以 √2。输出 S 仍是匹配分数，可以为负。','For each position’s Q, multiply matching features with each K and sum. Here every Q/K has two features, so dₖ = 2 and each dot product is divided by √2. S still contains matching scores, which may be negative.'):
  L('每个位置的 Q，分别与各位置的 K 对应相乘再求和。这里每个 Q/K 有 4 个特征，所以 dₖ = 4，再把每个点积除以 √4 = 2。输出 S 仍是匹配分数，可以为负。','For each position’s Q, multiply matching features with each K and sum. Here every Q/K has four features, so dₖ = 4 and each dot product is divided by √4 = 2. S still contains matching scores, which may be negative.');
 cards[id]={...(cards[id]||previousCard(id)),ability:L('先算匹配，再缩放分数','Compute matches, then scale the scores'),formula:'S = QKᵀ / √dₖ   (dₖ = '+width+')',meaning,purpose:scorePurpose,trait:L('缩放点积','Scaled dot products')};
 M.definitions[id].hint=meaning;
}
cards.softmax={...previousCard('softmax'),ability:L('把一组分数变成一组比例','Turn scores into proportions'),formula:'Aⱼ = exp(Sⱼ) / Σₜ exp(Sₜ)',
 meaning:L('对同一个查询的三个分数分别取指数，再除以这些指数的总和。输出是非负比例，总和为 1，供后面按比例读取 V。','Exponentiate the three scores for one query, then divide each exponential by their sum. The outputs are nonnegative proportions summing to 1, ready to read V in proportion.'),
 purpose:L('Softmax 对分数差距敏感：输入 [0, 2] 得到约 [12%, 88%]，先除以 √2 再算则约为 [20%, 80%]。两次都和为 1，但比例不同；前一步缩放不会被这一步抵消。','Softmax responds to score differences: [0, 2] gives about [12%, 88%], while dividing by √2 first gives about [20%, 80%]. Both sum to 1 but allocate differently; Softmax does not cancel the preceding scale.')};
M.levels.scores.rationale.takeaway=scorePurpose;
M.scoreGuide={
 title:L('先看一个查询怎样给键打分','Follow one query as it scores the keys'),
 query:L('查询 Q','Query Q'),key:L('匹配的键 K','Matching key K'),dot:L('点积 Q · K','Dot product Q · K'),scaled:L('缩放分数 S','Scaled score S'),
 shape:L('Kᵀ 把 K 转置，让每个 Q 能一次匹配所有 K；结果的每个格对应一对查询与键。','Kᵀ transposes K so each Q can match every K at once. Each output cell corresponds to one query–key pair.'),
 dimension:L('dₖ 是每个注意力头中，一个 Q 或 K 向量的特征数。这里是','dₖ is the feature count of one Q or K vector in this attention head. Here it is'),
 compare:L('下一步对照：再经过 Softmax','Next-step comparison: apply Softmax'),
 before:L('不缩放 → Softmax','Unscaled → Softmax'),after:L('缩放后 → Softmax','Scaled → Softmax'),
 boundary:L('本组件输出到 S 为止。下面把两组分数分别交给 Softmax，比较它们会如何分配比例。','This module stops at S. Below, each set of scores is passed to Softmax to compare how the resulting proportions differ.'),
 explanation:L('Softmax 先取指数，再除以指数的总和。因此，缩小分数差距会改变比例；它不是把原分数简单除以总和。两组比例都和为 1，但集中程度不同。','Softmax exponentiates scores before dividing by the sum of exponentials. Reducing score differences therefore changes the proportions; it is not simply dividing the original scores by their sum. Both distributions sum to 1 but differ in concentration.'),
 shortcut:L('一个更简单的对照：','A simpler comparison:'),
 reason:L('为什么用平方根？','Why the square root?'),
 theory:L('一个 dₖ 维点积是 dₖ 个乘积的和。在 Q/K 各分量近似独立、均值为 0、方差为 1 的假设下，点积的方差约为 dₖ，标准差约为 √dₖ；除以 √dₖ 后，方差回到约 1。这是控制典型波动幅度，并不保证每个分数都落在固定范围内。','A dₖ-dimensional dot product sums dₖ products. Assuming approximately independent Q/K components with mean 0 and variance 1, the dot product has variance about dₖ and standard deviation about √dₖ. Dividing by √dₖ brings the variance back to about 1. This controls typical spread; it does not bound every score to a fixed range.'),
 training:L('Softmax 的比例过早接近 0 或 1 时，它对分数变化的响应会变小，训练也更难调整注意力。缩放是为了避免仅因维度增加就出现这种情况，并不要求注意力始终平均分配。','When Softmax proportions approach 0 or 1 too early, they become less responsive to score changes, making attention harder to adjust during training. Scaling avoids this happening merely because dimensionality increased; it does not require attention to stay uniform.'),
 full:L('查看完整 Q、K 和打分结果','View the full Q, K and score matrices')
};
I18n.prepare(M.scoreGuide);
const aggregateMeaning=L('A 是 Softmax 算出的注意力比例，V 是 V 投影产生的内容向量。AV 就是 A × V：一个比例乘一整组 V，再把这些贡献相加，得到输出 O。','A contains the attention proportions computed by Softmax. V contains the content vectors from the V projection. AV means A × V: scale each whole V vector by its proportion, then add the contributions to obtain O.');
const aggregatePurpose=L('这是原版 Transformer 的 Attention 公式里，Softmax 后面“乘 V”的一步。只做 V 投影时，各位置仍各自加工自己的特征；A × V 让当前查询能读取其他位置的内容。每个查询各有一组比例，分别算出自己的输出，之后才做输出投影 Wo。','This is the multiplication by V after Softmax in the original Transformer’s Attention formula. A V projection transforms each position separately; A × V lets a query read content from other positions. Each query has its own proportions and output. The output projection Wo comes afterward.');
for(const [id,wide]of [['aggregate',false],['original-aggregate',true]]){
 M.definitions[id].name=wide?L('A × V · 汇合四维内容','A × V · mix four-feature values'):L('A × V · 汇合内容','A × V · mix values');
 M.definitions[id].hint=aggregateMeaning;
 cards[id]={...(cards[id]||previousCard(id)),seal:'AV',english:'ATTENTION · WEIGHTED SUM',ability:L('按比例，把内容取回来','Retrieve content in proportion'),formula:'O = A × V',meaning:aggregateMeaning,purpose:aggregatePurpose,weight:L('无','None'),trait:L('矩阵乘法 · 加权求和','Matrix product · weighted sum')};
}
M.aggregateGuide={
 flowTitle:L('它在 Attention 的哪里？','Where does it fit in Attention?'),
 a:L('A · 取多少','A · how much'),v:L('V · 取什么','V · what to read'),o:L('O · 汇合后的内容','O · combined content'),
 scorePath:L('Q/K → 打分 → Softmax','Q/K → scores → Softmax'),
 crossScorePath:L('目标 Q / 源句 K → 打分 → Softmax','Target Q / source K → scores → Softmax'),
 maskedScorePath:L('Q/K → 打分 → 遮罩 → Softmax','Q/K → scores → mask → Softmax'),
 valuePath:L('输入特征 → V 投影','Input features → V projection'),
 crossValuePath:L('源句特征 → V 投影','Source features → V projection'),
 dynamic:L('A 是随输入算出的比例，不是另一块固定的投影权重。','A is computed from the input, not a fixed projection weight matrix.'),
 title:L('先用两个内容向量算一次','Start with two content vectors'),
 simple:L('简化例子：假设某个查询得到的比例是 25% 和 75%。','Simplified example: suppose one query assigns 25% and 75%.'),
 proportion:L('A · 比例','A · proportion'),content:L('V · 内容向量','V · content vector'),contribution:L('这份贡献','Contribution'),
 sum:L('最后把贡献相加','Add the contributions'),
 whole:L('25% 乘第一个 V 的两个数，75% 乘第二个 V 的两个数；再把对应特征相加。结果是一组新向量，不是选出其中一个词。','Multiply both features of the first V by 25%, and both features of the second by 75%, then add matching features. The result is a new vector, not a selected word.'),
 actual:L('展开游戏里的三位置计算','Show the game’s three-position example'),
 rounding:L('上方为简化例子；展开后使用示例关卡的真实计算值 · 数字已四舍五入','The example above is simplified; expand for the example level’s actual calculation · Values are rounded'),
 query:L('正在为这个查询汇合：','Combining content for query:'),
 sources:L('内容来自：','Content sources:'),
 rest:L('上面只算这个查询的输出。其余查询各用自己的比例计算，三组输出合起来才是完整的 O。','The calculation above produces one query’s output. Each other query uses its own proportions; the three outputs together form O.'),
 dimensions:L('A 的三个数对应三个内容来源；每个比例乘完整的 V，输出保留 V 的特征数。','Each of the three proportions in A belongs to a content source. It scales the whole V vector, so the output keeps V’s feature count.')
};
I18n.prepare(M.aggregateGuide);
for(const [id,width]of [['output',2],['original-output',4]]){
 const meaning=width===2?
  L('O 是前一步 A × V 汇合得到的内容向量。Wo 用不同的权重组合 O 中的两个数，得到两个新的输出特征 Y。这里仍是 2 维 → 2 维，改变的是特征的组合方式。','O is the content vector produced by the preceding A × V step. Wo combines its two values with different weights to produce two new output features Y. The width stays 2 → 2; what changes is how the features are combined.'):
  L('O 是前一步 A × V 汇合得到的内容向量。Wo 用不同的权重组合 O 中的四个数，得到四个新的输出特征 Y。这里仍是 4 维 → 4 维，改变的是特征的组合方式。','O is the content vector produced by the preceding A × V step. Wo combines its four values with different weights to produce four new output features Y. The width stays 4 → 4; what changes is how the features are combined.');
 M.definitions[id].hint=meaning;
 cards[id]={...(cards[id]||previousCard(id)),seal:L('输','O'),english:'OUTPUT PROJECTION',family:I18n.t('投影'),ability:L('重新组合 Attention 取回的内容','Recombine the content retrieved by attention'),formula:'Y = O × Wo',meaning,
  purpose:L('它就是放在 Attention 末尾的线性投影。Wo 的每一列是一份组合配方，真实模型通过训练学会怎样组合这些特征。Y 是注意力输出，之后还要加回这个子层原来的输入。本游戏的 Wo 使用固定教学数值。','This is a linear projection placed at the end of attention. Each column of Wo is a recipe for combining features, learned through training in a real model. Y is the attention output, which is then added back to this sublayer’s original input. The game uses fixed teaching values for Wo.'),
  trait:L('同一位置的线性组合','Linear combination within one position'),inputSymbol:'O'};
}
M.outputProjectionGuide={
 title:L('一列权重，组合出一个输出','One weight column produces one output'),
 flowTitle:L('两步分别在组合什么？','What does each step combine?'),
 aggregate:L('A × V：从不同词那里汇入内容。','A × V: gather content from different tokens.'),
 projection:L('Wo：重新组合当前词向量中的特征。','Wo: recombine features within the current token’s vector.'),
 concat:L('先把各个注意力头的输出拼接起来。','First concatenate the outputs of the attention heads.'),
 input:L('汇合得到的内容','Aggregated content'),concatInput:L('各头拼接的内容','Concatenated head outputs'),output:L('注意力输出','Attention output'),
 column:L('Wo 的列','Wo column'),feature:L('输出特征','Output feature'),word:L('对应词','Token'),
 recipe:L('每个输出都可以使用全部输入特征；每一列的权重不同，组合出的结果就不同。','Each output can use all input features. Different columns use different weights, so they produce different combinations.'),
 sameWeights:L('其他词各自做同样的计算，使用同一个 Wo。','Other tokens are processed independently with the same Wo.'),
 full:L('查看本关三个词的输入与输出','Show this lesson’s inputs and outputs for all three tokens'),
 multiheadTitle:L('多头时，Wo 又做什么？','What does Wo do with multiple heads?'),
 multihead:L('多头注意力先把各个头的输出拼成一个向量，再乘 Wo。每个新的输出特征都可以同时使用多个头的分量。即使拼接后已经是模型需要的宽度，Wo 仍然负责重组各个头带回的信息。','Multi-head attention concatenates the head outputs into one vector, then multiplies by Wo. Each new output feature can use components from several heads. Even when concatenation already gives the model’s required width, Wo still recombines the information retrieved by the heads.')
};
I18n.prepare(M.outputProjectionGuide);
cards.mask={number:'',seal:L('遮','Mask'),english:'CAUSAL MASK',family:L('注意力','Attention'),color:'#9a813d',
 ability:L('禁止当前位置偷看后面的词','Prevent each position from looking ahead'),
 formula:'Q/K scores → mask → Softmax',
 meaning:L('输入是 Q/K 算出的匹配分数，还不是注意力比例。对于“爱”这个位置，保留它对“我、爱”的分数，把对后面的“猫”的分数改成 −∞。其他位置各自按同样规则处理。','The input contains Q/K matching scores, not attention weights yet. For Love, keep the scores for I and Love and replace the score for the later Cat with −∞. Apply the same rule independently at every position.'),
 purpose:L('例如分数 [2, 1, 3] 变成 [2, 1, −∞]，再经 Softmax 得到约 [0.73, 0.27, 0]。这是一组便于说明的数字，不是本关答案。遮罩限制可见范围，Softmax 才负责把可见分数变成合计为 1 的比例；分数设成 0 并不等于屏蔽。','For example, scores [2, 1, 3] become [2, 1, −∞], then Softmax produces about [0.73, 0.27, 0]. These illustrative numbers are not the lesson’s target. The mask limits visibility; Softmax converts allowed scores into weights summing to 1. Setting a score to 0 does not block it.'),
 input:L('Q/K 匹配分数','Q/K matching scores'),output:L('遮住未来后的分数','Scores with future positions masked'),weight:L('无','None'),trait:L('保留自己与过去','Keep self and earlier positions'),stage:0};
I18n.prepare(cards);
M.original={relu,ln,position,embed,wide,project,vocabulary,classicFFN,sequenceFFN,head,concat,multi,singleAttention,encoder,decoderSelf,decoder,sourceIds,
 exampleLabels(levelId){return {Oa:L('自注意力更新','Self-attention update'),Om:L('因果注意力更新','Masked attention update'),Oc:L('交叉注意力更新','Cross-attention update'),A:['relu','original-ffn'].includes(levelId)?L('ReLU 输出','ReLU output'):I18n.t('注意力'),E:L('编码器输出','Encoder output'),D:L('目标特征','Target features'),Xs:L('源词向量与位置','Source embeddings and positions'),Xt:L('目标词向量与位置','Target embeddings and positions'),Xp:L('含位置的特征','Position-enriched features'),H_A:L('头 A 的结果','Head A output'),H_B:L('头 B 的结果','Head B output'),C:L('拼接结果','Concatenated features'),X1:levelId==='encoder-layer'?L('交流后的特征','Features after exchange'):L('第一次归一化','First normalized state'),X2:L('交叉注意力后的特征','Features after cross-attention'),R1:L('Attention 残差结果','Attention residual result'),R2:L('FFN 残差结果','FFN residual result'),Rc:L('交叉注意力残差结果','Cross-attention residual result')};},
 card(id,levelId){
  if(cards[id]){
   const c={...cards[id]},decoderLevel=levelId==='decoder-layer';
   if(['output','original-output'].includes(id)&&M.levels[levelId]?.nodes.includes('concat')){
    c.inputSymbol='C';c.formula='Y = C × Wo';
    c.meaning=L('C 是把多个注意力头的输出拼接成的向量。Wo 用每一列权重，把这些分量组合成一个新的输出特征。本关两个头各给一个数，拼成两维，再经过 2 × 2 的 Wo，仍输出两维。','C concatenates the outputs of the attention heads. Each column of Wo combines those components into one new output feature. Here two heads each supply one value, giving two features; a 2 × 2 Wo recombines them into two output features.');
   }
   const formulas={'self-heads':'Oa = MHA(X)','masked-heads':'Om = MaskedMHA('+(decoderLevel?'D':'X')+')','encoder-add':'R1 = '+(decoderLevel?'D': 'X')+' + '+(levelId==='encoder-layer'?'Oa':'Om'),'ln-attn':'X1 = LayerNorm(R1)','cross-heads':'Oc = CrossAttention(X1, E)','cross-add':'Rc = X1 + Oc','ln-cross':'X2 = LayerNorm(Rc)','original-ffn-block':'F = FFN('+(decoderLevel?'X2':'X1')+')','ffn-add':'R2 = '+(decoderLevel?'X2':'X1')+' + F','ln-ffn':'Y = LayerNorm(R2)'};
   if(formulas[id])c.formula=formulas[id];
   if(levelId==='encoder-layer'){
    if(['encoder-add','ffn-add'].includes(id)){
     c.english='RESIDUAL ADDITION';c.ability=L('把修改量加回这一段的输入','Add the update to this stage’s input');
     c.meaning=L('两个入口按同一个词、同一个特征对齐相加。例如 [1, 2] 加修改量 [0.3, −0.5]，得到 [1.3, 1.5]。这条旁路让原输入也参与结果，而不必全部经过支路的变换。','Align both inputs by token and feature, then add. For example, [1, 2] plus the update [0.3, −0.5] gives [1.3, 1.5]. This bypass lets the original input contribute directly without passing entirely through the branch transformation.');
     c.purpose=L('两段使用相同的相加组件。第一段的输入是 X；第二段的输入已变成交流后的 X1。各自取本段输入与本段修改量相加，再归一化。卡片数值示例采用下面标出的输入。','Both stages use the same addition operator. The first stage starts with X; the second starts with X1, the features after exchange. Add each stage’s own input and update, then normalize. The worked example uses the inputs labeled below.');
    }else if(['ln-attn','ln-ffn'].includes(id)){
     c.english='LAYERNORM';c.ability=L('分别整理每个词的四个特征','Normalize each token’s four features');
     c.meaning=L('每个词单独取自己的 4 个特征，减去这 4 个数的均值，再除以标准差。例如 [1, 1, 3, 3] 约变成 [−1, −1, 1, 1]。三个词分别计算，不把不同词混在一起。','For each token, center its four features by their mean and divide by their standard deviation. For example, [1, 1, 3, 3] becomes approximately [−1, −1, 1, 1]. Process the three tokens separately.');
     c.purpose=L('残差相加后，数值的整体偏移和大小可能变化。LayerNorm 先整理这些尺度，再交给下一段。两段用的是同一种运算，本例两块都取 γ = 1、β = 0；真实模型可以分别学习各自的参数。','Residual addition can change the overall offset and scale. LayerNorm adjusts them before the next stage. Both copies use the same operation and γ = 1, β = 0 here; real models may learn different parameters for each copy.');
    }else if(id==='self-heads'){
     c.meaning=L('沿用前面的双头注意力：每个词分别按两套注意力比例读取整句话的 V，再拼接并经过 Wo。这里输入是每词 4 个特征，每个头处理 2 个；输出仍是 3 个词、每词 4 个特征。','Reuse the two-head attention structure: each token reads V from the whole sentence with two attention patterns, then concatenates the results and applies Wo. Here each token has four features, with two per head; the output still has three tokens with four features each.');
     c.purpose=L('Q/K/V、打分、Softmax、A × V、拼接与 Wo 已经在这块内部。它负责跨词读取内容；残差相加和 LayerNorm 放在外面，由你搭建。','Q/K/V, scoring, Softmax, A × V, concatenation and Wo are inside this module. It reads across tokens; residual addition and LayerNorm remain outside for you to build.');
    }else if(id==='original-ffn-block'){
     c.meaning=L('把交流后的每个词分别送过 Linear → ReLU → Linear：4 个特征扩成 8 个，经 ReLU 再组合回 4 个。所有词用同一套权重，但各自计算；“爱”的 FFN 不会在这一步读取“猫”的向量。','Send each token after exchange through Linear → ReLU → Linear: expand four features to eight, apply ReLU, and combine back to four. All tokens share the weights but are processed independently; Love’s FFN does not read Cats’ vector at this step.');
     c.purpose=L('注意力已经带回上下文，FFN 再对这些特征做非线性加工，产生本词的修改量。用残差把修改量加回交流后的输入，再整理尺度，才完成这一层。','Attention has brought in context. The FFN applies nonlinear processing to those features and produces an update for that token. Add it back to the input after exchange and normalize the scale to finish the layer.');
    }
   }
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
 const reward=M.fusions[levelId];
 if(reward?.kind===id&&!M.levels[levelId].nodes.includes(id)){
  const s=M.solutions(levelId),sampleIndex=0,input=M.samplesFor(levelId)[sampleIndex].v,sources=M.sourceValues(s,input),values=reward.inputs.map(key=>sources[key]);
  const labels=levelId==='ffn'?{R:'R',Z:'Z'}:levelId==='encoder-decoder'?{R:'D ID',Z:'S ID'}:{R:reward.inputs.length===1?'X':'D',Z:'E'};
  return {sampleIndex,exampleSource:[labels.R,input],inputs:values.map((value,i)=>[labels[reward.inputs[i]],value]),output:[({'silu-ffn':'F','swiglu-ffn':'F','original-transformer':'L','source-embed':'Xp'})[id]||'Y',M.operations[id](values)]};
 }
 if(!M.levels[levelId]?.original)return previousExample(id,levelId);
 const s=M.solutions(levelId),sampleIndex=levelId==='relu'?2:0,input=M.samplesFor(levelId)[sampleIndex].v,ev=M.evaluate(s,input),n=s.nodes.find(n=>n.id===id);
 if(!n)return null;
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
