const statusEl=document.getElementById('status');
const startBtn=document.getElementById('start-btn');
let currentTabId = null;

function setStatus(t,cls=''){ statusEl.textContent=t; statusEl.className=cls; }

async function getActiveTabId(){
  if(currentTabId) return currentTabId;
  const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
  currentTabId = tab ? tab.id : null;
  return currentTabId;
}

async function send(action, extra={}){
  const tabId = await getActiveTabId();
  return chrome.runtime.sendMessage({target:'background', tabId, action, ...extra});
}

function setSlider(id, val){
  const el=document.getElementById(id);
  el.value=val;
  document.getElementById(id+'-val').textContent = id==='sharp' ? val : val+'%';
}

async function refresh(){
  const tabId = await getActiveTabId();
  if(!tabId) return;

  const r = await chrome.runtime.sendMessage({target:'offscreen', tabId, action:'status'}).catch(()=>null);
  if(r && r.running){
    setSlider('voice', Math.round(r.voice*100));
    setSlider('bgm', Math.round(r.bgm*100));
    setSlider('sharp', r.sharp);
    setStatus('✅ Running in background','ok');
    startBtn.textContent='✅ Running';
    startBtn.disabled=true;
  } else {
    setStatus('Play a stereo video/song, then Start');
    startBtn.textContent='▶ Start';
    startBtn.disabled=false;
  }
}

startBtn.onclick=async()=>{
  startBtn.disabled=true;
  setStatus('⏳ Starting...');
  const r = await send('start');
  if(r && r.ok){
    setStatus('✅ Live! Runs even if you close this.','ok');
    startBtn.textContent='✅ Running';
    pushGains(); pushSharp();
  } else {
    setStatus('❌ '+((r&&r.error)||'Play audio in the tab first'),'err');
    startBtn.disabled=false;
  }
};

document.getElementById('stop-btn').onclick=async()=>{
  await send('stop');
  setSlider('voice',100); setSlider('bgm',100); setSlider('sharp',3);
  setStatus('Stopped.');
  startBtn.disabled=false;
  startBtn.textContent='▶ Start';
};

function pushGains(){
  send('gains', {
    voice:+document.getElementById('voice').value/100,
    bgm:+document.getElementById('bgm').value/100
  });
}
function pushSharp(){
  const s=+document.getElementById('sharp').value;
  send('sharp', { sharp:s, width:0.30-s*0.03 });
}

document.getElementById('voice').oninput=function(){
  document.getElementById('voice-val').textContent=this.value+'%'; pushGains();
};
document.getElementById('bgm').oninput=function(){
  document.getElementById('bgm-val').textContent=this.value+'%'; pushGains();
};
document.getElementById('sharp').oninput=function(){
  document.getElementById('sharp-val').textContent=this.value; pushSharp();
};

refresh();