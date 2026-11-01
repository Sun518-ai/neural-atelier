(function(scope){
const weights={gate:[[1,-1,.5,0],[0,.5,1,1]],up:[[1,0,1,.5],[0,1,.5,-1]],down:[[.4,0],[0,.3],[.2,.2],[-.1,.3]]};
weights.project=weights.up;
const norm=v=>{const rms=Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length+1e-6);return v.map(x=>x/rms);};
const linear=(v,w)=>w[0].map((_,j)=>v.reduce((s,x,i)=>s+x*w[i][j],0));
const silu=x=>x/(1+Math.exp(-x));
const definitions={
 project:{name:I18n.t("线性投影"),hint:I18n.t("每一列权重生成一个新特征：一个输入向量中的 2 个数，组合成 4 个数。"),ins:[2],out:4,type:'linear',x:0,z:0},
 gate:{name:I18n.t("门投影"),hint:I18n.t("输入向量中的 2 个特征，乘权重 Wg，展开成 4 个。"),ins:[2],out:4,type:'linear',x:-4.6,z:-2.2},
 up:{name:I18n.t("内容投影"),hint:I18n.t("同一个输入向量乘另一套权重 Wu，得到另一份 4 维内容。"),ins:[2],out:4,type:'linear',x:-4.6,z:2.2},
 silu:{name:'SiLU',hint:I18n.t("对每个数做 x / (1 + exp(−x))，形成门值；不改变维度。"),ins:[4],out:4,type:'activation',x:-.9,z:-2.6},
 multiply:{name:I18n.t("逐元素相乘"),hint:I18n.t("两个 4 维向量，对应位置相乘。门值控制各个内容特征的贡献。"),ins:[4,4],out:4,type:'multiply',x:.1,z:1.8},
 down:{name:I18n.t("降维投影"),hint:I18n.t("4 维向量乘 Wd，压回 2 维，得到 FFN 的变换 F。"),ins:[4],out:2,type:'linear',x:3.5,z:1.5},
 add:{name:I18n.t("残差相加"),hint:I18n.t("两个 2 维向量相加，把这次变换加回进入 FFN 前的 R。"),ins:[2,2],out:2,type:'add',x:6.4,z:-1.5}
};
const levels={
 wire:{id:'wire',chapter:I18n.t("序章 / 01"),title:I18n.t("让信号抵达"),nodes:[],sources:['R'],sinkDim:2,sampleCount:3,sourceX:-3.5,sinkX:3.5,zoom:.65,
  mission:I18n.t("把输入原样送到出口"),description:I18n.t("让每个输入位置的两个数完整抵达右边。先接一条线，再试跑三个位置。"),summary:I18n.t("只有输入和出口，先熟悉接线与试跑。"),concept:I18n.t("向量与连线"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("输出特征 Y"),boardText:'SIGNAL / 01',shape:'2 → 2',next:'projection',
  hints:[I18n.t("圆口发送数据，方口接收数据。点两个端口，或从圆口直接拖线。")]},
 projection:{id:'projection',chapter:I18n.t("序章 / 02"),title:I18n.t("经过一次投影"),nodes:['project'],sources:['R'],sinkDim:4,sampleCount:3,sourceX:-5,sinkX:5.2,zoom:.75,
  mission:I18n.t("把 2 个特征变成 4 个"),description:I18n.t("用桌上的权重矩阵处理每个输入向量，让出口得到 4 个特征。三个输入位置共用同一套权重。"),summary:I18n.t("加入一块投影模块，观察矩阵如何改变向量。"),concept:I18n.t("一次矩阵乘法"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("投影特征 P"),boardText:'PROJECTION / 02',shape:'2 → 4',next:'activation',
  hints:[I18n.t("端口上的数字是向量维度。双击模块，可以查看它的权重和输入输出。")]},
 activation:{id:'activation',chapter:I18n.t("序章 / 03"),title:I18n.t("让数值有弯曲"),nodes:['project','silu'],sources:['R'],sinkDim:4,sampleCount:3,sourceX:-6,sinkX:6,zoom:.83,boardWidth:17,boardDepth:7,
  positions:{project:[-2,0],silu:[2,0]},initialLinks:{project:['R']},initialSink:'project',
  mission:I18n.t("改变数值，保留四个特征"),description:I18n.t("投影已经能抵达出口，但目标是每个投影数经过 SiLU 后的结果。改动线路，让三个输入位置都匹配。"),summary:I18n.t("新增 SiLU。维度相同的两份向量，数值不一定相同。"),concept:I18n.t("投影与非线性"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("激活特征 S"),boardText:'ACTIVATION / 03',shape:'2 → 4 → 4',next:'gating',
  hints:[I18n.t("可以先试跑现有线路，比较出口的实际值与预期值。"),I18n.t("SiLU 对每个数单独计算，不改变向量长度；双击卡片可查看函数。")]},
 gating:{id:'gating',chapter:I18n.t("序章 / 04"),title:I18n.t("让两路相遇"),nodes:['gate','up','silu','multiply'],sources:['R'],sinkDim:4,sampleCount:5,sourceX:-8,sinkX:8,zoom:1,boardWidth:21,boardDepth:10,
  positions:{gate:[-4,-2],up:[-4,2],silu:[0,-2],multiply:[3.5,1.2]},initialLinks:{gate:['R'],up:['R']},
  mission:I18n.t("让门值调节内容"),description:I18n.t("两套权重产生门与内容。让门经过激活后，逐项调节内容的贡献。出口应保留 4 个特征，还会用两组新向量检验。"),summary:I18n.t("新增两路分支和逐元素相乘。自己决定哪条支路经过激活。"),concept:I18n.t("两路门控"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("门控特征 H"),boardText:'GATING / 04',shape:'2 → 4 + 4 → 4',next:'residual',
  hints:[I18n.t("端口维度相同只说明能接上，不代表计算结果正确。"),I18n.t("逐元素相乘把两条支路对应的数相乘；激活放在哪一条支路会改变结果。")]},
 residual:{id:'residual',chapter:I18n.t("序章 / 05"),title:I18n.t("留一条回来的路"),nodes:['project','down','add'],sources:['R'],sinkDim:2,sampleCount:5,sourceX:-7.5,sinkX:7.5,zoom:.96,boardWidth:20,boardDepth:9,
  positions:{project:[-3.8,1.3],down:[0,1.3],add:[3.8,-.3]},initialLinks:{project:['R'],down:['project']},initialSink:'down',
  mission:I18n.t("让出口同时保留原值与变化"),description:I18n.t("桌上的变换已把 2 维展开成 4 维，再压回 2 维。目标是把这次变化加到原输入上；找出需要保留的那条路。"),summary:I18n.t("新增降维与残差相加。形状回到原宽度，才能把输入加回来。"),concept:I18n.t("降维与残差"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("残差特征 Y"),boardText:'RESIDUAL / 05',shape:'2 → 4 → 2 + 2',next:'ffn',
  hints:[I18n.t("一个圆形输出口可以连接多条线，不会消耗原来的向量。"),I18n.t("相加的两份向量需要同样长度；一份是原输入，一份是刚算出的变化。")]},
 ffn:{id:'ffn',chapter:I18n.t("正式关卡 / 01"),title:I18n.t("让一层醒来"),nodes:['gate','up','silu','multiply','down','add'],sources:['Z','R'],sinkDim:2,sampleCount:5,sourceX:-8.55,sinkX:9,zoom:1,
  mission:I18n.t("修复断开的 FFN"),description:I18n.t("把前面练过的投影、激活、门控、降维与残差接成一段完整计算。Z 已做归一化，R 是需要保留的原输入。"),summary:I18n.t("把序章中的组件组合成完整 SwiGLU FFN。"),concept:I18n.t("完整 SwiGLU FFN"),sourceTitle:I18n.t("层输入 R"),sourceNote:I18n.t("上游 Attention 的输出特征"),outputTitle:I18n.t("本层特征 Y"),boardText:'FFN / SWIGLU',shape:'2 → 4 → 2',next:null,
  initialLinks:{gate:['Z'],up:['Z']},
  hints:[I18n.t("圆口是输出，方口是输入；输入可以分叉给多个模块。"),I18n.t("SiLU 把门投影的数变成门值；门值和内容投影的数逐元素相乘。"),I18n.t("降维后的变换 F，需要加回进入 FFN 前的原始 R。")]}
};
function levelFor(state){return levels[state.levelId]||levels.ffn;}
function initial(levelId='ffn'){const level=levels[levelId]||levels.ffn;return {version:1,levelId:level.id,...(level.engine?{settings:{...api.engineDefaults,...level.settings}}:{}),nodes:level.nodes.map(id=>{const d=definitions[id],p=level.positions?.[id];return {id,x:p?.[0]??d.x,z:p?.[1]??d.z,...(level.engine?{device:level.devices?.[id]||'gpu'}:{}),links:level.initialLinks?.[id]?[...level.initialLinks[id]]:d.ins.map(()=>null)};}),sink:level.initialSink||null};}
const samples=[{word:I18n.t("我"),v:[1,0]},{word:I18n.t("爱"),v:[0,1]},{word:I18n.t("猫"),v:[1,1]},{word:I18n.t("新输入 A"),v:[-1,2]},{word:I18n.t("新输入 B"),v:[2,-.5]}];
function reference(v,levelId='ffn'){
 if(levelId==='wire')return [...v];
 const p=linear(v,weights.project);
 if(levelId==='projection')return p;
 if(levelId==='activation')return p.map(silu);
 if(levelId==='residual')return linear(p,weights.down).map((x,i)=>x+v[i]);
 const z=levelId==='gating'?v:norm(v),g=linear(z,weights.gate).map(silu),u=linear(z,weights.up),h=g.map((x,i)=>x*u[i]);
 if(levelId==='gating')return h;
 const f=linear(h,weights.down);return v.map((x,i)=>x+f[i]);
}
function evaluate(state,v){const level=levelFor(state),context={state,level,input:v},values=Object.fromEntries(level.sources.map(id=>[id,id==='Z'?norm(v):v])),depths=Object.fromEntries(level.sources.map(id=>[id,0])),visiting=new Set(),order=[];let error=null,bad=null;
 function run(id){if(id==null)throw {message:I18n.t("有一个输入口还没有接线。")};if(values[id])return values[id];const node=state.nodes.find(n=>n.id===id),d=definitions[id];if(!node||!d)throw {message:I18n.t("线路指向了不存在的模块。")};if(visiting.has(id))throw {message:I18n.t("线路绕成了环，数值走不出来。"),node:id};visiting.add(id);
 const inputs=d.ins.map((dim,i)=>{if(!node.links[i])throw {message:`「${d.name}${I18n.t("」的输入 ")}${i+1}${I18n.t(" 还没接上。")}`,node:id,port:i};const a=run(node.links[i]);if(a.length!==dim)throw {message:`「${d.name}${I18n.t("」需要 ")}${dim}${I18n.t(" 维，收到 ")}${a.length}${I18n.t(" 维。")}`,node:id,port:i};return a;});
 let out;if(api.operations?.[id])out=api.operations[id](inputs,context);else if(weights[id])out=linear(inputs[0],weights[id]);else if(id==='silu')out=inputs[0].map(silu);else out=inputs[0].map((x,i)=>id==='multiply'?x*inputs[1][i]:x+inputs[1][i]);
 values[id]=out;depths[id]=1+Math.max(...node.links.map(k=>depths[k]));order.push(id);visiting.delete(id);return out;}
 const dim=levelFor(state).sinkDim;
 let output=null;try{if(!state.sink)throw {message:I18n.t("出口还没有接上。"),node:'sink',port:0};output=run(state.sink);if(output.length!==dim)throw {message:`${I18n.t("出口需要 ")}${dim}${I18n.t(" 维向量。")}`,node:'sink'};}catch(e){error=e.message;bad={id:e.node,port:e.port};}
 // Every runnable branch participates in the visual execution, even when the
 // final outlet is disconnected or another branch cannot finish. Keep the
 // original final-output validation separate from this execution trace.
 for(const node of state.nodes){visiting.clear();try{run(node.id);}catch{}}
 return {output,values,depths,order,error,bad};}
function connect(state,from,to,port){const level=levelFor(state);if(!level.sources.includes(from)&&!state.nodes.some(n=>n.id===from))return I18n.t("没有找到这个端口");if(to!=='sink'&&!state.nodes.some(n=>n.id===to))return I18n.t("没有找到这个端口");const out=from==='R'||from==='Z'?(level.sourceDim||2):definitions[from]?.out,dim=to==='sink'?level.sinkDim:definitions[to]?.ins[port];if(!out||!dim)return I18n.t("没有找到这个端口");if(from===to)return I18n.t("不能把输出接回自己");if(out!==dim)return `${I18n.t("维度接不上：输出 ")}${out}${I18n.t(" 维，入口需要 ")}${dim}${I18n.t(" 维。")}`;if(to==='sink')state.sink=from;else state.nodes.find(n=>n.id===to).links[port]=from;return null;}
const api={weights,norm,linear,silu,definitions,levels,levelFor,initial,samples,reference,evaluate,connect};if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.NeuralPrologue=api;
})(globalThis);
