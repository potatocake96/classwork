
window.toast = (msg)=>{
  let el = document.getElementById('toast');
  if(!el){ el = document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 1800);
};
window.copyText = async (t)=>{ try{ await navigator.clipboard.writeText(t||''); toast('Copied'); }catch{ alert('Code: '+t); } };
window.fmtDate = (ts)=>{
  try{
    const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if(!d) return '';
    return d.toLocaleString();
  }catch{ return ''; }
};
window.shortCode = ()=> Math.random().toString(36).slice(2,8).toUpperCase();
