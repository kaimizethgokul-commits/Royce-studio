let ctx, master, dryBus, delayBus, delayNode, delayFeedback, delayWet, reverbBus, reverbNode, reverbWet, recordDestination;
let drumGain, loopGain, vocalGain;
let playing=false, metronome=false, currentStep=0, timer=null, nextNoteTime=0, sessionStartTime=0;
let micStream=null, recorder=null, recordedChunks=[], lastTakeBlob=null, vocalBuffer=null;
let loopBuffer=null, loopFileName='', activeLoopSources=[], activeVocalSources=[];
const muted={drums:false,loop:false,vocal:false};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const bpmEl=$('#bpm'), statusEl=$('#transportStatus');
const pattern={kick:Array(16).fill(false),snare:Array(16).fill(false),hat:Array(16).fill(false),clap:Array(16).fill(false)};
pattern.kick[0]=pattern.kick[8]=true; pattern.snare[4]=pattern.snare[12]=true; [0,2,4,6,8,10,12,14].forEach(i=>pattern.hat[i]=true);

function makeImpulse(c,seconds=1.7,decay=2.2){const len=Math.floor(c.sampleRate*seconds),b=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay)}return b}
function ensureAudio(){
  if(!ctx){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain(); master.gain.value=+$('#masterVol').value;
    dryBus=ctx.createGain(); delayBus=ctx.createGain(); reverbBus=ctx.createGain();
    delayNode=ctx.createDelay(1);delayNode.delayTime.value=.24;delayFeedback=ctx.createGain();delayFeedback.gain.value=.28;delayWet=ctx.createGain();delayWet.gain.value=+$('#delayMix').value;
    reverbNode=ctx.createConvolver();reverbNode.buffer=makeImpulse(ctx);reverbWet=ctx.createGain();reverbWet.gain.value=+$('#reverbMix').value;
    drumGain=ctx.createGain();loopGain=ctx.createGain();vocalGain=ctx.createGain();
    drumGain.gain.value=+$('#drumsVol').value;loopGain.gain.value=+$('#loopVol').value;vocalGain.gain.value=+$('#vocalVol').value;
    drumGain.connect(dryBus);loopGain.connect(dryBus);vocalGain.connect(dryBus);
    drumGain.connect(delayBus);loopGain.connect(delayBus);vocalGain.connect(delayBus);
    drumGain.connect(reverbBus);loopGain.connect(reverbBus);vocalGain.connect(reverbBus);
    delayBus.connect(delayNode);delayNode.connect(delayWet);delayWet.connect(master);delayNode.connect(delayFeedback);delayFeedback.connect(delayNode);
    reverbBus.connect(reverbNode);reverbNode.connect(reverbWet);reverbWet.connect(master);dryBus.connect(master);
    recordDestination=ctx.createMediaStreamDestination();master.connect(ctx.destination);master.connect(recordDestination);
  }
  if(ctx.state==='suspended')ctx.resume();$('#audioUnlock').textContent='Audio Ready';$('#audioUnlock').classList.add('on');return ctx;
}
function noiseBuffer(seconds=.2,c=ensureAudio()){const len=Math.max(1,Math.floor(c.sampleRate*seconds)),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return b}
function playKick(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(150,time);o.frequency.exponentialRampToValueAtTime(48,time+.13);g.gain.setValueAtTime(1,time);g.gain.exponentialRampToValueAtTime(.001,time+.22);o.connect(g).connect(out);o.start(time);o.stop(time+.25)}
function playSnare(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=noiseBuffer(.18,c);f.type='highpass';f.frequency.value=900;g.gain.setValueAtTime(.65,time);g.gain.exponentialRampToValueAtTime(.001,time+.15);src.connect(f).connect(g).connect(out);src.start(time);const o=c.createOscillator(),og=c.createGain();o.type='triangle';o.frequency.value=185;og.gain.setValueAtTime(.22,time);og.gain.exponentialRampToValueAtTime(.001,time+.09);o.connect(og).connect(out);o.start(time);o.stop(time+.1)}
function playHat(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=noiseBuffer(.06,c);f.type='highpass';f.frequency.value=6500;g.gain.setValueAtTime(.24,time);g.gain.exponentialRampToValueAtTime(.001,time+.05);src.connect(f).connect(g).connect(out);src.start(time)}
function playClap(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){[0,.018,.036].forEach(off=>{const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=noiseBuffer(.09,c);f.type='bandpass';f.frequency.value=1500;f.Q.value=.7;g.gain.setValueAtTime(.35,time+off);g.gain.exponentialRampToValueAtTime(.001,time+off+.08);src.connect(f).connect(g).connect(out);src.start(time+off)})}
const drumFns={kick:playKick,snare:playSnare,hat:playHat,clap:playClap};
function synth(freq,type='sawtooth',duration=.55,gain=.14){const c=ensureAudio(),now=c.currentTime,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type=type;o.frequency.value=freq;f.type='lowpass';f.frequency.value=type==='sine'?600:1800;f.Q.value=1.2;g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(f).connect(g).connect(master);o.start(now);o.stop(now+duration+.03)}
function buildSequencer(){const s=$('#sequencer');s.innerHTML='';Object.keys(pattern).forEach(name=>{const l=document.createElement('div');l.className='seq-label';l.textContent=name.toUpperCase();s.append(l);pattern[name].forEach((on,i)=>{const b=document.createElement('button');b.className='step'+(on?' active':'');b.dataset.drum=name;b.dataset.step=i;b.onclick=()=>{pattern[name][i]=!pattern[name][i];b.classList.toggle('active')};s.append(b)})})}
const noteMap=[['C4',261.63],['D4',293.66],['E4',329.63],['F4',349.23],['G4',392],['A4',440],['B4',493.88],['C5',523.25],['D5',587.33],['E5',659.25]];
function buildPiano(){noteMap.forEach(([n,f])=>{const b=document.createElement('button');b.className='key';b.textContent=n;b.onpointerdown=()=>{b.classList.add('down');synth(f)};b.onpointerup=()=>b.classList.remove('down');b.onpointerleave=()=>b.classList.remove('down');$('#piano').append(b)})}
const bassMap=[['C2',65.41],['D2',73.42],['E2',82.41],['F2',87.31],['G2',98],['A2',110],['B2',123.47],['C3',130.81],['D3',146.83]];
function buildBass(){bassMap.forEach(([n,f])=>{const b=document.createElement('button');b.className='bass-key';b.textContent=n;b.onpointerdown=()=>synth(f,'sine',.7,.25);$('#bassKeys').append(b)})}
function currentBpm(){return Math.max(40,Math.min(220,+bpmEl.value||100))}function setBpm(v){const bpm=Math.max(40,Math.min(220,Math.round(v||100)));bpmEl.value=bpm;statusEl.textContent=`Tempo ${bpm} BPM`;return bpm}function stepDuration(){return 60/currentBpm()/4}function sessionSeconds(){return 16*4*stepDuration()}
function scheduler(){while(nextNoteTime<ctx.currentTime+.12){scheduleStep(currentStep,nextNoteTime);nextNoteTime+=stepDuration();currentStep=(currentStep+1)%16}timer=setTimeout(scheduler,25)}
function scheduleStep(step,time){if(!muted.drums)Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](time)});if(metronome&&step%4===0)click(time,step===0);setTimeout(()=>highlightStep(step),Math.max(0,(time-ctx.currentTime)*1000))}
function click(time,strong=false){const c=ensureAudio(),o=c.createOscillator(),g=c.createGain();o.frequency.value=strong?1200:900;g.gain.setValueAtTime(.08,time);g.gain.exponentialRampToValueAtTime(.001,time+.035);o.connect(g).connect(master);o.start(time);o.stop(time+.04)}function highlightStep(step){$$('.step').forEach(x=>x.classList.toggle('playhead',+x.dataset.step===step))}
function launchArrangement(time){stopArrangementSources();const dur=sessionSeconds();if(loopBuffer&&!muted.loop){const src=ctx.createBufferSource();src.buffer=loopBuffer;src.loop=true;src.loopEnd=Math.max(.05,Math.min(loopBuffer.duration,dur));src.connect(loopGain);src.start(time);src.stop(time+dur);activeLoopSources.push(src)}if(vocalBuffer&&!muted.vocal){const src=ctx.createBufferSource();src.buffer=vocalBuffer;src.connect(vocalGain);src.start(time);src.stop(Math.min(time+dur,time+vocalBuffer.duration));activeVocalSources.push(src)}}
function stopArrangementSources(){[...activeLoopSources,...activeVocalSources].forEach(s=>{try{s.stop()}catch{}});activeLoopSources=[];activeVocalSources=[]}
function start(){ensureAudio();if(playing)return;playing=true;currentStep=0;sessionStartTime=ctx.currentTime+.05;nextNoteTime=sessionStartTime;launchArrangement(sessionStartTime);scheduler();statusEl.textContent='Playing';$('#playBtn').textContent='❚❚'}
function stop(){playing=false;if(timer)clearTimeout(timer);timer=null;stopArrangementSources();currentStep=0;$$('.step').forEach(x=>x.classList.remove('playhead'));statusEl.textContent='Stopped';$('#playBtn').textContent='▶'}
async function armMic(){try{ensureAudio();if(!micStream)micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});$('#micStatus').textContent='Microphone armed. Press the red record button.';$('#armMic').textContent='Mic Armed'}catch(e){$('#micStatus').textContent='Microphone permission was not granted.';console.error(e)}}
function bestMime(){const c=['audio/mp4','audio/webm;codecs=opus','audio/webm'];return c.find(x=>window.MediaRecorder&&MediaRecorder.isTypeSupported(x))||''}
async function decodeBlob(blob){ensureAudio();return await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0))}
async function startRecording(){if(!micStream)await armMic();if(!micStream||recorder?.state==='recording')return;recordedChunks=[];try{const mime=bestMime();recorder=new MediaRecorder(micStream,mime?{mimeType:mime}:undefined);recorder.ondataavailable=e=>{if(e.data.size)recordedChunks.push(e.data)};recorder.onstop=async()=>{lastTakeBlob=new Blob(recordedChunks,{type:recorder.mimeType||'audio/webm'});const url=URL.createObjectURL(lastTakeBlob);$('#takePlayer').src=url;$('#playTake').disabled=false;$('#exportTake').disabled=false;$('#micStatus').textContent='Take captured.';$('#vocalClip').textContent='Last vocal take';try{vocalBuffer=await decodeBlob(lastTakeBlob)}catch(e){console.warn('Could not decode vocal take',e)}};recorder.start();$('#recordBtn').classList.add('active');statusEl.textContent='Recording';if(!playing)start()}catch(e){$('#micStatus').textContent='Recording is not supported in this browser session.';console.error(e)}}
function stopRecording(){if(recorder?.state==='recording')recorder.stop();$('#recordBtn').classList.remove('active');statusEl.textContent=playing?'Playing':'Ready'}
function projectObject(){return{version:3,name:$('#projectName').value||'Untitled Royce Session',bpm:+bpmEl.value||100,pattern,mixer:{drums:+$('#drumsVol').value,loop:+$('#loopVol').value,vocal:+$('#vocalVol').value,master:+$('#masterVol').value,delay:+$('#delayMix').value,reverb:+$('#reverbMix').value,muted},loopFileName,updatedAt:new Date().toISOString()}}
function saveProject(){localStorage.setItem('royceStudioProject',JSON.stringify(projectObject()));statusEl.textContent='Project saved locally'}
function setControl(id,val){const e=$(id);if(e&&val!=null)e.value=val}
function loadProjectObject(p){if(!p||!p.pattern)return;$('#projectName').value=p.name||'Untitled Royce Session';bpmEl.value=p.bpm||100;Object.keys(pattern).forEach(k=>pattern[k]=(p.pattern[k]||Array(16).fill(false)).slice(0,16));const m=p.mixer||{};setControl('#drumsVol',m.drums);setControl('#loopVol',m.loop);setControl('#vocalVol',m.vocal);setControl('#masterVol',m.master);setControl('#delayMix',m.delay);setControl('#reverbMix',m.reverb);Object.assign(muted,m.muted||{});buildSequencer();updateMixer();statusEl.textContent='Project loaded'}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200)}
function updateMixer(){if(ctx){drumGain.gain.value=muted.drums?0:+$('#drumsVol').value;loopGain.gain.value=muted.loop?0:+$('#loopVol').value;vocalGain.gain.value=muted.vocal?0:+$('#vocalVol').value;master.gain.value=+$('#masterVol').value;delayWet.gain.value=+$('#delayMix').value;reverbWet.gain.value=+$('#reverbMix').value}$('#delayValue').textContent=Math.round(+$('#delayMix').value/0.55*100)+'%';$('#reverbValue').textContent=Math.round(+$('#reverbMix').value/0.65*100)+'%';$$('.mute-btn').forEach(b=>b.classList.toggle('on',muted[b.dataset.track]))}
async function importAudio(file){ensureAudio();try{loopBuffer=await ctx.decodeAudioData((await file.arrayBuffer()).slice(0));loopFileName=file.name;$('#loopClip').textContent=file.name;$('#clearLoop').disabled=false;$('#detectBpm').disabled=false;$('#bpmDetectStatus').textContent='Audio imported. Tap Detect BPM to analyze it.';statusEl.textContent='Audio imported'}catch(e){statusEl.textContent='Could not decode audio file';console.error(e)}}
function clearLoop(){loopBuffer=null;loopFileName='';$('#loopClip').textContent='No audio imported';$('#clearLoop').disabled=true;stopArrangementSources()}
function audioBufferToWav(buffer){const channels=buffer.numberOfChannels,samples=buffer.length,bytesPerSample=2,blockAlign=channels*bytesPerSample,array=new ArrayBuffer(44+samples*blockAlign),view=new DataView(array);let pos=0;const writeStr=s=>{for(let i=0;i<s.length;i++)view.setUint8(pos++,s.charCodeAt(i))};const u16=v=>{view.setUint16(pos,v,true);pos+=2};const u32=v=>{view.setUint32(pos,v,true);pos+=4};writeStr('RIFF');u32(36+samples*blockAlign);writeStr('WAVE');writeStr('fmt ');u32(16);u16(1);u16(channels);u32(buffer.sampleRate);u32(buffer.sampleRate*blockAlign);u16(blockAlign);u16(16);writeStr('data');u32(samples*blockAlign);for(let i=0;i<samples;i++)for(let ch=0;ch<channels;ch++){let s=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));view.setInt16(pos,s<0?s*0x8000:s*0x7fff,true);pos+=2}return new Blob([array],{type:'audio/wav'})}
async function exportWav(){statusEl.textContent='Rendering WAV…';const sr=44100,dur=sessionSeconds(),off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr),out=off.createGain();out.gain.value=+$('#masterVol').value;out.connect(off.destination);const dg=off.createGain();dg.gain.value=muted.drums?0:+$('#drumsVol').value;dg.connect(out);const lg=off.createGain();lg.gain.value=muted.loop?0:+$('#loopVol').value;lg.connect(out);for(let bar=0;bar<4;bar++)for(let step=0;step<16;step++){const t=(bar*16+step)*stepDuration();Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](t,dg,off)})}if(loopBuffer&&!muted.loop){const src=off.createBufferSource();src.buffer=loopBuffer;src.loop=true;src.connect(lg);src.start(0);src.stop(dur)}const rendered=await off.startRendering(),p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(audioBufferToWav(rendered),`${safe}.wav`);statusEl.textContent='WAV exported'}


let tapTimes=[];
function tapTempo(){
  const now=performance.now();
  tapTimes=tapTimes.filter(t=>now-t<3000);tapTimes.push(now);
  if(tapTimes.length<2){statusEl.textContent='Tap again…';return}
  const intervals=[];for(let i=1;i<tapTimes.length;i++)intervals.push(tapTimes[i]-tapTimes[i-1]);
  const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  let bpm=60000/avg;while(bpm<40)bpm*=2;while(bpm>220)bpm/=2;setBpm(bpm);
}
function monoSamples(buffer){const n=buffer.length,c=buffer.numberOfChannels,out=new Float32Array(n);for(let ch=0;ch<c;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<n;i++)out[i]+=d[i]/c}return out}
function detectTempo(buffer){
  const sr=buffer.sampleRate,data=monoSamples(buffer),hop=Math.max(128,Math.round(sr/200));
  const energy=[];for(let i=0;i<data.length;i+=hop){let e=0;const end=Math.min(data.length,i+hop);for(let j=i;j<end;j++)e+=data[j]*data[j];energy.push(e/(end-i||1))}
  const novelty=new Float32Array(energy.length);for(let i=1;i<energy.length;i++)novelty[i]=Math.max(0,energy[i]-energy[i-1]);
  let max=0;for(const v of novelty)if(v>max)max=v;const threshold=max*.22;for(let i=0;i<novelty.length;i++)if(novelty[i]<threshold)novelty[i]=0;
  let bestBpm=100,bestScore=-1;
  for(let bpm=40;bpm<=220;bpm++){
    const lag=(60/bpm)*sr/hop;let score=0,count=0;
    for(let i=0;i<novelty.length-lag;i++){const j=Math.round(i+lag);if(j<novelty.length){score+=novelty[i]*novelty[j];count++}}
    if(count)score/=count;
    if(score>bestScore){bestScore=score;bestBpm=bpm}
  }
  return {bpm:bestBpm,confidence:bestScore};
}
async function detectImportedBpm(){
  if(!loopBuffer)return;
  const el=$('#bpmDetectStatus');el.textContent='Analyzing imported audio…';statusEl.textContent='Detecting BPM…';
  await new Promise(r=>setTimeout(r,30));
  const result=detectTempo(loopBuffer);setBpm(result.bpm);el.textContent=`Detected about ${result.bpm} BPM. Adjust manually if the beat is half/double time.`;
}

$('#audioUnlock').onclick=ensureAudio;$('#playBtn').onclick=()=>playing?stop():start();$('#stopBtn').onclick=()=>{stop();stopRecording()};$('#recordBtn').onclick=()=>recorder?.state==='recording'?stopRecording():startRecording();$('#tapTempo').onclick=tapTempo;$('#halfTempo').onclick=()=>setBpm(currentBpm()/2);$('#doubleTempo').onclick=()=>setBpm(currentBpm()*2);$('#bpmPreset').onchange=e=>{if(e.target.value)setBpm(+e.target.value)};bpmEl.onchange=()=>setBpm(currentBpm());$('#detectBpm').onclick=detectImportedBpm;$('#metroBtn').onclick=()=>{metronome=!metronome;$('#metroBtn').textContent=`Metronome ${metronome?'On':'Off'}`;$('#metroBtn').classList.toggle('on',metronome)};$('#clearPattern').onclick=()=>{Object.keys(pattern).forEach(k=>pattern[k].fill(false));buildSequencer()};$$('.pad').forEach(p=>p.onpointerdown=()=>{ensureAudio();drumFns[p.dataset.drum]();p.classList.add('flash');setTimeout(()=>p.classList.remove('flash'),100)});$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('#'+t.dataset.tab).classList.add('active')});$('#armMic').onclick=armMic;$('#playTake').onclick=()=>$('#takePlayer').play();$('#saveProject').onclick=saveProject;$('#downloadProject').onclick=()=>{const p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),`${safe}.royce.json`)};$('#importProject').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{loadProjectObject(JSON.parse(await f.text()))}catch{statusEl.textContent='Invalid project file'}};$('#exportTake').onclick=()=>{if(lastTakeBlob)downloadBlob(lastTakeBlob,`royce-vocal-take.${lastTakeBlob.type.includes('mp4')?'m4a':'webm'}`)};$('#importAudio').onchange=e=>{const f=e.target.files?.[0];if(f)importAudio(f)};$('#clearLoop').onclick=clearLoop;$('#exportWav').onclick=exportWav;['#drumsVol','#loopVol','#vocalVol','#masterVol','#delayMix','#reverbMix'].forEach(id=>$(id).oninput=updateMixer);$$('.mute-btn').forEach(b=>b.onclick=()=>{muted[b.dataset.track]=!muted[b.dataset.track];updateMixer()});
buildSequencer();buildPiano();buildBass();updateMixer();try{const saved=localStorage.getItem('royceStudioProject');if(saved)loadProjectObject(JSON.parse(saved))}catch{}

// Royce Studio v0.4 — full song arrangement
let arrangementSections=[
  {name:'Intro',bars:4,drums:true,loop:true,vocal:false},
  {name:'Verse',bars:8,drums:true,loop:true,vocal:true},
  {name:'Hook',bars:8,drums:true,loop:true,vocal:true},
  {name:'Outro',bars:4,drums:true,loop:true,vocal:false}
];
let songStep=0, songStopTimer=null;
function totalBars(){return arrangementSections.reduce((n,s)=>n+Math.max(1,+s.bars||1),0)}
function sectionAtStep(step){let bar=Math.floor(step/16),cursor=0;for(let i=0;i<arrangementSections.length;i++){const n=Math.max(1,+arrangementSections[i].bars||1);if(bar<cursor+n)return {section:arrangementSections[i],index:i,localBar:bar-cursor};cursor+=n}return null}
function renderArrangement(){
  const host=$('#arrangement'),strip=$('#arrangementStrip'); if(!host||!strip)return;host.innerHTML='';strip.innerHTML='';
  arrangementSections.forEach((sec,i)=>{
    const card=document.createElement('div');card.className='section-card';card.dataset.section=i;
    card.innerHTML=`<div class="section-card-top"><input class="section-name" value="${String(sec.name).replace(/"/g,'&quot;')}" aria-label="Section name"><input class="section-bars" type="number" min="1" max="32" value="${sec.bars}" aria-label="Bars"></div><div class="track-switches"><button class="track-switch ${sec.drums?'on':''}" data-track="drums">DRUMS</button><button class="track-switch ${sec.loop?'on':''}" data-track="loop">LOOP</button><button class="track-switch ${sec.vocal?'on':''}" data-track="vocal">VOCAL</button></div><div class="section-actions"><button data-action="duplicate">Duplicate</button><button class="danger-small" data-action="delete">Delete</button></div>`;
    card.querySelector('.section-name').oninput=e=>{sec.name=e.target.value||`Section ${i+1}`;renderStrip()};
    card.querySelector('.section-bars').onchange=e=>{sec.bars=Math.max(1,Math.min(32,+e.target.value||1));e.target.value=sec.bars;renderArrangement()};
    card.querySelectorAll('.track-switch').forEach(b=>b.onclick=()=>{sec[b.dataset.track]=!sec[b.dataset.track];b.classList.toggle('on',sec[b.dataset.track])});
    card.querySelector('[data-action="duplicate"]').onclick=()=>{arrangementSections.splice(i+1,0,{...sec,name:sec.name+' Copy'});renderArrangement()};
    card.querySelector('[data-action="delete"]').onclick=()=>{if(arrangementSections.length>1){arrangementSections.splice(i,1);renderArrangement()}};
    host.append(card);
  });renderStrip();
}
function renderStrip(){const strip=$('#arrangementStrip');if(!strip)return;strip.innerHTML='';arrangementSections.forEach(sec=>{const d=document.createElement('div');d.className='section-block';d.style.flexGrow=Math.max(1,+sec.bars||1);d.innerHTML=`<span>${sec.name}<small>${sec.bars} bars</small></span>`;strip.append(d)});$('#songLengthLabel').textContent=`${totalBars()} bars`}
function markPlayingSection(i){$$('.section-card').forEach((x,n)=>x.classList.toggle('playing',n===i))}
function barDuration(){return 60/currentBpm()*4}
function sessionSeconds(){return totalBars()*barDuration()}
function launchArrangement(time){
  stopArrangementSources();let offset=0;
  arrangementSections.forEach(sec=>{const dur=Math.max(1,+sec.bars||1)*barDuration();
    if(loopBuffer&&!muted.loop&&sec.loop){const src=ctx.createBufferSource();src.buffer=loopBuffer;src.loop=true;src.connect(loopGain);src.start(time+offset);src.stop(time+offset+dur);activeLoopSources.push(src)}
    if(vocalBuffer&&!muted.vocal&&sec.vocal){const src=ctx.createBufferSource();src.buffer=vocalBuffer;src.connect(vocalGain);src.start(time+offset);src.stop(time+offset+Math.min(dur,vocalBuffer.duration));activeVocalSources.push(src)}
    offset+=dur;
  });
}
function scheduler(){
  if(!playing)return;const maxSteps=totalBars()*16;
  while(nextNoteTime<ctx.currentTime+.12&&songStep<maxSteps){const info=sectionAtStep(songStep),step=songStep%16;if(info){scheduleSongStep(step,nextNoteTime,info)}nextNoteTime+=stepDuration();songStep++}
  if(songStep>=maxSteps){if(!songStopTimer)songStopTimer=setTimeout(()=>stop(),Math.max(0,(nextNoteTime-ctx.currentTime)*1000)+40);return}timer=setTimeout(scheduler,25)
}
function scheduleSongStep(step,time,info){if(info.section.drums&&!muted.drums)Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](time)});if(metronome&&step%4===0)click(time,step===0);setTimeout(()=>{highlightStep(step);markPlayingSection(info.index)},Math.max(0,(time-ctx.currentTime)*1000))}
function start(){ensureAudio();if(playing)return;playing=true;songStep=0;currentStep=0;sessionStartTime=ctx.currentTime+.05;nextNoteTime=sessionStartTime;launchArrangement(sessionStartTime);scheduler();statusEl.textContent=`Playing ${totalBars()}-bar song`;$('#playBtn').textContent='❚❚'}
function stop(){playing=false;if(timer)clearTimeout(timer);if(songStopTimer)clearTimeout(songStopTimer);timer=null;songStopTimer=null;stopArrangementSources();songStep=0;currentStep=0;$$('.step').forEach(x=>x.classList.remove('playhead'));markPlayingSection(-1);statusEl.textContent='Stopped';$('#playBtn').textContent='▶'}
function projectObject(){return{version:4,name:$('#projectName').value||'Untitled Royce Session',bpm:+bpmEl.value||100,pattern,arrangement:arrangementSections,mixer:{drums:+$('#drumsVol').value,loop:+$('#loopVol').value,vocal:+$('#vocalVol').value,master:+$('#masterVol').value,delay:+$('#delayMix').value,reverb:+$('#reverbMix').value,muted},loopFileName,updatedAt:new Date().toISOString()}}
function loadProjectObject(p){if(!p||!p.pattern)return;$('#projectName').value=p.name||'Untitled Royce Session';bpmEl.value=p.bpm||100;Object.keys(pattern).forEach(k=>pattern[k]=(p.pattern[k]||Array(16).fill(false)).slice(0,16));if(Array.isArray(p.arrangement)&&p.arrangement.length)arrangementSections=p.arrangement.map(s=>({name:s.name||'Section',bars:Math.max(1,+s.bars||1),drums:s.drums!==false,loop:s.loop!==false,vocal:!!s.vocal}));const m=p.mixer||{};setControl('#drumsVol',m.drums);setControl('#loopVol',m.loop);setControl('#vocalVol',m.vocal);setControl('#masterVol',m.master);setControl('#delayMix',m.delay);setControl('#reverbMix',m.reverb);Object.assign(muted,m.muted||{});buildSequencer();renderArrangement();updateMixer();statusEl.textContent='Project loaded'}
async function importAudio(file){ensureAudio();try{loopBuffer=await ctx.decodeAudioData((await file.arrayBuffer()).slice(0));loopFileName=file.name;$('#loopClip').textContent=file.name;$('#clearLoop').disabled=false;$('#detectBpm').disabled=false;$('#bpmDetectStatus').textContent=`${file.name} imported. Tap Detect BPM or arrange it across song sections.`;statusEl.textContent='Audio imported'}catch(e){statusEl.textContent='Could not decode audio file';console.error(e)}}
function clearLoop(){loopBuffer=null;loopFileName='';$('#loopClip').textContent='';$('#clearLoop').disabled=true;$('#detectBpm').disabled=true;$('#bpmDetectStatus').textContent='Audio loop removed.';stopArrangementSources()}
async function exportWav(){
  statusEl.textContent='Rendering full song WAV…';const sr=44100,dur=sessionSeconds(),off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr),out=off.createGain();out.gain.value=+$('#masterVol').value;out.connect(off.destination);const dg=off.createGain(),lg=off.createGain();dg.gain.value=muted.drums?0:+$('#drumsVol').value;lg.gain.value=muted.loop?0:+$('#loopVol').value;dg.connect(out);lg.connect(out);
  let barOffset=0;for(const sec of arrangementSections){const bars=Math.max(1,+sec.bars||1),secStart=barOffset*barDuration(),secDur=bars*barDuration();if(sec.drums&&!muted.drums){for(let bar=0;bar<bars;bar++)for(let step=0;step<16;step++){const t=secStart+(bar*16+step)*stepDuration();Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](t,dg,off)})}}if(loopBuffer&&sec.loop&&!muted.loop){const src=off.createBufferSource();src.buffer=loopBuffer;src.loop=true;src.connect(lg);src.start(secStart);src.stop(secStart+secDur)}barOffset+=bars}
  const rendered=await off.startRendering(),p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(audioBufferToWav(rendered),`${safe}-full-song.wav`);statusEl.textContent='Full song WAV exported'
}
$('#addSection').onclick=()=>{arrangementSections.push({name:'New Section',bars:4,drums:true,loop:true,vocal:false});renderArrangement()};
$('#resetArrangement').onclick=()=>{arrangementSections=[{name:'Intro',bars:4,drums:true,loop:true,vocal:false},{name:'Verse',bars:8,drums:true,loop:true,vocal:true},{name:'Hook',bars:8,drums:true,loop:true,vocal:true},{name:'Outro',bars:4,drums:true,loop:true,vocal:false}];renderArrangement();statusEl.textContent='Arrangement reset'};
$('#exportWav').onclick=exportWav;
renderArrangement();

// Royce Studio v0.5 — multitrack vocal recording/editing
let vocalTakes=[];
let takeCounter=1;
let punchMode=false;
let pendingRecordOffset=0;
let activeTakeSources=[];

function songDurationSeconds(){return totalBars()*barDuration()}
function enabledVocalIntervals(){
  let t=0, out=[];
  arrangementSections.forEach(sec=>{const d=Math.max(1,+sec.bars||1)*barDuration();if(sec.vocal)out.push([t,t+d]);t+=d});
  return out;
}
function takeUsableDuration(t){return Math.max(0,(t.buffer?.duration||0)-t.trimStart-t.trimEnd)}
function hasSoloTakes(){return vocalTakes.some(t=>t.solo)}
function takeAudible(t){return !t.muted && (!hasSoloTakes()||t.solo)}
function stopTakeSources(){activeTakeSources.forEach(s=>{try{s.stop()}catch{}});activeTakeSources=[]}
function scheduleTakeInContext(t,baseTime,output=vocalGain,c=ctx){
  if(!t.buffer||!takeAudible(t)||muted.vocal)return;
  const clipStart=Math.max(0,t.start||0), clipDur=takeUsableDuration(t), clipEnd=clipStart+clipDur;
  if(clipDur<=0)return;
  enabledVocalIntervals().forEach(([a,b])=>{
    const from=Math.max(a,clipStart), to=Math.min(b,clipEnd); if(to<=from)return;
    const src=c.createBufferSource();src.buffer=t.buffer;src.connect(output);
    const sourceOffset=t.trimStart+(from-clipStart), duration=to-from;
    src.start(baseTime+from,sourceOffset,duration);
    if(c===ctx)activeTakeSources.push(src);
  });
}
function launchArrangement(time){
  stopArrangementSources();stopTakeSources();let offset=0;
  arrangementSections.forEach(sec=>{const dur=Math.max(1,+sec.bars||1)*barDuration();
    if(loopBuffer&&!muted.loop&&sec.loop){const src=ctx.createBufferSource();src.buffer=loopBuffer;src.loop=true;src.connect(loopGain);src.start(time+offset);src.stop(time+offset+dur);activeLoopSources.push(src)}
    offset+=dur;
  });
  vocalTakes.forEach(t=>scheduleTakeInContext(t,time,vocalGain,ctx));
}
function stopArrangementSources(){[...activeLoopSources,...activeVocalSources].forEach(s=>{try{s.stop()}catch{}});activeLoopSources=[];activeVocalSources=[];stopTakeSources()}

function drawWaveform(canvas,buffer,trimStart=0,trimEnd=0){
  if(!canvas||!buffer)return;const dpr=Math.max(1,window.devicePixelRatio||1),w=Math.max(280,canvas.clientWidth||280),h=58;
  canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);const g=canvas.getContext('2d');g.scale(dpr,dpr);g.clearRect(0,0,w,h);
  const data=buffer.getChannelData(0),start=Math.floor(trimStart*buffer.sampleRate),end=Math.max(start+1,data.length-Math.floor(trimEnd*buffer.sampleRate));
  const step=Math.max(1,Math.floor((end-start)/w));g.strokeStyle='#d946ef';g.lineWidth=1;g.beginPath();
  for(let x=0;x<w;x++){let min=1,max=-1;const a=start+x*step,b=Math.min(end,a+step);for(let i=a;i<b;i++){const v=data[i];if(v<min)min=v;if(v>max)max=v}const y1=(1+min)*h/2,y2=(1+max)*h/2;g.moveTo(x,y1);g.lineTo(x,y2)}g.stroke();
}
function renderVocalTakes(){
  const host=$('#vocalTakes');if(!host)return;host.innerHTML='';$('#takeCount').textContent=`${vocalTakes.length} take${vocalTakes.length===1?'':'s'}`;
  const total=Math.max(.01,songDurationSeconds());
  vocalTakes.forEach((t,i)=>{
    const row=document.createElement('div');row.className='vocal-take';
    if(!t.buffer){row.innerHTML=`<div class="take-top"><input class="take-name" value="${t.name}"><button class="danger-small">Delete</button></div><div class="empty-lane">Empty vocal lane — press Record to capture a take.</div>`;row.querySelector('.take-name').oninput=e=>t.name=e.target.value;row.querySelector('button').onclick=()=>{vocalTakes.splice(i,1);renderVocalTakes()};host.append(row);return}
    const dur=takeUsableDuration(t),left=Math.min(100,Math.max(0,(t.start/total)*100)),width=Math.max(1,Math.min(100-left,(dur/total)*100));
    row.innerHTML=`<div class="take-top"><input class="take-name" value="${t.name}"><span class="mini">${dur.toFixed(1)}s</span></div><canvas class="waveform"></canvas><div class="take-lane"><div class="take-clip" style="left:${left}%;width:${width}%">${t.name}</div></div><div class="take-meta"><label>Start (sec)<input class="take-start" type="number" min="0" step="0.1" value="${t.start.toFixed(1)}"></label><label>Trim In<input class="trim-in" type="number" min="0" step="0.1" value="${t.trimStart.toFixed(1)}"></label><label>Trim Out<input class="trim-out" type="number" min="0" step="0.1" value="${t.trimEnd.toFixed(1)}"></label></div><div class="take-actions"><button data-a="left">← 1 Bar</button><button data-a="right">1 Bar →</button><button data-a="mute" class="${t.muted?'on':''}">${t.muted?'Muted':'Mute'}</button><button data-a="solo" class="${t.solo?'on':''}">${t.solo?'Solo On':'Solo'}</button><button data-a="play">Play</button><button data-a="export">Export</button><button data-a="dup">Duplicate</button><button data-a="delete" class="danger-small">Delete</button></div>`;
    row.querySelector('.take-name').oninput=e=>{t.name=e.target.value;renderVocalTakes()};
    const syncInputs=()=>{t.start=Math.max(0,+row.querySelector('.take-start').value||0);t.trimStart=Math.max(0,+row.querySelector('.trim-in').value||0);t.trimEnd=Math.max(0,+row.querySelector('.trim-out').value||0);const maxTrim=Math.max(0,(t.buffer.duration-.05));if(t.trimStart+t.trimEnd>maxTrim)t.trimEnd=Math.max(0,maxTrim-t.trimStart);renderVocalTakes()};
    row.querySelectorAll('.take-meta input').forEach(el=>el.onchange=syncInputs);
    row.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{
      const a=b.dataset.a;if(a==='left')t.start=Math.max(0,t.start-barDuration());if(a==='right')t.start=Math.min(songDurationSeconds(),t.start+barDuration());
      if(a==='mute')t.muted=!t.muted;if(a==='solo')t.solo=!t.solo;
      if(a==='delete'){vocalTakes.splice(i,1);renderVocalTakes();return}
      if(a==='dup'){vocalTakes.splice(i+1,0,{...t,id:Date.now()+Math.random(),name:t.name+' Copy',start:Math.min(songDurationSeconds(),t.start+barDuration())});renderVocalTakes();return}
      if(a==='play'){ensureAudio();const src=ctx.createBufferSource();src.buffer=t.buffer;src.connect(vocalGain);src.start(ctx.currentTime,t.trimStart,Math.max(.01,takeUsableDuration(t)));return}
      if(a==='export'&&t.blob){downloadBlob(t.blob,`${(t.name||'vocal-take').replace(/[^a-z0-9-_]+/gi,'-')}.${t.blob.type.includes('mp4')?'m4a':'webm'}`);return}
      renderVocalTakes();
    });
    host.append(row);requestAnimationFrame(()=>drawWaveform(row.querySelector('canvas'),t.buffer,t.trimStart,t.trimEnd));
  });
}

async function startRecording(){
  if(!micStream)await armMic();if(!micStream||recorder?.state==='recording')return;ensureAudio();
  if(!playing)start();
  pendingRecordOffset=punchMode?Math.max(0,ctx.currentTime-sessionStartTime):0;
  recordedChunks=[];
  try{const mime=bestMime();recorder=new MediaRecorder(micStream,mime?{mimeType:mime}:undefined);recorder.ondataavailable=e=>{if(e.data.size)recordedChunks.push(e.data)};
    recorder.onstop=async()=>{lastTakeBlob=new Blob(recordedChunks,{type:recorder.mimeType||'audio/webm'});const url=URL.createObjectURL(lastTakeBlob);$('#takePlayer').src=url;$('#playTake').disabled=false;$('#exportTake').disabled=false;$('#micStatus').textContent='Take captured and added to the vocal timeline.';
      try{const b=await decodeBlob(lastTakeBlob);vocalBuffer=b;vocalTakes.push({id:Date.now()+Math.random(),name:`Vocal ${takeCounter++}`,buffer:b,blob:lastTakeBlob,start:pendingRecordOffset,trimStart:0,trimEnd:0,muted:false,solo:false});renderVocalTakes()}catch(e){console.warn('Could not decode vocal take',e)}
    };recorder.start();$('#recordBtn').classList.add('active');statusEl.textContent=punchMode?'Punch recording':'Recording';
  }catch(e){$('#micStatus').textContent='Recording is not supported in this browser session.';console.error(e)}
}

function projectObject(){return{version:5,name:$('#projectName').value||'Untitled Royce Session',bpm:+bpmEl.value||100,pattern,arrangement:arrangementSections,mixer:{drums:+$('#drumsVol').value,loop:+$('#loopVol').value,vocal:+$('#vocalVol').value,master:+$('#masterVol').value,delay:+$('#delayMix').value,reverb:+$('#reverbMix').value,muted},loopFileName,vocalTakes:vocalTakes.map(t=>({name:t.name,start:t.start,trimStart:t.trimStart,trimEnd:t.trimEnd,muted:t.muted,solo:t.solo,hasAudio:!!t.buffer})),updatedAt:new Date().toISOString()}}

const loadProjectObjectV4=loadProjectObject;
loadProjectObject=function(p){loadProjectObjectV4(p);if(Array.isArray(p?.vocalTakes)){vocalTakes=p.vocalTakes.map((t,i)=>({id:Date.now()+i,name:t.name||`Vocal ${i+1}`,start:+t.start||0,trimStart:+t.trimStart||0,trimEnd:+t.trimEnd||0,muted:!!t.muted,solo:!!t.solo,buffer:null,blob:null}));takeCounter=vocalTakes.length+1;renderVocalTakes();if(vocalTakes.length)$('#micStatus').textContent='Vocal lane metadata loaded. Re-record or re-import audio after a browser reload.'}}

async function exportWav(){
  statusEl.textContent='Rendering full song WAV with vocals…';const sr=44100,dur=Math.max(.1,sessionSeconds()),off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr),out=off.createGain();out.gain.value=+$('#masterVol').value;out.connect(off.destination);
  const dg=off.createGain(),lg=off.createGain(),vg=off.createGain();dg.gain.value=muted.drums?0:+$('#drumsVol').value;lg.gain.value=muted.loop?0:+$('#loopVol').value;vg.gain.value=muted.vocal?0:+$('#vocalVol').value;dg.connect(out);lg.connect(out);vg.connect(out);
  let barOffset=0;for(const sec of arrangementSections){const bars=Math.max(1,+sec.bars||1),secStart=barOffset*barDuration(),secDur=bars*barDuration();if(sec.drums&&!muted.drums){for(let bar=0;bar<bars;bar++)for(let step=0;step<16;step++){const t=secStart+(bar*16+step)*stepDuration();Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](t,dg,off)})}}if(loopBuffer&&sec.loop&&!muted.loop){const src=off.createBufferSource();src.buffer=loopBuffer;src.loop=true;src.connect(lg);src.start(secStart);src.stop(secStart+secDur)}barOffset+=bars}
  if(!muted.vocal)vocalTakes.forEach(t=>scheduleTakeInContext(t,0,vg,off));
  const rendered=await off.startRendering(),p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(audioBufferToWav(rendered),`${safe}-full-song-vocals.wav`);statusEl.textContent='Full song WAV exported with vocals'
}

$('#punchMode').onclick=()=>{punchMode=!punchMode;$('#punchMode').textContent=`Punch-In: ${punchMode?'On':'Off'}`;$('#punchMode').classList.toggle('on',punchMode);$('#micStatus').textContent=punchMode?'Punch-in enabled: start playback, move to the spot, then press Record.':'Punch-in disabled: new recordings begin at song start.'};
$('#addEmptyTake').onclick=()=>{vocalTakes.push({id:Date.now()+Math.random(),name:`Vocal ${takeCounter++}`,buffer:null,blob:null,start:0,trimStart:0,trimEnd:0,muted:false,solo:false});renderVocalTakes()};
$('#recordBtn').onclick=()=>recorder?.state==='recording'?stopRecording():startRecording();
$('#exportWav').onclick=exportWav;
renderVocalTakes();

// ===== Royce Studio v0.6: persistent media + multi imported audio =====
let audioTracks=[];
const DB_NAME='RoyceStudioDB', DB_VERSION=1, STORE='media';
function openRoyceDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbPut(key,value){const db=await openRoyceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbGet(key){const db=await openRoyceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbDelete(key){const db=await openRoyceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function mediaKey(kind,id){return `${kind}:${id}`}
function makeAudioTrack(file,buffer){return{id:Date.now()+Math.random(),name:file.name||`Audio ${audioTracks.length+1}`,fileName:file.name||'',blob:file,buffer,start:0,trimStart:0,trimEnd:0,volume:.8,pan:0,muted:false,loop:true}}
function trackDuration(t){return Math.max(0,(t.buffer?.duration||0)-(t.trimStart||0)-(t.trimEnd||0))}
function renderAudioTracks(){const host=$('#audioTracks');if(!host)return;host.innerHTML='';$('#audioTrackCount').textContent=`${audioTracks.length} track${audioTracks.length===1?'':'s'}`;audioTracks.forEach((t,i)=>{const row=document.createElement('div');row.className='audio-track-row';const badge=t.buffer?'<span class="restore-badge">Audio ready</span>':'<span class="missing-badge">Audio missing</span>';row.innerHTML=`<div class="audio-track-top"><input class="audio-track-name" value="${t.name}">${badge}</div><div class="audio-track-controls"><label>Start (sec)<input data-f="start" type="number" min="0" step="0.1" value="${(+t.start||0).toFixed(1)}"></label><label>Volume<input data-f="volume" type="range" min="0" max="1" step="0.01" value="${t.volume??.8}"></label><label>Pan<input data-f="pan" type="range" min="-1" max="1" step="0.01" value="${t.pan??0}"></label><label>Trim In (sec)<input data-f="trimStart" type="number" min="0" step="0.1" value="${(+t.trimStart||0).toFixed(1)}"></label></div><div class="audio-track-actions"><button data-a="mute" class="${t.muted?'on':''}">${t.muted?'Muted':'Mute'}</button><button data-a="loop" class="${t.loop?'on':''}">${t.loop?'Loop On':'Loop Off'}</button><button data-a="left">← 1 Bar</button><button data-a="right">1 Bar →</button><button data-a="play">Play</button><button data-a="delete">Delete</button></div>`;row.querySelector('.audio-track-name').oninput=e=>t.name=e.target.value;row.querySelectorAll('[data-f]').forEach(el=>el.oninput=()=>{const f=el.dataset.f;t[f]=+el.value||0});row.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;if(a==='mute')t.muted=!t.muted;if(a==='loop')t.loop=!t.loop;if(a==='left')t.start=Math.max(0,(t.start||0)-barDuration());if(a==='right')t.start=Math.min(songDurationSeconds(),(t.start||0)+barDuration());if(a==='play'&&t.buffer){ensureAudio();const src=ctx.createBufferSource(),g=ctx.createGain(),p=ctx.createStereoPanner?ctx.createStereoPanner():null;src.buffer=t.buffer;g.gain.value=t.volume??.8;if(p){p.pan.value=t.pan||0;src.connect(g).connect(p).connect(loopGain)}else src.connect(g).connect(loopGain);src.start(ctx.currentTime,t.trimStart||0,Math.max(.01,trackDuration(t)));return}if(a==='delete'){try{await dbDelete(mediaKey('audio',t.id))}catch{}audioTracks.splice(i,1);syncLegacyLoop();renderAudioTracks();return}renderAudioTracks()});host.append(row)})}
function syncLegacyLoop(){const first=audioTracks.find(t=>t.buffer);loopBuffer=first?.buffer||null;loopFileName=first?.fileName||first?.name||'';$('#clearLoop').disabled=!audioTracks.length;$('#detectBpm').disabled=!loopBuffer}
async function importAudioV6(file){ensureAudio();try{const blob=file instanceof Blob?file:new Blob([file]);const buffer=await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));const t=makeAudioTrack(file,buffer);audioTracks.push(t);await dbPut(mediaKey('audio',t.id),blob);syncLegacyLoop();renderAudioTracks();$('#bpmDetectStatus').textContent=`${file.name} imported. ${audioTracks.length} imported audio track${audioTracks.length===1?'':'s'} in session.`;statusEl.textContent='Audio track imported'}catch(e){statusEl.textContent='Could not decode audio file';console.error(e)}}
function scheduleAudioTrack(t,baseTime,output,c=ctx){if(!t.buffer||t.muted||muted.loop)return;let secOffset=0;arrangementSections.forEach(sec=>{const secDur=Math.max(1,+sec.bars||1)*barDuration(),secStart=secOffset,secEnd=secOffset+secDur;if(sec.loop){const from=Math.max(secStart,t.start||0),to=secEnd;if(to>from){const g=c.createGain();g.gain.value=t.volume??.8;let node=g;if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=t.pan||0;g.connect(p);p.connect(output)}else g.connect(output);const src=c.createBufferSource();src.buffer=t.buffer;src.loop=!!t.loop;const offset=(t.trimStart||0)+Math.max(0,from-(t.start||0));src.connect(g);src.start(baseTime+from,Math.min(offset,Math.max(0,t.buffer.duration-.01)));if(!t.loop){const d=Math.min(trackDuration(t)-Math.max(0,from-(t.start||0)),to-from);if(d>0)src.stop(baseTime+from+d)}else src.stop(baseTime+to);if(c===ctx)activeLoopSources.push(src)}}secOffset=secEnd})}
launchArrangement=function(time){stopArrangementSources();stopTakeSources();audioTracks.forEach(t=>scheduleAudioTrack(t,time,loopGain,ctx));vocalTakes.forEach(t=>scheduleTakeInContext(t,time,vocalGain,ctx))};
const projectObjectV5=projectObject;
projectObject=function(){const p=projectObjectV5();p.version=6;p.audioTracks=audioTracks.map(t=>({id:t.id,name:t.name,fileName:t.fileName,start:t.start,trimStart:t.trimStart,trimEnd:t.trimEnd,volume:t.volume,pan:t.pan,muted:t.muted,loop:t.loop,hasAudio:!!t.buffer}));p.vocalTakes=vocalTakes.map(t=>({id:t.id,name:t.name,start:t.start,trimStart:t.trimStart,trimEnd:t.trimEnd,muted:t.muted,solo:t.solo,hasAudio:!!t.buffer}));return p};
async function persistAllMedia(){const status=$('#mediaSaveStatus');if(status)status.textContent='Saving project media locally…';for(const t of audioTracks)if(t.blob)await dbPut(mediaKey('audio',t.id),t.blob);for(const t of vocalTakes)if(t.blob)await dbPut(mediaKey('vocal',t.id),t.blob);if(status)status.textContent=`Saved ${audioTracks.length} audio track(s) and ${vocalTakes.filter(t=>t.blob).length} vocal take(s) locally.`}
async function saveProjectV6(){localStorage.setItem('royceStudioProject',JSON.stringify(projectObject()));try{await persistAllMedia();statusEl.textContent='Project + media saved locally'}catch(e){statusEl.textContent='Project saved; some media could not be stored';console.warn(e)}}
async function restoreMediaForProject(p){ensureAudio();audioTracks=[];if(Array.isArray(p?.audioTracks)){for(const m of p.audioTracks){let blob=null,buffer=null;try{blob=await dbGet(mediaKey('audio',m.id));if(blob)buffer=await decodeBlob(blob)}catch(e){console.warn(e)}audioTracks.push({...m,blob,buffer})}}for(const t of vocalTakes){if(!t.id)continue;try{const blob=await dbGet(mediaKey('vocal',t.id));if(blob){t.blob=blob;t.buffer=await decodeBlob(blob)}}catch(e){console.warn(e)}}syncLegacyLoop();renderAudioTracks();renderVocalTakes();const restored=audioTracks.filter(t=>t.buffer).length+vocalTakes.filter(t=>t.buffer).length;if($('#mediaSaveStatus'))$('#mediaSaveStatus').textContent=`Restored ${restored} media item${restored===1?'':'s'} from this device.`}
const loadProjectObjectV5=loadProjectObject;
loadProjectObject=function(p){loadProjectObjectV5(p);if(Array.isArray(p?.vocalTakes)){vocalTakes=p.vocalTakes.map((t,i)=>({id:t.id||Date.now()+i,name:t.name||`Vocal ${i+1}`,start:+t.start||0,trimStart:+t.trimStart||0,trimEnd:+t.trimEnd||0,muted:!!t.muted,solo:!!t.solo,buffer:null,blob:null}));takeCounter=vocalTakes.length+1}restoreMediaForProject(p)};
const startRecordingV5=startRecording;
startRecording=async function(){await startRecordingV5();if(recorder){const oldStop=recorder.onstop;recorder.onstop=async e=>{if(oldStop)await oldStop(e);const newest=vocalTakes[vocalTakes.length-1];if(newest?.blob){try{await dbPut(mediaKey('vocal',newest.id),newest.blob);if($('#mediaSaveStatus'))$('#mediaSaveStatus').textContent='New vocal take saved locally.'}catch(err){console.warn(err)}}}}};
exportWav=async function(){statusEl.textContent='Rendering full song WAV with all tracks…';const sr=44100,dur=Math.max(.1,sessionSeconds()),off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr),out=off.createGain();out.gain.value=+$('#masterVol').value;out.connect(off.destination);const dg=off.createGain(),lg=off.createGain(),vg=off.createGain();dg.gain.value=muted.drums?0:+$('#drumsVol').value;lg.gain.value=muted.loop?0:+$('#loopVol').value;vg.gain.value=muted.vocal?0:+$('#vocalVol').value;dg.connect(out);lg.connect(out);vg.connect(out);let barOffset=0;for(const sec of arrangementSections){const bars=Math.max(1,+sec.bars||1),secStart=barOffset*barDuration();if(sec.drums&&!muted.drums){for(let bar=0;bar<bars;bar++)for(let step=0;step<16;step++){const t=secStart+(bar*16+step)*stepDuration();Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](t,dg,off)})}}barOffset+=bars}audioTracks.forEach(t=>scheduleAudioTrack(t,0,lg,off));if(!muted.vocal)vocalTakes.forEach(t=>scheduleTakeInContext(t,0,vg,off));const rendered=await off.startRendering(),p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(audioBufferToWav(rendered),`${safe}-v06-full-mix.wav`);statusEl.textContent='Full mix WAV exported'};
$('#saveProject').onclick=saveProjectV6;
$('#importAudio').onchange=async e=>{const fs=[...(e.target.files||[])];for(const f of fs)await importAudioV6(f);e.target.value=''};
$('#clearLoop').onclick=async()=>{for(const t of audioTracks){try{await dbDelete(mediaKey('audio',t.id))}catch{}}audioTracks=[];syncLegacyLoop();renderAudioTracks();$('#bpmDetectStatus').textContent='All imported audio tracks removed.';stopArrangementSources()};
$('#exportWav').onclick=exportWav;
const storedV6=localStorage.getItem('royceStudioProject');if(storedV6){try{const p=JSON.parse(storedV6);if(p.version>=6)loadProjectObject(p)}catch(e){console.warn(e)}}
renderAudioTracks();


// ===== Royce Studio v0.7 production mixer =====
let v07Ready=false, v07Nodes=null, meterRAF=null;
const v07Defaults={
  drums:{low:0,mid:0,high:0},loop:{low:0,mid:0,high:0},vocal:{low:0,mid:0,high:0,comp:.35,delay:.15,reverb:.22,pitch:0},master:{limiter:-1}
};
function v07Val(id,def=0){const e=$(id);return e?+e.value:def}
function v07Filter(c,type,freq,gain=0,Q=.8){const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.gain.value=gain;f.Q.value=Q;return f}
function v07TrackChain(c,input,kind,dryTarget,delayTarget,reverbTarget){
  const low=v07Filter(c,'lowshelf',180,v07Val(`#${kind}Low`,0));
  const mid=v07Filter(c,'peaking',1200,v07Val(`#${kind}Mid`,0),.9);
  const high=v07Filter(c,'highshelf',6500,v07Val(`#${kind}High`,0));
  const analyser=c.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.76;
  input.connect(low);low.connect(mid);mid.connect(high);
  let tail=high,comp=null;
  if(kind==='vocal'){
    comp=c.createDynamicsCompressor();tail.connect(comp);tail=comp;
    const amount=v07Val('#vocalComp',.35);comp.threshold.value=-12-amount*30;comp.knee.value=18;comp.ratio.value=2+amount*8;comp.attack.value=.006;comp.release.value=.22;
  }
  tail.connect(analyser);analyser.connect(dryTarget);
  let delaySend=null,reverbSend=null;
  if(kind==='vocal'){
    delaySend=c.createGain();reverbSend=c.createGain();delaySend.gain.value=v07Val('#vocalDelaySend',.15);reverbSend.gain.value=v07Val('#vocalReverbSend',.22);analyser.connect(delaySend);delaySend.connect(delayTarget);analyser.connect(reverbSend);reverbSend.connect(reverbTarget);
  }
  return {low,mid,high,comp,analyser,delaySend,reverbSend};
}
function v07RewireLive(){
  if(!ctx||v07Ready)return;
  try{drumGain.disconnect();loopGain.disconnect();vocalGain.disconnect();master.disconnect()}catch(e){}
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=v07Val('#limiterThreshold',-1);limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.08;
  const masterAnalyser=ctx.createAnalyser();masterAnalyser.fftSize=256;masterAnalyser.smoothingTimeConstant=.78;
  const drums=v07TrackChain(ctx,drumGain,'drums',dryBus,delayBus,reverbBus);
  const loop=v07TrackChain(ctx,loopGain,'loop',dryBus,delayBus,reverbBus);
  const vocal=v07TrackChain(ctx,vocalGain,'vocal',dryBus,delayBus,reverbBus);
  master.connect(limiter);limiter.connect(masterAnalyser);masterAnalyser.connect(ctx.destination);masterAnalyser.connect(recordDestination);
  v07Nodes={drums,loop,vocal,limiter,masterAnalyser};v07Ready=true;v07UpdateMixer();v07StartMeters();
}
const ensureAudioV6=ensureAudio;
ensureAudio=function(){const c=ensureAudioV6();v07RewireLive();return c};
function v07DbText(v){return `${(+v).toFixed((+v)%1?1:0)} dB`}
function v07UpdateLabels(){
  ['drums','loop','vocal'].forEach(k=>['Low','Mid','High'].forEach(b=>{const id=`#${k}${b}`,out=$(`#${k}${b}Value`);if(out)out.textContent=v07DbText(v07Val(id,0))}));
  if($('#vocalCompValue'))$('#vocalCompValue').textContent=Math.round(v07Val('#vocalComp',.35)*100)+'%';
  if($('#vocalDelayValue'))$('#vocalDelayValue').textContent=Math.round(v07Val('#vocalDelaySend',.15)*100)+'%';
  if($('#vocalReverbValue'))$('#vocalReverbValue').textContent=Math.round(v07Val('#vocalReverbSend',.22)*100)+'%';
  if($('#vocalPitchValue'))$('#vocalPitchValue').textContent=Math.round(v07Val('#vocalPitch',0))+' cents';
  if($('#limiterValue'))$('#limiterValue').textContent=v07DbText(v07Val('#limiterThreshold',-1));
}
function v07UpdateMixer(){
  updateMixerV6();v07UpdateLabels();if(!v07Nodes)return;
  ['drums','loop','vocal'].forEach(k=>{const n=v07Nodes[k];if(!n)return;n.low.gain.value=v07Val(`#${k}Low`,0);n.mid.gain.value=v07Val(`#${k}Mid`,0);n.high.gain.value=v07Val(`#${k}High`,0)});
  const a=v07Val('#vocalComp',.35),c=v07Nodes.vocal.comp;if(c){c.threshold.value=-12-a*30;c.ratio.value=2+a*8}
  if(v07Nodes.vocal.delaySend)v07Nodes.vocal.delaySend.gain.value=v07Val('#vocalDelaySend',.15);
  if(v07Nodes.vocal.reverbSend)v07Nodes.vocal.reverbSend.gain.value=v07Val('#vocalReverbSend',.22);
  if(v07Nodes.limiter)v07Nodes.limiter.threshold.value=v07Val('#limiterThreshold',-1);
}
const updateMixerV6=updateMixer;updateMixer=v07UpdateMixer;
function v07MeterValue(an){if(!an)return 0;const data=new Uint8Array(an.fftSize);an.getByteTimeDomainData(data);let sum=0;for(const x of data){const v=(x-128)/128;sum+=v*v}return Math.min(1,Math.sqrt(sum/data.length)*4.2)}
function v07StartMeters(){if(meterRAF)return;const draw=()=>{if(v07Nodes){[['drums',v07Nodes.drums?.analyser],['loop',v07Nodes.loop?.analyser],['vocal',v07Nodes.vocal?.analyser],['master',v07Nodes.masterAnalyser]].forEach(([k,a])=>{const el=$(`#${k}Meter`);if(el)el.style.height=`${Math.max(2,v07MeterValue(a)*100)}%`})}meterRAF=requestAnimationFrame(draw)};draw()}
function v07OfflineChain(c,input,kind,dryTarget,delayTarget,reverbTarget){
  const low=v07Filter(c,'lowshelf',180,v07Val(`#${kind}Low`,0)),mid=v07Filter(c,'peaking',1200,v07Val(`#${kind}Mid`,0),.9),high=v07Filter(c,'highshelf',6500,v07Val(`#${kind}High`,0));input.connect(low);low.connect(mid);mid.connect(high);let tail=high;
  if(kind==='vocal'){const comp=c.createDynamicsCompressor(),a=v07Val('#vocalComp',.35);comp.threshold.value=-12-a*30;comp.knee.value=18;comp.ratio.value=2+a*8;comp.attack.value=.006;comp.release.value=.22;tail.connect(comp);tail=comp;const ds=c.createGain(),rs=c.createGain();ds.gain.value=v07Val('#vocalDelaySend',.15);rs.gain.value=v07Val('#vocalReverbSend',.22);tail.connect(ds);ds.connect(delayTarget);tail.connect(rs);rs.connect(reverbTarget)}
  tail.connect(dryTarget);return tail;
}
const projectObjectV6=projectObject;
projectObject=function(){const p=projectObjectV6();p.version=7;p.production={drums:{low:v07Val('#drumsLow'),mid:v07Val('#drumsMid'),high:v07Val('#drumsHigh')},loop:{low:v07Val('#loopLow'),mid:v07Val('#loopMid'),high:v07Val('#loopHigh')},vocal:{low:v07Val('#vocalLow'),mid:v07Val('#vocalMid'),high:v07Val('#vocalHigh'),comp:v07Val('#vocalComp',.35),delay:v07Val('#vocalDelaySend',.15),reverb:v07Val('#vocalReverbSend',.22),pitch:v07Val('#vocalPitch',0)},master:{limiter:v07Val('#limiterThreshold',-1)}};return p};
const loadProjectObjectV6=loadProjectObject;
loadProjectObject=function(p){loadProjectObjectV6(p);const x=p?.production||{};[['#drumsLow',x.drums?.low],['#drumsMid',x.drums?.mid],['#drumsHigh',x.drums?.high],['#loopLow',x.loop?.low],['#loopMid',x.loop?.mid],['#loopHigh',x.loop?.high],['#vocalLow',x.vocal?.low],['#vocalMid',x.vocal?.mid],['#vocalHigh',x.vocal?.high],['#vocalComp',x.vocal?.comp],['#vocalDelaySend',x.vocal?.delay],['#vocalReverbSend',x.vocal?.reverb],['#vocalPitch',x.vocal?.pitch],['#limiterThreshold',x.master?.limiter]].forEach(([id,v])=>setControl(id,v));v07UpdateMixer()};
function v07SourceDetune(src){if(src?.detune)src.detune.value=v07Val('#vocalPitch',0)}
const scheduleTakeInContextV6=scheduleTakeInContext;
scheduleTakeInContext=function(t,baseTime,output=vocalGain,c=ctx){
  if(!t.buffer||!takeAudible(t)||muted.vocal)return;const clipStart=Math.max(0,t.start||0),clipDur=takeUsableDuration(t),clipEnd=clipStart+clipDur;if(clipDur<=0)return;
  enabledVocalIntervals().forEach(([a,b])=>{const from=Math.max(a,clipStart),to=Math.min(b,clipEnd);if(to<=from)return;const src=c.createBufferSource();src.buffer=t.buffer;v07SourceDetune(src);src.connect(output);const sourceOffset=t.trimStart+(from-clipStart),duration=to-from;src.start(baseTime+from,sourceOffset,duration);if(c===ctx)activeTakeSources.push(src)})
};
exportWav=async function(){
  statusEl.textContent='Rendering v0.7 production mix…';const sr=44100,dur=Math.max(.1,sessionSeconds()),off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr);
  const dry=off.createGain(),dBus=off.createGain(),rBus=off.createGain(),masterOut=off.createGain(),limiter=off.createDynamicsCompressor();masterOut.gain.value=+$('#masterVol').value;limiter.threshold.value=v07Val('#limiterThreshold',-1);limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.08;masterOut.connect(limiter);limiter.connect(off.destination);dry.connect(masterOut);
  const dNode=off.createDelay(1),dFb=off.createGain(),dWet=off.createGain();dNode.delayTime.value=.24;dFb.gain.value=.28;dWet.gain.value=+$('#delayMix').value;dBus.connect(dNode);dNode.connect(dWet);dWet.connect(masterOut);dNode.connect(dFb);dFb.connect(dNode);
  const rv=off.createConvolver(),rvWet=off.createGain();rv.buffer=makeImpulse(off);rvWet.gain.value=+$('#reverbMix').value;rBus.connect(rv);rv.connect(rvWet);rvWet.connect(masterOut);
  const dg=off.createGain(),lg=off.createGain(),vg=off.createGain();dg.gain.value=muted.drums?0:+$('#drumsVol').value;lg.gain.value=muted.loop?0:+$('#loopVol').value;vg.gain.value=muted.vocal?0:+$('#vocalVol').value;v07OfflineChain(off,dg,'drums',dry,dBus,rBus);v07OfflineChain(off,lg,'loop',dry,dBus,rBus);v07OfflineChain(off,vg,'vocal',dry,dBus,rBus);
  let barOffset=0;for(const sec of arrangementSections){const bars=Math.max(1,+sec.bars||1),secStart=barOffset*barDuration();if(sec.drums&&!muted.drums){for(let bar=0;bar<bars;bar++)for(let step=0;step<16;step++){const t=secStart+(bar*16+step)*stepDuration();Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](t,dg,off)})}}barOffset+=bars}
  audioTracks.forEach(t=>scheduleAudioTrack(t,0,lg,off));if(!muted.vocal)vocalTakes.forEach(t=>scheduleTakeInContext(t,0,vg,off));const rendered=await off.startRendering(),p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(audioBufferToWav(rendered),`${safe}-v07-production-mix.wav`);statusEl.textContent='v0.7 production mix exported';
};
['#drumsLow','#drumsMid','#drumsHigh','#loopLow','#loopMid','#loopHigh','#vocalLow','#vocalMid','#vocalHigh','#vocalComp','#vocalDelaySend','#vocalReverbSend','#vocalPitch','#limiterThreshold'].forEach(id=>{const e=$(id);if(e)e.oninput=v07UpdateMixer});
$('#exportWav').onclick=exportWav;
v07UpdateLabels();
const storedV7=localStorage.getItem('royceStudioProject');if(storedV7){try{const p=JSON.parse(storedV7);if(p.version>=7)loadProjectObject(p)}catch(e){console.warn(e)}}


// ===== Royce Studio v0.8 vocal production tools =====
const v08Notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const v08Scales={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]};
function v08DbToAmp(db){return Math.pow(10,db/20)}
function v08NearestNote(freq){if(!freq||!isFinite(freq))return null;const midi=Math.round(69+12*Math.log2(freq/440));const exact=69+12*Math.log2(freq/440);const cents=Math.round((exact-midi)*100);return{midi,note:v08Notes[(midi%12+12)%12],octave:Math.floor(midi/12)-1,cents,freq:440*Math.pow(2,(midi-69)/12)}}
function v08InScale(note){const root=v08Notes.indexOf($('#songKey')?.value||'C'),pc=v08Notes.indexOf(note),scale=v08Scales[$('#songScale')?.value||'major']||v08Scales.major;return scale.includes((pc-root+12)%12)}
function v08Autocorrelate(buf,sr){let size=Math.min(buf.length,Math.floor(sr*1.5));let start=Math.max(0,Math.floor((buf.length-size)/2));let data=buf.subarray(start,start+size);let rms=0;for(let i=0;i<data.length;i++)rms+=data[i]*data[i];rms=Math.sqrt(rms/data.length);if(rms<0.01)return null;let minLag=Math.floor(sr/1000),maxLag=Math.min(Math.floor(sr/70),data.length-2),bestLag=-1,best=0;for(let lag=minLag;lag<=maxLag;lag++){let sum=0,n=data.length-lag;for(let i=0;i<n;i++)sum+=data[i]*data[i+lag];sum/=n;if(sum>best){best=sum;bestLag=lag}}if(bestLag<0)return null;return sr/bestLag}
function v08AnalyzeTake(){const t=[...vocalTakes].reverse().find(x=>x.buffer);if(!t?.buffer){$('#pitchNote').textContent='—';$('#pitchHz').textContent='Record or restore a vocal take first';return}const ch=t.buffer.getChannelData(0),freq=v08Autocorrelate(ch,t.buffer.sampleRate),n=v08NearestNote(freq);if(!n){$('#pitchNote').textContent='—';$('#pitchHz').textContent='No stable pitch detected in this take';return}const ok=v08InScale(n.note);$('#pitchNote').textContent=`${n.note}${n.octave}`;$('#pitchHz').textContent=`${freq.toFixed(1)} Hz · ${n.cents>=0?'+':''}${n.cents} cents · ${ok?'in':'outside'} selected scale`;$('#pitchGuide').textContent=ok?`${n.note} is inside ${$('#songKey').value} ${$('#songScale').value}.`:`${n.note} is outside ${$('#songKey').value} ${$('#songScale').value}; use this as a correction guide.`}
function v08Preset(name){const p={clean:{low:-1,mid:1,high:1.5,comp:.28,delay:.06,reverb:.12,gate:-52,deess:.18},warm:{low:2,mid:.5,high:-1,comp:.36,delay:.08,reverb:.18,gate:-50,deess:.22},rap:{low:-2,mid:3,high:2,comp:.55,delay:.1,reverb:.1,gate:-46,deess:.32},air:{low:-2,mid:0,high:4,comp:.3,delay:.15,reverb:.3,gate:-54,deess:.38},night:{low:1,mid:-1,high:1.5,comp:.42,delay:.22,reverb:.34,gate:-50,deess:.28}}[name];if(!p)return;[['#vocalLow',p.low],['#vocalMid',p.mid],['#vocalHigh',p.high],['#vocalComp',p.comp],['#vocalDelaySend',p.delay],['#vocalReverbSend',p.reverb],['#vocalGate',p.gate],['#vocalDeEsser',p.deess]].forEach(([id,v])=>setControl(id,v));v07UpdateMixer();v08UpdateLabels()}
function v08UpdateLabels(){if($('#gateValue'))$('#gateValue').textContent=`${Math.round(v07Val('#vocalGate',-48))} dB`;if($('#deEsserValue'))$('#deEsserValue').textContent=`${Math.round(v07Val('#vocalDeEsser',.25)*100)}%`}
function v08GateBuffer(buffer,c){const out=c.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate),threshold=v08DbToAmp(v07Val('#vocalGate',-48));for(let ch=0;ch<buffer.numberOfChannels;ch++){const src=buffer.getChannelData(ch),dst=out.getChannelData(ch);for(let i=0;i<src.length;i++){const a=Math.abs(src[i]);let g=1;if(a<threshold){const r=a/Math.max(threshold,1e-6);g=.08+.92*r*r}dst[i]=src[i]*g}}return out}
function v08AddDeEsser(c,input){const shelf=c.createBiquadFilter();shelf.type='highshelf';shelf.frequency.value=5200;shelf.gain.value=-8*v07Val('#vocalDeEsser',.25);input.connect(shelf);return shelf}
const v08TrackChainPrev=v07TrackChain;
v07TrackChain=function(c,input,kind,dryTarget,delayTarget,reverbTarget){if(kind!=='vocal')return v08TrackChainPrev(c,input,kind,dryTarget,delayTarget,reverbTarget);const low=v07Filter(c,'lowshelf',180,v07Val('#vocalLow',0)),mid=v07Filter(c,'peaking',1200,v07Val('#vocalMid',0),.9),high=v07Filter(c,'highshelf',6500,v07Val('#vocalHigh',0));input.connect(low);low.connect(mid);mid.connect(high);const de=v08AddDeEsser(c,high),comp=c.createDynamicsCompressor();de.connect(comp);const amount=v07Val('#vocalComp',.35);comp.threshold.value=-12-amount*30;comp.knee.value=18;comp.ratio.value=2+amount*8;comp.attack.value=.006;comp.release.value=.22;const analyser=c.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.76;comp.connect(analyser);analyser.connect(dryTarget);const delaySend=c.createGain(),reverbSend=c.createGain();delaySend.gain.value=v07Val('#vocalDelaySend',.15);reverbSend.gain.value=v07Val('#vocalReverbSend',.22);analyser.connect(delaySend);delaySend.connect(delayTarget);analyser.connect(reverbSend);reverbSend.connect(reverbTarget);return{low,mid,high,comp,analyser,delaySend,reverbSend,deEsser:de}};
const v08OfflinePrev=v07OfflineChain;
v07OfflineChain=function(c,input,kind,dryTarget,delayTarget,reverbTarget){if(kind!=='vocal')return v08OfflinePrev(c,input,kind,dryTarget,delayTarget,reverbTarget);const low=v07Filter(c,'lowshelf',180,v07Val('#vocalLow',0)),mid=v07Filter(c,'peaking',1200,v07Val('#vocalMid',0),.9),high=v07Filter(c,'highshelf',6500,v07Val('#vocalHigh',0));input.connect(low);low.connect(mid);mid.connect(high);const de=v08AddDeEsser(c,high),comp=c.createDynamicsCompressor(),a=v07Val('#vocalComp',.35);de.connect(comp);comp.threshold.value=-12-a*30;comp.knee.value=18;comp.ratio.value=2+a*8;comp.attack.value=.006;comp.release.value=.22;const ds=c.createGain(),rs=c.createGain();ds.gain.value=v07Val('#vocalDelaySend',.15);rs.gain.value=v07Val('#vocalReverbSend',.22);comp.connect(ds);ds.connect(delayTarget);comp.connect(rs);rs.connect(reverbTarget);comp.connect(dryTarget);return comp};
const scheduleTakeInContextV7=scheduleTakeInContext;
scheduleTakeInContext=function(t,baseTime,output=vocalGain,c=ctx){if(!t.buffer||!takeAudible(t)||muted.vocal)return;const original=t.buffer;try{t.buffer=v08GateBuffer(original,c);scheduleTakeInContextV7(t,baseTime,output,c)}finally{t.buffer=original}};
const projectObjectV7=projectObject;
projectObject=function(){const p=projectObjectV7();p.version=8;p.vocalProduction={key:$('#songKey')?.value||'C',scale:$('#songScale')?.value||'major',preset:$('#vocalPreset')?.value||'custom',gate:v07Val('#vocalGate',-48),deEsser:v07Val('#vocalDeEsser',.25)};return p};
const loadProjectObjectV7=loadProjectObject;
loadProjectObject=function(p){loadProjectObjectV7(p);const v=p?.vocalProduction||{};if($('#songKey')&&v.key)$('#songKey').value=v.key;if($('#songScale')&&v.scale)$('#songScale').value=v.scale;if($('#vocalPreset')&&v.preset)$('#vocalPreset').value=v.preset;setControl('#vocalGate',v.gate);setControl('#vocalDeEsser',v.deEsser);v08UpdateLabels()};
$('#applyVocalPreset').onclick=()=>v08Preset($('#vocalPreset').value);$('#analyzePitch').onclick=v08AnalyzeTake;['#vocalGate','#vocalDeEsser'].forEach(id=>{const e=$(id);if(e)e.oninput=()=>{v08UpdateLabels();if(v07Ready){v07Ready=false;try{v07RewireLive()}catch{}}}});['#songKey','#songScale'].forEach(id=>{const e=$(id);if(e)e.onchange=()=>{if($('#pitchNote').textContent!=='—')v08AnalyzeTake()}});
const exportWavV7=exportWav;
exportWav=async function(){await exportWavV7();statusEl.textContent='v0.8 vocal production mix exported'};$('#exportWav').onclick=exportWav;v08UpdateLabels();const storedV8=localStorage.getItem('royceStudioProject');if(storedV8){try{const p=JSON.parse(storedV8);if(p.version>=8)loadProjectObject(p)}catch(e){console.warn(e)}}


// ===== Royce Studio v0.9 scale-aware tuning, doubling, harmony + comping =====
let v09CompEnabled=false;
function v09ExactMidi(freq){return 69+12*Math.log2(freq/440)}
function v09ScalePcs(){const root=v08Notes.indexOf($('#songKey')?.value||'C');return (v08Scales[$('#songScale')?.value||'major']||v08Scales.major).map(x=>(root+x)%12)}
function v09NearestScaleMidi(exactMidi){if(!isFinite(exactMidi))return Math.round(exactMidi||69);const pcs=v09ScalePcs();let best=Math.round(exactMidi),dist=1e9;for(let m=Math.floor(exactMidi)-12;m<=Math.ceil(exactMidi)+12;m++){if(!pcs.includes((m%12+12)%12))continue;const d=Math.abs(m-exactMidi);if(d<dist){dist=d;best=m}}return best}
function v09PitchInfo(t){if(!t?.buffer)return null;if(t._v09Pitch&&t._v09Pitch.key===($('#songKey')?.value||'C')&&t._v09Pitch.scale===($('#songScale')?.value||'major'))return t._v09Pitch;const freq=v08Autocorrelate(t.buffer.getChannelData(0),t.buffer.sampleRate);if(!freq)return null;const exact=v09ExactMidi(freq),target=v09NearestScaleMidi(exact);return t._v09Pitch={freq,exact,target,key:$('#songKey')?.value||'C',scale:$('#songScale')?.value||'major'}}
function v09CorrectionCents(t){const p=v09PitchInfo(t);if(!p)return 0;return (p.target-p.exact)*100*v07Val('#tuneAmount',.65)}
function v09HarmonySemitones(t,mode){if(mode==='octave')return 12;if(mode==='off')return 0;const p=v09PitchInfo(t),start=p?.target??60,pcs=v09ScalePcs();const steps=mode==='third'?2:4;let count=0,m=start;while(count<steps&&m<start+24){m++;if(pcs.includes((m%12+12)%12))count++}return m-start}
function v09AnyComp(){return vocalTakes.some(t=>t.comp&&t.buffer)}
const takeAudibleV8=takeAudible;
takeAudible=function(t){if(!takeAudibleV8(t))return false;if(v09CompEnabled&&v09AnyComp())return !!t.comp;return true};
function v09ConnectSource(c,src,output,gainValue=1,panValue=0){const g=c.createGain();g.gain.value=gainValue;if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=panValue;src.connect(g);g.connect(p);p.connect(output)}else{src.connect(g);g.connect(output)}return g}
function v09StartVariant(c,t,output,when,sourceOffset,duration,detune=0,gain=1,pan=0,delay=0){if(duration<=0)return;const src=c.createBufferSource();src.buffer=t.buffer;if(src.detune)src.detune.value=v07Val('#vocalPitch',0)+detune;v09ConnectSource(c,src,output,gain,pan);src.start(when+delay,sourceOffset,duration);if(c===ctx)activeTakeSources.push(src)}
scheduleTakeInContext=function(t,baseTime,output=vocalGain,c=ctx){
  if(!t.buffer||!takeAudible(t)||muted.vocal)return;const original=t.buffer;let gated=original;try{gated=v08GateBuffer(original,c)}catch{}t.buffer=gated;
  const clipStart=Math.max(0,t.start||0),clipDur=Math.max(0,gated.duration-(t.trimStart||0)-(t.trimEnd||0)),clipEnd=clipStart+clipDur;if(clipDur<=0){t.buffer=original;return}
  const corr=v09CorrectionCents({...t,buffer:original}),doubleMix=v07Val('#doubleMix',0),hMode=$('#harmonyMode')?.value||'off',hMix=v07Val('#harmonyMix',0),hSemi=v09HarmonySemitones({...t,buffer:original},hMode);
  enabledVocalIntervals().forEach(([a,b])=>{const from=Math.max(a,clipStart),to=Math.min(b,clipEnd);if(to<=from)return;const sourceOffset=(t.trimStart||0)+(from-clipStart),duration=to-from,when=baseTime+from;v09StartVariant(c,t,output,when,sourceOffset,duration,corr,1,0,0);if(doubleMix>0){v09StartVariant(c,t,output,when,sourceOffset,duration,corr-8,doubleMix*.72,-.32,.014);v09StartVariant(c,t,output,when,sourceOffset,duration,corr+8,doubleMix*.72,.32,.022)}if(hMode!=='off'&&hMix>0)v09StartVariant(c,t,output,when,sourceOffset,duration,corr+hSemi*100,hMix,.18,.008)});
  t.buffer=original;
};
const renderVocalTakesV8=renderVocalTakes;
renderVocalTakes=function(){renderVocalTakesV8();const rows=$$('#vocalTakes .vocal-take');rows.forEach((row,i)=>{const t=vocalTakes[i];if(!t?.buffer)return;const actions=row.querySelector('.take-actions');if(!actions)return;const b=document.createElement('button');b.textContent=t.comp?'Comp ✓':'Comp';b.className=t.comp?'comp-on':'';b.onclick=()=>{t.comp=!t.comp;renderVocalTakes();v09UpdateCompStatus()};actions.append(b);if(t.comp){const badge=document.createElement('span');badge.className='comp-badge';badge.textContent='ACTIVE COMP';row.querySelector('.take-top')?.append(badge)}});v09UpdateCompStatus()};
function v09UpdateLabels(){if($('#tuneAmountValue'))$('#tuneAmountValue').textContent=`${Math.round(v07Val('#tuneAmount',.65)*100)}%`;if($('#doubleMixValue'))$('#doubleMixValue').textContent=`${Math.round(v07Val('#doubleMix',0)*100)}%`;if($('#harmonyMixValue'))$('#harmonyMixValue').textContent=`${Math.round(v07Val('#harmonyMix',0)*100)}%`}
function v09UpdateCompStatus(){if($('#compMode')){$('#compMode').textContent=`Comp Mode: ${v09CompEnabled?'On':'Off'}`;$('#compMode').classList.toggle('on',v09CompEnabled)}const n=vocalTakes.filter(t=>t.comp&&t.buffer).length;if($('#compStatus'))$('#compStatus').textContent=v09CompEnabled?(n?`${n} comp take${n===1?'':'s'} selected. Only selected comp takes will play/export.`:'Comp mode is on; no takes selected yet, so all audible takes still play.'):`${n} take${n===1?'':'s'} marked for comp. Turn Comp Mode on to use only those takes.`}
const projectObjectV8=projectObject;
projectObject=function(){const p=projectObjectV8();p.version=9;p.vocalTuning={amount:v07Val('#tuneAmount',.65),double:v07Val('#doubleMix',0),harmony:$('#harmonyMode')?.value||'off',harmonyMix:v07Val('#harmonyMix',0),compMode:v09CompEnabled};if(Array.isArray(p.vocalTakes))p.vocalTakes=p.vocalTakes.map((x,i)=>({...x,comp:!!vocalTakes[i]?.comp}));return p};
const loadProjectObjectV8=loadProjectObject;
loadProjectObject=function(p){loadProjectObjectV8(p);const v=p?.vocalTuning||{};setControl('#tuneAmount',v.amount);setControl('#doubleMix',v.double);setControl('#harmonyMix',v.harmonyMix);if($('#harmonyMode')&&v.harmony)$('#harmonyMode').value=v.harmony;v09CompEnabled=!!v.compMode;if(Array.isArray(p?.vocalTakes))vocalTakes.forEach((t,i)=>t.comp=!!p.vocalTakes[i]?.comp);vocalTakes.forEach(t=>delete t._v09Pitch);v09UpdateLabels();renderVocalTakes();v09UpdateCompStatus()};
['#tuneAmount','#doubleMix','#harmonyMix'].forEach(id=>{const e=$(id);if(e)e.oninput=v09UpdateLabels});if($('#harmonyMode'))$('#harmonyMode').onchange=v09UpdateLabels;if($('#compMode'))$('#compMode').onclick=()=>{v09CompEnabled=!v09CompEnabled;v09UpdateCompStatus()};['#songKey','#songScale'].forEach(id=>{const e=$(id);if(e){const prev=e.onchange;e.onchange=()=>{vocalTakes.forEach(t=>delete t._v09Pitch);if(prev)prev();}}});
const exportWavV8=exportWav;
exportWav=async function(){await exportWavV8();statusEl.textContent='v0.9 tuned/comped vocal mix exported'};$('#exportWav').onclick=exportWav;
v09UpdateLabels();renderVocalTakes();v09UpdateCompStatus();
const storedV9=localStorage.getItem('royceStudioProject');if(storedV9){try{const p=JSON.parse(storedV9);if(p.version>=9)loadProjectObject(p)}catch(e){console.warn(e)}}

/* ===== v0.10 instrument expansion ===== */
let v10Last808Freq=null;
function v10NormVel(id,fallback=100){const el=$(id);return Math.max(.05,Math.min(1,(+(el?.value||fallback))/127))}
function v10Preset(id,fallback){return $(id)?.value||fallback}
function v10Env(c,g,now,peak,attack,release){g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),now+Math.max(.003,attack));g.gain.exponentialRampToValueAtTime(.0001,now+Math.max(attack+.01,release))}
function v10PlayKey(freq){const c=ensureAudio(),now=c.currentTime,p=v10Preset('#keyPreset','poly'),vel=v10NormVel('#keyVelocity',96);let type='sawtooth',attack=.012,release=.7,cut=2100,q=1.1,gain=.16;
  if(p==='pluck'){type='triangle';attack=.004;release=.25;cut=3200;gain=.18}
  if(p==='bell'){type='sine';attack=.005;release=1.3;cut=5000;gain=.15}
  if(p==='analog'){type='square';attack=.018;release=.65;cut=1500;gain=.12}
  if(p==='dreamPad'){type='sawtooth';attack=.28;release=2.1;cut=1450;gain=.11}
  if(p==='warmPad'){type='triangle';attack=.22;release=1.8;cut=1050;gain=.14}
  if(p==='darkPad'){type='sawtooth';attack=.34;release=2.4;cut=720;gain=.11}
  const f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.value=cut;f.Q.value=q;g.connect(master);f.connect(g);v10Env(c,g,now,gain*vel,attack,release);
  const detunes=(p.includes('Pad')||p==='analog')?[-7,0,7]:[0];detunes.forEach((d,i)=>{const o=c.createOscillator();o.type=type;o.frequency.value=freq;o.detune.value=d;o.connect(f);o.start(now);o.stop(now+release+.08)});
  if(p==='bell'){const o=c.createOscillator(),og=c.createGain();o.type='sine';o.frequency.value=freq*2.01;og.gain.setValueAtTime(.06*vel,now);og.gain.exponentialRampToValueAtTime(.0001,now+1);o.connect(og).connect(master);o.start(now);o.stop(now+1.05)}
}
function v10PlayBass(freq,force808=false){const c=ensureAudio(),now=c.currentTime,p=force808?'808':v10Preset('#bassPreset','sub'),vel=v10NormVel('#bassVelocity',110),rel=+($('#release808')?.value||.9);let type='sine',release=.7,cut=650,gain=.26;
  if(p==='808'){type='sine';release=rel;cut=900;gain=.34}
  if(p==='reese'){type='sawtooth';release=.75;cut=520;gain=.17}
  if(p==='analogBass'){type='square';release=.5;cut=760;gain=.16}
  const f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.value=cut;f.Q.value=p==='reese'?2.1:.8;f.connect(g).connect(master);v10Env(c,g,now,gain*vel,.008,release);
  const detunes=p==='reese'?[-12,12]:[0];detunes.forEach(d=>{const o=c.createOscillator();o.type=type;const glide=$('#glide808')?.classList.contains('on')&&v10Last808Freq&&p==='808';if(glide){o.frequency.setValueAtTime(v10Last808Freq,now);o.frequency.exponentialRampToValueAtTime(freq,now+.09)}else o.frequency.value=freq;o.detune.value=d;o.connect(f);o.start(now);o.stop(now+release+.08)});
  if(p==='808'){const click=c.createOscillator(),cg=c.createGain();click.type='sine';click.frequency.setValueAtTime(freq*3,now);click.frequency.exponentialRampToValueAtTime(freq,now+.045);cg.gain.setValueAtTime(.09*vel,now);cg.gain.exponentialRampToValueAtTime(.0001,now+.06);click.connect(cg).connect(master);click.start(now);click.stop(now+.07);v10Last808Freq=freq}
}
function v10DrumKit(){return v10Preset('#drumKit','studio')}
function v10Kick(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const kit=v10DrumKit(),vel=v10NormVel('#drumVelocity',100),o=c.createOscillator(),g=c.createGain();o.type=kit==='lofi'?'triangle':'sine';const start=kit==='trap'?190:kit==='punch'?175:145,end=kit==='trap'?42:kit==='lofi'?58:48,dur=kit==='punch'?.17:.24;o.frequency.setValueAtTime(start,time);o.frequency.exponentialRampToValueAtTime(end,time+.13);g.gain.setValueAtTime(1*vel,time);g.gain.exponentialRampToValueAtTime(.001,time+dur);o.connect(g).connect(out);o.start(time);o.stop(time+dur+.03)}
function v10Snare(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const kit=v10DrumKit(),vel=v10NormVel('#drumVelocity',100),src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=noiseBuffer(kit==='lofi'?.12:.2,c);f.type=kit==='trap'?'highpass':'bandpass';f.frequency.value=kit==='lofi'?1150:kit==='punch'?1850:1450;f.Q.value=.75;g.gain.setValueAtTime(.7*vel,time);g.gain.exponentialRampToValueAtTime(.001,time+(kit==='lofi'?.1:.17));src.connect(f).connect(g).connect(out);src.start(time)}
function v10Hat(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const kit=v10DrumKit(),vel=v10NormVel('#drumVelocity',100),src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=noiseBuffer(kit==='lofi'?.045:.07,c);f.type='highpass';f.frequency.value=kit==='lofi'?4300:kit==='trap'?7600:6500;g.gain.setValueAtTime((kit==='trap'?.3:.22)*vel,time);g.gain.exponentialRampToValueAtTime(.001,time+(kit==='trap'?.065:.05));src.connect(f).connect(g).connect(out);src.start(time)}
function v10Clap(time=ensureAudio().currentTime,out=drumGain,c=ensureAudio()){const kit=v10DrumKit(),vel=v10NormVel('#drumVelocity',100);(kit==='punch'?[0,.014,.028,.05]:[0,.018,.036]).forEach(off=>{const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=noiseBuffer(.09,c);f.type='bandpass';f.frequency.value=kit==='lofi'?1200:1650;g.gain.setValueAtTime(.38*vel,time+off);g.gain.exponentialRampToValueAtTime(.001,time+off+.085);src.connect(f).connect(g).connect(out);src.start(time+off)})}
drumFns.kick=v10Kick;drumFns.snare=v10Snare;drumFns.hat=v10Hat;drumFns.clap=v10Clap;
function v10RebuildKeys(){const el=$('#piano');if(!el)return;el.innerHTML='';noteMap.forEach(([n,f])=>{const b=document.createElement('button');b.className='key';b.textContent=n;b.onpointerdown=()=>{b.classList.add('down');v10PlayKey(f)};b.onpointerup=()=>b.classList.remove('down');b.onpointerleave=()=>b.classList.remove('down');el.append(b)})}
function v10RebuildBass(){const el=$('#bassKeys');if(!el)return;el.innerHTML='';bassMap.forEach(([n,f])=>{const b=document.createElement('button');b.className='bass-key';b.textContent=n;b.onpointerdown=()=>v10PlayBass(f);el.append(b)});const pads=$('#pads808');if(pads){pads.innerHTML='';bassMap.slice(0,8).forEach(([n,f])=>{const b=document.createElement('button');b.className='pad808';b.innerHTML=`<span>${n}<small>808</small></span>`;b.onpointerdown=()=>{b.classList.add('hit');v10PlayBass(f,true)};b.onpointerup=()=>b.classList.remove('hit');b.onpointerleave=()=>b.classList.remove('hit');pads.append(b)})}}
function v10Labels(){if($('#drumVelocityValue'))$('#drumVelocityValue').textContent=$('#drumVelocity').value;if($('#keyVelocityValue'))$('#keyVelocityValue').textContent=$('#keyVelocity').value;if($('#bassVelocityValue'))$('#bassVelocityValue').textContent=$('#bassVelocity').value;if($('#release808Value'))$('#release808Value').textContent=`${(+$('#release808').value).toFixed(2)}s`}
['#drumVelocity','#keyVelocity','#bassVelocity','#release808'].forEach(id=>{if($(id))$(id).oninput=v10Labels});if($('#glide808'))$('#glide808').onclick=()=>{$('#glide808').classList.toggle('on');$('#glide808').textContent=$('#glide808').classList.contains('on')?'On':'Off'};
const projectObjectV9=projectObject;
projectObject=function(){const p=projectObjectV9();p.version=10;p.instruments={drumKit:v10Preset('#drumKit','studio'),drumVelocity:+($('#drumVelocity')?.value||100),keyPreset:v10Preset('#keyPreset','poly'),keyVelocity:+($('#keyVelocity')?.value||96),bassPreset:v10Preset('#bassPreset','sub'),bassVelocity:+($('#bassVelocity')?.value||110),release808:+($('#release808')?.value||.9),glide808:!!$('#glide808')?.classList.contains('on')};return p};
const loadProjectObjectV9=loadProjectObject;
loadProjectObject=function(p){loadProjectObjectV9(p);const x=p?.instruments||{};if($('#drumKit')&&x.drumKit)$('#drumKit').value=x.drumKit;if($('#keyPreset')&&x.keyPreset)$('#keyPreset').value=x.keyPreset;if($('#bassPreset')&&x.bassPreset)$('#bassPreset').value=x.bassPreset;setControl('#drumVelocity',x.drumVelocity);setControl('#keyVelocity',x.keyVelocity);setControl('#bassVelocity',x.bassVelocity);setControl('#release808',x.release808);if($('#glide808')){$('#glide808').classList.toggle('on',!!x.glide808);$('#glide808').textContent=x.glide808?'On':'Off'}v10Labels()};
v10RebuildKeys();v10RebuildBass();v10Labels();
const storedV10=localStorage.getItem('royceStudioProject');if(storedV10){try{const p=JSON.parse(storedV10);if(p.version>=10)loadProjectObject(p)}catch(e){console.warn(e)}}


// ===== Royce Studio v0.11 non-destructive timeline editor =====
let v11Undo=[],v11Redo=[],v11Selected=null,v11Clipboard=null,v11Zoom=1;
function v11CloneTrack(t){return {...t}}
function v11Snapshot(){return {audio:audioTracks.map(v11CloneTrack),vocal:vocalTakes.map(v11CloneTrack),arr:arrangementSections.map(x=>({...x})),selected:v11Selected?{...v11Selected}:null}}
function v11PushHistory(label='Edit'){v11Undo.push(v11Snapshot());if(v11Undo.length>50)v11Undo.shift();v11Redo=[];v11HistoryUI();const s=$('#editorStatus');if(s)s.textContent=`${label} · Undo available`}
function v11Restore(s){audioTracks=s.audio.map(v11CloneTrack);vocalTakes=s.vocal.map(v11CloneTrack);arrangementSections=s.arr.map(x=>({...x}));v11Selected=s.selected?{...s.selected}:null;syncLegacyLoop();renderArrangement();renderAudioTracks();renderVocalTakes();v11Decorate();}
function v11UndoEdit(){if(!v11Undo.length)return;v11Redo.push(v11Snapshot());v11Restore(v11Undo.pop());v11HistoryUI();$('#editorStatus').textContent='Undo'}
function v11RedoEdit(){if(!v11Redo.length)return;v11Undo.push(v11Snapshot());v11Restore(v11Redo.pop());v11HistoryUI();$('#editorStatus').textContent='Redo'}
function v11HistoryUI(){if($('#undoEdit'))$('#undoEdit').disabled=!v11Undo.length;if($('#redoEdit'))$('#redoEdit').disabled=!v11Redo.length;if($('#copyClip'))$('#copyClip').disabled=!v11Selected;if($('#pasteClip'))$('#pasteClip').disabled=!v11Clipboard}
function v11GridSeconds(){const g=+($('#snapGrid')?.value||0);if(!g)return 0;if(g===1)return barDuration();if(g===4)return 60/currentBpm();return stepDuration()}
function v11Snap(sec){const g=v11GridSeconds();return g?Math.max(0,Math.round(sec/g)*g):Math.max(0,sec)}
function v11Collection(type){return type==='audio'?audioTracks:vocalTakes}
function v11GetSelected(){if(!v11Selected)return null;const a=v11Collection(v11Selected.type);return a.find(x=>String(x.id)===String(v11Selected.id))||null}
function v11Select(type,id){v11Selected={type,id};v11Decorate();v11HistoryUI();const t=v11GetSelected();if($('#editorStatus'))$('#editorStatus').textContent=t?`Selected ${type}: ${t.name}`:'No clip selected'}
function v11Copy(){const t=v11GetSelected();if(!t)return;v11Clipboard={type:v11Selected.type,track:v11CloneTrack(t)};v11HistoryUI();$('#editorStatus').textContent=`Copied ${t.name}`}
async function v11Paste(){if(!v11Clipboard)return;v11PushHistory('Paste clip');const type=v11Clipboard.type,t=v11CloneTrack(v11Clipboard.track);t.id=Date.now()+Math.random();t.name=(t.name||'Clip')+' Copy';t.start=v11Snap((+t.start||0)+barDuration());v11Collection(type).push(t);if(t.blob){try{await dbPut(mediaKey(type==='audio'?'audio':'vocal',t.id),t.blob)}catch(e){console.warn(e)}}v11Selected={type,id:t.id};syncLegacyLoop();renderAudioTracks();renderVocalTakes();v11Decorate();v11HistoryUI()}
function v11Split(type,id){const a=v11Collection(type),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return;const t=a[i];if(!t.buffer)return;const full=type==='audio'?trackDuration(t):takeUsableDuration(t);if(full<.12)return;v11PushHistory('Split clip');const split=full/2,left=v11CloneTrack(t),right=v11CloneTrack(t);left.id=Date.now()+Math.random();right.id=Date.now()+Math.random()+1;left.name=t.name+' A';right.name=t.name+' B';
  if(type==='audio'){left.trimEnd=(+t.trimEnd||0)+(full-split);right.trimStart=(+t.trimStart||0)+split;right.start=v11Snap((+t.start||0)+split)}
  else{left.trimEnd=(+t.trimEnd||0)+(full-split);right.trimStart=(+t.trimStart||0)+split;right.start=v11Snap((+t.start||0)+split)}
  a.splice(i,1,left,right);v11Selected={type,id:right.id};if(type==='audio')renderAudioTracks();else renderVocalTakes();v11Decorate();}
function v11Move(type,id,delta){const t=v11Collection(type).find(x=>String(x.id)===String(id));if(!t)return;v11PushHistory('Move clip');t.start=v11Snap((+t.start||0)+delta);if(type==='audio')renderAudioTracks();else renderVocalTakes();v11Decorate()}
function v11Nudge(type,id,dir){v11Move(type,id,dir*(v11GridSeconds()||stepDuration()))}
function v11AddActions(row,type,t){if(row.querySelector('.clip-edit-actions'))return;row.dataset.v11id=t.id;row.dataset.v11type=type;row.onclick=e=>{if(e.target.closest('button,input,select,label'))return;v11Select(type,t.id)};const box=document.createElement('div');box.className='clip-edit-actions';box.innerHTML=`<button data-v11="select">Select</button><button data-v11="split">Split ½</button><button data-v11="nudgeL">◀ Grid</button><button data-v11="nudgeR">Grid ▶</button>`;box.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=b.dataset.v11;if(a==='select')v11Select(type,t.id);if(a==='split')v11Split(type,t.id);if(a==='nudgeL')v11Nudge(type,t.id,-1);if(a==='nudgeR')v11Nudge(type,t.id,1)});row.append(box)}
function v11Decorate(){document.querySelectorAll('.audio-track-row').forEach((row,i)=>{const t=audioTracks[i];if(!t)return;v11AddActions(row,'audio',t);row.classList.toggle('clip-selected',!!v11Selected&&v11Selected.type==='audio'&&String(v11Selected.id)===String(t.id))});document.querySelectorAll('#vocalTakes .vocal-take').forEach((row,i)=>{const t=vocalTakes[i];if(!t)return;v11AddActions(row,'vocal',t);row.classList.toggle('clip-selected',!!v11Selected&&v11Selected.type==='vocal'&&String(v11Selected.id)===String(t.id))});document.querySelectorAll('.take-lane,.arrangement-strip').forEach(el=>{el.style.minWidth=`${100*v11Zoom}%`});v11HistoryUI()}
const v11RenderAudio=renderAudioTracks;renderAudioTracks=function(){v11RenderAudio();requestAnimationFrame(v11Decorate)};
const v11RenderVocal=renderVocalTakes;renderVocalTakes=function(){v11RenderVocal();requestAnimationFrame(v11Decorate)};
const v11ProjectObject=projectObject;projectObject=function(){const p=v11ProjectObject();p.version=11;p.editor={zoom:v11Zoom,snap:$('#snapGrid')?.value||'4'};return p};
const v11LoadProject=loadProjectObject;loadProjectObject=function(p){v11LoadProject(p);const e=p?.editor||{};v11Zoom=Math.max(1,Math.min(4,+e.zoom||1));if($('#timelineZoom'))$('#timelineZoom').value=v11Zoom;if($('#snapGrid')&&e.snap!=null)$('#snapGrid').value=String(e.snap);if($('#zoomValue'))$('#zoomValue').textContent=`${Math.round(v11Zoom*100)}%`;v11Undo=[];v11Redo=[];v11Selected=null;v11Clipboard=null;requestAnimationFrame(v11Decorate)};
if($('#undoEdit'))$('#undoEdit').onclick=v11UndoEdit;if($('#redoEdit'))$('#redoEdit').onclick=v11RedoEdit;if($('#copyClip'))$('#copyClip').onclick=v11Copy;if($('#pasteClip'))$('#pasteClip').onclick=v11Paste;if($('#timelineZoom'))$('#timelineZoom').oninput=e=>{v11Zoom=+e.target.value||1;$('#zoomValue').textContent=`${Math.round(v11Zoom*100)}%`;v11Decorate()};if($('#snapGrid'))$('#snapGrid').onchange=()=>{$('#editorStatus').textContent=`Snap: ${$('#snapGrid').selectedOptions[0].textContent}`};
// Capture a pre-edit state for direct numeric/range/name edits so Undo also works for ordinary clip controls.
document.addEventListener('pointerdown',e=>{const row=e.target.closest?.('.audio-track-row,.vocal-take');if(row&&e.target.matches('input,select'))v11PushHistory('Clip parameter edit')},{capture:true});
// Keyboard shortcuts also work when a hardware keyboard is attached to iPhone/iPad/Mac.
document.addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey))return;if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?v11RedoEdit():v11UndoEdit()}if(e.key.toLowerCase()==='c'&&v11Selected){e.preventDefault();v11Copy()}if(e.key.toLowerCase()==='v'&&v11Clipboard){e.preventDefault();v11Paste()}});
v11HistoryUI();v11Decorate();


// ===== Royce Studio v0.12 final mixing + mastering =====
function v12CompSettings(kind){const amount=v07Val(kind==='drums'?'#drumsComp':kind==='loop'?'#loopComp':'#vocalComp',kind==='vocal'?.35:.2);return{amount,threshold:-10-amount*28,ratio:1.5+amount*7.5,knee:16-amount*8,attack:kind==='drums'?.008:.012,release:kind==='vocal'?.2:.13}}
function v12MakeComp(c,kind){const x=v12CompSettings(kind),comp=c.createDynamicsCompressor();comp.threshold.value=x.threshold;comp.ratio.value=x.ratio;comp.knee.value=x.knee;comp.attack.value=x.attack;comp.release.value=x.release;return comp}
function v12TrackChain(c,input,kind,dryTarget,delayTarget,reverbTarget){
  const low=v07Filter(c,'lowshelf',180,v07Val(`#${kind}Low`,0)),mid=v07Filter(c,'peaking',1200,v07Val(`#${kind}Mid`,0),.9),high=v07Filter(c,'highshelf',6500,v07Val(`#${kind}High`,0));
  const comp=v12MakeComp(c,kind),analyser=c.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.76;input.connect(low);low.connect(mid);mid.connect(high);high.connect(comp);comp.connect(analyser);analyser.connect(dryTarget);let delaySend=null,reverbSend=null;if(kind==='vocal'){delaySend=c.createGain();reverbSend=c.createGain();delaySend.gain.value=v07Val('#vocalDelaySend',.15);reverbSend.gain.value=v07Val('#vocalReverbSend',.22);analyser.connect(delaySend);delaySend.connect(delayTarget);analyser.connect(reverbSend);reverbSend.connect(reverbTarget)}return{low,mid,high,comp,analyser,delaySend,reverbSend};
}
function v12WidthNode(c,input,output,width=1){const split=c.createChannelSplitter(2),merge=c.createChannelMerger(2),ll=c.createGain(),lr=c.createGain(),rr=c.createGain(),rl=c.createGain();const same=(1+width)/2,cross=(1-width)/2;ll.gain.value=same;rr.gain.value=same;lr.gain.value=cross;rl.gain.value=cross;input.connect(split);split.connect(ll,0);split.connect(rl,0);split.connect(lr,1);split.connect(rr,1);ll.connect(merge,0,0);lr.connect(merge,0,0);rl.connect(merge,0,1);rr.connect(merge,0,1);merge.connect(output);return{ll,lr,rr,rl,set(w){const s=(1+w)/2,x=(1-w)/2;ll.gain.value=s;rr.gain.value=s;lr.gain.value=x;rl.gain.value=x}}}
function v12Curve(amount){const n=1024,a=Math.max(0,amount)*35,curve=new Float32Array(n);for(let i=0;i<n;i++){const x=i*2/(n-1)-1;curve[i]=a?Math.tanh((1+a*.12)*x)/Math.tanh(1+a*.12):x}return curve}
function v12BuildMaster(c,input,destination,withAnalyser=false){const hp=c.createBiquadFilter(),low=c.createBiquadFilter(),high=c.createBiquadFilter(),drive=c.createWaveShaper(),comp=c.createDynamicsCompressor(),widthIn=c.createGain(),limiter=c.createDynamicsCompressor(),an=withAnalyser?c.createAnalyser():null;hp.type='highpass';hp.frequency.value=25;hp.Q.value=.7;low.type='lowshelf';low.frequency.value=120;low.gain.value=v07Val('#masterLow',0);high.type='highshelf';high.frequency.value=8500;high.gain.value=v07Val('#masterHigh',0);drive.curve=v12Curve(v07Val('#masterDrive',0));drive.oversample='2x';const amt=v07Val('#masterComp',.28);comp.threshold.value=-8-amt*20;comp.ratio.value=1.4+amt*4;comp.knee.value=12;comp.attack.value=.02;comp.release.value=.18;limiter.threshold.value=v07Val('#limiterThreshold',-1);limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.08;input.connect(hp);hp.connect(low);low.connect(high);high.connect(drive);drive.connect(comp);comp.connect(widthIn);const width=v12WidthNode(c,widthIn,limiter,v07Val('#masterWidth',1));if(an){an.fftSize=256;an.smoothingTimeConstant=.78;limiter.connect(an);an.connect(destination)}else limiter.connect(destination);return{hp,low,high,drive,comp,width,limiter,analyser:an}}

// Replace the live v0.7 wiring before audio is first armed.
v07TrackChain=v12TrackChain;
v07RewireLive=function(){if(!ctx||v07Ready)return;try{drumGain.disconnect();loopGain.disconnect();vocalGain.disconnect();master.disconnect()}catch(e){}const drums=v12TrackChain(ctx,drumGain,'drums',dryBus,delayBus,reverbBus),loop=v12TrackChain(ctx,loopGain,'loop',dryBus,delayBus,reverbBus),vocal=v12TrackChain(ctx,vocalGain,'vocal',dryBus,delayBus,reverbBus);const chain=v12BuildMaster(ctx,master,ctx.destination,true);chain.analyser.connect(recordDestination);v07Nodes={drums,loop,vocal,limiter:chain.limiter,masterAnalyser:chain.analyser,v12Master:chain};v07Ready=true;v12UpdateMixer();v07StartMeters()};
function v12Db(v){return `${(+v).toFixed((+v)%1?1:0)} dB`}
function v12UpdateLabels(){if($('#drumsCompValue'))$('#drumsCompValue').textContent=`${Math.round(v07Val('#drumsComp',.22)*100)}%`;if($('#loopCompValue'))$('#loopCompValue').textContent=`${Math.round(v07Val('#loopComp',.16)*100)}%`;if($('#masterCompValue'))$('#masterCompValue').textContent=`${Math.round(v07Val('#masterComp',.28)*100)}%`;if($('#masterWidthValue'))$('#masterWidthValue').textContent=`${Math.round(v07Val('#masterWidth',1)*100)}%`;if($('#masterLowValue'))$('#masterLowValue').textContent=v12Db(v07Val('#masterLow',0));if($('#masterHighValue'))$('#masterHighValue').textContent=v12Db(v07Val('#masterHigh',0));if($('#masterDriveValue'))$('#masterDriveValue').textContent=`${Math.round(v07Val('#masterDrive',0)*100)}%`}
function v12SetComp(node,kind){if(!node)return;const x=v12CompSettings(kind);node.threshold.value=x.threshold;node.ratio.value=x.ratio;node.knee.value=x.knee;node.attack.value=x.attack;node.release.value=x.release}
function v12UpdateMixer(){v07UpdateMixer();v12UpdateLabels();if(!v07Nodes)return;v12SetComp(v07Nodes.drums?.comp,'drums');v12SetComp(v07Nodes.loop?.comp,'loop');v12SetComp(v07Nodes.vocal?.comp,'vocal');const m=v07Nodes.v12Master;if(m){m.low.gain.value=v07Val('#masterLow',0);m.high.gain.value=v07Val('#masterHigh',0);m.drive.curve=v12Curve(v07Val('#masterDrive',0));const a=v07Val('#masterComp',.28);m.comp.threshold.value=-8-a*20;m.comp.ratio.value=1.4+a*4;m.width.set(v07Val('#masterWidth',1));m.limiter.threshold.value=v07Val('#limiterThreshold',-1)}}
updateMixer=v12UpdateMixer;
const projectObjectV11=projectObject;projectObject=function(){const p=projectObjectV11();p.version=12;p.mastering={drumsComp:v07Val('#drumsComp',.22),loopComp:v07Val('#loopComp',.16),masterComp:v07Val('#masterComp',.28),width:v07Val('#masterWidth',1),low:v07Val('#masterLow',0),high:v07Val('#masterHigh',0),drive:v07Val('#masterDrive',0),loudness:+($('#loudnessTarget')?.value||-11)};return p};
const loadProjectObjectV11=loadProjectObject;loadProjectObject=function(p){loadProjectObjectV11(p);const m=p?.mastering||{};[['#drumsComp',m.drumsComp],['#loopComp',m.loopComp],['#masterComp',m.masterComp],['#masterWidth',m.width],['#masterLow',m.low],['#masterHigh',m.high],['#masterDrive',m.drive]].forEach(([id,v])=>setControl(id,v));if($('#loudnessTarget')&&m.loudness!=null)$('#loudnessTarget').value=String(m.loudness);v12UpdateMixer()};
function v12OfflineTrack(c,input,kind,dryTarget,delayTarget,reverbTarget){return v12TrackChain(c,input,kind,dryTarget,delayTarget,reverbTarget)}
function v12Stats(buffer){let peak=0,sum=0,n=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>peak)peak=a;sum+=d[i]*d[i];n++}}const rms=Math.sqrt(sum/Math.max(1,n));return{peak,peakDb:20*Math.log10(Math.max(1e-9,peak)),rms,rmsDb:20*Math.log10(Math.max(1e-9,rms))}}
function v12Normalize(buffer,targetDb,ceilingDb){const st=v12Stats(buffer),ceiling=Math.pow(10,ceilingDb/20),target=Math.pow(10,targetDb/20);let gain=target/Math.max(1e-9,st.rms);gain=Math.min(gain,Math.pow(10,12/20));if(st.peak*gain>ceiling)gain=ceiling/Math.max(st.peak,1e-9);for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]*=gain}return{before:st,after:v12Stats(buffer),gainDb:20*Math.log10(Math.max(1e-9,gain))}}
exportWav=async function(){statusEl.textContent='Rendering v0.12 mastered mix…';const sr=44100,dur=Math.max(.1,sessionSeconds()),off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr),dry=off.createGain(),dBus=off.createGain(),rBus=off.createGain(),masterIn=off.createGain();masterIn.gain.value=+$('#masterVol').value;dry.connect(masterIn);const dNode=off.createDelay(1),dFb=off.createGain(),dWet=off.createGain();dNode.delayTime.value=.24;dFb.gain.value=.28;dWet.gain.value=+$('#delayMix').value;dBus.connect(dNode);dNode.connect(dWet);dWet.connect(masterIn);dNode.connect(dFb);dFb.connect(dNode);const rv=off.createConvolver(),rvWet=off.createGain();rv.buffer=makeImpulse(off);rvWet.gain.value=+$('#reverbMix').value;rBus.connect(rv);rv.connect(rvWet);rvWet.connect(masterIn);v12BuildMaster(off,masterIn,off.destination,false);const dg=off.createGain(),lg=off.createGain(),vg=off.createGain();dg.gain.value=muted.drums?0:+$('#drumsVol').value;lg.gain.value=muted.loop?0:+$('#loopVol').value;vg.gain.value=muted.vocal?0:+$('#vocalVol').value;v12OfflineTrack(off,dg,'drums',dry,dBus,rBus);v12OfflineTrack(off,lg,'loop',dry,dBus,rBus);v12OfflineTrack(off,vg,'vocal',dry,dBus,rBus);let barOffset=0;for(const sec of arrangementSections){const bars=Math.max(1,+sec.bars||1),secStart=barOffset*barDuration();if(sec.drums&&!muted.drums){for(let bar=0;bar<bars;bar++)for(let step=0;step<16;step++){const t=secStart+(bar*16+step)*stepDuration();Object.keys(pattern).forEach(name=>{if(pattern[name][step])drumFns[name](t,dg,off)})}}barOffset+=bars}audioTracks.forEach(t=>scheduleAudioTrack(t,0,lg,off));if(!muted.vocal)vocalTakes.forEach(t=>scheduleTakeInContext(t,0,vg,off));const rendered=await off.startRendering(),target=+($('#loudnessTarget')?.value||-11),ceiling=v07Val('#limiterThreshold',-1),norm=v12Normalize(rendered,target,ceiling);if($('#masterAnalysis'))$('#masterAnalysis').textContent=`Peak ${norm.after.peakDb.toFixed(1)} dB · RMS ${norm.after.rmsDb.toFixed(1)} dB · Gain ${norm.gainDb>=0?'+':''}${norm.gainDb.toFixed(1)} dB`;const p=projectObject(),safe=p.name.replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';downloadBlob(audioBufferToWav(rendered),`${safe}-royce-master.wav`);statusEl.textContent='Royce Studio 1.0.2 mastered WAV exported'};$('#exportWav').onclick=exportWav;
['#drumsComp','#loopComp','#masterComp','#masterWidth','#masterLow','#masterHigh','#masterDrive','#limiterThreshold'].forEach(id=>{const e=$(id);if(e)e.oninput=v12UpdateMixer});if($('#loudnessTarget'))$('#loudnessTarget').onchange=v12UpdateLabels;v12UpdateLabels();const storedV12=localStorage.getItem('royceStudioProject');if(storedV12){try{const p=JSON.parse(storedV12);if(p.version>=12)loadProjectObject(p)}catch(e){console.warn(e)}}


// ===== Royce Studio v0.13 mobile session / recovery layer =====
const V13_SNAPSHOT_KEY='royceStudioSnapshotsV13',V13_RECOVERY_KEY='royceStudioRecoveryV13';
let v13AutosaveTimer=null,v13LastRecovery=0;
function v13NowLabel(ts){try{return new Date(ts).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return 'Saved'}}
function v13Snapshots(){try{return JSON.parse(localStorage.getItem(V13_SNAPSHOT_KEY)||'[]')}catch{return []}}
function v13SetSnapshots(v){localStorage.setItem(V13_SNAPSHOT_KEY,JSON.stringify(v.slice(0,12)))}
function v13SnapshotProject(){const p=projectObject();return JSON.parse(JSON.stringify(p))}
function v13SaveSnapshot(){const p=v13SnapshotProject(),list=v13Snapshots(),entry={id:`snap_${Date.now()}`,name:p.name||'Untitled Royce Session',savedAt:Date.now(),project:p};list.unshift(entry);v13SetSnapshots(list);v13RenderProjects();const s=$('#mediaSaveStatus');if(s)s.textContent=`Snapshot saved: ${entry.name}`;}
function v13RenderProjects(){const host=$('#projectBrowser');if(!host)return;const list=v13Snapshots();host.innerHTML='';if(!list.length){host.innerHTML='<div class="project-browser-empty">No snapshots yet. Tap Save Snapshot to keep a named checkpoint.</div>';return}list.forEach(entry=>{const row=document.createElement('div');row.className='project-row';row.innerHTML=`<div class="project-row-main"><b>${escapeHtml(entry.name||'Untitled')}</b><small>${v13NowLabel(entry.savedAt)} · ${entry.project?.release?'Royce Studio '+entry.project.release:'schema v'+(entry.project?.version||'?')}</small></div><div class="project-row-actions"><button data-a="open">Open</button><button data-a="delete" class="danger-small">Delete</button></div>`;row.querySelector('[data-a="open"]').onclick=async()=>{loadProjectObject(entry.project);localStorage.setItem('royceStudioProject',JSON.stringify(entry.project));await restoreMediaForProject(entry.project);statusEl.textContent=`Opened snapshot: ${entry.name}`};row.querySelector('[data-a="delete"]').onclick=()=>{v13SetSnapshots(v13Snapshots().filter(x=>x.id!==entry.id));v13RenderProjects()};host.append(row)})}
function v13SaveRecovery(){try{const p=v13SnapshotProject();localStorage.setItem(V13_RECOVERY_KEY,JSON.stringify({savedAt:Date.now(),project:p}));v13LastRecovery=Date.now();const st=$('#recoveryStatus'),btn=$('#restoreRecovery');if(st)st.textContent=`Autosaved ${v13NowLabel(v13LastRecovery)}`;if(btn)btn.disabled=false}catch(e){console.warn('Autosave failed',e)}}
function v13ScheduleRecovery(){clearTimeout(v13AutosaveTimer);v13AutosaveTimer=setTimeout(v13SaveRecovery,900)}
function v13LoadRecoveryMeta(){try{const r=JSON.parse(localStorage.getItem(V13_RECOVERY_KEY)||'null');if(!r)return;const st=$('#recoveryStatus'),btn=$('#restoreRecovery');if(st)st.textContent=`Recovery point from ${v13NowLabel(r.savedAt)}`;if(btn)btn.disabled=false}catch{}}
async function v13RestoreRecovery(){try{const r=JSON.parse(localStorage.getItem(V13_RECOVERY_KEY)||'null');if(!r?.project)return;loadProjectObject(r.project);localStorage.setItem('royceStudioProject',JSON.stringify(r.project));await restoreMediaForProject(r.project);statusEl.textContent='Autosaved session restored';v13ScheduleRecovery()}catch(e){statusEl.textContent='Could not restore autosave';console.warn(e)}}
function v13MobileTab(name){const btn=document.querySelector(`.tab[data-tab="${name}"]`);if(btn){btn.click();btn.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}}
function v13BindMobile(){const play=$('#dockPlay'),stop=$('#dockStop'),rec=$('#dockRecord'),proj=$('#dockProject');if(play)play.onclick=()=>$('#playBtn')?.click();if(stop)stop.onclick=()=>$('#stopBtn')?.click();if(rec)rec.onclick=()=>$('#recordBtn')?.click();if(proj)proj.onclick=()=>v13MobileTab('project');if($('#saveSnapshot'))$('#saveSnapshot').onclick=v13SaveSnapshot;if($('#refreshProjects'))$('#refreshProjects').onclick=v13RenderProjects;if($('#restoreRecovery'))$('#restoreRecovery').onclick=v13RestoreRecovery;document.addEventListener('input',e=>{if(e.target.closest('.app'))v13ScheduleRecovery()},{passive:true});document.addEventListener('click',e=>{if(e.target.closest('.app'))v13ScheduleRecovery()},{passive:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')v13SaveRecovery()});window.addEventListener('pagehide',v13SaveRecovery)}
const projectObjectV12=projectObject;projectObject=function(){const p=projectObjectV12();p.version=13;p.ui={lastTab:document.querySelector('.tab.active')?.dataset.tab||'drums',mobile:true};return p};
const loadProjectObjectV12=loadProjectObject;loadProjectObject=function(p){loadProjectObjectV12(p);if(p?.ui?.lastTab)setTimeout(()=>v13MobileTab(p.ui.lastTab),0);v13ScheduleRecovery()};
const saveProjectV13Base=$('#saveProject')?.onclick;if($('#saveProject'))$('#saveProject').onclick=async()=>{if(saveProjectV13Base)await saveProjectV13Base();v13SaveRecovery()};
v13BindMobile();v13RenderProjects();v13LoadRecoveryMeta();v13ScheduleRecovery();

// ===== Royce Studio v1.0 release / onboarding / portable backup =====
const RS_RELEASE='1.0', RS_NEW_SESSION_KEY='royceStudioNewSessionNameV10';
function rsHideLaunch(){const el=$('#launchScreen');if(el)el.classList.add('hidden')}
function rsHasSession(){return !!localStorage.getItem('royceStudioProject') || !!localStorage.getItem(V13_RECOVERY_KEY)}
function rsPreferredProjectName(){try{return JSON.parse(localStorage.getItem('royceStudioProject')||'null')?.name||'Untitled Royce Session'}catch{return 'Untitled Royce Session'}}
async function rsResume(){
  const recovery=(()=>{try{return JSON.parse(localStorage.getItem(V13_RECOVERY_KEY)||'null')}catch{return null}})();
  if(recovery?.project){await v13RestoreRecovery()}
  rsHideLaunch();
  statusEl.textContent='Session ready';
}
function rsNewProject(){
  const name=($('#launchProjectName')?.value||'Untitled Royce Session').trim()||'Untitled Royce Session';
  localStorage.removeItem('royceStudioProject');
  localStorage.removeItem(V13_RECOVERY_KEY);
  sessionStorage.setItem(RS_NEW_SESSION_KEY,name);
  location.reload();
}
function rsLaunchInit(){
  const name=$('#launchProjectName'); if(name)name.value=rsPreferredProjectName();
  const resume=$('#launchResume'); if(resume){resume.disabled=!rsHasSession();resume.onclick=rsResume}
  const fresh=$('#launchNew'); if(fresh)fresh.onclick=rsNewProject;
  const open=$('#launchOpen'); if(open)open.onclick=rsHideLaunch;
  const newName=sessionStorage.getItem(RS_NEW_SESSION_KEY);
  if(newName){sessionStorage.removeItem(RS_NEW_SESSION_KEY);if($('#projectName'))$('#projectName').value=newName;rsHideLaunch();setTimeout(()=>{v13SaveRecovery();statusEl.textContent=`New project ready: ${newName}`},120)}
}
function rsDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)})}
async function rsDataUrlToBlob(url){const r=await fetch(url);return r.blob()}
async function rsExportPortableProject(){
  try{
    statusEl.textContent='Building portable project backup…';
    const project=projectObject();project.release=RS_RELEASE;
    const media=[];
    for(const t of audioTracks){let blob=t.blob; if(!blob)try{blob=await dbGet(mediaKey('audio',t.id))}catch{} if(blob)media.push({kind:'audio',id:t.id,type:blob.type||'application/octet-stream',data:await rsDataUrl(blob)})}
    for(const t of vocalTakes){let blob=t.blob; if(!blob)try{blob=await dbGet(mediaKey('vocal',t.id))}catch{} if(blob)media.push({kind:'vocal',id:t.id,type:blob.type||'application/octet-stream',data:await rsDataUrl(blob)})}
    const pack={format:'royce-studio-portable',release:RS_RELEASE,exportedAt:new Date().toISOString(),project,media};
    const safe=(project.name||'royce-session').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')||'royce-session';
    downloadBlob(new Blob([JSON.stringify(pack)],{type:'application/json'}),`${safe}.royce.json`);
    statusEl.textContent=`Portable project exported with ${media.length} media item${media.length===1?'':'s'}`;
  }catch(e){console.error(e);statusEl.textContent='Project backup export failed'}
}
async function rsImportPortableProject(file){
  try{
    statusEl.textContent='Importing project backup…';
    const raw=JSON.parse(await file.text());
    const project=raw?.format==='royce-studio-portable'?raw.project:raw;
    if(!project||typeof project!=='object')throw new Error('Invalid project');
    if(Array.isArray(raw?.media))for(const item of raw.media){if(!item?.kind||item.id==null||!item.data)continue;const blob=await rsDataUrlToBlob(item.data);await dbPut(mediaKey(item.kind,item.id),blob)}
    loadProjectObject(project);localStorage.setItem('royceStudioProject',JSON.stringify(project));await restoreMediaForProject(project);v13SaveRecovery();
    statusEl.textContent=raw?.format==='royce-studio-portable'?`Portable project imported (${raw.media?.length||0} media items)`:'Legacy project imported';
  }catch(e){console.error(e);statusEl.textContent='Invalid or unsupported project file'}
}
function rsDiagRow(label,value,state='ok'){return `<span><b>${label}</b><em class="diag-${state}">${value}</em></span>`}
async function rsRunDiagnostics(){
  const host=$('#diagnosticsList');if(!host)return;host.innerHTML='<span>Checking this browser…</span>';
  const rows=[];
  rows.push(rsDiagRow('Web Audio',window.AudioContext||window.webkitAudioContext?'Available':'Unavailable',window.AudioContext||window.webkitAudioContext?'ok':'bad'));
  rows.push(rsDiagRow('Microphone API',navigator.mediaDevices?.getUserMedia?'Available':'Unavailable',navigator.mediaDevices?.getUserMedia?'ok':'bad'));
  rows.push(rsDiagRow('Media Recorder',window.MediaRecorder?'Available':'Unavailable',window.MediaRecorder?'ok':'bad'));
  rows.push(rsDiagRow('Local Media Storage',window.indexedDB?'Available':'Unavailable',window.indexedDB?'ok':'bad'));
  rows.push(rsDiagRow('Secure Context',window.isSecureContext?'Yes':'No — mic may fail',window.isSecureContext?'ok':'warn'));
  let storage='Unknown',storageState='warn';try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();const used=Math.round((e.usage||0)/1048576),quota=Math.round((e.quota||0)/1048576);storage=`${used} MB used / ${quota} MB`;storageState='ok'}}catch{}
  rows.push(rsDiagRow('Browser Storage',storage,storageState));host.innerHTML=rows.join('');
}
const rsProjectObjectBase=projectObject;projectObject=function(){const p=rsProjectObjectBase();p.release=RS_RELEASE;return p};
if($('#downloadProject'))$('#downloadProject').onclick=rsExportPortableProject;
if($('#importProject'))$('#importProject').onchange=async e=>{const f=e.target.files?.[0];if(f)await rsImportPortableProject(f);e.target.value=''};
if($('#runDiagnostics'))$('#runDiagnostics').onclick=rsRunDiagnostics;
const rsExportBase=exportWav;exportWav=async function(){await rsExportBase()};if($('#exportWav'))$('#exportWav').onclick=exportWav;
rsLaunchInit();


// ===== Royce Studio v1.0.1 QA + stability patch =====
const RS_PATCH_RELEASE='1.0.4';
function rsTestRow(name,detail,state='ok'){
  return `<span>${escapeHtml(name)} <b class="diag-${state}">${escapeHtml(detail)}</b></span>`;
}
async function rsRunSelfTest(){
  const host=$('#selfTestList'); if(!host)return;
  const rows=[];
  const required=['#playBtn','#stopBtn','#recordBtn','#bpm','#sequencer','#piano','#bassKeys','#vocalTakes','#arrangement','#audioTracks','#mixer','#projectName','#exportWav'];
  const missing=required.filter(x=>!$(x));
  rows.push(rsTestRow('UI controls',missing.length?`${missing.length} missing`:'Pass',missing.length?'bad':'ok'));
  try{const key='royce-selftest';localStorage.setItem(key,'1');const ok=localStorage.getItem(key)==='1';localStorage.removeItem(key);rows.push(rsTestRow('Local storage',ok?'Pass':'Failed',ok?'ok':'bad'))}catch(e){rows.push(rsTestRow('Local storage','Blocked','bad'))}
  try{const p=projectObject();const clone=JSON.parse(JSON.stringify(p));rows.push(rsTestRow('Project serialization',clone&&clone.name!=null?'Pass':'Failed',clone&&clone.name!=null?'ok':'bad'))}catch(e){rows.push(rsTestRow('Project serialization','Failed','bad'))}
  rows.push(rsTestRow('Web Audio',(window.AudioContext||window.webkitAudioContext)?'Pass':'Unavailable',(window.AudioContext||window.webkitAudioContext)?'ok':'bad'));
  rows.push(rsTestRow('Offline render',window.OfflineAudioContext?'Pass':'Unavailable',window.OfflineAudioContext?'ok':'bad'));
  rows.push(rsTestRow('MediaRecorder',window.MediaRecorder?'Pass':'Unavailable',window.MediaRecorder?'ok':'warn'));
  rows.push(rsTestRow('Microphone API',navigator.mediaDevices?.getUserMedia?'Pass':'Unavailable',navigator.mediaDevices?.getUserMedia?'ok':'warn'));
  rows.push(rsTestRow('IndexedDB',window.indexedDB?'Pass':'Unavailable',window.indexedDB?'ok':'bad'));
  rows.push(rsTestRow('Secure context',window.isSecureContext?'Pass':'Use HTTPS for mic',window.isSecureContext?'ok':'warn'));
  try{
    if(window.OfflineAudioContext){const o=new OfflineAudioContext(1,256,44100),osc=o.createOscillator();osc.connect(o.destination);osc.start();osc.stop(.003);await o.startRendering();rows.push(rsTestRow('Audio render smoke test','Pass','ok'))}
  }catch(e){rows.push(rsTestRow('Audio render smoke test','Failed','bad'))}
  host.innerHTML=rows.join('');
  statusEl.textContent='Royce Studio self-test complete';
}
if($('#runSelfTest'))$('#runSelfTest').onclick=rsRunSelfTest;

// Make audio unlock failures visible on iPhone instead of silently failing.
if($('#audioUnlock'))$('#audioUnlock').onclick=async()=>{
  try{
    const c=ensureAudio();
    if(c?.state==='suspended')await c.resume();
    $('#audioUnlock').textContent=c?.state==='running'?'Audio Ready':'Tap Audio Again';
    $('#audioUnlock').classList.toggle('on',c?.state==='running');
    statusEl.textContent=c?.state==='running'?'Audio engine ready':'Audio is still suspended';
  }catch(e){console.error(e);statusEl.textContent='Audio could not start in this browser session'}
};
window.addEventListener('error',e=>{console.error('Royce Studio runtime error',e.error||e.message)});
window.addEventListener('unhandledrejection',e=>{console.error('Royce Studio promise rejection',e.reason)});


// ===== Royce Studio v1.0.2 guided real-device QA =====
const RS_GUIDED_KEY='royceStudioGuidedQA_v102';
function rsGuidedState(){try{return JSON.parse(localStorage.getItem(RS_GUIDED_KEY)||'{}')||{}}catch{return {}}}
function rsGuidedRender(){
  const state=rsGuidedState(), boxes=$$('#guidedTestList input[data-qa]');
  let done=0;boxes.forEach(b=>{b.checked=!!state[b.dataset.qa];if(b.checked)done++});
  const p=$('#guidedProgress');if(p)p.textContent=`${done} / ${boxes.length} passed`;
}
function rsGuidedBind(){
  $$('#guidedTestList input[data-qa]').forEach(b=>b.onchange=()=>{const state=rsGuidedState();state[b.dataset.qa]=b.checked;localStorage.setItem(RS_GUIDED_KEY,JSON.stringify(state));rsGuidedRender()});
  const reset=$('#resetGuidedTest');if(reset)reset.onclick=()=>{localStorage.removeItem(RS_GUIDED_KEY);rsGuidedRender();statusEl.textContent='Guided test checklist reset'};
}
function rsLoadDemoSession(){
  stop();
  if($('#projectName'))$('#projectName').value='Royce iPhone QA Demo';
  if(bpmEl){bpmEl.value=104;bpmEl.dispatchEvent(new Event('change',{bubbles:true}))}
  const demo={
    kick:[1,0,0,0,0,0,1,0,1,0,0,0,0,1,0,0],
    snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    hat:[1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0],
    clap:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]
  };
  Object.keys(pattern).forEach(k=>{pattern[k].splice(0,pattern[k].length,...demo[k].map(Boolean))});
  arrangementSections=[
    {name:'Intro',bars:2,drums:true,loop:false,vocal:false},
    {name:'Verse',bars:4,drums:true,loop:true,vocal:true},
    {name:'Hook',bars:4,drums:true,loop:true,vocal:true},
    {name:'Outro',bars:2,drums:true,loop:false,vocal:false}
  ];
  if($('#drumKit'))$('#drumKit').value='trap';
  if($('#keyPreset'))$('#keyPreset').value='warmPad';
  if($('#bassPreset'))$('#bassPreset').value='sub';
  setControl('#drumVelocity',112);setControl('#keyVelocity',96);setControl('#bassVelocity',118);setControl('#release808',1.15);
  setControl('#drumsVol',.86);setControl('#loopVol',.72);setControl('#vocalVol',.86);setControl('#masterVol',.9);
  if($('#delayMix'))setControl('#delayMix',.12);if($('#reverbMix'))setControl('#reverbMix',.17);
  if($('#masterComp'))setControl('#masterComp',.25);if($('#masterWidth'))setControl('#masterWidth',1.05);
  buildSequencer();renderArrangement();v10Labels?.();v12UpdateMixer?.();
  try{v13SaveRecovery()}catch(e){console.warn(e)}
  try{localStorage.setItem('royceStudioProject',JSON.stringify(projectObject()))}catch(e){console.warn(e)}
  statusEl.textContent='Demo session loaded — press Play, then work through iPhone Guided Test';
  document.querySelector('.tab[data-tab="drums"]')?.click();
}
if($('#loadDemoSession'))$('#loadDemoSession').onclick=rsLoadDemoSession;
rsGuidedBind();rsGuidedRender();


// ===== Royce Studio v1.0.3 installable iPhone web app =====
function rsStandaloneMode(){return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true}
async function rsRegisterServiceWorker(){
  if(!('serviceWorker' in navigator))return {ok:false,msg:'Service workers unavailable in this browser'};
  if(!window.isSecureContext)return {ok:false,msg:'HTTPS is required for offline install support'};
  try{const reg=await navigator.serviceWorker.register('./service-worker.js');return {ok:true,msg:rsStandaloneMode()?'Installed app mode active':'Offline app shell ready'}}
  catch(e){console.warn('Service worker registration failed',e);return {ok:false,msg:'Offline cache registration failed'}}
}
async function rsInstallCheck(){
  const host=$('#installStatus');if(!host)return;
  const rows=[];
  rows.push(rsTestRow('Secure connection',window.isSecureContext?'Pass':'HTTPS required',window.isSecureContext?'ok':'warn'));
  rows.push(rsTestRow('Home-screen mode',rsStandaloneMode()?'Running installed':'Open Safari Share → Add to Home Screen',rsStandaloneMode()?'ok':'warn'));
  const sw=await rsRegisterServiceWorker();rows.push(rsTestRow('Offline app shell',sw.msg,sw.ok?'ok':'warn'));
  host.innerHTML=rows.join('');
}
if($('#checkInstall'))$('#checkInstall').onclick=rsInstallCheck;
window.addEventListener('load',()=>{rsRegisterServiceWorker().catch(()=>{});});


// ===== Royce Studio v1.0.4 deployment + update manager =====
const RS_DEPLOY_RELEASE='1.0.4';
let rsSwRegistration=null,rsRefreshing=false;
function rsIsIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||((navigator.platform==='MacIntel')&&navigator.maxTouchPoints>1)}
function rsOriginLabel(){try{return location.origin==='null'?'Local file':location.origin}catch{return 'Unknown'}}
function rsSetUpdateButton(state){
  const b=$('#applyUpdate');if(!b)return;
  if(state==='ready'){b.disabled=false;b.textContent='Install App Update';b.classList.add('update-ready')}
  else{b.disabled=true;b.textContent='App Up to Date';b.classList.remove('update-ready')}
}
function rsWatchRegistration(reg){
  rsSwRegistration=reg;
  if(reg.waiting)rsSetUpdateButton('ready');
  reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;if(!worker)return;
    worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)rsSetUpdateButton('ready')});
  });
}
const rsRegisterServiceWorkerV103=rsRegisterServiceWorker;
rsRegisterServiceWorker=async function(){
  if(!('serviceWorker' in navigator))return {ok:false,msg:'Service workers unavailable in this browser'};
  if(!window.isSecureContext)return {ok:false,msg:'HTTPS is required for offline install support'};
  try{const reg=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});rsWatchRegistration(reg);reg.update().catch(()=>{});return {ok:true,msg:rsStandaloneMode()?'Installed app mode active':'Offline app shell ready'}}
  catch(e){console.warn('Service worker registration failed',e);return {ok:false,msg:'Offline cache registration failed'}}
};
async function rsDeploymentCheck(){
  const host=$('#deploymentStatus');if(!host)return;
  const rows=[];
  const hosted=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
  rows.push(rsTestRow('Royce build',`v${RS_DEPLOY_RELEASE}`,'ok'));
  rows.push(rsTestRow('Current host',rsOriginLabel(),hosted?'ok':'warn'));
  rows.push(rsTestRow('HTTPS / secure origin',window.isSecureContext?'Pass':'Required for microphone + install',window.isSecureContext?'ok':'warn'));
  rows.push(rsTestRow('Network',navigator.onLine?'Online':'Offline',navigator.onLine?'ok':'warn'));
  rows.push(rsTestRow('iPhone install',rsIsIOS()?(rsStandaloneMode()?'Home Screen mode':'Safari Share → Add to Home Screen'):'PWA install supported by browser',rsStandaloneMode()?'ok':'warn'));
  if('serviceWorker' in navigator&&window.isSecureContext){
    try{const reg=rsSwRegistration||await navigator.serviceWorker.getRegistration();if(reg){rsWatchRegistration(reg);rows.push(rsTestRow('Service worker',reg.waiting?'Update waiting':'Active',reg.waiting?'warn':'ok'))}else rows.push(rsTestRow('Service worker','Not registered','warn'))}
    catch{rows.push(rsTestRow('Service worker','Check failed','warn'))}
  }else rows.push(rsTestRow('Service worker','Unavailable','warn'));
  host.innerHTML=rows.join('');
}
if($('#checkDeployment'))$('#checkDeployment').onclick=rsDeploymentCheck;
if($('#reloadStudio'))$('#reloadStudio').onclick=()=>location.reload();
if($('#applyUpdate'))$('#applyUpdate').onclick=()=>{
  const w=rsSwRegistration?.waiting;if(!w)return;
  $('#applyUpdate').disabled=true;$('#applyUpdate').textContent='Installing…';w.postMessage({type:'SKIP_WAITING'});
};
if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(rsRefreshing)return;rsRefreshing=true;location.reload()})}
window.addEventListener('online',rsDeploymentCheck);window.addEventListener('offline',rsDeploymentCheck);
window.addEventListener('load',()=>{setTimeout(rsDeploymentCheck,250)});