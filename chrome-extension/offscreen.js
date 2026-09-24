// タブIDごとにセッションを個別に管理
const sessions = new Map();

async function start(tabId, streamId){
  if(sessions.has(tabId)) stop(tabId);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource:'tab', chromeMediaSourceId: streamId } }
  });
  
  const audioCtx = new AudioContext();
  await audioCtx.audioWorklet.addModule('separator-worklet.js');
  const source = audioCtx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(audioCtx,'pan-separator',{
    numberOfInputs:1, numberOfOutputs:2, outputChannelCount:[2,2]
  });
  
  const voiceGain = audioCtx.createGain();
  const bgmGain = audioCtx.createGain();
  const cur = { voice:1, bgm:1, sharp:3, width:0.21 };

  voiceGain.gain.value = cur.voice;
  bgmGain.gain.value = cur.bgm;

  source.connect(node);
  node.connect(voiceGain,0);
  node.connect(bgmGain,1);
  voiceGain.connect(audioCtx.destination);
  bgmGain.connect(audioCtx.destination);
  
  node.port.postMessage({sharp:cur.sharp, width:cur.width});

  // ストリーム終了時の自動破棄
  if(stream.getAudioTracks()[0]){
    stream.getAudioTracks()[0].onended = () => stop(tabId);
  }

  sessions.set(tabId, {
    stream, audioCtx, node, voiceGain, bgmGain, cur
  });
}

function stop(tabId){
  const session = sessions.get(tabId);
  if(!session) return;
  if(session.stream) session.stream.getTracks().forEach(t=>t.stop());
  if(session.audioCtx) session.audioCtx.close();
  sessions.delete(tabId);
}

chrome.runtime.onMessage.addListener((msg, sender, reply)=>{
  if(msg.target!=='offscreen') return;
  (async()=>{
    try{
      const tabId = msg.tabId;
      const session = sessions.get(tabId);

      if(msg.action==='start'){ 
        await start(tabId, msg.streamId); 
        reply({ok:true}); 
      }
      else if(msg.action==='stop'){ 
        stop(tabId); 
        reply({ok:true}); 
      }
      else if(msg.action==='gains'){
        if(session){
          session.cur.voice = msg.voice;
          session.cur.bgm = msg.bgm;
          if(session.voiceGain) session.voiceGain.gain.value = msg.voice;
          if(session.bgmGain) session.bgmGain.gain.value = msg.bgm;
        }
        reply({ok:true});
      }
      else if(msg.action==='sharp'){
        if(session){
          session.cur.sharp = msg.sharp;
          session.cur.width = msg.width;
          if(session.node) session.node.port.postMessage({sharp:msg.sharp, width:msg.width});
        }
        reply({ok:true});
      }
      else if(msg.action==='status'){
        if(session){
          reply({running:true, ...session.cur});
        } else {
          reply({running:false, voice:1, bgm:1, sharp:3});
        }
      }
    }catch(e){ reply({ok:false, error:e.message}); }
  })();
  return true;
});