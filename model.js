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
  mission:I18n.t("把两组数一一相乘"),description:I18n.t("两块投影接收同一份输入，分别算出 4 个数。用 SiLU 处理其中一组，再让两组数一一相乘。接好模块，让 5 组输入都得到目标结果。"),summary:I18n.t("新增两路分支和逐元素相乘。自己决定哪条支路经过激活。"),concept:I18n.t("两路门控"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("门控特征 H"),boardText:'GATING / 04',shape:'2 → 4 + 4 → 4',next:'residual',
  hints:[I18n.t("端口维度相同只说明能接上，不代表计算结果正确。"),I18n.t("逐元素相乘把两条支路对应的数相乘；激活放在哪一条支路会改变结果。")]},
 residual:{id:'residual',chapter:I18n.t("序章 / 05"),title:I18n.t("留一条回来的路"),nodes:['project','down','add'],sources:['R'],sinkDim:2,sampleCount:5,sourceX:-7.5,sinkX:7.5,zoom:.96,boardWidth:20,boardDepth:9,
  positions:{project:[-3.8,1.3],down:[0,1.3],add:[3.8,-.3]},initialLinks:{project:['R'],down:['project']},initialSink:'down',
  mission:I18n.t("让出口同时保留原值与变化"),description:I18n.t("桌上的变换已把 2 维展开成 4 维，再压回 2 维。目标是把这次变化加到原输入上；找出需要保留的那条路。"),summary:I18n.t("新增降维与残差相加。形状回到原宽度，才能把输入加回来。"),concept:I18n.t("降维与残差"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("残差特征 Y"),boardText:'RESIDUAL / 05',shape:'2 → 4 → 2 + 2',next:'ffn',
  hints:[I18n.t("一个圆形输出口可以连接多条线，不会消耗原来的向量。"),I18n.t("相加的两份向量需要同样长度；一份是原输入，一份是刚算出的变化。")]},
 workshop:{id:'workshop',chapter:I18n.t("序章 / 06"),title:I18n.t("从架上拿一块"),nodes:['project'],inventory:{project:1},maxModules:1,buildable:true,placementTutorial:true,sources:['R'],sinkDim:4,sampleCount:3,sourceX:-5.5,sinkX:5.5,zoom:.8,boardWidth:16,boardDepth:7,
  mission:I18n.t("拖进一块投影，再接上线"),description:I18n.t("台面上少了一块熟悉的投影。从组件架拖一块进来，连接输入和出口，然后试跑。"),summary:I18n.t("只学一个新操作：从组件架拖入模块。"),concept:I18n.t("自己放置组件"),sourceTitle:I18n.t("输入 X"),sourceNote:'',outputTitle:I18n.t("投影特征 P"),boardText:'WORKSHOP / 06',shape:'2 → 4',next:'ffn',
  hints:[I18n.t("按住组件架上的卡片，拖到台面松开。再把输入、投影、出口连起来。") ]},
 ffn:{id:'ffn',chapter:I18n.t("正式关卡 / 01"),title:I18n.t("让一层醒来"),nodes:['gate','up','silu','multiply','down','add'],sources:['Z','R'],sinkDim:2,sampleCount:5,sourceX:-8.55,sinkX:9,zoom:1,
  mission:I18n.t("搭出一段 FFN"),description:I18n.t("从组件架选取模块，自行安排台面和线路。Z 已做归一化，R 是原输入；让出口匹配目标结果。"),summary:I18n.t("把序章中的组件组合成完整 SwiGLU FFN。"),concept:I18n.t("完整 SwiGLU FFN"),sourceTitle:I18n.t("层输入 R"),sourceNote:I18n.t("上游 Attention 的输出特征"),outputTitle:I18n.t("本层特征 Y"),boardText:'FFN / SWIGLU',shape:'2 → 4 → 2',next:null,
  initialLinks:{gate:['Z'],up:['Z']},
  hints:[I18n.t("圆口是输出，方口是输入；输入可以分叉给多个模块。"),I18n.t("SiLU 把门投影的数变成门值；门值和内容投影的数逐元素相乘。"),I18n.t("降维后的变换 F，需要加回进入 FFN 前的原始 R。")]}
};
function levelFor(state){return levels[state.levelId]||levels.ffn;}
const nodeKind=n=>n?.kind||n?.id;
const kindOf=(state,id)=>nodeKind(state.nodes.find(n=>n.id===id))||id;
const definitionFor=(state,id)=>definitions[kindOf(state,id)];
const inventory=level=>level.inventory||Object.fromEntries(level.nodes.map(k=>[k,1]));
const moduleLimit=level=>level.maxModules??level.nodes.length;
function stock(state,kind){return Math.max(0,(inventory(levelFor(state))[kind]||0)-state.nodes.filter(n=>nodeKind(n)===kind).length);}
function canAdd(state,kind){const level=levelFor(state);return !!level.buildable&&stock(state,kind)>0&&state.nodes.length<moduleLimit(level);}
function nextId(state,kind){if(!state.nodes.some(n=>n.id===kind))return kind;let i=2;while(state.nodes.some(n=>n.id===kind+'-'+i))i++;return kind+'-'+i;}
function validNodeId(id,kind){return typeof id==='string'&&typeof kind==='string'&&(id===kind||new RegExp('^'+kind+'-(?:[2-9]|[1-9][0-9]+)$').test(id));}
function nodeName(state,id){const kind=kindOf(state,id),d=definitions[kind];if(!d)return id;const copies=state.nodes.filter(n=>nodeKind(n)===kind);return d.name+(copies.length>1?' · '+(id===kind?'1':id.slice(kind.length+1)):'');}

function bounds(level){return {left:level.sourceX+2.8,right:level.sinkX-2.8,back:-(level.boardDepth||(level.id==='ffn'?11:7))/2+1.6,front:(level.boardDepth||(level.id==='ffn'?11:7))/2-1.6};}
function shuffled(items,random=Math.random){const list=[...items];for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
function arrange(state,random=Math.random){
 const b=bounds(levelFor(state)),count=state.nodes.length;if(!count)return state;
 const maxCols=Math.max(1,Math.floor((b.right-b.left)/3.25)+1),cols=Math.min(maxCols,Math.ceil(Math.sqrt(count*1.5))),rows=Math.ceil(count/cols);
 const dx=cols>1?Math.min(3.8,(b.right-b.left)/(cols-1)):0,dz=rows>1?Math.min(3.5,(b.front-b.back)/(rows-1)):0;
 const slots=shuffled(Array.from({length:cols*rows},(_,i)=>[(b.left+b.right)/2+(i%cols-(cols-1)/2)*dx,(Math.floor(i/cols)-(rows-1)/2)*dz]),random);
 state.nodes.forEach((n,i)=>{n.x=Math.max(b.left,Math.min(b.right,slots[i][0]+(random()-.5)*.24));n.z=Math.max(b.back,Math.min(b.front,slots[i][1]+(random()-.5)*.24));});return state;
}
function initial(levelId='ffn',{complete=false,random=Math.random}={}){const level=levels[levelId]||levels.ffn,empty=level.buildable&&!complete;
 const state={version:1,levelId:level.id,palette:Object.keys(inventory(level)),...(level.engine?{settings:{...api.engineDefaults,...level.settings}}:{}),nodes:(empty?[]:level.nodes).map(id=>{const d=definitions[id];return {id,kind:id,x:d.x??0,z:d.z??0,...(level.engine?{device:level.devices?.[id]||'gpu'}:{}),links:level.initialLinks?.[id]?[...level.initialLinks[id]]:d.ins.map(()=>null)};}),sink:empty?null:level.initialSink||null};return arrange(state,random);
}
function placement(state,kind,x,z){const level=levelFor(state),b=bounds(level);if(!canAdd(state,kind))return null;if(!Number.isFinite(x)||!Number.isFinite(z)||x<b.left||x>b.right||z<b.back||z>b.front)return null;if(state.nodes.some(n=>Math.abs(n.x-x)<2.65&&Math.abs(n.z-z)<2.9))return null;return {id:nextId(state,kind),kind,x,z,links:definitions[kind].ins.map(()=>null)};}
function addNode(state,id,x,z){const n=placement(state,id,x,z);if(!n)return false;state.nodes.push(n);return true;}
function removeNode(state,id){if(!levelFor(state).buildable||!state.nodes.some(n=>n.id===id))return false;state.nodes=state.nodes.filter(n=>n.id!==id);state.nodes.forEach(n=>n.links=n.links.map(k=>k===id?null:k));if(state.sink===id)state.sink=null;return true;}
function disconnect(state,to,port){if(to==='sink'){if(!state.sink)return false;state.sink=null;return true;}const n=state.nodes.find(n=>n.id===to);if(!n?.links[port])return false;n.links[port]=null;return true;}
const samples=[{word:I18n.t("我"),v:[1,0]},{word:I18n.t("爱"),v:[0,1]},{word:I18n.t("猫"),v:[1,1]},{word:I18n.t("新输入 A"),v:[-1,2]},{word:I18n.t("新输入 B"),v:[2,-.5]}];
function reference(v,levelId='ffn'){
 if(levelId==='wire')return [...v];
 const p=linear(v,weights.project);
 if(levelId==='projection'||levelId==='workshop')return p;
 if(levelId==='activation')return p.map(silu);
 if(levelId==='residual')return linear(p,weights.down).map((x,i)=>x+v[i]);
 const z=levelId==='gating'?v:norm(v),g=linear(z,weights.gate).map(silu),u=linear(z,weights.up),h=g.map((x,i)=>x*u[i]);
 if(levelId==='gating')return h;
 const f=linear(h,weights.down);return v.map((x,i)=>x+f[i]);
}
function evaluate(state,v){const level=levelFor(state),context={state,level,input:v},values=Object.fromEntries(level.sources.map(id=>[id,id==='Z'?norm(v):v])),depths=Object.fromEntries(level.sources.map(id=>[id,0])),visiting=new Set(),order=[];let error=null,bad=null;
 function run(id){if(id==null)throw {message:I18n.t("有一个输入口还没有接线。")};if(values[id])return values[id];const node=state.nodes.find(n=>n.id===id),kind=nodeKind(node),d=definitions[kind];if(!node||!d)throw {message:I18n.t("线路指向了不存在的模块。")};if(visiting.has(id))throw {message:I18n.t("线路绕成了环，数值走不出来。"),node:id};visiting.add(id);
 const inputs=d.ins.map((dim,i)=>{if(!node.links[i])throw {message:`「${d.name}${I18n.t("」的输入 ")}${i+1}${I18n.t(" 还没接上。")}`,node:id,port:i};const a=run(node.links[i]);if(a.length!==dim)throw {message:`「${d.name}${I18n.t("」需要 ")}${dim}${I18n.t(" 维，收到 ")}${a.length}${I18n.t(" 维。")}`,node:id,port:i};return a;});
 let out;if(api.operations?.[kind])out=api.operations[kind](inputs,context);else if(weights[kind])out=linear(inputs[0],weights[kind]);else if(kind==='silu')out=inputs[0].map(silu);else out=inputs[0].map((x,i)=>kind==='multiply'?x*inputs[1][i]:x+inputs[1][i]);
 values[id]=out;depths[id]=1+Math.max(...node.links.map(k=>depths[k]));order.push(id);visiting.delete(id);return out;}
 const dim=levelFor(state).sinkDim;
 let output=null;try{if(!state.sink)throw {message:I18n.t("出口还没有接上。"),node:'sink',port:0};output=run(state.sink);if(output.length!==dim)throw {message:`${I18n.t("出口需要 ")}${dim}${I18n.t(" 维向量。")}`,node:'sink'};}catch(e){error=e.message;bad={id:e.node,port:e.port};}
 // Every runnable branch participates in the visual execution, even when the
 // final outlet is disconnected or another branch cannot finish. Keep the
 // original final-output validation separate from this execution trace.
 for(const node of state.nodes){visiting.clear();try{run(node.id);}catch{}}
 return {output,values,depths,order,error,bad};}
function valueForKind(state,ev,kind){
 if(!ev)return null;const pending=[state.sink],seen=new Set();
 while(pending.length){const id=pending.shift();if(!id||seen.has(id))continue;seen.add(id);const n=state.nodes.find(n=>n.id===id);if(!n)continue;if(nodeKind(n)===kind)return ev.values[id]||null;pending.push(...n.links);}
 return null;
}
function connect(state,from,to,port){const level=levelFor(state);if(!level.sources.includes(from)&&!state.nodes.some(n=>n.id===from))return I18n.t("没有找到这个端口");if(to!=='sink'&&!state.nodes.some(n=>n.id===to))return I18n.t("没有找到这个端口");const out=from==='R'||from==='Z'?(level.sourceDim||2):definitionFor(state,from)?.out,dim=to==='sink'?level.sinkDim:definitionFor(state,to)?.ins[port];if(!out||!dim)return I18n.t("没有找到这个端口");if(from===to)return I18n.t("不能把输出接回自己");if(out!==dim)return `${I18n.t("维度接不上：输出 ")}${out}${I18n.t(" 维，入口需要 ")}${dim}${I18n.t(" 维。")}`;if(to==='sink')state.sink=from;else state.nodes.find(n=>n.id===to).links[port]=from;return null;}
const api={valueForKind,nodeKind,kindOf,definitionFor,inventory,moduleLimit,stock,canAdd,validNodeId,nodeName,weights,norm,linear,silu,definitions,levels,levelFor,initial,samples,reference,evaluate,connect,disconnect,bounds,arrange,placement,addNode,removeNode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.NeuralPrologue=api;
})(globalThis);
