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
    ability:I18n.t("生成门分支"), formula:'G = Z × Wg',
    meaning:I18n.t("接过归一化后的向量 Z，用权重矩阵把 2 个特征组合成 4 个数。这一支接着经过 SiLU，形成调节内容的门值。"),
    purpose:I18n.t("同一份输入产生两条支路：一条提供内容，一条决定各个内容特征如何参与计算。这里负责后者。"),
    input:I18n.t("归一化输入 Z"), output:I18n.t("门分支 G"), weight:'2 × 4', trait:I18n.t("线性变换"), stage:0
  },
  up: {
    number:'02', seal:I18n.t("展"), english:'UP PROJECTION', family:I18n.t("投影"), color:'#397f71',
    ability:I18n.t("展开内容特征"), formula:'U = Z × Wu',
    meaning:I18n.t("同样接收 Z，但使用另一套权重。2 个输入特征被重新组合为 4 个内容特征，等待与门值逐项相乘。"),
    purpose:I18n.t("更宽的中间向量提供更多特征组合的空间。门投影与内容投影的权重分别学习，所以两支会产生不同的数。"),
    input:I18n.t("归一化输入 Z"), output:I18n.t("内容分支 U"), weight:'2 × 4', trait:I18n.t("线性变换"), stage:0
  },
  silu: {
    number:'03', seal:I18n.t("启"), english:'SiLU ACTIVATION', family:I18n.t("激活"), color:'#a8793b',
    ability:I18n.t("让门值连续变化"), formula:'SiLU(x) = x / (1 + e⁻ˣ)',
    meaning:I18n.t("对门分支中的每一个数单独应用同一个函数。正负数的变化程度不同，4 个数处理后仍然是 4 个数。"),
    purpose:I18n.t("给网络加入非线性，避免多次线性变换只相当于一次线性变换。门值是连续数值，也可以是负数。"),
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
    meaning:I18n.t("接回进入 FFN 前保留的原始输入 R，与这次算出的变换 F 逐项相加。得到的 Y 仍然是一个 2 维向量。"),
    purpose:I18n.t("原输入通过旁路继续传递，FFN 在它的基础上增加一次变化。这个向量仍对应原来的 token，可以交给下一层。"),
    input:I18n.t("原始输入 R 与变换 F"), output:I18n.t("本层输出 Y"), weight:I18n.t("无"), trait:I18n.t("对应位置相加"), stage:4
  }
};

I18n.prepare(moduleCards);

export function cardFor(id,levelId){
 if(!moduleCards[id])return null;
 const card={...moduleCards[id]};
 if(levelId==='ffn')return card;
 if(id==='gate'||id==='up'){
  card.formula=card.formula.replace('Z','X');
  card.meaning=card.meaning.replace(I18n.t("归一化后的向量 Z"),I18n.t("输入向量 X")).replace(I18n.t("接收 Z"),I18n.t("接收 X"));
 }
 if(id==='silu'&&levelId==='activation'){
  card.ability=I18n.t("逐个改变投影数值");card.meaning=I18n.t("把投影 P 中的每个数分别送入 SiLU。正数与负数受到不同程度的缩放，4 个数处理后仍是 4 个数。");
 }
 if(id==='down'&&levelId==='residual'){
  card.formula='F = P × Wd';card.meaning=I18n.t("接过投影 P 中的 4 个数，乘上 4 × 2 权重矩阵。每个输出由 4 项乘积求和，得到 2 维变换 F。");card.purpose=I18n.t("F 的长度回到与输入 X 相同，才能逐项相加。单独得到 F，还没有保留原输入。");
 }
 if(id==='add'&&levelId==='residual'){
  card.formula='Y = X + F';card.meaning=I18n.t("把原输入 X 与本次变换 F 按对应位置相加。输出 Y 是更新后的特征，仍对应同一个输入位置。");card.purpose=I18n.t("一条路计算变化，一条路保留原输入。残差把它们在出口前合起来。");
 }
 return card;
}

export function exampleFor(M,id,levelId='ffn'){
  if(id==='project')return {inputs:[['X',[1,1]]],output:['P',M.linear([1,1],M.weights.project)]};
  const R=[1,1],Z=levelId==='ffn'?M.norm(R):R,P=M.linear(R,M.weights.project);
  if(levelId==='activation')return {inputs:[['P',P]],output:['S',P.map(M.silu)]};
  if(levelId==='residual'){
   const F=M.linear(P,M.weights.down);
   return id==='down'?{inputs:[['P',P]],output:['F',F]}:{inputs:[['X',R],['F',F]],output:['Y',R.map((x,i)=>x+F[i])]};
  }
  const G=M.linear(Z,M.weights.gate),U=M.linear(Z,M.weights.up),S=G.map(M.silu),H=S.map((x,i)=>x*U[i]),F=M.linear(H,M.weights.down),Y=R.map((x,i)=>x+F[i]),source=levelId==='ffn'?'Z':'X';
  const paths={gate:[[[source,Z]],['G',G]],up:[[[source,Z]],['U',U]],silu:[[['G',G]],['S',S]],multiply:[[['S',S],['U',U]],['H',H]],down:[[['H',H]],['F',F]],add:[[['R',R],['F',F]],['Y',Y]]};
  return {inputs:paths[id][0],output:paths[id][1]};
}
