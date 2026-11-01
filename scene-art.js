// Scene objects represent weights, features and token rows; math stays in model.js.
export function createSceneArt(T,scene,colors,{anisotropy=1}={}){
 const context=new T.Group(),floor=new T.Group();scene.add(floor,context);
 const units=new Map(),sharedSphere=new T.SphereGeometry(.115,18,14),rows=[],tokens=[];
 const rowColor=i=>[0x397aa2,0x8862aa,0x288778][i]??0x557e6b;
 const featureColor=i=>[0x397aa2,0x8862aa,0xb68036,0x288778][i%4];
 const rowZ=i=>-1.05+i*.96;
 sharedSphere.userData.shared=true;
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.5,metalness:.12,...extra});
 function box(parent,w,h,d,x,y,z,color,extra={}){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color,extra));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function slab(parent,w,d,h,x,y,z,color){const r=.12,s=new T.Shape(),a=-w/2,b=-d/2;s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+d-r);s.quadraticCurveTo(a+w,b+d,a+w-r,b+d);s.lineTo(a+r,b+d);s.quadraticCurveTo(a,b+d,a,b+d-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);const g=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,steps:1});g.rotateX(-Math.PI/2);const mesh=new T.Mesh(g,mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function tube(parent,points,color,r=.022,opacity=1){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,18,r,6,false),mat(color,{transparent:opacity<1,opacity}));parent.add(mesh);return mesh;}
 function ring(parent,r,x,y,z,color,thickness=.018){const mesh=new T.Mesh(new T.TorusGeometry(r,thickness,8,36),mat(color));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 function neuron(parent,x,y,z,color){const b=new T.Mesh(sharedSphere,mat(color,{emissive:color,emissiveIntensity:.08}));b.position.set(x,y,z);b.castShadow=true;parent.add(b);ring(parent,.155,x,y-.13,z,color,.012);return b;}
 function textTile(parent,text,w,d,x,y,z,{color='#314941',bg='#edf3e8',size=52}={}){
  // Match the physical tile's aspect ratio so letters are never stretched to fit.
  const canvas=document.createElement('canvas'),height=Math.min(384,2048*d/w);
  canvas.width=Math.round(height*w/d);canvas.height=Math.round(height);
  const ctx=canvas.getContext('2d');
  function draw(value,tone){
   ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.fillStyle=tone;ctx.textAlign='center';ctx.textBaseline='middle';
   let fontSize=canvas.height*size/128;
   const font=()=>`600 ${fontSize}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif`;
   ctx.font=font();
   fontSize*=Math.min(1,canvas.width*.88/Math.max(1,ctx.measureText(String(value)).width));
   ctx.font=font();ctx.fillText(String(value),canvas.width/2,canvas.height*.52);
  }
  draw(text,color);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=anisotropy;
  const mesh=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);
  let previousText=text,previousTone=color;
  return {mesh,ctx,texture,write(value,tone=color){if(value===previousText&&tone===previousTone)return;previousText=value;previousTone=tone;draw(value,tone);texture.needsUpdate=true;}};
 }
 function surroundings(samples,layout={}){
  for(const parent of [floor,context])for(const o of [...parent.children]){parent.remove(o);o.traverse(c=>{if(c.geometry&&!c.geometry.userData?.shared)c.geometry.dispose();c.material?.map?.dispose();c.material?.dispose?.();});}
  tokens.length=0;rows.length=0;floor.visible=context.visible=true;
  const sourceX=layout.sourceX??-8.55,sinkX=layout.sinkX??9,dim=layout.sinkDim||2,w=layout.boardWidth??(layout.id==='wire'?11.6:layout.id==='projection'?15:22.1),d=layout.boardDepth??(layout.id==='ffn'||!layout.id?11:7);
  slab(floor,w,d,.3,0,-.45,0,0xaabcb1);slab(floor,w-.2,d-.2,.09,0,-.12,0,0xd4dfd3);slab(floor,w-.45,d-.45,.035,0,-.01,0,0xeaf0e4);
  for(let x=Math.ceil(-w/2+1);x<w/2-.5;x++)tube(floor,[[x,.075,-d/2+.5],[x,.075,d/2-.5]],0xb7c8b9,.007,.55);
  for(let z=Math.ceil(-d/2+1);z<d/2-.5;z++)tube(floor,[[-w/2+.5,.075,z],[w/2-.5,.075,z]],0xb7c8b9,.007,.55);
  for(const z of [-d/2+.25,d/2-.25])box(floor,w-1.3,.05,.04,0,.08,z,0x92aa9b);
  for(const x of [-w/2+.45,w/2-.45])for(const z of [-d/2+.4,d/2-.4]){const screw=new T.Mesh(new T.CylinderGeometry(.065,.065,.03,12),mat(0x728a7c));screw.position.set(x,.1,z);floor.add(screw);}
  textTile(context,layout.boardText||'FFN / SWIGLU',3.2,.48,-w/2+3.3,.1,d/2-.8,{color:'#526d5e',bg:'#eaf0e4',size:58});
  textTile(context,layout.shape||'2 → 4 → 2',2.5,.45,w/2-3.25,.1,d/2-.8,{color:'#526d5e',bg:'#eaf0e4',size:62});
  const seq=!!layout.sequence,inputCols=seq&&layout.sourceDim===3?1:2,outCols=seq?(dim===3?1:dim/3):dim;
  const sourceW=seq?2.4:1.8,rackW=seq?3.2:dim===4?2.6:1.8;
  slab(context,sourceW,3.8,.42,sourceX,.07,0,0x7fa6af);slab(context,sourceW-.14,3.64,.08,sourceX,.5,0,0xe8f1ea);
  [I18n.t("我"),I18n.t("爱"),I18n.t("猫")].forEach((word,i)=>{
   const g=new T.Group();g.position.set(sourceX,.65,rowZ(i));g.userData.sourceRow=i;context.add(g);
   const panel=slab(g,sourceW-.25,.72,.12,0,0,0,0xbfd8d3);
   const stripe=box(g,sourceW-.38,.045,.055,0,.15,.31,rowColor(i),{emissive:rowColor(i),emissiveIntensity:.1});
   const label=textTile(g,seq?samples[0].word.split(' / ')[i]:word,.65,.3,seq?-.82:-.3,.17,-.02,{size:70});
   const cells=Array.from({length:inputCols},(_,j)=>{const x=seq?-.12+j*.48:.17+j*.34;box(g,seq?.4:.24,.12,.36,x,.18,0,0x73aaa6);return textTile(g,'·',seq?.4:.24,.34,x,.25,0,{color:'#fffdf4',bg:'#73aaa6',size:72});});tokens.push({g,cells,label,panel,stripe});
  });
  slab(context,rackW,3.8,.42,sinkX,.07,0,0x608f7c);slab(context,rackW-.15,3.64,.08,sinkX,.5,0,0xe8f1df);
  const labelX=seq?-1.15:dim===4?-.87:-.47;
  textTile(context,I18n.t("位置"),.48,.28,sinkX+labelX,.63,-1.65,{size:72,color:'#526d5e',bg:'#e8f1df'});
  samples.slice(0,3).forEach((_,i)=>{const g=new T.Group();g.position.set(sinkX,.66,rowZ(i));g.userData.sinkRow=i;context.add(g);
   const panel=slab(g,rackW-.45,.72,.08,0,0,0,0xc8d9c5);
   const stripe=box(g,rackW-.55,.035,.045,0,.105,.32,rowColor(i),{emissive:rowColor(i),emissiveIntensity:.1});
   textTile(g,String(i),.28,.32,labelX,.13,0,{size:70});
   const status=textTile(g,'·',.19,.22,rackW/2-.12,.14,0,{size:82,bg:'#e8f1df'});
   const cw=seq?Math.min(.7,1.95/outCols):.36;
   const cells=Array.from({length:outCols},(_,j)=>textTile(g,'·',cw,.43,seq?-.55+j*(cw+.03):(dim===4?-.42:-.02)+j*.4,.14,0,{color:'#558974',bg:'#e9f3e2',size:51}));rows.push({g,cells,status,panel,stripe});
  });
  context.userData={samples,layout};

 }
 function module(parent,n,d,weights,{register=true}={}){
  const g=new T.Group();g.position.set(n.x,0,n.z);g.userData.node=n.id;parent.add(g);const color=colors[n.kind||n.id];
  slab(g,2.05,2.4,.26,0,.07,0,color);slab(g,1.91,2.26,.08,0,.36,0,0xf4f5e9);
  const glow=box(g,1.6,.035,.055,0,.41,1.13,color,{emissive:color,emissiveIntensity:.18});
  const border=new T.Group();g.add(border);[[[-.96,.49,-1.12],[-.96,.49,-.78]],[[-.96,.49,-1.12],[-.62,.49,-1.12]],[[.96,.49,1.12],[.96,.49,.78]],[[.96,.49,1.12],[.62,.49,1.12]]].forEach(points=>tube(border,points,color,.018));
  let outputs=[],inputs=[],connections=[],weightCells=[],activationChannels=[];
  if(d.type==='linear'){
   const w=weights[n.kind||n.id],a=w.length,b=w[0].length,cw=1.5/b,ch=1.5/a;
   for(let i=0;i<a;i++)for(let j=0;j<b;j++){const x=(j-(b-1)/2)*cw,z=(i-(a-1)/2)*ch,c=w[i][j]<0?0xc89d70:w[i][j]===0?0xd7dfd4:color;const tile=box(g,cw*.84,.055+Math.abs(w[i][j])*.065,ch*.82,x,.49,z,c);const face=textTile(g,String(w[i][j]),cw*.8,ch*.76,x,.53+Math.abs(w[i][j])*.065,z,{bg:w[i][j]<0?'#d7b68b':w[i][j]===0?'#dfe5d9':'#d2dfcc',color:'#456052',size:63});weightCells.push({tile,face:face.mesh,i,j,weight:w[i][j]});}
   for(let i=0;i<a;i++)inputs.push(neuron(g,-.7,.98,(i-(a-1)/2)*ch,0x6c9eb1));
   for(let j=0;j<b;j++)outputs.push(neuron(g,.7,1.28,(j-(b-1)/2)*.4,color));
   for(let i=0;i<a;i++)for(let j=0;j<b;j++){
    const mesh=tube(g,[[-.7,.98,(i-(a-1)/2)*ch],[0,1.24,(i-(a-1)/2)*.13+(j-(b-1)/2)*.13],[.7,1.28,(j-(b-1)/2)*.4]],w[i][j]<0?0xc89968:color,w[i][j]===0?.007:.015,w[i][j]===0?.2:.8);
    const spark=new T.Mesh(sharedSphere,mat(color,{emissive:color,emissiveIntensity:1.8,transparent:true,depthWrite:false}));spark.visible=false;spark.userData={contribution:true,input:i,output:j,weight:w[i][j]};g.add(spark);
    connections.push({mesh,spark,i,j,weight:w[i][j]});
   }
  }else if(d.type==='activation'){
   const panel=box(g,1.5,.025,1.7,0,.57,0,0xe4cc9d,{transparent:true,opacity:.34,depthWrite:false});
   for(let i=0;i<4;i++){
    const z=(i-1.5)*.42,pts=Array.from({length:33},(_,j)=>{const x=-3+j*6/32;return [x*.22,.92+.22*x/(1+Math.exp(-x)),z];});
    inputs.push(neuron(g,...pts[0],0xb6ab83));outputs.push(neuron(g,...pts[32],color));
    const channel=tube(g,pts,0xb38649,.026),gate=ring(g,.19,0,.92,z,color,.025);
    const spark=new T.Mesh(sharedSphere,mat(color,{emissive:color,emissiveIntensity:1.6,transparent:true,depthWrite:false}));spark.visible=false;spark.userData={activationFeature:i};g.add(spark);
    activationChannels.push({channel,gate,spark,i});
   }
   textTile(g,'x · σ(x)',1.2,.22,0,.64,1.02,{size:67,color:'#8b6739',bg:'#f0e7c8'});
  }else if(d.type==='multiply'){
   for(let i=0;i<4;i++){const z=(i-1.5)*.43;neuron(g,-.65,.84,z,0xaa94bd);neuron(g,-.22,1.22,z,0x79b5a8);outputs.push(neuron(g,.68,1.05,z,color));tube(g,[[-.65,.84,z],[.12,.96,z],[.68,1.05,z]],0xa894bb,.018);tube(g,[[-.22,1.22,z],[.12,.96,z],[.68,1.05,z]],color,.018);ring(g,.13,.12,.96,z,color,.02);}
  }else if(['score','mask','softmax','mix','attention'].includes(d.type)){
   // Three rows correspond to positions; crossed threads depict information mixing.
   for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const c=d.type==='mask'&&j>i?0xc3b6a5:color,x=(j-1)*.47,z=(i-1)*.48;
    box(g,.39,.06,.39,x,.52,z,c);textTile(g,d.type==='mask'?(j>i?'−∞':'✓'):d.type==='softmax'?'p':String(i)+','+String(j),.35,.32,x,.56,z,{size:56,bg:'#e2e9da',color:'#4e6b5a'});
   }
   for(let i=0;i<3;i++){neuron(g,-.75,.96,(i-1)*.5,0x789abf);outputs.push(neuron(g,.75,1.05,(i-1)*.5,color));for(let j=0;j<=i;j++)tube(g,[[-.75,.96,(j-1)*.5],[0,1.3,0],[.75,1.05,(i-1)*.5]],color,.012,.55);}
  }else if(d.type==='rope'){
   for(let i=0;i<3;i++){const z=(i-1)*.6;ring(g,.24,0,.7,z,color);tube(g,[[0,.72,z],[Math.cos(i)*.25,.72,z+Math.sin(i)*.25]],color,.027);outputs.push(neuron(g,.7,1.02,z,color));}
  }else if(['embedding','vocabulary','pick','storage','cache','decode','norm','ffn','invert'].includes(d.type)){
   const words=d.type==='vocabulary'||d.type==='pick'?[I18n.t("我"),I18n.t("爱"),I18n.t("猫"),I18n.t("你"),I18n.t("恨"),I18n.t("狗")]:d.type==='cache'?['K','V','+1']:d.type==='norm'?['x','RMS','÷']:d.type==='storage'?['W','W','W']:d.type==='ffn'?['G','×','U']:['0','1','2'];
   words.forEach((t,i)=>{const x=words.length>3?(i%2-.5)*.7:0,z=words.length>3?(Math.floor(i/2)-1)*.55:(i-1)*.58;box(g,.55,.09,.44,x,.55,z,color);textTile(g,t,.5,.38,x,.605,z,{size:64,bg:'#e9edde',color:'#496253'});});
   for(let i=0;i<3;i++)outputs.push(neuron(g,.7,1.08,(i-1)*.5,color));
  }else{
   for(let i=0;i<2;i++){const z=(i-.5)*.65;neuron(g,-.6,.78,z,0x6b9fb1);neuron(g,-.3,1.25,z,0xb7a17d);outputs.push(neuron(g,.68,1.08,z,color));tube(g,[[-.6,.78,z],[.02,.96,z],[.68,1.08,z]],0x6b9fb1,.027);tube(g,[[-.3,1.25,z],[.02,.96,z],[.68,1.08,z]],color,.027);ring(g,.18,.06,.94,z,color);}
  }
  d.ins.forEach((dim,i)=>{const z=d.ins.length===2?(i?.55:-.55):0;box(g,.21,.17,.27,-1.08,.58,z,0x6e887c);for(let j=0;j<Math.min(dim,4);j++)box(g,.12,.02,.035,-1.08,.68,z+(j-(Math.min(dim,4)-1)/2)*.055,0xc6d7c3);});
  const sock=new T.Mesh(new T.CylinderGeometry(.15,.15,.18,20),mat(color));sock.rotation.z=Math.PI/2;sock.position.set(1.05,.68,0);g.add(sock);
  if(register)units.set(n.id,{g,glow,outputs,inputs,connections,weightCells,activationChannels,links:n.links,color});return g;
 }
 function sync(values,depths,depth,selected,activeSample,results,busy,layout={},output=null){
  if(!busy)clearProcessing();
  for(const [id,u]of units){const completed=values?.[id]&&(depths[id]||0)<=depth,active=busy&&depths[id]===depth,sel=id===selected;
   u.glow.material.emissiveIntensity=active?1.6:sel?.9:completed?.45:.12;
   const input=completed&&!layout.sequence?values[u.links[0]]:null;
   u.inputs.forEach((o,i)=>{const v=input?.[i];o.scale.setScalar(v==null?1:Math.abs(v)<1e-9?.55:1+Math.min(2,Math.abs(v))*.3);o.material.emissiveIntensity=active&&Number.isFinite(v)&&Math.abs(v)>1e-9?1.1:.08;});
   u.connections.forEach(({mesh,i,weight})=>{const lit=active&&input&&Math.abs(input[i]*weight)>1e-9;mesh.material.opacity=input?(lit?.95:.08):(weight===0?.2:.8);mesh.material.emissive.set(lit?u.color:0x000000);mesh.material.emissiveIntensity=lit?.6:0;});
   u.outputs.forEach((o,i)=>{const v=completed?values[id][i]:null;o.scale.setScalar(!Number.isFinite(v)?1:1+Math.min(2,Math.abs(v))*.18);o.material.color.set(Number.isFinite(v)&&v<0?0xc79868:u.color);o.material.emissiveIntensity=active?1.1:completed?.35:.08;});
  }
  const {samples}=context.userData,seq=!!layout.sequence,input=seq?samples[activeSample].v:null;
  const words=seq?samples[activeSample].word.split(' / '):samples.slice(0,3).map(s=>s.word);
  tokens.forEach((t,i)=>{t.label.write(words[i]);t.g.userData.active=busy&&(seq||i===activeSample);t.cells.forEach((c,j)=>c.write(String(seq?input[i*t.cells.length+j]:samples[i].v[j])));});
  pulseSource();
  rows.forEach((r,i)=>{
   const active=busy&&(seq||i===activeSample);r.g.userData.active=active;r.stripe.material.emissiveIntensity=active?1.3:.1;
   const result=seq?results[activeSample]:results[i],offset=seq?i*r.cells.length:0;
   const actual=result?.actual;
   const rowPass=result&&(seq?actual&&r.cells.every((_,j)=>Number.isFinite(actual[offset+j])&&Math.abs(actual[offset+j]-result.expected[offset+j])<(layout.engine?(layout.limits?.error||.06):1e-9)):result.pass);
   const tone=!result?'#558974':rowPass?'#397c61':'#a14d3d';
   r.panel.material.color.set(!result?0xc8d9c5:rowPass?0xbcd8c4:0xe6c1ac);
   r.status.write(!result?'·':rowPass?'✓':'×',tone);
   r.cells.forEach((cell,j)=>{const value=actual?.[offset+j];cell.write(layout.tokenOutput&&Number.isInteger(value)?window.NeuralPrologue.math.vocab[value]??'?':Number.isFinite(value)?Number(value.toFixed(2)).toString():result?'—':'·',tone);});
  });

 }
 const ramp=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 function processing(id,progress,input,output,color,{sequence=false,detailed=false}={}){
  const u=units.get(id);if(!u)return;
  const active=progress>=0&&progress<1,p=Math.max(0,Math.min(1,progress));u.g.userData.processing=active;
  const entering=ramp(p,0,.23),gathering=ramp(p,.6,.9),pulse=active?Math.sin(Math.PI*p):0;
  u.glow.material.emissiveIntensity=.12+1.5*pulse;
  u.inputs.forEach((o,i)=>{const v=sequence?1:input[i],size=Math.abs(v)<1e-9?.55:1+Math.min(2,Math.abs(v))*.3;o.scale.setScalar(1+(size-1)*entering);if(u.connections.length){o.material.color.set(detailed&&active?featureColor(i):0x6c9eb1);o.material.emissive.set(detailed?featureColor(i):0x6c9eb1);}o.material.emissiveIntensity=.08+(active&&Math.abs(v)>1e-9?entering*(1-ramp(p,.65,1)):0);});
  for(const {mesh,spark,i,j,weight} of u.connections){
   const contribution=sequence?weight:input[i]*weight,lit=Number.isFinite(contribution)&&Math.abs(contribution)>1e-9;
   mesh.material.opacity=active?(lit?.35+.6*pulse:.08):(weight===0?.2:.8);
   mesh.material.emissive.set(lit?color:0);mesh.material.emissiveIntensity=active&&lit?pulse*.7:0;
   const start=detailed?(j===0?.4:.69):.2,end=detailed?(j===0?.67:.8):.76;
   spark.visible=active&&lit&&p>=start&&p<=end;
   spark.userData.value=contribution;
   if(spark.visible){const tone=detailed?featureColor(i):contribution<0?0xd6a578:color;spark.material.color.set(tone);spark.material.emissive.set(tone);spark.material.opacity=ramp(p,start,start+.025)*(1-ramp(p,end-.025,end));spark.scale.setScalar(.48+Math.min(2,Math.abs(contribution))*.15);spark.position.copy(mesh.geometry.parameters.path.getPoint(ramp(p,start,end)));}
  }
  for(const {tile,face,i,j,weight} of u.weightCells){const contribution=sequence?weight:input[i]*weight,lit=active&&(detailed||Math.abs(contribution)>1e-9),highlight=detailed?ramp(p,.16,.38)*(1-ramp(p,j===0?.65:.76,j===0?.7:.84)):pulse,tone=detailed?featureColor(i):color;tile.material.emissive.set(lit?tone:0);tile.material.emissiveIntensity=lit?highlight*(detailed&&j===0?1.4:.5):0;face.material.color.set(0xffffff);if(lit)face.material.color.lerp(new T.Color(tone),highlight*.32);}
  for(const {channel,gate,spark,i} of u.activationChannels){
   const from=input[i],to=output[i],sigmoid=1/(1+Math.exp(-from)),travel=ramp(p,.16,.84),transform=ramp(p,.35,.7),value=from+(to-from)*transform,tone=from<0?0xd6a578:color;
   gate.scale.setScalar(1-(1-(.22+.78*sigmoid))*pulse);gate.material.emissive.set(tone);gate.material.emissiveIntensity=active?pulse*.85:0;
   channel.material.emissive.set(tone);channel.material.emissiveIntensity=active?pulse*.9:0;
   spark.visible=active&&p>=.16&&p<.86&&Math.abs(from)>1e-9;
   Object.assign(spark.userData,{inputValue:from,outputValue:to,value,sigmoid,phase:transform});
   if(spark.visible){spark.position.copy(channel.geometry.parameters.path.getPoint(travel));spark.scale.setScalar(.3+Math.min(3,Math.abs(value))*.5);spark.material.color.set(tone);spark.material.emissive.set(tone);spark.material.opacity=ramp(p,.16,.23)*(1-ramp(p,.78,.86));}
  }
  u.outputs.forEach((o,i)=>{const v=sequence?1:output[i],size=Number.isFinite(v)?Math.abs(v)<1e-9?.55:1+Math.min(2,Math.abs(v))*.18:1,gather=detailed?ramp(p,i===0?.59:.76,i===0?.68:.9):gathering;o.scale.setScalar(1+(size-1)*gather);o.material.color.set(v<0?0xc79868:u.color);o.material.emissiveIntensity=.08+(active?1.3*gather*(1-ramp(p,.9,1)):progress>=1?.35:0);});
 }
 function clearProcessing(){for(const u of units.values()){u.g.userData.processing=false;if(u.connections.length)u.inputs.forEach(o=>{o.material.color.set(0x6c9eb1);o.material.emissive.set(0x6c9eb1);o.material.emissiveIntensity=.08;});u.connections.forEach(c=>c.spark.visible=false);u.activationChannels.forEach(({spark,gate,channel})=>{spark.visible=false;gate.scale.setScalar(1);gate.material.emissiveIntensity=0;channel.material.emissiveIntensity=0;});u.weightCells.forEach(({tile,face})=>{tile.material.emissiveIntensity=0;face.material.color.set(0xffffff);});}}
 // A single colour pulse identifies the departing row without moving its tray.
 function pulseSource(progress=1){
  const pulse=Math.pow(1-Math.min(1,Math.max(0,progress)/.65),2);
  tokens.forEach((t,i)=>{const active=t.g.userData.active;t.panel.material.color.set(active?0xe6eacb:0xbfd8d3);if(active)t.panel.material.color.lerp(new T.Color(rowColor(i)),pulse*.28);t.stripe.material.emissiveIntensity=active?.65+pulse: .1;});
 }
 function packet(values,color,{sequence=false}={}){
  const g=new T.Group(),cols=sequence?values.length/3:values.length,count=sequence?3:1;g.userData.packet=true;
  // Features run left to right, just like the input/output racks. A sequence
  // adds token rows in depth; moving the packet never transposes its tensor.
  const tray=box(g,cols*.24+.1,.045,count*.3+.06,0,0,0,0xc7d9ce);tray.userData.packetTray=true;
  values.forEach((v,i)=>{const finite=Number.isFinite(v),zero=finite&&Math.abs(v)<1e-9,c=!finite||v<0?0xd6a578:zero?0xc8d4d0:color,h=zero?.035:.08+Math.min(finite?Math.abs(v):2,2)*.24;
   const x=(i%cols-(cols-1)/2)*.24,z=(Math.floor(i/cols)-(count-1)/2)*.3;
   const pad=box(g,.2,.025,.23,x,.035,z,0xe6ece2);pad.userData.featurePad=i;const bar=box(g,.17,h,.17,x,.06+h/2,z,c,{emissive:c,emissiveIntensity:zero?.02:.4});bar.userData={feature:i,value:v};
  });return g;
 }
 function prepareProjectionPacket(g){
  // The same blocks leave the horizontal tray. Their new positions illustrate
  // routing into the weight rows, not a transpose of the input tensor.
  g.userData.featureRoutes=g.children.filter(o=>o.userData.feature!=null).map(bar=>{
   const i=bar.userData.feature,pad=g.children.find(o=>o.userData.featurePad===i),v=bar.userData.value;
   const label=textTile(g,String(Number(v.toFixed(2))),.31,.25,bar.position.x,bar.position.y+bar.geometry.parameters.height/2+.02,bar.position.z,{size:76,color:'#fffdf4',bg:'#'+featureColor(i).toString(16).padStart(6,'0')}).mesh;
   label.visible=false;label.material.transparent=true;label.material.depthWrite=false;label.userData.featureValue=i;
   return {bar,pad,label,home:bar.position.clone(),padHome:pad.position.clone(),labelHome:label.position.clone(),tone:bar.material.color.clone()};
  });
 }
 function routeProjectionPacket(id,mesh,p,origin,anchor){
  const u=units.get(id),routes=mesh.userData.featureRoutes;if(!u||!routes)return;
  const fan=ramp(p,.12,.38),alpha=1-ramp(p,.72,.86);mesh.userData.routing=fan>0;
  mesh.children.find(o=>o.userData.packetTray).material.opacity=(1-ramp(p,.12,.3))*alpha;
  for(const {bar,pad,label,home,padHome,labelHome,tone} of routes){
   const i=bar.userData.feature,target=new T.Vector3(u.g.position.x-1.12,.87,u.g.position.z+u.inputs[i].position.z);
   for(const [object,start] of [[bar,home],[pad,padHome],[label,labelHome]]){
    object.position.copy(start);
    if(p>=.12)object.position.copy(anchor).add(start).lerp(target.clone().add(new T.Vector3(0,start.y,0)),fan).sub(origin);
   }
   bar.material.color.copy(tone).lerp(new T.Color(featureColor(i)),fan);bar.material.emissive.copy(bar.material.color);
   bar.material.opacity=pad.material.opacity=alpha;
   label.visible=p>=.12&&p<.86;label.material.opacity=ramp(p,.12,.3)*alpha;
   Object.assign(bar.userData,{mappedInput:i,mappingProgress:fan});
  }
 }
 function resetUnits(){units.clear();}
 return {surroundings,module,sync,pulseSource,processing,clearProcessing,packet,prepareProjectionPacket,routeProjectionPacket,featureColor,rowColor,rowZ,resetUnits,focus(active){context.visible=!active;floor.visible=!active;}};
}
