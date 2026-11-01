// Card copy describes the same toy operators as model.js. Numbers are computed, not baked into the art.
export const moduleCards = {
  project: {
    number:'01',seal:I18n.t("映"),english:'LINEAR PROJECTION',family:I18n.t("投影"),color:'#397f71',
    ability:I18n.t("用权重组合出新特征"),formula:'P = X × W',
    meaning:I18n.t("输入向量包含 2 个数。取权重矩阵的一列，分别乘输入里的两个数，再把乘积相加，得到一个输出特征。"),
    purpose:I18n.t("矩阵有 4 列，就能生成 4 个特征。同一套权重可以处理每个 token 的向量，改变的是特征的表示方式。"),
    input:I18n.t("输入 X"),output:I18n.t("投影结果 P"),weight:'2 × 4',trait:I18n.t("线性变换"),stage:1
  },
  gate: {
    number:'01', seal:I18n.t("门"), english:'GATE PROJECTION', family:I18n.t("投影"), color:'#75628e',
    ability:I18n.t("为内容准备调节系数"), formula:'G = Z × Wg',
    meaning:I18n.t("和内容投影一样，这里做的是矩阵乘法。同一份输入乘 Wg 得到 G，乘另一套权重 Wu 得到内容特征 U。"),
    purpose:I18n.t("G 还要经过 SiLU，才得到系数 S；S 与 U 的对应位置相乘，形成 H。系数随输入变化，可以缩小、放大或改变特征的符号。"),
    input:I18n.t("归一化输入 Z"), output:I18n.t("门分支 G"), weight:'2 × 4', trait:I18n.t("线性变换"), stage:0
  },
  up: {
    number:'02', seal:I18n.t("展"), english:'UP PROJECTION', family:I18n.t("投影"), color:'#397f71',
    ability:I18n.t("生成等待调节的特征"), formula:'U = Z × Wu',
    meaning:I18n.t("本模块把输入乘 Wu，生成 4 个内容特征 U。门投影接收同一份输入，乘另一套权重 Wg，生成 G；两者的计算方式相同，权重和用途不同。"),
    purpose:I18n.t("U 提供要使用的特征值；门分支经 SiLU 得到系数 S，再与 U 逐项相乘。推理时两套权重固定，换一个输入，特征值和调节系数都会重新计算。"),
    input:I18n.t("归一化输入 Z"), output:I18n.t("内容分支 U"), weight:'2 × 4', trait:I18n.t("线性变换"), stage:0
  },
  silu: {
    number:'03', seal:I18n.t("启"), english:'SiLU ACTIVATION', family:I18n.t("激活"), color:'#a8793b',
    ability:I18n.t("把输入 G 算成输出 S"), formula:'S = SiLU(G)',
    meaning:I18n.t("SiLU 是函数名。G 是门投影算出的输入向量，S 是经过 SiLU 后的输出向量。G 中的每个数各算一次，得到 S 中对应的数。"),
    purpose:I18n.t("SiLU 会把较大的负数压近 0，较大的正数则接近原值。输出 S 接着与内容特征 U 相乘，成为逐项调节特征的系数。S 仍可以为负，也可以超过 1。"),
    input:I18n.t("门分支 G"), output:I18n.t("激活后的门值 S"), weight:I18n.t("无"), trait:I18n.t("逐项非线性"), stage:1
  },
  multiply: {
    number:'04', seal:I18n.t("合"), english:'ELEMENTWISE GATING', family:I18n.t("门控"), color:'#3e8078',
    ability:I18n.t("让门值作用于内容"), formula:'Hᵢ = Sᵢ × Uᵢ',
    meaning:I18n.t("把两个向量的对应特征配对：第 1 个乘第 1 个，第 2 个乘第 2 个。4 对乘积组成新的 4 维向量 H。"),
    purpose:I18n.t("内容特征的贡献随当前输入产生的门值而改变。这里逐项相乘；矩阵乘法才会把多个乘积求和。"),
    input:I18n.t("门值 S 与内容 U"), output:I18n.t("门控结果 H"), weight:I18n.t("无"), trait:I18n.t("对应位置相乘"), stage:2
  },
  down: {
    number:'05', seal:I18n.t("归"), english:'DOWN PROJECTION', family:I18n.t("投影"), color:'#637e63',
    ability:I18n.t("汇成两维变换"), formula:'F = H × Wd',
    meaning:I18n.t("把门控后的 4 个特征乘上 4 × 2 权重矩阵。每个输出都由 4 项乘积求和，最终得到 2 维的 FFN 变换 F。"),
    purpose:I18n.t("把扩展后的特征组合回原宽度。F 与最初的输入 R 都是 2 维，下一步才能按对应位置相加。"),
    input:I18n.t("门控结果 H"), output:I18n.t("FFN 变换 F"), weight:'4 × 2', trait:I18n.t("线性变换"), stage:3
  },
  add: {
    number:'06', seal:I18n.t("续"), english:'RESIDUAL ADDITION', family:I18n.t("残差"), color:'#a17949',
    ability:I18n.t("把变化加回原输入"), formula:'Y = R + F',
    meaning:I18n.t("R 是进入 FFN 前的特征，F 是支路算出的修改量。对应位置相加得到 Y：正的修改量让数值增加，负的让它减少。"),
    purpose:I18n.t("支路可以学习需要改动的部分。无需修改的位置只要输出 0，原值就能通过直连路径继续传递；不必让支路再学一遍如何复制原值。相加也可能抵消数值，因此并不保证原信息完整保留。"),
    input:I18n.t("原始输入 R 与变换 F"), output:I18n.t("本层输出 Y"), weight:I18n.t("无"), trait:I18n.t("对应位置相加"), stage:4
  }
};

I18n.prepare(moduleCards);

export function cardFor(id,levelId){
 if(!moduleCards[id])return null;
 const card={...moduleCards[id]};
 if(levelId==='ffn'){
  if(id==='gate'||id==='up')card.meaning=I18n.t("输入先归一化为 Z。")+' '+card.meaning;
  return card;
 }
 if(id==='gate'||id==='up'){
  card.formula=card.formula.replace('Z','X');
  card.input=I18n.t("输入 X");
 }
 if(id==='silu'&&levelId==='activation'){
  card.ability=I18n.t("把输入 P 算成输出 S");card.formula='S = SiLU(P)';
  card.input=I18n.t("投影结果 P");card.output=I18n.t("激活特征 S");
  card.meaning=I18n.t("SiLU 是函数名。P 是线性投影算出的输入向量，S 是经过 SiLU 后的输出向量。P 中的每个数各算一次，得到 S 中对应的数。");
  card.purpose=I18n.t("乘一个固定比例会把所有数一起缩放；SiLU 的缩放比例随数值变化。较大的负数被压近 0，较大的正数接近原值，因此它能改变特征之间的数值关系。");
 }
 if(id==='down'&&levelId==='residual'){
  card.formula='F = P × Wd';card.meaning=I18n.t("接过投影 P 中的 4 个数，乘上 4 × 2 权重矩阵。每个输出由 4 项乘积求和，得到 2 维变换 F。");card.purpose=I18n.t("修改量 F 与输入 X 同为 2 维，才能逐项加到 X 上，得到更新后的特征。");
 }
 if(id==='add'&&levelId==='residual'){
  card.formula='Y = X + F';card.meaning=I18n.t("X 是原有特征，F 是两块投影算出的修改量。对应位置相加得到 Y：正的修改量让数值增加，负的让它减少。");
  card.input=I18n.t("原有特征 X 与修改量 F");
 }
 return card;
}

export function exampleFor(M,id,levelId='ffn'){
  const shared=['gating','ffn','residual'].includes(levelId),compare=id==='gate'||id==='up',R=shared?[1,0]:[1,1],Z=levelId==='ffn'?M.norm(R):R,P=M.linear(R,M.weights.project);
  const meta={sampleIndex:shared?0:2,exampleSource:[levelId==='ffn'?'R':'X',R]};
  if(id==='project')return {...meta,inputs:[['X',R]],output:['P',P]};
  if(levelId==='activation')return {...meta,inputs:[['P',P]],output:['S',P.map(M.silu)],activation:{feature:2}};
  if(levelId==='residual'){
   const F=M.linear(P,M.weights.down);
   return id==='down'?{...meta,inputs:[['P',P]],output:['F',F]}:{...meta,inputs:[['X',R],['F',F]],output:['Y',R.map((x,i)=>x+F[i])],addition:{feature:0}};
  }
  const G=M.linear(Z,M.weights.gate),U=M.linear(Z,M.weights.up),S=G.map(M.silu),H=S.map((x,i)=>x*U[i]),F=M.linear(H,M.weights.down),Y=R.map((x,i)=>x+F[i]),source=levelId==='ffn'?'Z':'X';
  const paths={gate:[[[source,Z]],['G',G]],up:[[[source,Z]],['U',U]],silu:[[['G',G]],['S',S]],multiply:[[['S',S],['U',U]],['H',H]],down:[[['H',H]],['F',F]],add:[[['R',R],['F',F]],['Y',Y]]};
  return {...meta,inputs:paths[id][0],output:paths[id][1],...(compare?{comparison:{input:[source,Z],rows:[['U',U],['G',G],['S',S],['H',H]],feature:2}}:{}),...(id==='silu'?{activation:{feature:2,content:U,product:H}}:{}),...(id==='add'?{addition:{feature:0}}:{})};
}
