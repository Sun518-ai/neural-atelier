(function(scope){
 // Original generative score: soft chords and a sparse pentatonic melody.
 // No audio files, remote services or sound before a player gesture.
 scope.createAtelierMusic=function({enabled=true,volume=.35,onUnavailable=()=>{}}={}){
  let context,master,filter,compressor,timer=null,unlocked=false,beat=0,next=0,disposed=false;
  const notes=[72,null,76,79,null,76,74,null,72,67,null,72,76,null,74,null];
  const chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,60]];
  const hz=midi=>440*Math.pow(2,(midi-69)/12),target=()=>enabled?volume*.18:0;
  function gain(){if(!master)return;master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(target(),context.currentTime,.12);}
  function tone(midi,when,length,level,type='sine'){
   const osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.value=hz(midi);
   amp.gain.setValueAtTime(0,when);amp.gain.linearRampToValueAtTime(level,when+.08);amp.gain.exponentialRampToValueAtTime(.0001,when+length);
   osc.connect(amp);amp.connect(filter);osc.start(when);osc.stop(when+length+.05);osc.onended=()=>{osc.disconnect();amp.disconnect();};
  }
  function schedule(){
   if(!context||context.state!=='running'||!enabled)return;
   while(next<context.currentTime+.25){
    const index=beat%16,chord=chords[Math.floor(beat/16)%chords.length];
    if(index===0)chord.forEach((note,i)=>tone(note,next+i*.045,5,.16,'triangle'));
    if(notes[index]!=null)tone(notes[index],next,2.6,.34);
    beat++;next+=.72;
   }
  }
  async function resume(){
   if(disposed||!unlocked||!enabled||scope.document?.hidden)return;
   try{
    if(!context){
     const Audio=scope.AudioContext||scope.webkitAudioContext;if(!Audio){onUnavailable();return;}
     context=new Audio();master=context.createGain();master.gain.value=0;filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1700;
     compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=3;
     filter.connect(compressor);compressor.connect(master);master.connect(context.destination);
    }
    await context.resume();if(disposed||!enabled||scope.document?.hidden){pause();return;}next=Math.max(next,context.currentTime+.08);gain();schedule();
    if(!timer)timer=scope.setInterval(schedule,100);
   }catch{onUnavailable();}
  }
  function pause(){if(timer){scope.clearInterval(timer);timer=null;}if(context?.state==='running')context.suspend().catch(()=>{});}
  function visibility(){if(scope.document.hidden)pause();else return resume();}
  scope.document?.addEventListener('visibilitychange',visibility);
  const api={
   async unlock(){unlocked=true;await resume();},
   setEnabled(value){enabled=!!value;gain();if(enabled)return resume();else if(timer){scope.clearInterval(timer);timer=null;}},
   setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));gain();},
   dispose(){disposed=true;pause();scope.document?.removeEventListener('visibilitychange',visibility);context?.close().catch(()=>{});}
  };
  scope.addEventListener?.('pagehide',e=>e.persisted?pause():api.dispose());
  scope.addEventListener?.('pageshow',e=>{if(e.persisted)return resume();});
  return api;
 };
})(globalThis);
