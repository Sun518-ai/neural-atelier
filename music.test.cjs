const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function boot(){
 const contexts=[],timers=new Map(),events=new Map(),documentEvents=new Map();let starts=0,id=0;
 const param=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){this.events.push([v,t]);},setTargetAtTime(v,t){this.events.push([v,t]);},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){},gain:param(),frequency:param(),threshold:param(),ratio:param()});
 class Audio{constructor(){this.currentTime=0;this.state='suspended';this.destination={};this.gains=[];contexts.push(this);}createGain(){const n=node();this.gains.push(n);return n;}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}createOscillator(){return {...node(),start(){starts++;},stop(){}};}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}}
 const c={AudioContext:Audio,setInterval(fn){timers.set(++id,fn);return id;},clearInterval(id){timers.delete(id);},document:{hidden:false,addEventListener:(n,f)=>documentEvents.set(n,f),removeEventListener:n=>documentEvents.delete(n)},addEventListener:(n,f)=>events.set(n,f)};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/music.js','utf8'),c);
 return {c,contexts,timers,events,documentEvents,starts:()=>starts};
}
test('music is silent until a player gesture; mute and volume affect the same audio context',async()=>{
 const app=boot(),music=app.c.createAtelierMusic();assert.equal(app.contexts.length,0);assert.equal(app.starts(),0);assert.equal(app.timers.size,0);
 await music.unlock();assert.equal(app.contexts.length,1);assert.ok(app.starts()>0);assert.equal(app.timers.size,1);
 const ctx=app.contexts[0],master=ctx.gains[0];music.setVolume(.2);assert.ok(Math.abs(master.gain.events.at(-1)[0]-.036)<1e-8);
 music.setEnabled(false);assert.equal(master.gain.events.at(-1)[0],0);assert.equal(app.timers.size,0);await music.setEnabled(true);assert.equal(app.contexts.length,1);assert.equal(app.timers.size,1);
});
test('music pauses in a hidden tab and resumes without duplicating schedulers, including bfcache',async()=>{
 const app=boot(),music=app.c.createAtelierMusic();await music.unlock();const ctx=app.contexts[0];
 app.c.document.hidden=true;app.documentEvents.get('visibilitychange')();assert.equal(ctx.state,'suspended');assert.equal(app.timers.size,0);
 app.c.document.hidden=false;await app.documentEvents.get('visibilitychange')();assert.equal(ctx.state,'running');assert.equal(app.timers.size,1);
 app.events.get('pagehide')({persisted:true});assert.equal(ctx.state,'suspended');await app.events.get('pageshow')({persisted:true});assert.equal(ctx.state,'running');assert.equal(app.timers.size,1);
 music.dispose();assert.equal(ctx.state,'closed');assert.equal(app.timers.size,0);
});
test('a saved muted preference does not create an audio context on entry',async()=>{
 const app=boot(),music=app.c.createAtelierMusic({enabled:false});await music.unlock();assert.equal(app.contexts.length,0);await music.setEnabled(true);assert.equal(app.contexts.length,1);
});
