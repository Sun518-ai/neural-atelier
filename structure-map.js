/* A curriculum-wide locator. This describes architecture, never the player's wiring. */
(function(M){
const translations=new Map();
const L=(zh,en)=>{translations.set(zh,en);return zh;};
const tr=text=>I18n.language()==='en'?(translations.get(text)||text):text;
function prepare(value,seen=new WeakSet()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
 for(const key of Object.keys(value)){
  const item=value[key];
  if(typeof item==='string'&&translations.has(item))Object.defineProperty(value,key,{enumerable:true,configurable:true,get:()=>tr(item)});
  else if(item&&typeof item==='object')prepare(item,seen);
 }
}
// Only the static HTML labels need entries in the shared catalog.
for(const [zh,en]of [['结构地图','Structure map'],['关闭结构地图','Close structure map']])globalThis.AtelierEnglish[zh]??=en;
const copy={
 title:L('结构地图','Structure map'),open:L('展开结构地图','Open structure map'),close:L('关闭结构地图','Close structure map'),
 scope:L('本关所在位置','Lesson location'),exit:L('本关出口','Lesson outlet'),next:L('在完整结构中，接下来','Next in the complete structure'),
 focus:L('本关重点','Lesson focus'),reference:L('结构参考 · 不是棋盘接线答案','Architecture reference · not a wiring solution'),
 legend:L('实色标出本关所在区域；描边标出本关出口。','Filled blocks locate this lesson; an outline marks its outlet.'),
 original:L('原版 Transformer · 编码器与解码器','Original Transformer · encoder and decoder'),
 modern:L('现代扩展 · 解码器结构','Modern extensions · decoder architecture'),
 cloud:L('云端部署 · 计算与数据搬运','Cloud deployment · computation and data movement'),
 engine:L('端侧推理 · 执行视图','On-device inference · execution view'),
 units:L('特征','features'),ids:L('词编号','token IDs'),
};
const node=(id,zh,en)=>({id,label:L(zh,en)});
const flows={
 connection:[node('input','输入向量','Input vector'),node('wire','传递到下一块','Route to a module'),node('result','仍是向量','Still a vector')],
 classicFFN:[node('up','线性展开','Expand features'),node('activation','ReLU','ReLU'),node('down','线性压回','Project back'),node('result','FFN 输出 F','FFN output F')],
 residual:[node('branch','支路计算 F(X)','Branch F(X)'),node('add','加回本段输入 X','Add this stage’s X'),node('norm','LayerNorm（原版）','LayerNorm (original)')],
 input:[node('embedding','词编号 → 词向量','Token IDs → embeddings'),node('position','加正弦位置编码','Add sinusoidal positions'),node('result','送入注意力层','Into attention layers')],
 attention:[node('qkv','Q / K / V 投影','Q / K / V projections'),node('score','QKᵀ 缩放打分','Scaled QKᵀ scores'),node('softmax','Softmax → 权重 A','Softmax → weights A'),node('av','A × V → 汇合特征','A × V → mixed features'),node('wo','多头时拼接，再投影 Wo','Concat if multi-head, then Wo')],
 causal:[node('qkv','Q / K / V 投影','Q / K / V projections'),node('score','QKᵀ 缩放打分','Scaled QKᵀ scores'),node('mask','遮住未来分数','Mask future scores'),node('softmax','Softmax → 权重 A','Softmax → weights A'),node('av','A × V → 汇合特征','A × V → mixed features'),node('wo','多头时拼接，再投影 Wo','Concat if multi-head, then Wo')],
 encoder:[node('attention','自注意力','Self-attention'),node('add1','加回注意力的输入','Add attention’s input'),node('norm1','LayerNorm','LayerNorm'),node('ffn','ReLU FFN','ReLU FFN'),node('add2','加回 FFN 的输入','Add the FFN’s input'),node('norm2','LayerNorm → 本层输出','LayerNorm → layer output')],
 decoder:[node('attention','带遮罩的自注意力','Masked self-attention'),node('add1','加回自注意力的输入','Add self-attention’s input'),node('norm1','LayerNorm','LayerNorm'),node('cross','交叉注意力：读取编码器 E','Cross-attention: read encoder E'),node('add2','加回交叉注意力的输入','Add cross-attention’s input'),node('norm2','LayerNorm','LayerNorm'),node('ffn','ReLU FFN','ReLU FFN'),node('add3','加回 FFN 的输入','Add the FFN’s input'),node('norm3','LayerNorm → 本层输出','LayerNorm → layer output')],
 cross:[node('encoded','源句 → 编码器 → E','Source → encoder → E'),node('prepared','上一关：目标前缀 → 因果自注意力 + 残差 + LayerNorm → D','Previous lesson: target prefix → masked attention + residual + LayerNorm → D'),node('q','目标特征 D → Q 投影 → Q','Target features D → Q projection → Q'),node('kv','编码器输出 E → K / V 投影 → K / V','Encoder output E → K / V projections → K / V'),node('score','QKᵀ 缩放打分','Scaled QKᵀ scores'),node('softmax','Softmax → 权重 A','Softmax → weights A'),node('av','A × V → 源句信息','A × V → source information'),node('wo','输出投影 Wo','Output projection Wo'),node('add','加回交叉注意力的输入','Add cross-attention’s input'),node('norm','LayerNorm','LayerNorm')],
 generation:[node('layers','编码器与解码器','Encoder and decoder'),node('logits','词表投影 → 候选分数','Vocabulary projection → logits'),node('select','选出词编号','Select a token ID'),node('append','追加到目标前缀，再计算','Append to target prefix; repeat')],
 modernFFN:[node('up','内容投影 U = XW','Content projection U = XW'),node('gate','并行门投影 G = XWg','Parallel gate projection G = XWg'),node('silu','门值 SiLU(G)','Gate values SiLU(G)'),node('multiply','对应相乘 U ⊙ SiLU(G)','Pairwise U ⊙ SiLU(G)'),node('down','压回 → FFN 输出 F','Project back → FFN output F')],
 singleSiLU:[node('up','线性展开','Expand features'),node('silu','SiLU','SiLU'),node('down','压回 → FFN 输出 F','Project back → FFN output F')],
 modernAttention:[node('qkv','Q / K / V 投影','Q / K / V projections'),node('rope','旋转 Q/K：RoPE','Rotate Q/K: RoPE'),node('score','QKᵀ 缩放打分','Scaled QKᵀ scores'),node('mask','因果遮罩','Causal mask'),node('softmax','Softmax → 权重 A','Softmax → weights A'),node('av','A × V → 汇合特征','A × V → mixed features'),node('wo','输出投影 Wo','Output projection Wo')],
 modernLayer:[node('norm1','RMSNorm','RMSNorm'),node('attention','带 RoPE 的因果注意力','Causal attention with RoPE'),node('add1','加回这一段的输入','Add this stage’s input'),node('norm2','RMSNorm','RMSNorm'),node('ffn','SwiGLU FFN','SwiGLU FFN'),node('add2','加回 FFN 段的输入','Add the FFN stage’s input')],
 singleGPU:[node('input','CPU 中的输入','Input in CPU memory'),node('upload','传入 GPU 显存','Copy into GPU memory'),node('compute','投影 / 激活 / FFN','Projection / activation / FFN'),node('readback','结果读回 CPU','Read result back to CPU')],
 tensorParallel:[node('split','划分矩阵或特征','Partition weights or features'),node('compute','两张卡各算自己的部分','Each GPU computes its part'),node('merge','收集分量或相加部分和','Gather features or reduce sums'),node('result','得到完整特征','Complete feature vector')],
 engine:[node('memory','权重与 KV 的存储','Weight and KV storage'),node('prefill','Prefill：处理已有前缀','Prefill: process the prefix'),node('decode','Decode：逐次处理新位置','Decode: process each new position'),node('check','本关数值与性能验收','Numerical and performance checks'),node('next','后续层、词表与选词','Later layers, vocabulary, selection')],
};
// Each lesson has an explicit exit. Similar-shaped tensors can have different meanings.
const lessons={};
function locate(ids,family,regions,flow,focus,exit,where,output,next,note=''){
 for(const id of ids.split(' '))lessons[id]={family,regions,flow,focus,exit,where,output,next,note};
}
const classic=L('原版 · FFN 内部','Original · inside an FFN'),attn=L('原版 · 编码器的自注意力内部','Original · inside encoder self-attention');
const reuse=L('这是可复用的局部练习。原版编码器和解码器都使用 FFN；当前棋盘不是完整的一层。','This is a reusable local exercise. Both original encoders and decoders use FFNs; this board is not a complete layer.');
const valuesBypass=L('V 不经过打分或 Softmax，直接供 A × V 使用。单头无需拼接。','V bypasses scoring and Softmax and feeds A × V directly. A single head needs no concatenation.');
const residualNote=L('残差从每一段自己的输入绕过支路；图中的“加回输入”不是加回整模型最初的输入。','Each residual bypasses its own branch from that stage’s input, not the initial input of the entire model.');
locate('wire','original',['encoder','decoder'],'connection',['wire'],'result',L('通用积木 · 向量传递','Reusable building block · vector routing'),L('原样传出的向量','Unchanged vector'),L('可送入投影、注意力或 FFN。','Can feed a projection, attention or FFN.'),L('连线是通用操作，不对应 Transformer 中某个专属层。','Routing is a general operation, not a dedicated Transformer layer.'));
locate('projection workshop','original',['encoder','decoder'],'classicFFN',['up'],'up',classic,L('展开后的特征 P','Expanded features P'),L('在原版 FFN 中，接下来经过 ReLU。','In an original FFN, ReLU follows.'),reuse);
locate('relu','original',['encoder','decoder'],'classicFFN',['activation'],'activation',classic,L('ReLU 激活特征 A','ReLU activations A'),L('送入线性压回投影，得到 FFN 输出。','Feed the down projection to produce the FFN output.'),reuse);
locate('down-projection','original',['encoder','decoder'],'classicFFN',['down'],'down',classic,L('压回后的特征 F','Projected-back features F'),L('在完整 FFN 中，这个宽度可与本段原输入相加。','In a complete FFN, this width can be added to the stage’s input.'),L('本关只练压回投影，输入支路没有 ReLU；后续关再组装完整 FFN。','This lesson isolates the down projection without ReLU in its input branch; later lessons assemble the full FFN.'));
locate('original-ffn pack-ffn','original',['encoder','decoder'],'classicFFN',['up','activation','down'],'result',classic,L('FFN 的变换 F','FFN transformation F'),L('加回 FFN 的输入，然后 LayerNorm（原版）。','Add the FFN’s input, then LayerNorm (original).'),reuse);
locate('residual','original',['encoder','decoder'],'residual',['add'],'add',L('通用积木 · 残差连接','Reusable building block · residual connection'),L('相加后的特征 X + F(X)','Features after X + F(X)'),L('原版结构中通常接 LayerNorm。','LayerNorm normally follows in the original architecture.'),L('本关支路是线性变换；残差也可以包住 Attention 或 FFN。','This exercise uses a linear branch; a residual can also wrap Attention or an FFN.'));
locate('layernorm','original',['encoder','decoder'],'residual',['norm'],'norm',L('原版 · 子层后的 LayerNorm','Original · LayerNorm after a sublayer'),L('归一化后的特征','Normalized features'),L('交给下一个子层或下一层。','Pass to the next sublayer or layer.'),L('本关单独练归一化，不代表完整的残差子层。','This isolates normalization; it is not a complete residual sublayer.'));
locate('add-norm','original',['encoder','decoder'],'residual',['branch','add','norm'],'norm',L('原版 · FFN 子层与外部残差','Original · FFN sublayer and its residual'),L('FFN + 残差 + LayerNorm 的结果','Result of FFN + residual + LayerNorm'),L('送往下一层；Attention 子层在本关之外。','Pass to the next layer; attention is outside this lesson.'),residualNote);
locate('embedding','original',['source','target'],'input',['embedding'],'embedding',L('原版 · 模型输入准备','Original · input preparation'),L('查表得到的词向量 X','Looked-up embeddings X'),L('加入正弦位置编码，再进入网络层。','Add sinusoidal positions before entering the layers.'));
locate('positions wider-features','original',['source','target'],'input',['embedding','position'],'position',L('原版 · 模型输入准备','Original · input preparation'),L('带位置的词特征','Position-enriched token features'),L('用于注意力的 Q/K/V 投影。','Feed Q/K/V projections in attention.'),L('位置加在输入词向量上；这里不是旋转 Q/K 的 RoPE。','Positions are added to input embeddings; this is not RoPE rotation of Q/K.'));
locate('qkv','original',['encoder'],'attention',['qkv'],'qkv',attn,L('值向量 V（本关只验收 V）','Value vectors V (only V is checked here)'),L('由注意力权重 A 加权汇合。Q/K 在别的支路生成 A。','Mixed using attention weights A, which Q/K produce on a separate branch.'),valuesBypass);
locate('scores','original',['encoder'],'attention',['score'],'score',attn,L('匹配分数 S，尚不是比例','Matching scores S, not weights yet'),L('经过 Softmax，才变成注意力权重 A。','Softmax converts them into attention weights A.'),valuesBypass);
locate('softmax pack-scores','original',['encoder'],'attention',['softmax'],'softmax',attn,L('注意力权重 A（中间结果）','Attention weights A (intermediate)'),L('与 V 做加权求和 A × V。','Weight and sum V using A × V.'),valuesBypass);
locate('weighted-sum','original',['encoder'],'attention',['av'],'av',attn,L('按比例汇合后的特征 O','Weighted-sum features O'),L('单头接输出投影 Wo；多头先拼接再投影。','Apply Wo for one head; concatenate before Wo for multiple heads.'),valuesBypass);
locate('self-attention multihead','original',['encoder'],'attention',['qkv','score','softmax','av','wo'],'wo',attn,L('Attention 输出（尚未加残差）','Attention output (before residual)'),L('加回 Attention 的输入，再做 LayerNorm。','Add attention’s input, then apply LayerNorm.'),valuesBypass);
locate('encoder-layer','original',['encoder','memory'],'encoder',['attention','add1','norm1','ffn','add2','norm2'],'norm2',L('原版 · 一层完整编码器','Original · one complete encoder layer'),L('本层输出 E','Encoder layer output E'),L('继续下一编码器层；最后一层的 E 供解码器交叉注意力读取。','Continue to the next encoder layer; the final E supplies decoder cross-attention.'),residualNote);
locate('causal','original',['decoder'],'causal',['mask'],'softmax',L('原版 · 解码器 → 带遮罩的自注意力','Original · decoder → masked self-attention'),L('注意力权重 A（中间结果）','Attention weights A (intermediate)'),L('与 V 汇合，再做输出投影；之后才是残差、归一化。','Mix V, then output projection; residual and normalization follow.'),valuesBypass);
locate('masked-multihead','original',['decoder'],'causal',['qkv','score','mask','softmax','av','wo'],'wo',L('原版 · 组装双头因果注意力','Original · assemble two-head causal attention'),L('双头因果注意力输出（尚未加残差）','Two-head causal attention output (before residual)'),L('收成组件；下一关加回输入，再做 LayerNorm。','Package as a module; add the input and apply LayerNorm in the next lesson.'),valuesBypass);
locate('decoder-self','original',['decoder'],'decoder',['attention','add1','norm1'],'norm1',L('原版 · 解码器的第一个子层','Original · first decoder sublayer'),L('自注意力 + 残差 + LayerNorm 的结果','Self-attention + residual + LayerNorm result'),L('送入交叉注意力，读取编码器的 E。','Feed cross-attention to read encoder E.'),residualNote);
locate('cross-attention','original',['memory','decoder'],'cross',['q','kv','score','softmax','av','wo'],'wo',L('原版 · 解码器 → 交叉注意力子层','Original · decoder → cross-attention sublayer'),L('交叉注意力输出（尚未加残差）','Cross-attention output (before residual)'),L('先加回交叉注意力的输入并做 LayerNorm，再进入 FFN。','Add cross-attention’s input and apply LayerNorm before entering the FFN.'),L('棋盘下方 D 是上一关已算好的目标特征，上方 E 是编码器输出。D / E 都不是现成的 Q / K / V，必须分别投影。源句完整可读；结果仍对应目标位置。','The lower board input D contains target features already computed by the previous lesson; the upper input E is the encoder output. Neither is a ready-made Q, K or V: they need separate projections. The whole source is readable; results still correspond to target positions.'));
locate('decoder-layer','original',['decoder'],'decoder',['attention','add1','norm1','cross','add2','norm2','ffn','add3','norm3'],'norm3',L('原版 · 一层完整解码器','Original · one complete decoder layer'),L('本层输出 D','Decoder layer output D'),L('送往下一解码器层；最后一层之后才接词表投影。','Feed the next decoder layer; vocabulary projection follows the final layer.'),residualNote);
locate('encoder-decoder','original',['source','encoder','memory','target','decoder','head'],'generation',['layers','logits'],'logits',L('原版 · 编码器、解码器与词表头','Original · encoder, decoder and vocabulary head'),L('词表分数 L（还没有选词）','Vocabulary logits L (no token selected yet)'),L('从词表分数选出下一个词，再追加到目标前缀。','Select the next token from logits, then append it to the target prefix.'));
locate('vocabulary-scores','original',['head'],'generation',['logits'],'logits',L('完整模型末端 · 词表投影','End of the model · vocabulary projection'),L('每个候选词的分数 L','A score L for each candidate token'),L('做选词；按概率采样时会先用 Softmax。','Select a token; probability sampling first applies Softmax.'));
locate('vocabulary','original',['head'],'generation',['select'],'select',L('完整模型末端 · 选词','End of the model · token selection'),L('预测词的编号（本练习每个位置一个）','Predicted token IDs (one per position in this exercise)'),L('实际自回归生成通常取最后位置的新词，追加后继续。','Autoregressive generation normally appends the new token from the last position and continues.'));
locate('autoregressive','original',['head','target'],'generation',['append'],'append',L('模型外部 · 逐词生成循环','Outside the model · generation loop'),L('追加新词后的上下文','Context with the new token appended'),L('进入下一次预测。','Begin the next prediction.'),L('本关用固定转移表隔离控制流程，不运行完整 Transformer。','This lesson isolates the control loop using a fixed transition table, not a complete Transformer.'));
const modern=L('现代扩展 · FFN 内部','Modern extension · inside an FFN');
locate('activation','modern',['layers'],'singleSiLU',['silu'],'silu',modern,L('SiLU 激活特征 S','SiLU activations S'),L('线性压回后才是 FFN 输出。','The down projection produces the FFN output.'),L('这是单支路激活练习，还没有 SwiGLU 的门分支。','This is a single-branch activation exercise, without a SwiGLU gate branch.'));
locate('plain-ffn','modern',['layers'],'singleSiLU',['up','silu','down'],'down',modern,L('单支路 SiLU FFN 的输出 F','Single-branch SiLU FFN output F'),L('可作为残差支路的变换。','Can serve as the transformation in a residual branch.'),L('这是一种单支路变体；后续 SwiGLU 才加入门分支。','This is a single-branch variant; the later SwiGLU introduces a gate branch.'));
locate('gate-projection','modern',['layers'],'modernFFN',['gate'],'gate',modern,L('门投影结果 G（还未激活）','Gate projection G (not yet activated)'),L('先算 SiLU(G)，再调节内容特征 U。','Apply SiLU(G), then modulate the content features U.'));
locate('pairwise gating','modern',['layers'],'modernFFN',['multiply'],'multiply',modern,L('对应相乘后的特征 H','Elementwise product features H'),L('经过压回投影得到 FFN 输出。','Pass through the down projection for the FFN output.'),L('内容 U 与门系数配对相乘；不是跨词汇合，也不是残差相加。','Content U is multiplied by gate coefficients, not mixed across tokens or added as a residual.'));
locate('swiglu','modern',['layers'],'modernFFN',['up','gate','silu','multiply','down'],'down',modern,L('SwiGLU FFN 的输出 F','SwiGLU FFN output F'),L('加回这一段的原输入。','Add this stage’s original input.'));
locate('normalize','modern',['layers'],'modernLayer',['norm1'],'norm1',L('现代扩展 · 子层计算前的归一化','Modern extension · normalization before a sublayer'),L('RMSNorm 后的特征 Z','Features Z after RMSNorm'),L('供下一段 Attention 或 FFN 使用。','Feed the following attention or FFN.'),L('RMSNorm 可用在两个子层前；这里借注意力入口定位。原版则把 LayerNorm 放在残差相加后。','RMSNorm can precede either sublayer; the attention entrance is shown here. The original places LayerNorm after residual addition.'));
locate('ffn','modern',['layers'],'modernLayer',['ffn','add2'],'add2',L('现代扩展 · FFN 半层','Modern extension · the FFN half of a layer'),L('SwiGLU + 残差后的特征','Features after SwiGLU + residual'),L('送往后续层；本关没有 Attention 半层。','Feed later layers; the attention half is absent here.'),L('Z 已在本关之外经过 RMSNorm；棋盘计算 SwiGLU(Z)，再加回未归一化的 R。','Z is already RMS-normalized outside this lesson; the board computes SwiGLU(Z), then adds the unnormalized R.'));
locate('rotation','modern',['layers'],'modernAttention',['rope'],'rope',L('现代扩展 · 注意力的位置处理','Modern extension · positions inside attention'),L('旋转后的 Q（本关只练 Q）','Rotated Q (only Q is exercised here)'),L('完整 RoPE 还要旋转 K，再算 Q/K 分数。','Full RoPE also rotates K, then computes Q/K scores.'),valuesBypass);
locate('rope','modern',['layers'],'modernAttention',['rope','score'],'score',L('现代扩展 · 注意力的位置处理','Modern extension · positions inside attention'),L('带相对位置信息的分数 S','Scores S with relative-position information'),L('因果遮罩后送入 Softmax。','Apply the causal mask, then Softmax.'),valuesBypass);
locate('aggregation','modern',['layers'],'modernAttention',['av'],'av',L('现代扩展 · 注意力内部','Modern extension · inside attention'),L('按比例汇合的特征 O','Weighted-sum features O'),L('接输出投影 Wo，再进入残差。','Apply output projection Wo, then the residual.'),valuesBypass);
locate('attention','modern',['layers'],'modernAttention',['qkv','rope','score','mask','softmax','av','wo'],'wo',L('现代扩展 · 完整注意力支路','Modern extension · complete attention branch'),L('Attention 输出（尚未加残差）','Attention output (before residual)'),L('加回本段输入，然后进入 FFN 半层。','Add the stage’s input, then enter the FFN half.'),valuesBypass);
locate('block','modern',['layers'],'modernLayer',['norm1','attention','add1','norm2','ffn','add2'],'add2',L('现代扩展 · 一层完整解码器块','Modern extension · one complete decoder block'),L('本层输出 Y','Layer output Y'),L('继续后续层；模型末端还有最终归一化和词表投影。','Continue through later layers; the model ends with final normalization and vocabulary projection.'),residualNote);
const cloud=L('云端 · 线性层 / FFN 的执行方式','Cloud · executing linear layers / FFNs');
locate('single-upload','cloud',['cpu','gpu','result'],'singleGPU',['upload','compute','readback'],'readback',cloud,L('读回 CPU 的投影特征','Projected features read back to CPU'),L('真实网络中可供激活或其他算子继续计算。','Can feed an activation or another operator in a real network.'),L('这里练设备间传递与线性投影，不是完整 Transformer 推理。','This exercises device transfers and a linear projection, not complete Transformer inference.'));
locate('single-fallback single-resident','cloud',['cpu','gpu','result'],'singleGPU',['compute'],'readback',cloud,L('读回 CPU 的 ReLU FFN 特征','ReLU FFN features read back to CPU'),L('在网络结构中可接残差；本关另验收内存位置与搬运量。','Can feed a residual in the network; this lesson also checks memory locations and copy volume.'),L('比较中途回 CPU 与留在 GPU 的执行路径，FFN 的数学目标不变。','Compare CPU fallback with GPU residency; the FFN’s mathematical target stays the same.'));
locate('tp-columns','cloud',['gpu','gpu2','result'],'tensorParallel',['split','compute','merge'],'result',cloud,L('拼齐的投影特征（不同分量）','Gathered projected features (distinct components)'),L('可交给激活；不是将两份部分和相加。','Can feed an activation; these are not partial sums to add.'));
locate('tp-rows','cloud',['gpu','gpu2','result'],'tensorParallel',['split','compute','merge'],'result',cloud,L('相加部分和后的完整特征','Complete features after summing partials'),L('可供后续算子使用；Reduce 不是残差。','Can feed subsequent operators; Reduce is not a residual.'));
locate('tp-ffn','cloud',['gpu','gpu2','result'],'tensorParallel',['split','compute','merge'],'result',cloud,L('两卡合算的 ReLU FFN 输出','ReLU FFN output computed across two GPUs'),L('在完整层中接入残差。','Feed a residual in a complete layer.'),L('拆的是 FFN 的计算与存储，不是在网络里增加一种新层。','This partitions FFN computation and storage; it does not add a new kind of network layer.'));
const engineNote=L('这是教学执行流水线与成本模型，不是某款真实模型的完整计算图；当前数值出口仍为特征，未做词表选词。','This is a teaching execution pipeline and cost model, not a real model’s complete graph. Its numerical outlet still contains features; vocabulary selection is not performed.');
for(const [ids,focus,where]of [
 ['placement layout parallel',['prefill'],L('端侧 · 算子放在哪里执行','On-device · where operators execute')],
 ['batching',['prefill'],L('端侧 · Prefill 的批处理','On-device · batched prefill')],
 ['kv-cache',['decode'],L('端侧 · Decode 复用历史 K/V','On-device · decoding with cached K/V')],
 ['quantization',['memory'],L('端侧 · 权重与 KV 内存','On-device · weight and KV memory')],
 ['fusion',['prefill','decode'],L('端侧 · 合并执行与减少搬运','On-device · fused execution and fewer transfers')],
 ['session',['memory','prefill'],L('端侧 · 多轮前缀复用','On-device · reuse across turns')],
 ['capstone',['memory','prefill','decode'],L('端侧 · 综合执行验收','On-device · complete execution challenge')]
])locate(ids,'engine',['cpu','gpu','ane'],'engine',focus,'check',where,L('教学流水线输出特征','Teaching pipeline output features'),L('真实模型还需要后续层及词表投影，再选出新词。','A real model still needs later layers and vocabulary projection before selecting a token.'),engineNote);
// Pairwise multiplication is deliberately taught before SiLU is added.
flows.pairwise=flows.modernFFN.filter(n=>n.id!=='silu').map(n=>n.id==='multiply'?node('multiply','对应相乘 U ⊙ G','Pairwise U ⊙ G'):n);
lessons.pairwise={...lessons.pairwise,flow:'pairwise',note:L('这里只练 U ⊙ G，门值尚未经过 SiLU。地图展示它在门控 FFN 中的位置；下一关再补激活。','This isolates U ⊙ G without SiLU on the gate. The map locates it in a gated FFN; the next lesson adds the activation.')};
for(const id of ['quantization','session','kv-cache'])lessons[id].regions=['memory','gpu'];
for(const data of [copy,flows,lessons])prepare(data);
function get(id){const entry=lessons[id];if(!entry)throw new Error('Missing structure map for '+id);return {...entry,steps:flows[entry.flow],shape:M.levels[id].tokenOutput?M.levels[id].sinkDim+' '+copy.ids:(M.levels[id].sequence?'3 × '+M.levels[id].sinkDim/3:'1 × '+M.levels[id].sinkDim)};}
const esc=s=>String(tr(s)).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function diagram(entry){
 const n=(id,x,y,zh,en)=>({id,x,y,label:L(zh,en)});
 let nodes,paths,height=122;
 if(entry.family==='original'){
  nodes=[n('source',3,4,'源句输入','Source'),n('encoder',81,4,'编码器','Encoder'),n('memory',159,4,'源表征 E','Memory E'),n('target',3,78,'目标前缀','Target'),n('decoder',81,78,'解码器','Decoder'),n('head',159,78,'词表/选词','Readout')];
  paths=['M61 18H79m-4 -3l4 3 -4 3','M139 18H157m-4 -3l4 3 -4 3','M188 32V51H110V76m-3 -4l3 4 3 -4','M61 92H79m-4 -3l4 3 -4 3','M139 92H157m-4 -3l4 3 -4 3','M188 106V116H32V108m-3 4l3 -4 3 4'];
 }else if(entry.family==='modern'){
  nodes=[n('input',3,4,'词向量','Embedding'),n('layers',81,4,'解码器层','Layers'),n('head',159,4,'Norm/词表','Norm/head'),n('selection',159,78,'选词','Select'),n('prefix',3,78,'更新前缀','New prefix')];
  paths=['M61 18H79m-4 -3l4 3 -4 3','M139 18H157m-4 -3l4 3 -4 3','M188 32V76m-3 -4l3 4 3 -4','M159 92H63m4 -3l-4 3 4 3','M32 78V34m-3 4l3 -4 3 4'];
 }else if(entry.family==='cloud'){
  nodes=[n('cpu',3,41,'CPU 内存','CPU RAM'),n('gpu',81,4,'GPU 0','GPU 0'),n('gpu2',81,78,'GPU 1','GPU 1'),n('result',159,41,'完整结果','Full result')];
  paths=['M61 55H70V18H79m-4 -3l4 3 -4 3','M70 55V92H79m-4 -3l4 3 -4 3','M139 18H148V55H157m-4 -3l4 3 -4 3','M139 92H148V55'];
 }else{
  nodes=[n('memory',81,4,'权重 / KV','Weights/KV'),n('cpu',3,67,'CPU','CPU'),n('gpu',81,67,'GPU','GPU'),n('ane',159,67,'ANE','ANE')];
  paths=['M110 32V45H32V65m-3 -4l3 4 3 -4','M110 45V65m-3 -4l3 4 3 -4','M110 45H188V65m-3 -4l3 4 3 -4'];
 }
 return `<svg class="structure-overview" viewBox="0 0 220 ${height}" role="img" aria-label="${esc(copy[entry.family]+' · '+entry.where)}"><g class="structure-edges">${paths.map(d=>`<path d="${d}"/>`).join('')}</g>${nodes.map(n=>`<g data-map-region="${n.id}" class="${entry.regions.includes(n.id)?'map-region-active':''}"><rect x="${n.x}" y="${n.y}" width="58" height="28" rx="6"/><text x="${n.x+29}" y="${n.y+18}" text-anchor="middle">${esc(n.label)}</text></g>`).join('')}</svg>`;
}
function render(id,full=false){
 const entry=get(id),e=esc;
 const outlet=`<div class="structure-outlet"><small>${e(copy.exit)}</small><strong>${e(entry.output)}</strong><code>${e(entry.shape)}</code></div>`;
 if(!full)return `<details class="structure-compact" open><summary>${e(copy.title)}</summary><button type="button" data-open-structure aria-haspopup="dialog" aria-label="${e(copy.open)}"><div class="structure-mini-caption">${e(copy[entry.family])}<span aria-hidden="true">↗</span></div>${diagram(entry)}<span class="structure-location">${e(entry.where)}</span></button>${outlet}</details>`;
 const step=(n)=>`<li data-map-step="${n.id}" class="${entry.focus.includes(n.id)?'map-step-focus ':''}${entry.exit===n.id?'map-step-exit':''}"><span>${e(n.label)}</span>${entry.exit===n.id?`<b>${e(copy.exit)}</b>`:''}</li>`;
 let route=entry.steps.map(step).join('');
 if(entry.flow==='cross'){
  const ns=Object.fromEntries(entry.steps.map(n=>[n.id,n]));
  route=`<li class="map-branch-pair"><ol>${step(ns.prepared)}${step(ns.q)}</ol><ol>${step(ns.encoded)}${step(ns.kv)}</ol></li>`+entry.steps.filter(n=>!['prepared','encoded','q','kv'].includes(n.id)).map(step).join('');
 }
 if(entry.flow==='modernFFN'||entry.flow==='pairwise'){
  const ns=Object.fromEntries(entry.steps.map(n=>[n.id,n]));
  route=`<li class="map-branch-pair"><ol>${step(ns.up)}</ol><ol>${step(ns.gate)}${ns.silu?step(ns.silu):''}</ol></li>${step(ns.multiply)}${step(ns.down)}`;
 }
 const mapNote=entry.family==='original'?L('源句进入编码器；目标前缀与编码器 E 一起进入解码器。图中一个框可代表多层。','The encoder reads the source; the decoder reads the target prefix and encoder E. Each box can represent multiple layers.'):entry.family==='modern'?L('这里是解码器型扩展，没有原版的编码器交叉注意力支路。选出的新词会追加回前缀。','These are decoder-style extensions without the original encoder cross-attention branch. Selected tokens are appended to the prefix.'):L('设备位置图，不表示固定的算子先后顺序。数学结果与执行成本分别验收。','Device locations, not a fixed operator sequence. Mathematical results and execution costs are checked separately.');
 return `<div class="structure-context"><p class="structure-family">${e(copy[entry.family])}</p><h3>${e(entry.where)}</h3><p class="structure-reference">${e(copy.reference)}</p></div><div class="structure-expanded-grid"><section class="structure-global">${diagram(entry)}<p>${e(mapNote)}</p>${outlet}<div class="structure-next"><small>${e(copy.next)}</small><p>${e(entry.next)}</p></div></section><section class="structure-local"><h4>${e(copy.focus)}</h4><ol class="structure-flow" data-map-flow="${entry.flow}">${route}</ol><p class="structure-map-legend">${e(copy.legend)}</p>${entry.note?`<p class="structure-note">${e(entry.note)}</p>`:''}</section></div>`;
}
M.structureMap={copy,get,lessons,flows,render};
})(window.NeuralPrologue);
