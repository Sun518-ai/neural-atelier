import {cardFor,exampleFor} from './module-cards.js?v=layernorm-placement-1';
import {createProgress} from './level-progress.js?v=layernorm-placement-1';
const M=window.NeuralPrologue,$=s=>document.querySelector(s),clone=x=>JSON.parse(JSON.stringify(x));
const fmt=x=>x===-Infinity?'−∞':Number.isFinite(x)?Number(x.toFixed(2)).toString():'?';
const vector=v=>v?'['+v.map(fmt).join(', ')+']':I18n.t("等待输入");
I18n.prepare({definitions:M.definitions,levels:M.levels,routes:M.routes,controls:M.engineControls,metrics:M.metricLabels,vocab:M.math.vocab});
for(const id of Object.keys(M.levels))I18n.prepare(M.samplesFor(id));
I18n.activate();
const progress=createProgress(M,localStorage);
function levelFromHash(){try{const id=decodeURIComponent((window.location?.hash||'').slice(1));return Object.prototype.hasOwnProperty.call(M.levels,id)?id:null;}catch{return null;}}
function writeLevelHash(id,replace=false){
 const loc=window.location,nav=window.history;if(!loc||!nav||loc.hash==='#'+id)return;
 nav[replace?'replaceState':'pushState'](null,'',loc.pathname+loc.search+'#'+id);
}
let stageId=levelFromHash()||progress.current(),state=progress.load(stageId),history=[],selected=null,pending=null,current=null,results=[],sample=0,busy=false,paused=false,pauseStarted=0,pausedDuration=0,runId=0,level=99,hints=0,world=null,fault=null;
let selectedWire=null,actionNode=null,placing=null,menuTrack=M.levels[stageId].track;
const stage=()=>M.levels[stageId],samples=()=>M.samplesFor?.(stageId)||M.samples,save=()=>progress.save(state);
const kindOf=id=>M.kindOf(state,id),definition=id=>M.definitionFor(state,id),weightsFor=id=>M.weights[kindOf(id)],nodeName=id=>M.nodeName(state,id);
let suppressPaletteClick=false,suppressNodeClick=false;
const shelfSizeKey='neural-atelier-shelf-size-v1';
let shelfSize=0;
function setShelfSize(value,persist=true){
 const next=Number(value);shelfSize=Number.isInteger(next)&&next>=0&&next<=2?next:0;
 $('#module-shelf').dataset.size=['small','medium','large'][shelfSize];
 $('#shelf-smaller').disabled=shelfSize===0;$('#shelf-larger').disabled=shelfSize===2;
 if(persist)try{localStorage.setItem(shelfSizeKey,String(shelfSize));}catch{}
 world?.syncShelf?.();
}
try{const saved=localStorage.getItem(shelfSizeKey);setShelfSize(saved===null?0:saved,false);}catch{setShelfSize(0,false);}
$('#shelf-smaller').onclick=()=>setShelfSize(shelfSize-1);
$('#shelf-larger').onclick=()=>setShelfSize(shelfSize+1);
const shape=dim=>stage().shapes?.[dim]||(stage().sequence?({3:I18n.t("3 个 ID"),6:'3 × 2',9:'3 × 3',12:'3 × 4',18:'3 × 6'}[dim]||dim):dim);
const playbackSpeedKey='neural-atelier-playback-speed-v1';
const defaultPlaybackSpeed=.25;
let playbackSpeed=defaultPlaybackSpeed;
function setPlaybackSpeed(value,persist=true){
 const speed=Number(value);playbackSpeed=Number.isFinite(speed)&&speed>=.25&&speed<=3?Math.round(speed*4)/4:defaultPlaybackSpeed;
 $('#playback-speed').value=String(playbackSpeed);$('#playback-speed').setAttribute('aria-valuetext',`${playbackSpeed}${I18n.t(" 倍速")}`);$('#playback-rate').textContent=`${playbackSpeed}×`;
 if(persist)try{localStorage.setItem(playbackSpeedKey,String(playbackSpeed));}catch{}
}
try{setPlaybackSpeed(localStorage.getItem(playbackSpeedKey),false);}catch{setPlaybackSpeed(defaultPlaybackSpeed,false);}
$('#playback-speed').addEventListener('input',e=>setPlaybackSpeed(e.target.value));
function animationTime(now=performance.now()){return now-pausedDuration-(paused?now-pauseStarted:0);}
function refreshPauseControl(){
 const button=$('#pause');button.disabled=!busy;button.setAttribute('aria-pressed',String(paused));
 button.innerHTML=paused?I18n.t('<span>▶</span> 继续'):I18n.t('<span>Ⅱ</span> 暂停');
}
function togglePause(){
 if(!busy)return;
 if(paused){pausedDuration+=performance.now()-pauseStarted;paused=false;}else{pauseStarted=performance.now();paused=true;}
 refreshPauseControl();
}
$('#pause').onclick=togglePause;
let engineReport=null;
const levelPassed=()=>results.length===stage().sampleCount&&results.every(r=>r.pass)&&(!stage().engine||engineReport?.pass);
function closeCompletion(){if($('#level-complete').open)$('#level-complete').close();}
function renderCompletion(){
 $('#complete-level').textContent=stage().chapter+' · '+stage().title;
 $('#complete-detail').textContent=stage().engine?I18n.t("数值与性能约束全部通过。"):I18n.t("全部输入验证通过。");
 $('#complete-next').textContent=stage().next?I18n.t("下一关 →"):I18n.t("选择关卡");
}
function showCompletion(){if(busy||!levelPassed())return;renderCompletion();if(!$('#level-complete').open)$('#level-complete').showModal();}
$('#complete-close').onclick=closeCompletion;
$('#complete-replay').onclick=()=>{changed();say('');$('#run').focus({preventScroll:true});};
$('#complete-next').onclick=()=>{closeCompletion();if(stage().next)switchLevel(stage().next);else levelMenu();};
function engineControls(){
 const c=stage(),area=$('#engine-controls');if(!c.engine){area.innerHTML='';return;}
 area.innerHTML=I18n.t("<div class=\"eyebrow\">引擎参数</div><p class=\"engine-model-note\">教学成本模型 · 非设备实测</p>")+c.controls.map(k=>{const d=M.engineControls[k];return `<label>${d.label}<select data-setting="${k}">${d.values.map(([v,name])=>`<option value="${v}" ${String(state.settings[k])===String(v)?'selected':''}>${name}</option>`).join('')}</select></label>`;}).join('')+I18n.t("<p class=\"engine-model-note\">选中模块，再点芯片区域分配；也可拖动模块的芯片标记。</p>");
}
function assignDevice(id,device){if(busy||!stage().engine)return;const n=state.nodes.find(n=>n.id===id);if(!n)return;checkpoint();n.device=device;changed();say(nodeName(id)+' → '+device.toUpperCase());}
function closeReport(restoreFocus=false){$('#run-report').hidden=true;if(restoreFocus)$('#run').focus({preventScroll:true});}
function resetReport(){closeReport();$('#run-report').replaceChildren();}
function renderReport(){
 const panel=$('#run-report'),attentionValues=M.valueForKind(state,current,'softmax')||M.valueForKind(state,current,'attentionweights')||M.valueForKind(state,current,'original-weights');let html=I18n.t("<div class=\"run-report-content\" tabindex=\"0\" aria-label=\"本次运行详情\">");
 if(stage().tokenOutput){html+='<div class="word-trials">'+results.map((r,i)=>`${I18n.t("<div><small>输入：")}${samples()[i].word}</small><strong class="${r.pass?'good':'bad'}">${r.actual?M.readTokens(r.actual):I18n.t("未得到输出")}${I18n.t("</strong><span>目标：")}${M.readTokens(r.expected)}</span></div>`).join('')+I18n.t("</div><p>文字来自词表分数最高的候选。计算出错可能改词，也可能碰巧仍是同一个词。</p>");}
 if(stage().attentionReadout&&attentionValues){const a=M.math.rows(attentionValues,3),words=samples()[sample].word.split(' / ');html+=I18n.t("<h3>各位置从哪里读取内容</h3><div class=\"attention-map\">")+a.map((r,i)=>`<div><b>${words[i]}${I18n.t(" · 位置 ")}${i}</b>${r.map((v,j)=>`<span style="--weight:${Math.max(0,Math.min(1,v))}">${words[j]} ${Math.round(v*100)}%</span>`).join('')}</div>`).join('')+I18n.t("</div><p>比例是这次计算的注意力权重，不是对真实语言理解的完整解释。</p>");}
 if(stage().sequence&&!stage().engine&&!stage().tokenOutput&&(!stage().attentionReadout||!attentionValues)){const r=results[results.length-1];html+=`<p>${r?.pass?I18n.t("数值匹配。"):I18n.t("数值不匹配。")}${I18n.t("输出特征仍对应原来的输入位置；下一词要在词表投影后才确定。</p>")}`;}
 if(stageId==='vocabulary'&&current?.values.lmhead){const scores=M.math.rows(current.values.lmhead,6);html+=I18n.t("<h3>词表分数 · 各位置取最高分</h3><div class=\"vocab-scores\"><div><b>位置</b>")+M.math.vocab.map(v=>'<b>'+v+'</b>').join('')+'</div>'+scores.map((r,i)=>'<div><b>'+i+'</b>'+r.map(v=>`<span class="${v===Math.max(...r)?'winner':''}">${fmt(v)}</span>`).join('')+'</div>').join('')+'</div>';}
 if(stageId==='autoregressive'&&results.every(r=>r.pass)){const rollout=M.rollout(state,samples()[0].v);html+=I18n.t("<h3>把新词追加回去，连续解码六次</h3><div class=\"word-trials\"><div><strong>")+rollout.text+I18n.t("</strong><small>每次只采用最后一个位置的预测，再更新上下文。</small></div></div>");}
 if(stage().engine&&results.length){html+='<div class="word-trials">'+results.map((r,i)=>`${I18n.t("<div><small>提示：")}${samples()[i].word}</small><strong class="${r.pass?'good':'bad'}">${r.actual?M.decodeFeatures(r.actual):I18n.t("未输出")}${I18n.t("</strong><span>目标读出：")}${M.decodeFeatures(r.expected)}</span></div>`).join('')+'</div>';}
 if(engineReport){if(['kv-cache','capstone'].includes(stageId)){const t=engineReport.cacheTrace;html+=`${I18n.t("<h3>逐词计算检查 · 3 个位置</h3><p>")}${state.settings.cache?I18n.t("保留旧 K/V"):I18n.t("每步重算历史")}${I18n.t("：共计算 ")}${t.processed}${I18n.t(" 个位置的 K/V。两种方法的 Attention 数值一致；缓存减少重复投影，但仍然读取历史 K/V。</p>")}`;}html+=I18n.t("<p>教学模拟 · 时间包含派发、同步与数据读写；ANE 工作占比表示分配的计算量，不是硬件计数器。</p>");
 engineReport.runs.forEach((r,i)=>{html+=`${I18n.t("<h3>负载 ")}${i+1} · ${r.work.prompt}${I18n.t(" 个提示位置 / ")}${r.work.context}${I18n.t(" 个上下文位置</h3><div class=\"metric-grid\">")}`+r.checks.map(c=>{const [name,unit]=M.metricLabels[c.key];return `<div class="${c.pass?'good':'bad'}"><small>${name}</small><strong>${fmt(c.value)} <em>${unit}${I18n.t("</em></strong><span>目标 ")}${c.key==='tps'||c.key==='aneMin'?'≥':'≤'} ${c.target} ${unit}</span></div>`;}).join('')+'</div>';
 if(r.errors.length)html+='<p class="bad">'+r.errors.join('；')+'</p>';
 html+='<div class="runtime-timeline">'+r.timeline.map(t=>`<div class="lane-${t.device}" style="flex:${Math.max(1,t.duration)}" title="${t.name} · ${fmt(t.duration)} ms"><b>${t.device.toUpperCase()}</b><span>${t.name}</span><small>${fmt(t.duration)} ms</small></div>`).join('')+'</div>';});}
 if(stageId==='autoregressive'&&results.every(r=>r.pass))html+=I18n.t('<div class="campaign-complete"><span>主线完成</span><h3>从向量，到逐词生成</h3><p>所有主线关卡都可以重玩。端侧推理的独立挑战在关卡菜单的番外中。</p></div>');
 if(stageId==='capstone'&&engineReport?.pass&&results.every(r=>r.pass))html+=I18n.t("<div class=\"campaign-complete\"><span>番外完成</span><h3>从一个向量，到可运行的端侧引擎</h3><p>你已经完成数值计算、注意力、逐词生成，以及正确性、内存和速度的联合验收。所有关卡仍可重玩，继续比较不同调度方案。</p></div>");
 if(!stage().sequence)html+=I18n.t("<p>输入与输出都是特征向量，分别对应“我 / 爱 / 猫”，不是生成的新词。</p>");
 panel.innerHTML=html+I18n.t("</div><button type=\"button\" class=\"report-close\" data-close-report aria-label=\"关闭运行说明\" title=\"关闭运行说明\">×</button>");panel.hidden=false;
}
$('#engine-controls').addEventListener('change',e=>{const key=e.target.dataset.setting;if(!key||busy)return;checkpoint();state.settings[key]=M.engineControls[key].values.find(([v])=>String(v)===e.target.value)[0];changed();});
$('#device-docks').addEventListener('click',e=>{const b=e.target.closest('[data-device]');if(!b)return;if(!selected)return say(I18n.t("先选中需要分配的模块。"));assignDevice(selected,b.dataset.device);});
$('#run-report').addEventListener('click',e=>{if(e.target.closest('[data-close-report]'))closeReport(true);});
function stageChrome(){
 const c=stage();document.body.classList.toggle('engine-level',!!c.engine);$('#device-docks').hidden=!c.engine;resetReport();$('#engine-controls').hidden=!c.engine;engineControls();$('.inspector').hidden=c.nodes.length===0;$('.scene-legend').hidden=c.nodes.length===0;$('#scene-help').textContent=c.nodes.length?I18n.t("拖模块摆放 · 点连线删除 · 双击查看模块卡"):I18n.t("圆口出，方口进 · 拖动空白转动视角");$('#pass-count').textContent='0 / '+c.sampleCount;document.title=I18n.t("神经工坊 · ")+c.title;$('.chapter span').textContent=c.chapter;$('.chapter strong').textContent=c.title;
 $('.mission h2').textContent=c.mission;$('.mission p').textContent=c.description;$('#mission-limits').innerHTML=c.engine?Object.entries(c.limits).map(([key,value])=>{const [name,unit]=M.metricLabels[key];return `<span>${name} ${key==='tps'||key==='aneMin'?'≥':'≤'} ${value} ${unit}</span>`;}).join(''):'';
 const reason=c.rationale;$('#mission-reason').hidden=!reason;
 $('#mission-reason-title').textContent=reason?.title||I18n.t("为什么要这样算");
 for(const field of ['text','takeaway','scope']){
  const el=$('#mission-reason-'+field);el.textContent=reason?.[field]||'';el.hidden=!reason?.[field];
 }
 if(reason?.kind==='swiglu'){
  $('#mission-reason-example').innerHTML=`<div class="swiglu-primer"><h4>${I18n.t("SwiGLU 是哪一段？")}</h4><p>${I18n.t("前面的进阶关已经把双路门控与降维组成 SwiGLU FFN；本关再接入归一化输入和残差。")}</p><div class="swiglu-source">${I18n.t("同一份输入 Z")}</div><div class="swiglu-branches"><div><b>${I18n.t("线性投影")}</b><span>${I18n.t("内容特征")}</span></div><div class="swiglu-gate"><b>${I18n.t("门投影 → SiLU")}</b><span>${I18n.t("调节系数")}</span></div></div><div class="swiglu-merge"><span aria-hidden="true">↓</span><b>${I18n.t("逐元素相乘")}</b><span aria-hidden="true">↓</span><b>${I18n.t("降维投影")}</b></div><p>${I18n.t("同样的内容值 2，乘系数 0.3 得到 0.6，乘 1.5 得到 3。系数随输入变化，决定这个特征贡献多少。")}</p></div>`;
 }else if(reason?.kind==='residual'){
  const x=reason.input,f=M.linear(M.linear(x,M.weights.project),M.weights.down),y=x.map((v,i)=>v+f[i]);
  $('#mission-reason-example').innerHTML=`<div class="residual-example">${[['baseline',I18n.t("原有特征 X"),x],['update',I18n.t("修改量 F"),f],['result',I18n.t("更新结果 Y"),y]].map(([role,label,values])=>`<div data-role="${role}"><span>${label}</span><code>${vector(values)}</code></div>`).join('')}<small>Y = X + F</small></div>`;
 }else $('#mission-reason-example').innerHTML=reason?.inputs?`<table><caption>${I18n.t("比较两种输入的第 3 个特征")}</caption><thead><tr><th>${I18n.t("输入")}</th><th>${I18n.t("内容 × 系数 ≈ 结果")}</th></tr></thead><tbody>${reason.inputs.map(input=>{
  const i=reason.feature,u=M.linear(input,M.weights.up)[i],g=M.linear(input,M.weights.gate)[i],s=M.silu(g);
  return `<tr><td>${vector(input)}</td><td><span data-factor="content">${fmt(u)}</span> × <span data-factor="scale">${fmt(s)}</span> ≈ <strong data-factor="result">${fmt(u*s)}</strong></td></tr>`;
 }).join('')}</tbody></table>`:'';
 $('#mission-reason-example').hidden=!$('#mission-reason-example').hasChildNodes();
 $('.route').innerHTML=`${I18n.t("<span>输入 token</span><i>→</i>")}${c.id==='ffn'?I18n.t("<span>归一化输入 · 已就绪</span><i>→</i>"):''}<strong>${c.concept}</strong><i>→</i><span>${c.outputTitle}${I18n.t("</span><span class=\"route-tail\">教学缩尺 ")}${c.shape}</span>`;
}
function renderLevelMenu(){
 $('#level-tracks').innerHTML=Object.entries(M.routes).map(([id,r])=>`<button type="button" role="tab" data-track="${id}" aria-selected="${id===menuTrack}" aria-controls="level-list">${r.name}<span>${r.ids.length}</span></button>`).join('');
 $('.level-menu-intro').textContent=M.routes[menuTrack].description;
 $('#level-list').innerHTML=M.routes[menuTrack].ids.map(id=>M.levels[id]).map(c=>`<button class="level-choice ${c.id===stageId?'current':''}" data-level="${c.id}"><span class="level-choice-top"><span>${c.chapter}</span><span>${progress.completed(c.id)?I18n.t("✓ 已通过"):c.id===stageId?I18n.t("当前关卡"):''}</span></span><strong>${c.title}</strong><span>${c.summary}</span><small>${c.buildable?I18n.t('最多 ')+M.moduleLimit(c):c.nodes.length}${I18n.t(" 个计算模块 · ")}${c.engine?I18n.t("正确性 + 性能验收"):c.buildable?I18n.t("自行放置组件"):c.sampleCount+I18n.t(" 组输入")}</small></button>`).join('');
}
function levelMenu(){
 menuTrack=stage().track;renderLevelMenu();$('#level-menu').showModal();$('#level-list .current')?.scrollIntoView({block:'nearest'});
}
function switchLevel(id,fromHash=false){
 if(busy||!M.levels[id])return;closeCompletion();if(id===stageId){$('#level-menu').close();return;}
 save();world?.beforeStage();stageId=id;state=progress.load(id);progress.select(id);
 history=[];selected=pending=current=fault=selectedWire=placing=actionNode=null;engineReport=null;results=[];sample=0;level=99;hints=0;
 stageChrome();world?.setStage();save();refresh();$('#level-menu').close();say('');if(!fromHash)writeLevelHash(id);
}
stageChrome();progress.select(stageId);save();writeLevelHash(stageId,true);
window.AtelierShell?.init({beforeLanguageChange:save});
I18n.onChange(()=>{
 stageChrome();setPlaybackSpeed(playbackSpeed,false);world?.relocalize();refresh();
 if(engineReport)engineReport=M.engineReport(state);
 if(!$('#run-report').hidden)renderReport();
 if(!busy)say('');
 if($('#level-menu').open)renderLevelMenu();
 if($('#level-complete').open)renderCompletion();
});
window.addEventListener?.('hashchange',()=>{
 const target=levelFromHash();if(!target){writeLevelHash(stageId,true);return;}
 if(target!==stageId&&busy){busy=paused=false;runId++;world?.clearPackets();}
 switchLevel(target,true);writeLevelHash(stageId,true);
});
const levelDialog=$('#level-menu');let levelBackdropStart=null;
function closeLevelMenu(){levelBackdropStart=null;levelDialog.close();$('#levels-open').focus?.({preventScroll:true});}
function outsideLevelDialog(e){const r=levelDialog.getBoundingClientRect();return e.target===levelDialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);}
$('#levels-open').onclick=levelMenu;$('#levels-close').onclick=closeLevelMenu;
levelDialog.addEventListener('pointerdown',e=>{levelBackdropStart=e.button===0&&e.isPrimary!==false&&outsideLevelDialog(e)?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;});
levelDialog.addEventListener('pointercancel',()=>levelBackdropStart=null);
levelDialog.addEventListener('click',e=>{
 const start=levelBackdropStart;levelBackdropStart=null;
 // Only a complete click on the backdrop dismisses it, never a drag that
 // began in the list or a click on the dialog's padding or scrollbar.
 if(start&&outsideLevelDialog(e)&&(e.pointerId==null||e.pointerId===start.id)&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8){e.preventDefault();e.stopPropagation();closeLevelMenu();}
});
levelDialog.addEventListener('cancel',e=>{e.preventDefault();closeLevelMenu();});
levelDialog.addEventListener('close',()=>levelBackdropStart=null);
$('#level-list').onclick=e=>{const b=e.target.closest('[data-level]');if(b)switchLevel(b.dataset.level);};
$('#level-tracks').onclick=e=>{const b=e.target.closest('[data-track]');if(b){menuTrack=b.dataset.track;renderLevelMenu();}};
$('#next-level').onclick=()=>switchLevel(stage().next);
function say(text,tone=''){$('#feedback').textContent=text;$('#feedback').className='feedback '+tone;}
function checkpoint(){history.push(clone(state));if(history.length>40)history.shift();}
function changed(){closeCompletion();resetReport();engineReport=null;fault=null;current=null;selectedWire=actionNode=null;results=[];sample=0;level=99;world?.clearPreview?.();save();world?.rebuild();refresh();}
function select(id){if(world?.focused())return;selected=id;selectedWire=null;actionNode=stage().buildable?id:null;world?.labels();inspect();}
function outputName(id){if(stage().sourceNames?.[id])return stage().sourceNames[id];return id==='R'?(stageId==='ffn'?I18n.t("原始输入 R"):I18n.t("输入 X")):id==='Z'?I18n.t("归一化输入 Z"):nodeName(id);}
function chooseOutput(id){if(busy)return;placing=selectedWire=actionNode=null;world?.clearPlacement?.();world?.clearPreview?.();pending=pending===id?null:id;world?.labels();say(pending?`${I18n.t("已拿起「")}${outputName(id)}${I18n.t("」的线，点一个方形输入口。")}`:I18n.t("已放下连线。"));}
function link(from,to,port){if(busy)return;const next=clone(state),err=M.connect(next,from,to,port);if(err){say(err,'error');return;}checkpoint();state=next;pending=null;changed();say(I18n.t("已连接。"));}
function chooseWire(to,index){if(busy)return;const from=to==='sink'?state.sink:state.nodes.find(n=>n.id===to)?.links[index];if(!from)return;pending=placing=actionNode=null;selectedWire={from,to,index};world?.clearPreview?.();world?.clearPlacement?.();world?.labels();}
function deleteWire(){if(busy||!selectedWire)return;const {to,index}=selectedWire;checkpoint();M.disconnect(state,to,index);changed();say(I18n.t("已删除连线。"));}
function chooseInput(to,port){if(busy)return;if(pending)return link(pending,to,port);const old=to==='sink'?state.sink:state.nodes.find(n=>n.id===to).links[port];if(!old)return say(I18n.t("先点一个圆形输出口，再接到这里。"));chooseWire(to,port);}
function renderShelf(){
 const shelf=$('#module-shelf');shelf.hidden=!stage().buildable;$('#remove-module').hidden=!stage().buildable||!state.nodes.some(n=>n.id===selected);$('#remove-module').disabled=busy;
 if(!stage().buildable)return;
 const cap=M.moduleLimit(stage()),available=M.inventory(stage());$('#module-count').textContent=state.nodes.length+' / '+cap;$('#module-count').setAttribute('aria-label',I18n.t('台面数量 / 上限'));
 shelf.querySelector('summary').title=shelf.hasAttribute('open')?I18n.t("收起组件架"):I18n.t("展开组件架");
 $('#module-palette').innerHTML=(state.palette||Object.keys(available)).map(kind=>{
  const d=M.definitions[kind],remaining=M.stock(state,kind),disabled=busy||!M.canAdd(state,kind),w=M.weights[kind];
  const symbols={layernorm:'LN',position:'sin',concat:'∥',encoder:'Enc',decoder:'Dec',activation:'∿',add:'+',residual:'+',multiply:'×',norm:'RMS',rope:'↻',score:'QKᵀ',mask:'◩',softmax:'σ',mix:'AV',attention:'Attn',ffn:'FFN'};
  const visual=w?`<span class="stock-matrix" aria-hidden="true" style="grid-template-columns:repeat(${w[0].length},1fr)">`+w.flat().slice(0,8).map(v=>`<i class="${v<0?'negative':''}"></i>`).join('')+'</span>':`<span class="stock-symbol" aria-hidden="true">${symbols[d.type]||'◇'}</span>`;
  const color=M.extraColors?.[kind]?'#'+M.extraColors[kind].toString(16).padStart(6,'0'):({project:'#5eaa9c',down:'#90a79a',add:'#c3a26f',gate:'#a894bf'})[kind]||'#8aa59a';
  const code=({relu:'ReLU',layernorm2:'LN','ln-attn':'LN','ln-ffn':'LN','ln-cross':'LN',concat:'A ∥ B',position:'PE',project:'W',gate:'Wg',down:'Wd',output:'Wo',q:'Q',k:'K',v:'V',ropeq:'Q ↻',ropek:'K ↻',residual1:'+ A',residual2:'+ F'})[kind]||({activation:'SiLU',add:'+',residual:'+',multiply:'×',norm:'RMS',score:'QKᵀ',mask:'◩',softmax:'σ',mix:'AV',attention:'Attn',ffn:'FFN'})[d.type]||kind;
  const description=`${d.name} · ${d.ins.map(shape).join(' + ')} → ${shape(d.out)} · ${I18n.t("可用数量")} ${remaining} / ${available[kind]} · ${I18n.t("双击查看说明")}`;
  return `<div class="module-stock" role="button" tabindex="${busy?'-1':'0'}" aria-disabled="${busy}" data-add-disabled="${disabled}" aria-label="${description}" title="${description}" data-add-module="${kind}" style="--stock-color:${color}">${visual}<span class="stock-description"><b class="stock-name">${d.name}</b><small>${d.ins.map(shape).join(' + ')} → ${shape(d.out)}</small></span><b class="stock-code" aria-hidden="true">${code}</b><span class="stock-count" aria-hidden="true">${remaining}</span></div>`;
 }).join('');
 world?.syncShelf?.();
}
function chooseModule(kind){if(busy||!M.canAdd(state,kind)||world?.focused())return;pending=selectedWire=actionNode=null;placing=kind;world?.clearPreview?.();world?.labels();say(I18n.t("拖到台面松开；也可以点空位放下。"));}
function placeModule(x,z){if(!placing||busy)return false;const next=clone(state);if(!M.addNode(next,placing,x,z)){say(I18n.t("这里放不下，换一处空位。"),'error');return false;}checkpoint();selected=next.nodes.at(-1).id;state=next;placing=null;world?.clearPlacement?.();changed();say(I18n.t("组件已放置。"));return true;}
$('#module-palette').onclick=e=>{if(suppressPaletteClick||world?.focused())return;const b=e.target.closest('[data-add-module]');if(b&&b.dataset.addDisabled!=='true')chooseModule(b.dataset.addModule);};
$('#module-palette').ondblclick=e=>{const b=e.target.closest('[data-add-module]');if(!b||busy||suppressPaletteClick)return;e.preventDefault();world?.focusShelf?.(b.dataset.addModule);};
$('#module-palette').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const b=e.target.closest('[data-add-module]');if(!b||busy)return;e.preventDefault();if(e.key==='Enter')world?.focusShelf?.(b.dataset.addModule);else if(b.dataset.addDisabled!=='true')chooseModule(b.dataset.addModule);});
function removeModule(id=selected){if(busy)return;const next=clone(state);if(!M.removeNode(next,id))return;checkpoint();state=next;if(selected===id)selected=null;pending=placing=actionNode=null;world?.clearPlacement?.();changed();say(I18n.t("组件已收回，相关连线已移除。"));}
$('#remove-module').onclick=()=>removeModule();
function inspect(){renderShelf();const d=state.nodes.some(n=>n.id===selected)?definition(selected):null;$('#inspect-focus').disabled=!d||world?.focused()===selected;if(!d){$('#inspect-name').textContent=I18n.t("点一个模块，看看里面");$('#inspect-desc').textContent=stage().sequence?I18n.t("这里的每条线传递整段输入的张量，包含各位置的特征。接线会决定真实计算。"):I18n.t("这里的每条线传递一个完整向量。你接的线路会决定真实计算结果。");$('#inspect-visual').innerHTML='';$('#inspect-values').innerHTML='';return;}$('#inspect-name').textContent=nodeName(selected);$('#inspect-desc').textContent=(cardFor(kindOf(selected),stageId)||M.extraCard?.(kindOf(selected),stageId))?.meaning||d.hint;const w=weightsFor(selected);$('#inspect-visual').innerHTML=w?`<div class="matrix-label">${w.length} × ${w[0].length}${I18n.t(" 权重矩阵 · 每格为一个权重</div><div class=\"matrix\" style=\"grid-template-columns:repeat(")}${w[0].length},1fr)">${w.flat().map(x=>`<span>${fmt(x)}</span>`).join('')}</div>`:`<div class="matrix-label">${d.ins.map(shape).join(I18n.t(" 与 "))} → ${shape(d.out)}</div>`;
 const n=state.nodes.find(n=>n.id===selected),values=current?.values||M.sourceValues(state,samples()[sample].v);
 $('#inspect-values').innerHTML=n.links.map((id,i)=>`${I18n.t("<div class=\"value-line\">输入 ")}${i+1} · ${id?outputName(id):I18n.t("未连接")}<b>${vector(values[id])}</b></div>`).join('')+`${I18n.t("<div class=\"value-line\">输出<b>")}${vector(values[selected])}</b></div>`;
}
function refresh(){refreshPauseControl();document.body.classList.toggle('network-running',busy);renderShelf();const t=samples()[sample];const won=levelPassed();$('.route strong').textContent=stage().concept+(won?I18n.t(" · 已通过"):'');$('#next-level').hidden=!(won||progress.completed(stageId))||!stage().next;$('#levels-open').disabled=busy;$('#engine-controls').querySelectorAll('input,select,button').forEach(e=>e.disabled=busy);$('#device-docks').querySelectorAll('button').forEach(e=>e.disabled=busy);$('#sample-name').textContent=t.word;$('#sample-value').textContent=stage().sequence?(stage().sourceDim===3?'Token ID '+vector(t.v):I18n.t(stage().sourceDim===12?"3 个位置 × 4 个特征":"3 个位置 × 2 个特征")):vector(t.v);$('#pass-count').textContent=results.filter(r=>r.pass).length+' / '+stage().sampleCount;$('#test-results').innerHTML=results.map((r,i)=>`<div class="test-row ${r.pass?'pass':'fail'}"><span>${r.pass?'✓':'×'} ${samples()[i].word}</span><span>${stage().tokenOutput&&r.actual?M.readTokens(r.actual):stage().sequence?(r.actual?I18n.t("矩阵 ")+shape(r.actual.length):I18n.t("等待输入")):vector(r.actual)}</span></div>`).join('');$('#run').disabled=!world;$('#run').innerHTML=busy?I18n.t("<span>■</span> 停下检查"):I18n.t("<span>▶</span> 试跑我的网络");$('#undo').disabled=busy||!history.length;$('#reset').disabled=busy;$('#restore-layout').hidden=!progress.canRestore(stageId,state);$('#restore-layout').disabled=busy;$('#hint').disabled=busy||!stage().hints?.length;inspect();}
async function run(){
 closeCompletion();
 if(busy){busy=paused=false;runId++;say(I18n.t("已停止。"));world.clearPackets();world.labels();refresh();return;}
 busy=true;paused=false;pausedDuration=0;pending=selectedWire=placing=actionNode=null;world.clearPreview?.();world.clearPlacement?.();fault=null;engineReport=null;results=[];resetReport();const id=++runId;
 for(let i=0;i<stage().sampleCount;i++){
  sample=i;current=M.evaluate(state,samples()[i].v);level=0;
  const expected=M.reference(samples()[i].v,stageId),actual=current.output;
  refresh();world.labels();say(`${I18n.t("试跑：「")}${samples()[i].word}」`);
  await world.animate(current,650,id);
  if(id!==runId||!busy)return;
  const pass=!current.error&&!!actual&&actual.length===expected.length&&actual.every((x,j)=>Number.isFinite(x)&&Math.abs(x-expected[j])<(stage().engine?(stage().limits?.error||.06):1e-9));results.push({pass,actual,expected});
  if(!pass){fault={id:'sink',actual,expected};level=99;busy=paused=false;if(stage().engine)engineReport=M.engineReport(state);world.labels();refresh();renderReport();say(`「${samples()[i].word}${I18n.t("」未通过。")}`,'error');return;}
  level=99;world.labels();refresh();
 }
 busy=paused=false;if(stage().engine)engineReport=M.engineReport(state);if(levelPassed())progress.complete(stageId,state);world.labels();refresh();renderReport();say(stage().engine?(engineReport.pass?I18n.t("数值与性能约束全部通过。"):I18n.t("数值通过；性能验收未通过，查看运行报告。")):`${I18n.t("通过：")}${stage().sampleCount} / ${stage().sampleCount}。`,stage().engine&&!engineReport.pass?'error':'success');showCompletion();
}
$('#inspect-focus').onclick=()=>world?.focus(selected);
$('#run').onclick=run;$('#undo').onclick=()=>{state=history.pop();pending=null;changed();say(I18n.t("已撤销。"));};$('#reset').onclick=()=>{checkpoint();state=M.initial(stageId);selected=pending=placing=null;world?.clearPlacement?.();changed();say(I18n.t("已恢复本关起点。"));};
$('#restore-layout').onclick=()=>{if(busy)return;const restored=progress.restore(stageId);if(!restored)return;checkpoint();state=restored;selected=pending=placing=null;world?.clearPlacement?.();changed();say(I18n.t("已恢复上次方案。"));};
$('#hint').onclick=()=>{const list=stage().hints;if(list?.length)say(list[Math.min(hints++,list.length-1)]);};
$('#about-open').onclick=()=>$('#about').showModal();$('#about-close').onclick=()=>$('#about').close();$('#about').addEventListener('click',e=>{if(e.target===$('#about')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
try{
 const T=await import('./vendor/three.module.js');
 const host=$('#scene'),overlay=$('#labels'),scene=new T.Scene(),camera=new T.OrthographicCamera(-11.5,11.5,7,-7,.1,100),renderer=new T.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.appendChild(renderer.domElement);
 scene.add(new T.HemisphereLight(0xfffdf2,0xa0b4a6,1.9));const sun=new T.DirectionalLight(0xfffcf2,1.9);sun.position.set(-4,14,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:12,bottom:-12});sun.shadow.bias=-.001;scene.add(sun);
 const colors={...M.extraColors,project:0x5eaa9c,gate:0xa894bf,silu:0xc6a574,multiply:0x669b91,down:0x90a79a,add:0xc3a26f,R:0x6e9fb5,Z:0x90b2bb,sink:0x438f7e};
 const nodeColor=id=>colors[kindOf(id)]||0x91afa4;
 const material=(c,extra={})=>new T.MeshStandardMaterial({color:c,roughness:.62,metalness:.07,...extra});
 function box(parent,w,h,d,x,y,z,c,extra={}){const b=new T.Mesh(new T.BoxGeometry(w,h,d),material(c,extra));b.position.set(x,y,z);b.castShadow=true;b.receiveShadow=true;parent.add(b);return b;}
 const {createSceneArt}=await import('./scene-art.js?v=layernorm-placement-1');
 const art=createSceneArt(T,scene,colors,{anisotropy:renderer.capabilities.getMaxAnisotropy()});art.surroundings(samples(),stage());
 const assembly=new T.Group(),wires=new T.Group();scene.add(assembly,wires);const neuronGeo=new T.SphereGeometry(.115,16,12);let elements=[],curves=[],packets=[],drag=null,preview=null,yaw=.05,pitch=.8,zoom=stage().zoom,lastDepth=-1;
 const cameraTarget=new T.Vector3();let focusId=null,shelfFocus=null,shelfModel=null,overview=null,cameraFrame=0,transitioning=false,lastTap=null;
 const ray=new T.Raycaster(),cursor=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
 function dispose(group){for(const o of [...group.children]){group.remove(o);o.traverse(c=>{if(c.geometry&&!c.geometry.userData?.shared)c.geometry.dispose();c.material?.map?.dispose();c.material?.dispose?.();});}}
 function point(id,kind='out',index=0){if(id==='R'||id==='Z')return new T.Vector3(stage().sourceX+(stage().sourceDim===12?1.65:stage().sequence?1.15:.85),.65,stage().dualSource?(id==='Z'?-2.15:2.15):stageId==='ffn'?(id==='Z'?-.75:.75):0);if(id==='sink')return new T.Vector3(stage().sinkX-(stage().sequence?1.5:stage().sinkDim===4?1.2:.8),.65,0);const n=state.nodes.find(n=>n.id===id),d=definition(id);return new T.Vector3(n.x+(kind==='in'?-1.12:1.12),.68,n.z+(kind==='in'&&d.ins.length===2?(index===0?-.55:.55):0));}
 const curve=(a,b)=>new T.CubicBezierCurve3(a,new T.Vector3(a.x+.8,a.y+.4,a.z),new T.Vector3(b.x-.8,b.y+.4,b.z),b);
 const guide=document.createElementNS('http://www.w3.org/2000/svg','svg'),guidePath=document.createElementNS('http://www.w3.org/2000/svg','path');
 guide.setAttribute('class','connection-guide');guide.setAttribute('aria-hidden','true');guide.setAttribute('hidden','');guidePath.setAttribute('vector-effect','non-scaling-stroke');guide.appendChild(guidePath);
 const placementGuide=document.createElementNS('http://www.w3.org/2000/svg','svg'),placementPath=document.createElementNS('http://www.w3.org/2000/svg','path'),placementOutline=document.createElementNS('http://www.w3.org/2000/svg','path');
 placementGuide.setAttribute('class','placement-guide');placementGuide.setAttribute('aria-hidden','true');placementGuide.setAttribute('hidden','');placementPath.setAttribute('class','placement-guide-path');placementOutline.setAttribute('class','placement-guide-outline');placementGuide.append(placementPath,placementOutline);
 const wireTargets=document.createElementNS('http://www.w3.org/2000/svg','svg');wireTargets.setAttribute('class','wire-targets');let wireTargetKey='',wirePaths=[],placementMesh=null;
 const colorHex=color=>'#'+color.toString(16).padStart(6,'0');
 const flowIdentity=()=>stage().sequence?I18n.t("整段输入"):samples()[sample].word;
 const packetIdentity=from=>stage().dualSource?(['Z','source-embed','original-encoder','original-k','original-v'].includes(kindOf(from))?I18n.t('源序列'):I18n.t('目标前缀')):flowIdentity();
 function rowEndpoint(kind){return new T.Vector3(kind==='source'?stage().sourceX+.34:stage().sinkX+.18,kind==='source'?.95:.98,art.rowZ(sample));}
 function wire(from,to,index){
  const cv=curve(point(from),point(to,'in',index)),color=nodeColor(from),dim=Math.min(4,(from==='R'||from==='Z')?(stage().sourceDim||2):definition(from).out);
  for(let j=0;j<dim;j++){const offset=(j-(dim-1)/2)*.035,points=cv.getPoints(32).map(p=>p.add(new T.Vector3(0,0,offset))),lane=new T.CatmullRomCurve3(points);wires.add(new T.Mesh(new T.TubeGeometry(lane,32,.012,6,false),material(color)));}
  const arrow=new T.Mesh(new T.ConeGeometry(.08,.19,8),material(color));arrow.position.copy(cv.getPoint(.6));arrow.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),cv.getTangent(.6).normalize());wires.add(arrow);curves.push({from,to,index,curve:cv});
 }
 function neuralModule(n){art.module(assembly,n,definition(n.id),M.weights);}
 function rebuild(){if(focusId)leaveFocus();clearPreview();dispose(assembly);dispose(wires);art.resetUnits();curves=[];state.nodes.forEach(neuralModule);state.nodes.forEach(n=>n.links.forEach((id,i)=>{if(id)wire(id,n.id,i);}));if(state.sink)wire(state.sink,'sink',0);labels();}
 function addLabel(tag,klass,html,attrs,pos){const el=document.createElement(tag);el.className=klass;const owner=attrs['data-owner']||attrs['data-node']||attrs['data-output']||attrs['data-input']?.split(':')[0];el.innerHTML=String(html);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(owner)el.dataset.owner=owner;overlay.appendChild(el);elements.push({el,pos});return el;}
 function labels(){art.sync(current?.values,current?.depths||{},level,selected,sample,results,busy,stage(),current?.output);overlay.querySelectorAll('.node-label,.port,.source-label,.node-value,.local-fault,.fault-pin,.device-badge,.row-marker,.wire-actions').forEach(el=>el.remove());elements=[];
  const edge=selectedWire&&curves.find(c=>c.to===selectedWire.to&&c.index===selectedWire.index&&c.from===selectedWire.from);
  if(edge&&!busy&&!focusId)addLabel('div','wire-actions',`<span>${outputName(edge.from)} → ${edge.to==='sink'?stage().outputTitle:nodeName(edge.to)}</span><button type="button" data-delete-wire>${I18n.t("删除连线")}</button><button type="button" data-close-wire aria-label="${I18n.t("关闭")}">×</button>`,{},()=>edge.curve.getPoint(.5));
  const removable=stage().buildable&&state.nodes.find(n=>n.id===actionNode);
  if(removable&&!busy&&!focusId&&!pending&&!placing&&!selectedWire)addLabel('div','wire-actions node-actions',`<button type="button" data-delete-node="${removable.id}">${I18n.t("删除组件")}</button><button type="button" data-close-node aria-label="${I18n.t("关闭")}">×</button>`,{'data-owner':removable.id},()=>new T.Vector3(removable.x,.7,removable.z+1.1));
  addLabel('span','source-label',`<b>${stage().sourceTitle}</b>${stage().sourceNote?'<br>'+stage().sourceNote:''}`,{},()=>new T.Vector3(stage().sourceX,1.6,-2.05+(stage().dualSource?2.15:0)));
  if(stage().dualSource)addLabel('span','source-label',`<b>${stage().sourceNames.Z}</b><br>${stage().secondaryTitle}`,{},()=>new T.Vector3(stage().sourceX,1.6,-4.2));
  addLabel('span','source-label',`<b>${stage().outputTitle}</b><br>${stage().tokenOutput?I18n.t("词表选择后的文字"):shape(stage().sinkDim)+I18n.t(" · 各位置的特征")}`,{},()=>new T.Vector3(stage().sinkX,1.6,-2.05));
  if(busy&&!stage().sequence){const marker=addLabel('span','row-marker',flowIdentity(),{'data-owner':'R','data-row':sample<3?String(sample):'validation'},()=>sample<3?new T.Vector3(stage().sourceX-1,.99,art.rowZ(sample)):new T.Vector3(stage().sourceX,1.4,2));marker.style.setProperty('--row-color',colorHex(art.rowColor(sample)));}
  stage().sources.forEach(id=>addLabel('button','port '+(pending===id?'pending':''),(stage().sourcePorts?.[id]||(id==='R'&&stageId!=='ffn'?'X':id))+' · '+shape(stage().sourceDim||2),{'type':'button','data-output':id,'aria-label':`${outputName(id)}${I18n.t(" 输出口，")}${shape(stage().sourceDim||2)}`},()=>point(id)));
  if(stageId==='ffn')addLabel('span','source-label','Z = RMSNorm(R)',{},()=>new T.Vector3(stage().sourceX,.65,2.55));
  state.nodes.forEach(n=>{const d=definition(n.id);addLabel('button','node-label '+(selected===n.id?'selected ':''),`${nodeName(n.id)}<small>${d.ins.map(shape).join(' / ')} → ${shape(d.out)}</small>`,{'type':'button','data-node':n.id,'aria-label':`${d.name}${I18n.t(" 模块，拖动移动")}`},()=>new T.Vector3(n.x,1.85,n.z-1.15));
   if(stage().engine)addLabel('button','device-badge device-'+n.device+(busy&&current?.depths[n.id]===level?' processing':''),n.device.toUpperCase(),{'type':'button','data-assign':n.id,'data-owner':n.id,'aria-label':definition(n.id).name+I18n.t(" 当前在 ")+n.device+I18n.t("，选择后点击芯片区域")},()=>new T.Vector3(n.x,1.9,n.z-.45));
   d.ins.forEach((dim,i)=>addLabel('button','port input '+(n.links[i]?'connected ':''),n.id==='enattn'?'Q/K/V':shape(dim),{'type':'button','data-input':`${n.id}:${i}`,'aria-label':`${d.name}${I18n.t(" 输入 ")}${i+1}，${shape(dim)}${n.links[i]?I18n.t("，已连接"):''}`},()=>point(n.id,'in',i)));
   addLabel('button','port '+(pending===n.id?'pending':''),n.id==='enqkv'?'Q/K/V':shape(d.out),{'type':'button','data-output':n.id,'aria-label':`${d.name}${I18n.t(" 输出口，")}${shape(d.out)}`},()=>point(n.id));
   if(busy&&current?.values[n.id]&&!stage().sequence&&(current.depths[n.id]||0)<=level&&fault?.id!==n.id)addLabel('span','node-value',`${flowIdentity()} · ${vector(current.values[n.id])}`,{'data-owner':n.id},()=>new T.Vector3(n.x,.5,n.z+1.45));
  });
  addLabel('button','port input '+(state.sink?'connected ':''),String(shape(stage().sinkDim)),{'type':'button','data-input':'sink:0','aria-label':`${I18n.t("本层输出入口，")}${shape(stage().sinkDim)}${state.sink?I18n.t("，已连接"):''}`},()=>point('sink'));
  if(busy&&current?.output&&level===99&&!fault&&!stage().sequence)addLabel('span','node-value',vector(current.output),{},()=>new T.Vector3(stage().sinkX,.6,1.6));
  if(fault){
   const pos=()=>point('sink'),vf=v=>v?'['+v.map(x=>fmt(x)).join(', ')+']':I18n.t("未得到输出");
   const tokenText=stage().tokenOutput?`${I18n.t("<p class=\"token-verdict\">实际：")}${fault.actual?M.readTokens(fault.actual):I18n.t("未输出")}${I18n.t("<br>目标：")}${M.readTokens(fault.expected)}</p>`:'';
   const content=`${I18n.t("<button type=\"button\" class=\"fault-close\" data-dismiss-result aria-label=\"关闭结果提示\" title=\"关闭结果提示\">×</button><strong>最终结果 · ")}${sample<3&&!stage().sequence?I18n.t("位置 ")+sample+I18n.t("（输入“")+samples()[sample].word+'”）':samples()[sample].word}</strong>${tokenText}${I18n.t("<div><span>你的结果</span><b>")}${vf(fault.actual)}${I18n.t("</b></div><div class=\"expected\"><span>预期结果</span><b>")}${vf(fault.expected)}</b></div>`;
   addLabel('span','fault-pin','!',{'data-owner':'sink','aria-hidden':'true'},pos);
   addLabel('div','local-fault',content,{'data-owner':'sink','role':'status'},pos);
  }
  render();
 }
 function project(p){const v=p.clone().project(camera);return [(v.x+1)*host.clientWidth/2,(1-v.y)*host.clientHeight/2];}
 function syncWireTargets(w,h){
  if(wireTargets.parentNode!==overlay)overlay.prepend(wireTargets);wireTargets.style.display=busy||focusId||placing||pending?'none':'';wireTargets.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const key=I18n.language()+curves.map(c=>`${c.from}:${c.to}:${c.index}`).join('|');
  if(key!==wireTargetKey){wireTargetKey=key;wireTargets.replaceChildren();wirePaths=curves.map(edge=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',outputName(edge.from)+' → '+(edge.to==='sink'?stage().outputTitle:nodeName(edge.to))+I18n.t("，选择连线"));path.dataset.wireTo=edge.to;path.dataset.wirePort=String(edge.index);path.addEventListener('click',()=>chooseWire(edge.to,edge.index));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseWire(edge.to,edge.index);}});wireTargets.appendChild(path);return path;});}
  curves.forEach((edge,i)=>{wirePaths[i].setAttribute('d',edge.curve.getPoints(32).map((p,j)=>{const [x,y]=project(p);return `${j?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(' '));wirePaths[i].classList.toggle('selected',!!selectedWire&&edge.to===selectedWire.to&&edge.index===selectedWire.index);});
 }
 function syncConnectionGuide(w,h){
  const visible=stageId==='wire'&&!state.sink&&!busy&&!pending&&!focusId;
  if(!visible){guide.setAttribute('hidden','');return;}
  if(guide.parentNode!==overlay)overlay.prepend(guide);
  guide.removeAttribute('hidden');guide.setAttribute('viewBox',`0 0 ${w} ${h}`);
  guidePath.setAttribute('d',curve(point('R'),point('sink','in')).getPoints(32).map((p,i)=>{const [x,y]=project(p);return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(' '));
 }
 function syncPlacementGuide(w,h){
  const flag=$('#module-palette [data-add-module]');
  if(!stage().placementTutorial||state.nodes.length||busy||focusId||!$('#module-shelf').hasAttribute('open')||!flag){placementGuide.setAttribute('hidden','');return;}
  if(placementGuide.parentNode!==overlay)overlay.prepend(placementGuide);
  placementGuide.removeAttribute('hidden');placementGuide.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const [x,y]=project(new T.Vector3(0,.13,0));
  const corners=[[-1.04,-1.22],[1.04,-1.22],[1.04,1.22],[-1.04,1.22]].map(([a,b])=>project(new T.Vector3(a,.13,b)));
  placementOutline.setAttribute('d',corners.map(([a,b],i)=>`${i?'L':'M'}${a} ${b}`).join(' ')+' Z');
  const flagRect=flag.getBoundingClientRect(),hostRect=host.getBoundingClientRect(),sx=flagRect.right-hostRect.left+5,sy=flagRect.top+flagRect.height/2-hostRect.top;
  placementPath.setAttribute('d',`M${sx} ${sy} Q${(sx+x)/2} ${sy} ${x} ${y}`);placementPath.style.opacity=placing?'0':'.65';
 }
 // Check the visible feature blocks as well as the tray: projection fans the
 // features away from the packet center. Screen space also follows camera moves.
 function flowFootprints(pixelsPerUnit){
  const footprints=[];if(!busy)return footprints;
  for(const p of packets)for(const mesh of [p.mesh,p.otherMesh,p.outputMesh]){
   if(!mesh?.visible)continue;
   mesh.traverseVisible(o=>{
    if(!o.userData.packetTray&&o.userData.feature==null&&o.userData.featureValue==null)return;
    const alpha=o.material?.opacity??1;if(alpha<=0)return;
    if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
    const sphere=o.geometry.boundingSphere,center=sphere.center.clone().applyMatrix4(o.matrixWorld),[x,y]=project(center);
    footprints.push({x,y,r:sphere.radius*o.matrixWorld.getMaxScaleOnAxis()*pixelsPerUnit,alpha:Math.min(1,alpha/.3)});
   });
  }
  return footprints;
 }
 function fadePort(el,x,y,footprints,width,height){
  let fade=0;const halfWidth=(width||27)/2,halfHeight=(height||27)/2;
  for(const p of packets)if((p.worked||p.tokenOperation||p.centering)&&(p.node.id===el.dataset.output||(p.paired||p.tokenOperation||p.centering)&&el.dataset.input?.startsWith(p.node.id+':')))fade=Math.max(fade,p.portFade||0);
  for(const p of footprints){
   const gap=Math.hypot(Math.max(0,Math.abs(x-p.x)-halfWidth),Math.max(0,Math.abs(y-p.y)-halfHeight))-p.r;
   const t=Math.max(0,Math.min(1,gap/24)),ease=t*t*(3-2*t);
   fade=Math.max(fade,(1-ease)*p.alpha);
  }
  el.style.opacity=fade?String(1-.92*fade):'';
 }
 function render(){
  const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);const width=23*zoom,height=width*h/w;
  Object.assign(camera,{left:-width/2,right:width/2,top:height/2,bottom:-height/2});
  camera.position.set(cameraTarget.x+Math.sin(yaw)*24,cameraTarget.y+Math.sin(pitch)*24,cameraTarget.z+Math.cos(yaw)*Math.cos(pitch)*24);
  camera.lookAt(cameraTarget);camera.updateProjectionMatrix();art.updateDetail(camera,w,h);
  for(const p of packets)if(p.tokenOperation||p.centering)for(const {label}of p.mesh.userData.featureRoutes)label.visible=label.material.opacity>0&&art.detailsVisible();
  renderer.render(scene,camera);
  syncConnectionGuide(w,h);syncPlacementGuide(w,h);syncWireTargets(w,h);
  const flow=flowFootprints(w/width);
  // Measure overlays together before moving them, avoiding layout per port.
  const layouts=elements.map(({el,pos})=>({el,xy:project(pos()),width:el.offsetWidth,height:el.offsetHeight}));
  layouts.forEach(({el,xy:[x,y],width,height})=>{
   el.hidden=!!focusId&&(el.dataset.owner!==focusId||el.classList.contains('node-label')||el.classList.contains('local-fault')||el.classList.contains('fault-pin'));
   if(el.classList.contains('port')){el.disabled=!!focusId;fadePort(el,x,y,flow,width,height);}
   if(el.classList.contains('local-fault')||el.classList.contains('wire-actions')){
    el.style.left=Math.max(12,Math.min(w-width-12,x+18))+'px';el.style.top=Math.max(12,Math.min(h-height-46,y+15))+'px';
   }else{el.style.left=x+'px';el.style.top=y+'px';}
  });
  packets.forEach(p=>{
   const [x,y]=project(p.p.clone().add(new T.Vector3(0,.7,0)));p.el.style.left=x+'px';p.el.style.top=y+'px';
   if(p.calculation){
    const scale=w/width/60;
    p.equationVisible=art.detailsVisible();
    p.calculation.dataset.detail=p.equationVisible?'full':'abstract';p.calculation.style.setProperty('--calculation-scale',String(scale));
    const anchor=p.tokenOperation?art.tokenAnchor(p.node.id,p.tokenRow,p.input,p.progress??0):p.centering?art.layerNormAnchor(p.node.id,p.rmsRow,p.progress??0):p.normalizing?art.rmsAnchor(p.node.id,p.rmsRow):art.projectionOutlet(p.node.id,p.column);
    const [cx,cy]=project(anchor),cw=(p.equationVisible?(p.calculation.offsetWidth||p.equation.textContent.length*7+14):24)*scale;
    const radius=(p.normalizing||p.tokenOperation?.2:art.projectionRadius(p.node.id,p.column))*w/width,offset=radius+9*scale,side=cx+offset+cw<w-12?'right':'left';
    p.calculation.dataset.side=side;
    p.calculation.style.left=(side==='right'?cx+offset:cx-offset)+'px';p.calculation.style.top=cy+'px';
    const accent=colorHex(p.tokenOperation?art.rowColor(p.tokenRow):p.centering&&!stage().sequence?p.color:p.normalizing?art.rowColor(p.rmsRow):p.paired?nodeColor(p.node.id):art.projectionColor);
    p.calculation.style.setProperty('--calculation-color',accent);p.calculation.style.setProperty('--calculation-halo',accent+'33');
    p.calculation.style.setProperty('--calculation-focus',String(p.focus||0));
    for(const {el,bar}of p.outputLabels){
     const [rx,ry]=project(bar.getWorldPosition(new T.Vector3())),[sx,sy]=project(art.projectionOutlet(p.node.id,bar.userData.feature)),g=p.outputMesh.userData.gather;
     const aligned=p.tokenOperation||p.centering;
     el.style.left=((sx+(aligned?0:28)*scale)*(1-g)+(rx-(aligned?0:7)*scale)*g)+'px';el.style.top=((sy-(aligned?16:0)*scale)*(1-g)+(ry-12*scale)*g)+'px';
     el.style.setProperty('--calculation-scale',String(scale));el.style.visibility=p.equationVisible?'':'hidden';
    }
   }
  });
 }

 function transition(target,targetZoom,targetYaw=yaw,targetPitch=pitch){
  cancelAnimationFrame(cameraFrame);const start=performance.now(),from=cameraTarget.clone(),z0=zoom,y0=yaw,p0=pitch,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;transitioning=true;host.setAttribute('aria-busy','true');
  function frame(now){const t=reduced?1:Math.min(1,(now-start)/480),ease=t*t*(3-2*t);cameraTarget.copy(from).lerp(target,ease);zoom=z0+(targetZoom-z0)*ease;yaw=y0+(targetYaw-y0)*ease;pitch=p0+(targetPitch-p0)*ease;render();if(t<1)cameraFrame=requestAnimationFrame(frame);else{transitioning=false;host.setAttribute('aria-busy','false');}}cameraFrame=requestAnimationFrame(frame);
 }
 function focus(id){
  const n=state.nodes.find(n=>n.id===id);if(!n)return;if(shelfFocus)leaveFocus();if(!focusId)overview={target:cameraTarget.clone(),zoom,yaw,pitch};focusId=id;selected=id;pending=placing=actionNode=null;clearPreview();clearPlacement();
  document.body.classList.add('module-focused');openModuleCard(id);
  $('#scene-help').textContent=I18n.t("近看模式 · 拖动旋转 · 滚轮缩放 · Esc 返回");
  assembly.children.forEach(g=>g.visible=g.userData.node===id);wires.visible=false;art.focus(true);labels();inspect();
  const width=Math.max(4.1,3.5*host.clientWidth/host.clientHeight);transition(new T.Vector3(n.x,.7,n.z),width/23,.32,.92);
 }
 function focusShelf(kind){
  if(busy||!stage().buildable||!M.inventory(stage())[kind])return;
  if(focusId)leaveFocus();
  overview={target:cameraTarget.clone(),zoom,yaw,pitch};shelfFocus={kind,selected};focusId='shelf-card';
  selected=actionNode=pending=placing=selectedWire=null;drag=lastTap=null;clearPreview();clearPlacement();
  const d=M.definitions[kind];shelfModel=art.module(scene,{id:'shelf-card',kind,x:0,z:0,links:d.ins.map(()=>null)},d,M.weights,{register:false});shelfModel.userData.shelfPreview=true;
  document.body.classList.add('module-focused');openModuleCard(null,kind,d.name);
  assembly.visible=false;wires.visible=false;art.focus(true);labels();inspect();
  const width=Math.max(4.1,3.5*host.clientWidth/host.clientHeight);transition(new T.Vector3(0,.7,0),width/23,.32,.92);
 }
 function openModuleCard(id,kind=kindOf(id),name=nodeName(id)){
  const c=cardFor(kind,stageId)||M.extraCard(kind,stageId),d=M.definitions[kind],card=$('#module-card');
  card.style.setProperty('--card-accent',c.color);$('.card-example-title').firstChild.textContent=stage().sequence?I18n.t("用三个输入位置看一次"):I18n.t("用“猫”的向量看一次");
  for(const [field,value]of Object.entries({name,seal:c.seal,english:c.english,family:c.family,number:stage().chapter,ability:c.ability,meaning:c.meaning,formula:c.formula,purpose:c.purpose}))$('#card-'+field).textContent=value;
  $('#card-stats').innerHTML=`${I18n.t("<div><span>向量维度</span><b>")}${d.ins.map(shape).join(' / ')} → ${shape(d.out)}${I18n.t("</b></div><div><span>权重矩阵</span><b>")}${c.weight}${I18n.t("</b></div><div><span>计算方式</span><b>")}${c.trait}</b></div>`;
  $('#card-example-input').textContent=stageId==='ffn'?'R = [1, 1]':stage().sequence?I18n.t("三个位置的特征 · 教学缩尺"):'X = [1, 1]';
  const names={Q:I18n.t("查询"),K:I18n.t("键"),V:I18n.t("内容"),A:I18n.t("注意力"),L:I18n.t("词表分数"),T:I18n.t("选出的词"),B:I18n.t("计算结果"),X:I18n.t("输入向量"),P:I18n.t("投影结果"),R:I18n.t("原始输入"),Z:I18n.t("归一化输入"),G:I18n.t("门分支"),U:I18n.t("内容分支"),S:stage().original?I18n.t('相关分数 S'):['activation','plain-ffn'].includes(stageId)?I18n.t("SiLU 的输出"):I18n.t("激活门值"),H:I18n.t("门控结果"),F:I18n.t("本次变换"),Y:I18n.t("本层输出")};
  Object.assign(names,M.original?.exampleLabels(stageId));
  if(stageId==='add-norm')names.R=I18n.t('残差相加结果');
  const ex=M.extraExample?.(kind,stageId)||exampleFor(M,kind,stageId),vectorRow=([name,values],output=false,focus=-1,label=names[name]||name)=>`<div class="card-vector ${output?'result':''}" data-symbol="${name}"><b>${name} · ${label}</b><span ${(stage().original||ex.rms)&&stage().sequence?'style="display:grid;grid-template-columns:repeat('+Math.ceil(values.length/3)+',minmax(0,1fr))"':''}>${values.map((v,i)=>`<i class="${v<0?'negative':''} ${i===focus?'example-focus':''}">${fmt(v)}</i>`).join('')}</span></div>`;
  const formulaNumber=v=>Number(v.toFixed(4)).toString();
  if(ex.sampleIndex===0&&!stage().sequence){$('.card-example-title').firstChild.textContent=I18n.t("用“我”的向量看一次");$('#card-example-input').textContent=ex.exampleSource[0]+' = '+vector(ex.exampleSource[1]);}
  if(ex.rms){
   const {width,meanSquare,divisor}=ex.rms,v=ex.inputs[0][1].slice(0,width);
   $('#card-example-values').innerHTML=ex.inputs.map(v=>vectorRow(v)).join('')+`<div class="card-silu-worked"><small>${I18n.t('这里只展开第一个位置的归一化，其他位置分别计算。')}</small><code>mean(X²) = ${formulaNumber(meanSquare)}<br>r = √(${formulaNumber(meanSquare)} + ε) ≈ ${formulaNumber(divisor)}<br>${vector(v)} / ${formulaNumber(divisor)} ≈ ${vector(ex.output[1].slice(0,width))}</code></div>`+vectorRow(ex.output,true);
  }else if(ex.normalization){
   const {mean,variance,epsilon}=ex.normalization;
   $('#card-example-values').innerHTML=ex.inputs.map(v=>vectorRow(v)).join('')+`<div class="card-silu-worked">${stage().sequence?'<small>'+I18n.t('这里只展开第一个位置的归一化，其他位置分别计算。')+'</small>':''}<code>μ = ${formulaNumber(mean)}<br>σ² = ${formulaNumber(variance)}<br>(x − μ) / √(σ² + ${epsilon})</code></div>`+vectorRow(ex.output,true);
  }else if(ex.activation?.kind==='relu'){
   const {feature}=ex.activation,input=ex.inputs[0],output=ex.output,x=input[1][feature];
   $('#card-example-values').innerHTML=`<div class="card-silu-example">${vectorRow(input,false,feature)}<div class="card-silu-link"><b>ReLU</b><span>${input[1].map((_,i)=>`<i class="${i===feature?'example-focus':''}">↓</i>`).join('')}</span></div>${vectorRow(output,true,feature)}<div class="card-silu-worked"><code>max(0, ${formulaNumber(x)}) = ${fmt(output[1][feature])}</code></div></div>`;
  }else if(ex.activation){
   const {feature,content,product}=ex.activation,input=ex.inputs[0],output=ex.output,x=input[1][feature],y=output[1][feature];
   const next=content?`<p class="card-silu-use">${I18n.t("把这个 S 与对应的内容特征相乘：")}</p><div class="card-gate-result"><span data-role="content"><small>${I18n.t("内容 U")}</small><b>${fmt(content[feature])}</b></span><i>×</i><span data-role="scale"><small>${I18n.t("SiLU 输出 S")}</small><b>${fmt(y)}</b></span><i>≈</i><span data-role="result"><small>${I18n.t("相乘结果")}</small><b>${fmt(product[feature])}</b></span></div>`:'';
   $('#card-example-values').innerHTML=`<div class="card-silu-example">${vectorRow(input,false,feature,I18n.t("SiLU 的输入"))}<div class="card-silu-link"><b>SiLU</b><span>${input[1].map((_,i)=>`<i class="${i===feature?'example-focus':''}" aria-hidden="true">↓</i>`).join('')}</span></div>${vectorRow(output,true,feature,I18n.t("SiLU 的输出"))}<div class="card-silu-worked"><small>${I18n.t("把高亮的输入代入公式：")}</small><code>SiLU(${formulaNumber(x)}) = ${formulaNumber(x)} / (1 + e<sup>${formulaNumber(-x)}</sup>) ≈ ${fmt(y)}</code></div>${next}</div>`;
  }else if(ex.addition){
   const {feature}=ex.addition,[base,update]=ex.inputs,result=ex.output,roles={[base[0]]:I18n.t("原有特征"),[update[0]]:I18n.t("修改量"),[result[0]]:I18n.t("更新结果")};
   const a=base[1][feature],b=update[1][feature],y=result[1][feature],signed=v=>v<0?'('+fmt(v)+')':fmt(v),equal=[a,b,y].some(v=>Math.abs(v-Number(v.toFixed(2)))>1e-9)?'≈':'=';
   $('#card-example-values').innerHTML=`<div class="card-add-example">${[base,update,result].map(row=>vectorRow(row,row===result,feature,roles[row[0]])).join('')}<div class="card-add-step"><small>${I18n.t("同一位置，原值加上修改量：")}</small><code><span data-role="baseline">${signed(a)}</span> + <span data-role="update">${signed(b)}</span> ${equal} <b>${fmt(y)}</b></code></div><p class="card-add-zero">${I18n.t("如果修改量为零：")} <code>${update[0]} = ${vector(update[1].map(()=>0))} → ${result[0]} = ${base[0]}</code></p></div>`;
  }else if(ex.comparison){
   const {input,rows,feature}=ex.comparison,values=Object.fromEntries(rows),u=values.U[feature],g=values.G[feature],s=values.S[feature],h=values.H[feature];
   const roles={U:I18n.t("线性投影"),G:I18n.t("门投影"),S:I18n.t("SiLU 系数"),H:I18n.t("相乘结果")};
   $('.card-example-title').firstChild.textContent=I18n.t("用“我”的向量比较两条支路");$('#card-example-input').textContent=input[0]+' = '+vector(input[1]);
   $('#card-example-values').innerHTML=`<div class="card-comparison"><p class="card-example-focus">${I18n.t("只看高亮的这一项：")}</p>${rows.map(row=>vectorRow(row,row[0]==='H',feature,roles[row[0]])).join('')}<div class="card-gate-step">SiLU(${formulaNumber(g)}) ≈ ${fmt(s)}</div><div class="card-gate-result"><span data-role="content"><small>${I18n.t("内容")}</small><b>${fmt(u)}</b></span><i>×</i><span data-role="scale"><small>${I18n.t("调节系数")}</small><b>${fmt(s)}</b></span><i>≈</i><span data-role="result"><small>${I18n.t("相乘结果")}</small><b>${fmt(h)}</b></span></div></div>`;
  }else $('#card-example-values').innerHTML=ex.inputs.map(v=>vectorRow(v)).join('')+vectorRow(ex.output,true);
  const contrast=$('#card-merge-contrast');contrast.hidden=!['multiply','add','residual'].includes(d.type);contrast.replaceChildren();
  if(!contrast.hidden){
   const a=[4,2],b=[.25,1.5],product=a.map((v,i)=>v*b[i]),sum=a.map((v,i)=>v+b[i]);
   contrast.innerHTML=`<b>${I18n.t('用同两组数比较：')}</b><code>A = ${vector(a)}　B = ${vector(b)}</code><div class="merge-compare-row ${d.type==='multiply'?'current':''}" data-operation="multiply"><strong>×</strong><span><code>A ⊙ B = ${vector(product)}</code><small>${I18n.t('逐项调节强弱；乘以 1 保持原值。')}</small></span></div><div class="merge-compare-row ${d.type!=='multiply'?'current':''}" data-operation="add"><strong>+</strong><span><code>A + B = ${vector(sum)}</code><small>${I18n.t('在原值上增加或减少；加上 0 保持原值。')}</small></span></div><small>${I18n.t('这里只比较运算：门控中 B 是调节系数，残差中 B 是修改量。')}</small>`;
  }
  $('.card-path>span').textContent=stage().title;
  $('#card-path').innerHTML=(stageId==='ffn'?[I18n.t("双路投影"),'SiLU',I18n.t("门控"),I18n.t("降维"),I18n.t("残差")]:stage().nodes.map(k=>M.definitions[k].name)).map((label,i)=>`${i?'<i>›</i>':''}<span class="${(stageId==='ffn'?i===c.stage:stage().nodes[i]===kind)?'active':''}">${label}</span>`).join('');
  host.setAttribute('aria-label',I18n.t("拖动旋转模块，滚轮缩放"));$('#card-portrait').append(host,overlay);if(!card.open)card.showModal();
 }
 function leaveFocus(){
  if(!focusId)return;
  // Restore synchronously, including when the opening animation is unfinished.
  cancelAnimationFrame(cameraFrame);cameraFrame=0;transitioning=false;
  const previous=overview,returnShelf=shelfFocus;overview=null;
  cameraTarget.copy(previous?.target||new T.Vector3());zoom=previous?.zoom??stage().zoom;yaw=previous?.yaw??.05;pitch=previous?.pitch??.8;
  host.setAttribute('aria-busy','false');
  focusId=null;shelfFocus=null;pending=null;clearPreview();if(shelfModel){scene.remove(shelfModel);dispose(shelfModel);shelfModel=null;}if(returnShelf)selected=returnShelf.selected;
  document.body.classList.remove('module-focused');$('.arena').prepend(host,overlay);host.setAttribute('aria-label',I18n.t("拖动空白转动视角，拖动模块重新摆放"));$('#module-card').close();
  $('#scene-help').textContent=I18n.t("拖模块摆放 · 点连线删除 · 双击查看模块卡");assembly.visible=true;assembly.children.forEach(g=>g.visible=true);wires.visible=true;art.focus(false);labels();inspect();
  $(returnShelf?'[data-add-module="'+returnShelf.kind+'"]':'[data-node="'+selected+'"]')?.focus({preventScroll:true});
 }
 function nodeTap(id,e){const now=performance.now();if(lastTap?.id===id&&now-lastTap.time<380&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<10){lastTap=null;focus(id);}else{lastTap={id,time:now,x:e.clientX,y:e.clientY};select(id);}}
 function worldPoint(x,y){const r=host.getBoundingClientRect();cursor.set((x-r.left)/r.width*2-1,-((y-r.top)/r.height*2-1));ray.setFromCamera(cursor,camera);const p=new T.Vector3();return ray.ray.intersectPlane(plane,p)?p:null;}
 function clearPackets(){packets.forEach(p=>{p.el.remove();p.calculation?.remove();p.outputLabels?.forEach(({el})=>el.remove());for(const mesh of [p.mesh,p.otherMesh,p.outputMesh].filter(Boolean)){scene.remove(mesh);mesh.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});}});packets=[];art.clearProcessing();render();}
 const normalizationFrame=(time,centering)=>art[centering?'layerNormFrame':'rmsFrame'](time,stage().sequence?3:1);
 function animate(ev,ms,id){
  clearPackets();lastDepth=-1;const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;if(reduced)ms=70;
  let previous=animationTime(),elapsed=0;
  const seq=!!stage().sequence,readyNodes=state.nodes.filter(n=>ev.values[n.id]);
  const pairedNode=id=>!seq&&['multiply','add'].includes(definition(id)?.type);
  const lastWave=Math.max(0,...Object.values(ev.depths)),starts=[0],ends=[0];
  // Travel is 1.5× faster than before; every operator keeps its original clock.
  const travelDuration=2/3;
  for(let depth=1;depth<=lastWave;depth++){
   const durations=readyNodes.filter(n=>ev.depths[n.id]===depth).map(n=>{
    const d=definition(n.id),tokenOperation=art.tokenOperation(d);
    return tokenOperation?art.tokenFrame(0,tokenOperation).duration:['norm','layernorm'].includes(d.type)?normalizationFrame(0,d.type==='layernorm').duration:!seq&&['linear','multiply','add'].includes(d.type)?art.projectionFrame(0,ev.values[n.id].length).duration:1;
   });
   starts[depth]=ends[depth-1]+travelDuration;ends[depth]=starts[depth]+Math.max(1,...durations);
  }
  const max=ends[lastWave]+travelDuration;
  const clamp=x=>Math.max(0,Math.min(1,x)),ramp=(x,a,b)=>{const v=clamp((x-a)/(b-a));return v*v*(3-2*v);};
  function fadeMaterials(mesh){const materials=[];mesh.traverse(o=>{if(o.material){o.material.transparent=true;o.material.depthWrite=false;o.castShadow=false;materials.push(o.material);}});return materials;}
  function movingPacket(values,from,to,motion){
   const color=seq?(nodeColor(from)):art.rowColor(sample);
   const el=document.createElement('span');el.className='packet';el.hidden=true;el.dataset.motion=motion;el.dataset.row=seq?'sequence':sample<3?String(sample):'validation';el.dataset.from=from;el.dataset.to=to;el.style.setProperty('--row-color',colorHex(color));
   const title=document.createElement('b');title.className='packet-title';title.textContent=packetIdentity(from);el.appendChild(title);
   const cells=document.createElement('span');cells.className='packet-values';
   cells.textContent=seq?shape(values.length):vector(values);
   el.appendChild(document.createTextNode(' '));el.appendChild(cells);overlay.appendChild(el);
   const mesh=art.packet(values,color,{sequence:seq});Object.assign(mesh.userData,{packet:motion==='wire',row:el.dataset.row,from,to});mesh.visible=false;scene.add(mesh);
   return {el,cells,mesh,color,materials:fadeMaterials(mesh),p:new T.Vector3(),motion};
  }
  // Give every depth enough processing time for all output columns. Shorter
  // operations hold their result; joins still wait for the final incoming branch.
  const processPaths=new Map(readyNodes.map(n=>[n.id,new T.CubicBezierCurve3(point(n.id,'in',0),new T.Vector3(n.x-.7,1.15,n.z),new T.Vector3(n.x+.7,1.15,n.z),point(n.id))]));
  curves.filter(c=>ev.values[c.from]).forEach(edge=>{
   const p=movingPacket(ev.values[edge.from],edge.from,edge.to,'wire');
   const perRow=!seq&&sample<3,departure=perRow&&['R','Z'].includes(edge.from)?new T.LineCurve3(rowEndpoint('source'),edge.curve.getPoint(0)):null,arrival=perRow&&edge.to==='sink'?new T.LineCurve3(edge.curve.getPoint(1),rowEndpoint('sink')):null;
   const start=ends[ev.depths[edge.from]||0],processStart=processPaths.has(edge.to)?starts[ev.depths[edge.to]]:null;
   Object.assign(p,{edge,departure,arrival,start,processStart,end:processStart==null?start+travelDuration:processStart+(edge.index>0&&!pairedNode(edge.to)?.25:0)});
   p.p=departure?.getPoint(0)||edge.curve.getPoint(0);p.mesh.position.copy(p.p);packets.push(p);
  });
  readyNodes.forEach(n=>{
   const input=ev.values[n.links[0]],output=ev.values[n.id],p=movingPacket(input,n.id,n.id,'process');
   p.el.classList.add('processing-packet');p.el.dataset.node=n.id;p.mesh.userData.processing=n.id;
   const detailed=!seq&&definition(n.id).type==='linear',paired=pairedNode(n.id),worked=detailed||paired,other=paired?ev.values[n.links[1]]:null;
   const operation=definition(n.id).type,tokenOperation=art.tokenOperation(definition(n.id)),centering=operation==='layernorm',normalizing=operation==='norm'||centering,pairTones=paired?art.pairColorsFor(n.id):null,operator=operation==='add'?'+':'×';
   Object.assign(p,{detailed,paired,worked,other,normalizing,centering,tokenOperation});
   if(worked||tokenOperation||centering)art.prepareProjectionPacket(p.mesh,paired?()=>pairTones[0]:undefined);
   if(paired){
    const otherMesh=art.packet(other,p.color);otherMesh.userData={processingSecondary:n.id,row:p.el.dataset.row};otherMesh.visible=false;scene.add(otherMesh);
    art.prepareProjectionPacket(otherMesh,()=>pairTones[1]);fadeMaterials(otherMesh);p.otherMesh=otherMesh;
   }
   const outputMesh=art.packet(output,p.color,{sequence:seq});outputMesh.userData={processingOutput:n.id,row:p.el.dataset.row};outputMesh.visible=false;scene.add(outputMesh);
   const morph=document.createElement('span');morph.className='packet-morph';p.cells.replaceWith(morph);morph.appendChild(p.cells);
   const after=document.createElement('span');after.className='packet-values';after.textContent=seq?shape(output.length):vector(output);after.style.opacity='0';morph.appendChild(after);
   p.el.style.visibility='hidden';p.el.hidden=false;
   const beforeWidth=p.cells.offsetWidth||p.cells.textContent.length*6.6,afterWidth=after.offsetWidth||after.textContent.length*6.6;
   p.el.hidden=true;p.el.style.visibility='';morph.style.width=beforeWidth+'px';
   if(worked||normalizing||tokenOperation){
    art.prepareProjectionOutput(outputMesh);
    p.outputLabels=output.map((value,j)=>{
     const el=document.createElement('span');el.className='projection-result'+(tokenOperation||centering?' token-result':'');el.hidden=true;el.textContent=fmt(value);el.dataset.node=n.id;el.dataset.column=String(j);el.dataset.row=p.el.dataset.row;overlay.appendChild(el);
     return {el,bar:outputMesh.children.find(o=>o.userData.feature===j)};
    });
   }
   if(tokenOperation){
    // Follow the actual ID-producing input, including repeated/reordered IDs
    // and additional operator copies. Feature vectors retain position identity.
    let from=n.links[0],ids=null;const visited=new Set();
    while(from&&!visited.has(from)){
     visited.add(from);const values=ev.values[from];
     if(values?.length===3&&values.every(v=>Number.isInteger(v)&&M.math.vocab[v]!=null)){ids=[...values];break;}
     from=state.nodes.find(node=>node.id===from)?.links[0];
    }
    const words=()=>ids?ids.map(i=>M.math.vocab[i]):samples()[sample].word.split(' / '),width=output.length/3;
    const calculation=document.createElement('span');calculation.className='projection-calculation token-calculation';calculation.hidden=true;calculation.dataset.node=n.id;calculation.dataset.operation=tokenOperation;
    const equation=document.createElement('span');equation.className='projection-equation';
    const token=document.createElement('b'),left=document.createElement('span'),join=document.createTextNode(''),right=document.createElement('span'),result=document.createElement('b');
    left.style.color=colorHex(0x397aa2);right.style.color=colorHex(0xb68036);equation.append(token,left,join,right,result);calculation.append(equation);
    const abstract=document.createElement('span');abstract.className='projection-sum-symbol';abstract.setAttribute('aria-hidden','true');calculation.append(abstract);overlay.append(calculation);
    const updateToken=timing=>{
     const key=I18n.language()+':'+timing.row+':'+timing.stage;if(p.tokenEquationKey===key)return;p.tokenEquationKey=key;
     const row=timing.row,values=tokenOperation==='lookup'?output.slice(row*width,(row+1)*width):input.slice(row*width,(row+1)*width),out=output.slice(row*width,(row+1)*width);
     token.textContent=words()[row]+' · ';result.textContent='';
     if(tokenOperation==='lookup'){
      left.textContent=timing.stage==='address'?'ID '+input[row]:'E['+input[row]+']';join.textContent=timing.stage==='address'?' → ':' = ';right.textContent=timing.stage==='address'?'E['+input[row]+']':vector(values);abstract.textContent='E[ ]';
     }else{
      const scaled=values.map(x=>x*Math.sqrt(width)),angles=values.map((_,j)=>row/10000**(2*Math.floor(j/2)/width)),codes=angles.map((angle,j)=>(j%2?Math.cos:Math.sin)(angle));
      if(timing.stage==='scale'){left.textContent=vector(values)+' × '+(width===2?'√2':'2');join.textContent=' ≈ ';right.textContent=vector(scaled);abstract.textContent='×';}
      else if(timing.stage==='position'){left.textContent='p = '+row+' · ['+angles.map((angle,j)=>(j%2?'cos':'sin')+'('+fmt(angle)+')').join(', ')+']';join.textContent=' ≈ ';right.textContent=vector(codes);abstract.textContent='∿';}
      else{left.textContent=vector(scaled);join.textContent=' + ';right.textContent=vector(codes);result.textContent=' ≈ '+vector(out);abstract.textContent='+';}
     }
     calculation.dataset.tokenRow=String(row);calculation.dataset.tokenStage=timing.stage;p.tokenRow=row;
    };
    Object.assign(p,{calculation,equation,words,updateToken,tokenRow:0});updateToken(art.tokenFrame(0,tokenOperation));
   }
   if(normalizing){
    const calculation=document.createElement('span');calculation.className='projection-calculation '+(centering?'layernorm-calculation':'rms-calculation');calculation.hidden=true;calculation.dataset.node=n.id;calculation.dataset.operation=centering?'layernorm':'rmsnorm';
    const equation=document.createElement('span');equation.className='projection-equation';
    const token=document.createElement('b'),formula=document.createElement('span');equation.append(token,formula);calculation.append(equation);
    const abstract=document.createElement('span');abstract.className='projection-sum-symbol';abstract.textContent='÷r';abstract.setAttribute('aria-hidden','true');calculation.append(abstract);overlay.append(calculation);
    const factor=v=>v<0?'('+fmt(v)+')':fmt(v),width=input.length/(seq?3:1);
    const updateRMS=timing=>{
     const key=I18n.language()+':'+timing.row+':'+timing.stage;if(p.rmsEquationKey===key)return;p.rmsEquationKey=key;
     const row=timing.row,values=input.slice(row*width,(row+1)*width),squares=values.map(x=>x*x),r=Math.sqrt(squares.reduce((a,b)=>a+b,0)/width+1e-6);
     const word=seq?samples()[sample].word.split(' / ')[row]:samples()[sample].word;
     token.textContent=word+' · ';
     if(centering){
      const stats=art.layerNormStats(values),divisor=Number(stats.divisor.toFixed(4)),stage=timing.stage;
      formula.textContent=stage==='mean'?'μ = ('+values.map(factor).join(' + ')+') / '+width+' ≈ '+fmt(stats.mean):stage==='center'?vector(values)+' − '+factor(stats.mean)+' ≈ '+vector(stats.centered):stage==='variance'?'s = √(('+stats.centered.map(x=>factor(x)+'²').join(' + ')+') / '+width+' + ε) ≈ '+divisor:vector(stats.centered)+' / '+divisor+' ≈ '+vector(output.slice(row*width,(row+1)*width));
      abstract.textContent=stage==='mean'?'μ':stage==='center'?'−μ':stage==='variance'?'√v':'÷s';
     }else formula.textContent=timing.stage==='squares'?vector(values)+'² → '+vector(squares):timing.stage==='rms'?'r = √(('+values.map(x=>factor(x)+'²').join(' + ')+') / '+width+' + ε) ≈ '+fmt(r):vector(values)+' / '+Number(r.toFixed(4))+' ≈ '+vector(output.slice(row*width,(row+1)*width));
     calculation.dataset.normRow=String(row);calculation.dataset.normStage=timing.stage;p.rmsRow=row;
    };
    Object.assign(p,{calculation,equation,updateRMS,rmsRow:0});updateRMS(normalizationFrame(0,centering));
   }
   if(worked){
    const calculation=document.createElement('span');calculation.className='projection-calculation';calculation.hidden=true;calculation.dataset.node=n.id;calculation.dataset.operation=operation;
    const equation=document.createElement('span');equation.className='projection-equation';calculation.appendChild(equation);
    const abstract=document.createElement('span');abstract.className='projection-sum-symbol';abstract.textContent=paired?operator:'∑';abstract.setAttribute('aria-hidden','true');calculation.appendChild(abstract);
    const factor=v=>v<0?'('+fmt(v)+')':fmt(v),terms=[];
    (paired?[input,other]:input).forEach((_,i)=>{if(i)equation.appendChild(document.createTextNode(paired?' '+operator+' ':' + '));const term=document.createElement('span');term.style.color=colorHex(paired?pairTones[i]:art.featureColor(i));equation.appendChild(term);terms.push(term);});
    const sum=document.createElement('b');sum.style.opacity='0';equation.appendChild(sum);overlay.appendChild(calculation);
    const updateEquation=column=>{
     const operands=paired?[input[column],other[column]]:[...input,...weightsFor(n.id).map(w=>w[column])];
     terms.forEach((term,i)=>term.textContent=paired?factor(operands[i]):factor(input[i])+' × '+factor(weightsFor(n.id)[i][column]));
     const rounded=[...operands,output[column]].some(v=>Math.abs(v-Number(v.toFixed(2)))>1e-9);sum.textContent=(rounded?' ≈ ':' = ')+fmt(output[column]);
    };
    updateEquation(0);Object.assign(p,{calculation,equation,sum,updateEquation,column:0});
   }
   Object.assign(p,{node:n,input,output,outputMesh,outputMaterials:fadeMaterials(outputMesh),morph,after,beforeWidth,afterWidth,start:starts[ev.depths[n.id]],end:ends[ev.depths[n.id]],path:processPaths.get(n.id)});
   p.p=p.path.getPoint(0);p.mesh.position.copy(p.p);p.outputMesh.position.copy(p.p);packets.push(p);
  });
  art.pulseSource(reduced?1:0);
  return new Promise(resolve=>{function tick(now){
   if(id!==runId){resolve();return;}
   if(!busy){clearPackets();resolve();return;}
   // Accumulate time so changing speed mid-flight never jumps or rewinds a packet.
   const clock=animationTime(now);
   if(paused){previous=clock;requestAnimationFrame(tick);return;}
   elapsed+=Math.max(0,clock-previous)*playbackSpeed;previous=clock;
   const t=Math.min(max,elapsed/ms);level=0;while(level<lastWave&&t>=ends[level+1])level++;
   if(t>=max){clearPackets();labels();inspect();resolve();return;}
   if(level!==lastDepth){lastDepth=level;labels();inspect();}
   art.pulseSource(reduced?1:t);
   packets.forEach(p=>{
    const tt=t-p.start,timing=p.tokenOperation?art.tokenFrame(tt,p.tokenOperation):p.normalizing?normalizationFrame(tt,p.centering):p.worked?art.projectionFrame(tt,p.output.length):null,progress=timing?timing.phase:clamp(tt/(p.motion==='wire'?travelDuration:1));
    if(p.motion==='process'){
     p.progress=tt;
     const visible=tt>=0&&t<p.end&&(!focusId||focusId===p.node.id),blend=ramp(progress,p.worked?.76:.55,p.worked?.9:.83);
     p.el.hidden=!visible;p.el.dataset.phase=progress<.23?'enter':progress<.65?'compute':'gather';p.p=p.path.getPoint(progress);
     p.cells.style.opacity=String(1-blend);p.after.style.opacity=String(blend);p.morph.style.width=(p.beforeWidth+(p.afterWidth-p.beforeWidth)*blend)+'px';
     const inputAlpha=1-ramp(progress,p.worked?.72:.2,p.worked?.86:.42),outputAlpha=ramp(progress,p.worked?.8:.65,p.worked?.96:.9);
     p.mesh.visible=visible&&inputAlpha>0;p.outputMesh.visible=visible&&outputAlpha>0;
     p.materials.forEach(m=>m.opacity=inputAlpha);p.outputMaterials.forEach(m=>m.opacity=outputAlpha);p.outputMesh.position.copy(p.p);
     if(p.worked){
      if(p.paired){
       p.otherMesh.visible=visible&&inputAlpha>0;
       art.routePairedPacket(p.node.id,p.mesh,tt,0);art.routePairedPacket(p.node.id,p.otherMesh,tt,1);
       // Once the values reach their sockets, leave only the token name above
       // the operator. The local paired equation carries the arithmetic.
       const entering=1-ramp(progress,.18,.35),leaving=ramp(progress,.8,.94);
       p.cells.style.opacity=String(entering);p.after.style.opacity=String(leaving);p.morph.style.width=(p.beforeWidth*entering+p.afterWidth*leaving)+'px';
      }else art.routeProjectionPacket(p.node.id,p.mesh,progress,p.p,p.path.getPoint(.12));
      art.routeProjectionOutput(p.node.id,p.outputMesh,tt,p.p);
      p.outputMesh.visible=visible&&tt>=.67;
      p.portFade=visible?ramp(progress,.2,.38):0;
      const local=tt-timing.offset;
      p.focus=visible?timing.focus:0;
      p.calculation.hidden=!visible||local<.36||local>=.76;p.calculation.style.opacity=String(ramp(local,.36,.4)*(1-ramp(local,.71,.76)));p.sum.style.opacity=String(ramp(local,.61,.67));
      p.outputLabels.forEach(({el},j)=>{
       const alpha=ramp(tt,.76+j*timing.step,.8+j*timing.step)*(1-ramp(progress,.89,.97));
       el.hidden=!visible||alpha<=0;el.style.opacity=String(alpha);
      });
      p.calculation.dataset.column=String(timing.column);
      if(p.column!==timing.column){p.column=timing.column;p.updateEquation(p.column);}
     }
     if(p.tokenOperation){
      p.el.hidden=!visible||(progress>.12&&progress<.88);p.mesh.visible=visible&&tt<timing.end;
      art.routeTokenInput(p.node.id,p.mesh,tt,p.p,p.path.getPoint(.04));
      art.routeTokenOutput(p.node.id,p.outputMesh,tt,p.p);p.outputMesh.visible=visible&&tt>=timing.start+.82*timing.step;
      p.portFade=visible?ramp(progress,.1,.2):0;p.focus=visible&&timing.local>=.04&&timing.local<.94?1:0;
      p.updateToken(timing);p.calculation.hidden=!visible||tt<timing.start||tt>=timing.end;p.calculation.style.opacity=String(ramp(timing.local,0,.06)*(1-ramp(timing.local,.94,1)));
      const width=p.output.length/3;
      p.outputLabels.forEach(({el},j)=>{const ready=timing.start+(Math.floor(j/width)+.84)*timing.step,alpha=ramp(tt,ready,ready+.04)*(1-ramp(progress,.9,.98));el.hidden=!visible||alpha<=0;el.style.opacity=String(alpha);});
     }
     if(p.normalizing){
      p.el.hidden=!visible||(progress>.18&&progress<.88);
      if(p.centering){p.mesh.visible=visible&&tt<timing.end;art.routeLayerNormInput(p.node.id,p.mesh,tt,p.p,p.path.getPoint(.04),p.input,p.output);art.routeLayerNormOutput(p.node.id,p.outputMesh,tt,p.p);}
      else{p.mesh.visible=visible&&progress<.3;p.materials.forEach(m=>m.opacity=1-ramp(progress,.15,.3));art.routeRMSOutput(p.node.id,p.outputMesh,tt,p.p);}
      p.outputMesh.visible=visible&&tt>=timing.start+(p.centering?.89:.82)*timing.step;
      p.portFade=visible?ramp(progress,.18,.3):0;p.focus=visible&&timing.local>=.05&&timing.local<.94?1:0;
      p.updateRMS(timing);p.calculation.hidden=!visible||tt<timing.start||tt>=timing.end;p.calculation.style.opacity=String(ramp(timing.local,0,.06)*(1-ramp(timing.local,.94,1)));
      const width=p.output.length/(seq?3:1);
      p.outputLabels.forEach(({el},j)=>{
       const ready=timing.start+(Math.floor(j/width)+(p.centering?.94:.84))*timing.step,alpha=ramp(tt,ready,ready+.05)*(1-ramp(progress,.9,.98));
       el.hidden=!visible||alpha<=0;el.style.opacity=String(alpha);
      });
     }
     art.processing(p.node.id,tt,p.input,p.output,p.color,{sequence:seq,detailed:p.detailed,paired:p.paired,other:p.other,words:p.words?.()});
    }else{
     const inView=!focusId||p.edge.from===focusId||p.edge.to===focusId,visible=t>=p.start&&t<p.end&&inView;
     p.el.hidden=!visible;p.mesh.visible=visible;
     const a=p.departure?.18:0,b=p.arrival?.18:0;
     p.p=a&&progress<a?p.departure.getPoint(progress/a):b&&progress>1-b?p.arrival.getPoint((progress-1+b)/b):p.edge.curve.getPoint((progress-a)/(1-a-b));
     // A secondary input joins the same processing event after both are ready.
     const joining=p.processStart!=null&&p.edge.index>0&&!pairedNode(p.edge.to)&&t>=p.processStart;
     const alpha=joining?1-ramp(t-p.processStart,0,.25):1;
     if(joining)p.p.lerp(processPaths.get(p.edge.to).getPoint(.3),ramp(t-p.processStart,0,.25));
     p.el.style.opacity=String(alpha);p.materials.forEach(m=>m.opacity=alpha);
    }
    if(!p.paired)p.mesh.position.copy(p.p);
   });render();requestAnimationFrame(tick);
  }requestAnimationFrame(tick);});
 }

 function clearPreview(){if(preview){scene.remove(preview);preview.geometry.dispose();preview.material.dispose();preview=null;}}
 function clearPlacement(){if(placementMesh){scene.remove(placementMesh);dispose(placementMesh);placementMesh=null;}}
 function previewPlacement(x,y){
  if(!placing)return;const rect=host.getBoundingClientRect();
  if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom){if(placementMesh)placementMesh.visible=false;return;}
  const p=worldPoint(x,y);if(!p)return;
  if(!placementMesh){placementMesh=art.module(scene,{id:'placement-preview',kind:placing,x:0,z:0,links:[]},M.definitions[placing],M.weights,{register:false});placementMesh.userData.placementGhost=true;
   placementMesh.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=.48;o.material.depthWrite=false;o.castShadow=false;}});
  }
  placementMesh.visible=true;placementMesh.position.set(p.x,.1,p.z);placementMesh.userData.validPlacement=!!M.placement(state,placing,p.x,p.z);
  placementMesh.traverse(o=>{if(o.material?.emissive){o.material.emissive.set(placementMesh.userData.validPlacement?0x234d3e:0xa03524);o.material.emissiveIntensity=.3;}});render();
 }
 function previewAt(x,y){clearPreview();if(!pending)return;const p=worldPoint(x,y);if(!p)return;p.y=.6;preview=new T.Line(new T.BufferGeometry().setFromPoints(curve(point(pending),p).getPoints(30)),new T.LineDashedMaterial({color:0xbd8e57,dashSize:.2,gapSize:.1}));preview.computeLineDistances();scene.add(preview);render();}
 overlay.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||busy)return;if(b.hasAttribute('data-delete-node')){removeModule(b.dataset.deleteNode);return;}if(b.hasAttribute('data-close-node')){actionNode=null;labels();return;}if(b.hasAttribute('data-delete-wire')){deleteWire();return;}if(b.hasAttribute('data-close-wire')){selectedWire=null;labels();return;}if(b.hasAttribute('data-dismiss-result')){e.stopPropagation();fault=null;$('#run-report').hidden=true;labels();$('#run').focus({preventScroll:true});return;}if(b.dataset.assign){select(b.dataset.assign);say(I18n.t("把芯片标记拖到目标区域，或点击下方 CPU / GPU / ANE。"));return;}if(b.dataset.suppress)return;if(b.dataset.output)chooseOutput(b.dataset.output);if(b.dataset.input){const [to,i]=b.dataset.input.split(':');chooseInput(to,Number(i));}if(b.dataset.node&&!suppressNodeClick)select(b.dataset.node);});
 overlay.addEventListener('keydown',e=>{const b=e.target.closest('[data-node]');if(b&&e.key==='Enter'){e.preventDefault();focus(b.dataset.node);}});
 function dragCamera(e){drag={kind:'camera',x:e.clientX,y:e.clientY,yaw,pitch,moved:false};}
 overlay.addEventListener('pointerdown',e=>{if(transitioning)return;if(busy){dragCamera(e);return;}const b=e.target.closest('button');if(!b)return;if(b.dataset.assign){selected=b.dataset.assign;drag={kind:'device',id:b.dataset.assign,x:e.clientX,y:e.clientY,moved:false};return;}if(b.dataset.output)drag={kind:'wire',id:b.dataset.output,el:b,x:e.clientX,y:e.clientY,moved:false};if(b.dataset.node){if(focusId){drag={kind:'camera',x:e.clientX,y:e.clientY,yaw,pitch,moved:false};return;}const n=state.nodes.find(n=>n.id===b.dataset.node),p=worldPoint(e.clientX,e.clientY);selected=n.id;actionNode=null;drag={kind:'node',id:n.id,x:e.clientX,y:e.clientY,moved:false,old:clone(state),offset:p?[n.x-p.x,n.z-p.z]:[0,0]};inspect();}});
 host.addEventListener('pointerdown',e=>{if(transitioning)return;if(busy){dragCamera(e);return;}if(placing){const p=worldPoint(e.clientX,e.clientY);if(p)placeModule(p.x,p.z);return;}if(selectedWire||actionNode){selectedWire=actionNode=null;labels();}if(focusId){drag={kind:'camera',x:e.clientX,y:e.clientY,yaw,pitch,moved:false};return;}const p=worldPoint(e.clientX,e.clientY),hit=ray.intersectObjects(assembly.children,true)[0];if(hit){let object=hit.object;while(object&&!object.userData.node)object=object.parent;if(object?.userData.node){const n=state.nodes.find(n=>n.id===object.userData.node);selected=n.id;actionNode=null;drag={kind:'node',id:n.id,x:e.clientX,y:e.clientY,moved:false,old:clone(state),offset:p?[n.x-p.x,n.z-p.z]:[0,0]};inspect();return;}}drag={kind:'camera',x:e.clientX,y:e.clientY,yaw,pitch,moved:false};if(pending){pending=null;labels();clearPreview();say(I18n.t("已取消连线。"));}});
 $('#module-palette').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-add-module]');if(!b||b.dataset.addDisabled==='true'||busy||focusId)return;e.preventDefault();chooseModule(b.dataset.addModule);drag={kind:'palette',id:placing,x:e.clientX,y:e.clientY,moved:false};});
 $('#module-shelf').addEventListener('toggle',()=>{const shelf=$('#module-shelf');shelf.querySelector('summary').title=shelf.hasAttribute('open')?I18n.t('收起组件架'):I18n.t('展开组件架');render();});
 document.addEventListener('pointermove',e=>{if(placing)previewPlacement(e.clientX,e.clientY);if(!drag||(busy&&drag.kind!=='camera'))return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(!drag.moved)return;if(drag.kind==='wire'){pending=drag.id;previewAt(e.clientX,e.clientY);}if(drag.kind==='node'){const p=worldPoint(e.clientX,e.clientY),n=state.nodes.find(n=>n.id===drag.id);if(p){const b=M.bounds(stage());n.x=Math.max(b.left,Math.min(b.right,p.x+drag.offset[0]));n.z=Math.max(b.back,Math.min(b.front,p.z+drag.offset[1]));rebuild();}}if(drag.kind==='camera'){yaw=Math.max(-.65,Math.min(.65,drag.yaw-(e.clientX-drag.x)*.003));pitch=Math.max(.4,Math.min(1.35,drag.pitch+(e.clientY-drag.y)*.004));render();}});
 document.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;if(busy&&d.kind!=='camera')return;if(d.kind==='palette'){if(d.moved){suppressPaletteClick=true;setTimeout(()=>suppressPaletteClick=false,0);const rect=host.getBoundingClientRect();if(e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom){const p=worldPoint(e.clientX,e.clientY);if(p)placeModule(p.x,p.z);}placing=null;clearPlacement();labels();}return;}if(d.kind==='device'){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-device]');if(target)assignDevice(d.id,target.dataset.device);return;}if(d.kind==='wire'&&d.moved){d.el.dataset.suppress='true';setTimeout(()=>delete d.el.dataset.suppress,0);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-input]');clearPreview();if(target){const [to,i]=target.dataset.input.split(':');link(d.id,to,Number(i));}else{pending=d.id;labels();say(I18n.t("继续点一个方形输入口，完成这条线。"));}}if(d.kind==='node'&&d.moved){suppressNodeClick=true;setTimeout(()=>suppressNodeClick=false,0);history.push(d.old);save();refresh();labels();}if(d.kind==='node'&&!d.moved){nodeTap(d.id,e);labels();}});
 document.addEventListener('pointercancel',()=>{drag=null;pending=placing=null;clearPreview();clearPlacement();labels();});
 function zoomCamera(e){e.preventDefault();if(transitioning)return;zoom=Math.max(focusId ? .13 : .45,Math.min(focusId ? .7 : 1.35,zoom+e.deltaY*(focusId ? .00028 : .0008)));render();}
 host.addEventListener('wheel',zoomCamera,{passive:false});overlay.addEventListener('wheel',zoomCamera,{passive:false});
 document.addEventListener('keydown',e=>{if($('#settings').open||$('#welcome').open||$('#level-menu').open||$('#level-complete').open||$('#about').open||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName))return;if((e.key==='Delete'||e.key==='Backspace')&&selectedWire&&!busy){e.preventDefault();deleteWire();return;}if((e.key==='Delete'||e.key==='Backspace')&&actionNode&&!busy&&!focusId){e.preventDefault();removeModule(actionNode);return;}if(e.key==='Escape'){if(focusId){e.preventDefault();leaveFocus();}else if(!$('#run-report').hidden){e.preventDefault();closeReport(true);}else{pending=placing=selectedWire=actionNode=null;fault=null;clearPreview();clearPlacement();labels();}}});
 document.addEventListener('pointercancel',()=>{if(drag?.kind==='palette'){placing=null;clearPlacement();}drag=null;render();});
 $('#card-close').onclick=leaveFocus;$('#card-return').onclick=leaveFocus;
 $('#module-card').addEventListener('cancel',e=>{e.preventDefault();leaveFocus();});
 $('#module-card').addEventListener('click',e=>{if(e.target!==$('#module-card'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)leaveFocus();});
 $('#card-camera-reset').onclick=()=>$('#camera-reset').click();
 $('#camera-reset').onclick=()=>{if(focusId){const n=shelfFocus?{x:0,z:0}:state.nodes.find(n=>n.id===focusId);transition(new T.Vector3(n.x,.72,n.z),Math.max(4.1,3.5*host.clientWidth/host.clientHeight)/23,.32,.92);}else{yaw=.05;pitch=.8;zoom=stage().zoom;cameraTarget.set(0,0,0);render();}};
 $('#scene-expand').onclick=()=>{const expanded=document.body.classList.toggle('scene-expanded');$('#scene-expand').textContent=expanded?I18n.t("显示观察窗"):I18n.t("放大场景");$('#scene-expand').setAttribute('aria-pressed',String(expanded));render();};
 function beforeStage(){if(focusId)leaveFocus();cancelAnimationFrame(cameraFrame);transitioning=false;host.setAttribute('aria-busy','false');drag=lastTap=null;clearPreview();clearPlacement();clearPackets();elements=[];overlay.replaceChildren();}
 function setStage(){art.surroundings(samples(),stage());yaw=.05;pitch=.8;zoom=stage().zoom;cameraTarget.set(0,0,0);rebuild();}
 function relocalize(){art.surroundings(samples(),stage());rebuild();packets.forEach(p=>{p.el.querySelector('.packet-title').textContent=packetIdentity(p.el.dataset.from);if(p.normalizing&&p.progress!=null)p.updateRMS(normalizationFrame(p.progress,p.centering));if(p.tokenOperation&&p.progress!=null)p.updateToken(art.tokenFrame(p.progress,p.tokenOperation));if(p.motion==='process'&&p.progress!=null)art.processing(p.node.id,p.progress,p.input,p.output,p.color,{sequence:!!stage().sequence,detailed:p.detailed,paired:p.paired,other:p.other,words:p.words?.()});});render();}
 new ResizeObserver(render).observe(host);world={relocalize,labels,rebuild,animate,clearPackets,clearPreview,clearPlacement,previewAt,previewPlacement,focus,focusShelf,focused:()=>focusId,beforeStage,setStage,syncShelf:()=>syncPlacementGuide(host.clientWidth,host.clientHeight)};$('#loading').hidden=true;rebuild();refresh();
}catch(e){$('#loading').innerHTML=I18n.t("<strong>3D 台面没有加载成功，请刷新重试。</strong>");say(I18n.t("页面尚未开始运行。"),'error');console.error(e);}
