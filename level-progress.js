export function createProgress(M,storage){
 const legacy='neural-atelier-prologue-v1',metaKey='neural-atelier-chapters-v1';
 const read=key=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
 const write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
 const key=id=>id==='ffn'?legacy:`neural-atelier-level-${id}-v1`;
 const saved=read(metaKey),meta={current:M.levels[saved?.current]?saved.current:(read(legacy)?'ffn':'wire'),completed:(Array.isArray(saved?.completed)?saved.completed:[]).filter(id=>M.levels[id])};
 function load(id){
  const s=read(key(id)),l=M.levels[id],valid=new Set([...l.sources,...(Array.isArray(s?.nodes)?s.nodes.map(n=>n.id):[])]);
  if(s?.version!==1||!Array.isArray(s.nodes)||(l.buildable?s.nodes.length>l.nodes.length:s.nodes.length!==l.nodes.length)||new Set(s.nodes.map(n=>n.id)).size!==s.nodes.length||s.nodes.some(n=>!l.nodes.includes(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.z)||!Array.isArray(n.links)||n.links.length!==M.definitions[n.id].ins.length||n.links.some(k=>k!==null&&!valid.has(k)))||(s.sink!==null&&!valid.has(s.sink)))return M.initial(id);
  s.palette=Array.isArray(s.palette)&&s.palette.length===l.nodes.length&&new Set(s.palette).size===l.nodes.length&&s.palette.every(k=>l.nodes.includes(k))?s.palette:[...l.nodes].sort();
  return {...s,levelId:id,...(l.engine?{settings:{...M.engineDefaults,...l.settings,...s.settings},nodes:s.nodes.map(n=>({...n,device:['cpu','gpu','ane'].includes(n.device)?n.device:'gpu'}))}:{})};
 }
 return {current:()=>meta.current,completed:id=>meta.completed.includes(id),load,
  save(state){write(key(state.levelId||'ffn'),state);},
  select(id){meta.current=id;write(metaKey,meta);},
  complete(id){if(!meta.completed.includes(id)){meta.completed.push(id);write(metaKey,meta);}}
 };
}
