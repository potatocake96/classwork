(function(){
  // Prevent double-defining
  if (window.__classworkModalReady) return;
  window.__classworkModalReady = true;

  function countModals(){ return document.querySelectorAll('.modal-backdrop').length; }

  window.closeModal = function wrapCloseModal(wrap){
    if (wrap && wrap.parentNode){ wrap.parentNode.removeChild(wrap); }
    if (countModals() === 0){ document.body.classList.remove('modal-open'); }
  };

  window.showModal = function(title, contentHTML, actions){
    actions = actions || [];
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';

    const tpl = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${title||'Dialog'}">
        <div class="modal-head">
          <h2 style="margin:0">${title||''}</h2>
          <button class="btn" type="button" data-close>Close</button>
        </div>
        <div class="modal-body">${contentHTML||''}</div>
        <div class="modal-foot"></div>
      </div>`;

    wrap.innerHTML = tpl;
    const foot = wrap.querySelector('.modal-foot');
    actions.forEach(a=>{
      const b = document.createElement('button');
      b.className = 'btn ' + (a.class||'');
      b.textContent = a.label;
      b.setAttribute('data-act', a.id);
      b.addEventListener('click', ()=> a.onClick && a.onClick(wrap));
      foot.appendChild(b);
    });

    // Close handlers
    wrap.querySelector('[data-close]').addEventListener('click', ()=> window.closeModal(wrap));
    wrap.addEventListener('click', (e)=>{ if(e.target === wrap){ window.closeModal(wrap); } });

    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');

    // ESC to close
    const esc = (e)=>{
      if (e.key === 'Escape'){
        const last = document.querySelector('.modal-backdrop:last-of-type');
        if (last === wrap){ window.closeModal(wrap); document.removeEventListener('keydown', esc); }
      }
    };
    document.addEventListener('keydown', esc);

    // Focus first actionable
    const first = wrap.querySelector('.modal-foot button, [data-close]');
    if (first && first.focus) first.focus();

    return wrap;
  };

  console.log('[Classwork] modal ready');
})();