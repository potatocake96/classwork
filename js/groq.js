
(function(){
  function getURL(){
    return (window.GROQ_PROXY_URL || window.GAS_URL || '').trim();
  }
  async function postJSON(payload){
    const url = getURL();
    if(!url){ throw new Error('Missing GROQ_PROXY_URL / GAS_URL'); }
    const body = Object.assign({ secret: window.GAS_SECRET || '' }, payload);
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || data.error){ throw new Error(data.error || ('HTTP '+res.status)); }
    return data;
  }
  window.AI = {
    async chat(messages, opts){
      const model = (opts && opts.model) || window.GROQ_MODEL || 'llama-3.1-8b-instant';
      const temperature = (opts && typeof opts.temperature==='number') ? opts.temperature : 0.2;
      const res = await postJSON({ route:'groq', model, temperature, messages });
      return res; // {content, json, usage}
    },
    async extractDocxText(file){
      const url = (window.GROQ_PROXY_URL || window.GAS_URL || '').trim();
      if(!url){ throw new Error('Missing GROQ_PROXY_URL / GAS_URL'); }
      const fd = new FormData();
      fd.append('route', 'docx');
      fd.append('secret', window.GAS_SECRET || '');
      fd.append('file', file, file.name);
      const res = await fetch(url, { method:'POST', body: fd });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || data.error){ throw new Error(data.error || ('HTTP '+res.status)); }
      return data; // {text}
    }
  };
  console.log('[Classwork] AI client ready');
})();
