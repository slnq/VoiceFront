let creating = null;

async function ensureOffscreen(){
  const existing = await chrome.offscreen.hasDocument();
  if(existing) return;
  if(creating){ await creating; return; }
  creating = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Real-time audio separation engine'
  });
  await creating;
  creating = null;
}

chrome.runtime.onMessage.addListener((msg, sender, reply)=>{
  if(msg.target !== 'background') return;
  (async()=>{
    try{
      // 対象タブのIDを特定（渡されていなければアクティブタブを取得）
      let tabId = msg.tabId;
      if(!tabId){
        const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
        if(tab) tabId = tab.id;
      }

      if(msg.action === 'start'){
        if(!tabId) throw new Error('対象のタブが見つかりません');
        await ensureOffscreen();
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        await new Promise(r=>setTimeout(r,150));
        const r = await chrome.runtime.sendMessage({
          target: 'offscreen', 
          action: 'start', 
          tabId, 
          streamId
        });
        reply(r);
      } else {
        const r = await chrome.runtime.sendMessage({
          ...msg, 
          target: 'offscreen', 
          tabId
        });
        reply(r);
      }
    }catch(e){ reply({ok:false, error:e.message}); }
  })();
  return true;
});