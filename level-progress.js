export function createProgress(M,storage){
 const legacy='neural-atelier-prologue-v1',metaKey='neural-atelier-chapters-v1';
 const read=key=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
 const write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
 const key=id=>id==='ffn'?legacy:`neural-atelier-level-${id}-v1`;
 const saved=read(metaKey),meta={current:M.levels[saved?.current]?saved.current:(read(legacy)?'ffn':'wire'),completed:(Array.isArray(saved?.completed)?saved.completed:[]).filter(id=>M.levels[id])};
 function mergeProjections(s){
  if(s?.version!==1||!Array.isArray(s.nodes))return s;
  const old=s.nodes.filter(n=>M.nodeKind(n)==='up'&&M.validNodeId(n.id,'up'));
  if(!old.length)return s;
  // Reserve every existing ID before assigning aliases, including spare or disconnected copies.
  const used=new Set(s.nodes.map(n=>n?.id)),renames=new Map();
  for(const n of old){let id='project',i=2;while(used.has(id))id='project-'+i++;used.add(id);renames.set(n.id,id);}
  const rename=id=>renames.get(id)||id;
  return {...s,nodes:s.nodes.map(n=>n?{...n,...(renames.has(n.id)?{id:rename(n.id),kind:'project'}:{}),links:Array.isArray(n.links)?n.links.map(rename):n.links}:n),sink:rename(s.sink),palette:Array.isArray(s.palette)?s.palette.map(k=>k==='up'?'project':k):s.palette};
 }
 function load(id){
  const s=mergeProjections(read(key(id))),l=M.levels[id],stock=M.inventory(l),allowed=Object.keys(stock);
  if(s?.version!==1||!Array.isArray(s.nodes))return M.initial(id);
  const valid=new Set([...l.sources,...s.nodes.map(n=>n?.id)]),counts={};
  if((l.buildable?s.nodes.length>M.moduleLimit(l):s.nodes.length!==l.nodes.length)||new Set(s.nodes.map(n=>n?.id)).size!==s.nodes.length||s.nodes.some(n=>{
   const kind=M.nodeKind(n);counts[kind]=(counts[kind]||0)+1;
   return !n||!allowed.includes(kind)||!M.validNodeId(n.id,kind)||(!l.buildable&&n.id!==kind)||counts[kind]>stock[kind]||!Number.isFinite(n.x)||!Number.isFinite(n.z)||!Array.isArray(n.links)||n.links.length!==M.definitions[kind].ins.length||n.links.some(k=>k!==null&&!valid.has(k));
  })||(s.sink!==null&&!valid.has(s.sink)))return M.initial(id);
  // Old saves keep their IDs and positions; only append newly available stock.
  s.palette=[...new Set((Array.isArray(s.palette)?s.palette:[]).filter(k=>allowed.includes(k)))];
  s.palette.push(...allowed.filter(k=>!s.palette.includes(k)));
  return {...s,levelId:id,...(l.engine?{settings:{...M.engineDefaults,...l.settings,...s.settings},nodes:s.nodes.map(n=>({...n,device:['cpu','gpu','ane'].includes(n.device)?n.device:'gpu'}))}:{})};
 }
 return {current:()=>meta.current,completed:id=>meta.completed.includes(id),load,
  save(state){write(key(state.levelId||'ffn'),state);},
  select(id){meta.current=id;write(metaKey,meta);},
  complete(id){if(!meta.completed.includes(id)){meta.completed.push(id);write(metaKey,meta);}}
 };
}
