
(function(){
  // Wait for Firebase compat globals
  function whenFBReady(cb){ if (window.$fb && $fb.auth) cb(); else setTimeout(()=>whenFBReady(cb), 30); }
  whenFBReady(main);

  function esc(s){
    s = (s==null) ? '' : String(s);
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function main(){
    $fb.auth.onAuthStateChanged(async (u)=>{
      if (!u){ window.location.href = 'login.html'; return; }
      const mk = document.getElementById('create-ws');
      if (mk) mk.addEventListener('click', createWorksheet);
      const lo = document.getElementById('logout');
      if (lo) lo.addEventListener('click', async ()=>{ await $fb.auth.signOut(); location.href='login.html'; });
      loadWorksheets();
    });
  }

  async function createWorksheet(){
    const title = prompt('Worksheet title?') || '';
    if (!title.trim()) return;
    const description = prompt('Short description (optional)?') || '';
    const uid = $fb.auth.currentUser.uid;
    const wsRef = await $fb.db.collection('users').doc(uid).collection('worksheets').add({
      title, description, createdAt: $fb.firebase.firestore.FieldValue.serverTimestamp(),
      open:false, questionCount:0, questions:[]
    });
    const code = await allocateCode(uid, wsRef.id);
    await wsRef.update({ code });
    await $fb.db.collection('shared').doc(code).set({
      code, title, description, teacherId: uid, worksheetId: wsRef.id,
      questions: [], open:false, updatedAt: $fb.firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Created. Expand to edit.');
    loadWorksheets();
  }

  async function allocateCode(uid, wid){
    let code, exists=true;
    while(exists){
      code = window.shortCode();
      const doc = await $fb.db.collection('codes').doc(code).get();
      exists = doc.exists;
    }
    await $fb.db.collection('codes').doc(code).set({
      teacherId: uid, worksheetId: wid, open:false,
      createdAt: $fb.firebase.firestore.FieldValue.serverTimestamp()
    });
    return code;
  }

  async function loadWorksheets(){
    const list = document.getElementById('ws-list');
    if (list) list.innerHTML = '<div class="notice">Loading worksheets...</div>';
    const uid = $fb.auth.currentUser.uid;
    const snap = await $fb.db.collection('users').doc(uid).collection('worksheets').orderBy('createdAt','desc').get();
    let html = '';
    snap.forEach(doc=> html += renderCard(doc.id, doc.data()));
    if (list) list.innerHTML = html || '<div class="notice">No worksheets yet.</div>';
    snap.forEach(doc=> bindCard(doc.id, doc.data()));
  }

  function renderCard(id, ws){
    const linkUrl = new URL('student.html', location.href); linkUrl.searchParams.set('code', ws.code || '');
    const link = linkUrl.toString();
    return `
      <div class="card accordion" id="ws-${id}">
        <div class="accordion-header">
          <div>
            <div class="section-title">${esc(ws.title)||'Untitled'} <span class="badge">${ws.open?'Published':'Draft'}</span></div>
            <small class="muted">Code: <span class="code">${esc(ws.code||'')}</span> • Qs: ${ws.questionCount||0} • ${window.fmtDate(ws.createdAt||'')}</small>
          </div>
          <div class="row">
            <button class="btn" data-act="copy">Code</button>
            <a class="btn" href="${link}" target="_blank">Student link</a>
            <button class="btn primary" data-act="publish">${ws.open?'Unpublish':'Publish'}</button>
            <button class="btn" data-act="delete">Delete</button>
            <span class="chev">▶</span>
          </div>
        </div>
        <div class="accordion-body">
          <div class="grid grid-2">
            <div>
              <div class="section-title">Edit worksheet</div>
              <div class="grid">
                <label>Title<input class="input" id="t-${id}-title" value="${esc(ws.title||'')}"></label>
                <label>Description<textarea class="input" id="t-${id}-desc" rows="3">${esc(ws.description||'')}</textarea></label>
              </div>
              <div class="section-title">Questions</div>
              <div id="qwrap-${id}">${renderQuestions(ws.questions||[])}</div>
              <div class="row">
                <button class="btn" data-act="addq">Add question</button>
                <button class="btn primary" data-act="saveq">Save all</button>
              </div>
            </div>
            <div>
              <div class="section-title">Submissions</div>
              <div id="subs-${id}" class="notice">Loading submissions...</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderQuestions(qs){
    if(!qs || !qs.length) return '<div class="notice">No questions yet.</div>';
    return `<table class="table"><thead><tr><th style="width:40px">#</th><th>Question</th><th style="width:160px">Mode</th><th style="width:120px">Max</th></tr></thead><tbody>${
      qs.map((q,i)=>{
        const mode = q.mode || 'percentage';
        const max = (typeof q.max==='number' && q.max>0) ? q.max : 100;
        const maxCell = (mode === 'competency')
          ? '<span class="muted">N/A</span>'
          : `<input class="input" type="number" min="1" max="1000" step="1" data-qmax="${i}" value="${max}">`;
        return `<tr>
          <td>${i+1}</td>
          <td><textarea data-qidx="${i}" class="input q-input" rows="4">${esc(q.text||'')}</textarea></td>
          <td>
            <select class="input" data-qmode="${i}">
              <option value="competency" ${mode==='competency'?'selected':''}>Competency</option>
              <option value="percentage" ${mode!=='competency'?'selected':''}>Percentage</option>
            </select>
          </td>
          <td>${maxCell}</td>
        </tr>`;
      }).join('')
    }</tbody></table>`;
  }

  function getCurrentQuestionsFromDOM(root){
    const rows = root.querySelectorAll('textarea[data-qidx]');
    return Array.from(rows).map(r=>{
      const idx = Number(r.getAttribute('data-qidx'));
      const modeEl = root.querySelector(`[data-qmode="${idx}"]`);
      const maxEl  = root.querySelector(`[data-qmax="${idx}"]`);
      const mode = (modeEl && modeEl.value) || 'percentage';
      const obj = { text: r.value.trim(), mode };
      if (mode !== 'competency'){
        const mv = Number(maxEl && maxEl.value || 100);
        obj.max = Math.max(1, Math.min(1000, isNaN(mv)?100:mv));
      }
      return obj;
    });
  }

  async function bindCard(id, ws){
    const root = document.getElementById(`ws-${id}`);
    const uid = $fb.auth.currentUser.uid;
    const header = root.querySelector('.accordion-header');
    header.addEventListener('click', (e)=>{
      if (e.target.closest('button') || e.target.closest('a')) return;
      root.classList.toggle('open');
    });

    // Actions
    root.querySelector('[data-act="copy"]').addEventListener('click', ()=> window.copyText(ws.code||''));
    root.querySelector('[data-act="publish"]').addEventListener('click', async ()=>{
      const newOpen = !ws.open;
      const wRef = $fb.db.collection('users').doc(uid).collection('worksheets').doc(id);
      await wRef.update({ open: newOpen });
      const code = (await wRef.get()).data().code;
      await $fb.db.collection('codes').doc(code).update({ open: newOpen });
      await $fb.db.collection('shared').doc(code).update({ open: newOpen });
      toast(newOpen ? 'Published' : 'Unpublished');
      loadWorksheets();
    });
    root.querySelector('[data-act="delete"]').addEventListener('click', async ()=>{
      if(!confirm('Delete this worksheet (and public index)? This cannot be undone.')) return;
      const code = ws.code;
      await $fb.db.collection('users').doc(uid).collection('worksheets').doc(id).delete();
      if (code){ await $fb.db.collection('codes').doc(code).delete().catch(()=>{}); await $fb.db.collection('shared').doc(code).delete().catch(()=>{}); }
      toast('Deleted.');
      loadWorksheets();
    });

    // Add question
    root.querySelector('[data-act="addq"]').addEventListener('click', ()=>{
      const qwrap = root.querySelector(`#qwrap-${id}`);
      const current = getCurrentQuestionsFromDOM(root);
      current.push({ text:'', mode:'percentage', max:100 });
      qwrap.innerHTML = renderQuestions(current);
    });

    // Save all
    root.querySelector('[data-act="saveq"]').addEventListener('click', async ()=>{
      const title = root.querySelector(`#t-${id}-title`).value.trim();
      const description = root.querySelector(`#t-${id}-desc`).value.trim();
      const questions = getCurrentQuestionsFromDOM(root).filter(q=> q.text.length);
      const batch = $fb.db.batch();
      const wRef = $fb.db.collection('users').doc(uid).collection('worksheets').doc(id);
      batch.update(wRef, { title, description, questions, questionCount: questions.length, updatedAt: $fb.firebase.firestore.FieldValue.serverTimestamp() });
      const code = (await wRef.get()).data().code;
      const sRef = $fb.db.collection('shared').doc(code);
      batch.update(sRef, { title, description, questions, updatedAt: $fb.firebase.firestore.FieldValue.serverTimestamp() });
      await batch.commit();
      toast('Worksheet saved.');
      loadWorksheets();
    });

    // Dynamic mode change: re-render questions to show/hide Max
    const qwrap = root.querySelector(`#qwrap-${id}`);
    qwrap.addEventListener('change', (e)=>{
      if (e.target.matches('select[data-qmode]')){
        const current = getCurrentQuestionsFromDOM(root);
        qwrap.innerHTML = renderQuestions(current);
      }
    });

    // Live submissions
    $fb.db.collection('users').doc(uid).collection('worksheets').doc(id).collection('submissions')
      .orderBy('submittedAt','desc')
      .onSnapshot((snap)=>{
        const el = root.querySelector(`#subs-${id}`);
        if (snap.empty){ el.innerHTML = '<div class="notice">No submissions yet.</div>'; return; }
        let rows = '';
        snap.forEach(doc=>{
          const s = doc.data();
          const status = s.mark?.status || 'unmarked';
          const score = (typeof s.mark?.score === 'number') ? (Math.round(s.mark.score*100)+'%') : '-';
          rows += `<tr>
            <td>${esc(s.studentName||'')}</td>
            <td>${window.fmtDate(s.submittedAt)}</td>
            <td><span class="badge">${status}</span></td>
            <td>${score}</td>
            <td>
              <button class="btn" data-sub="${doc.id}" data-act="view">View</button>
              <button class="btn primary" data-sub="${doc.id}" data-act="mark">Mark</button>
              <button class="btn" data-sub="${doc.id}" data-act="export">Export</button>
            </td>
          </tr>`;
        });
        el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Submitted</th><th>Status</th><th>Score</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        el.querySelectorAll('button').forEach(btn=>{
          const subId = btn.getAttribute('data-sub');
          const act = btn.getAttribute('data-act');
          btn.addEventListener('click', ()=> onSubmissionAction(uid, id, subId, act));
        });
      });
  }

  async function onSubmissionAction(uid, wid, subId, act){
    const ref = $fb.db.collection('users').doc(uid).collection('worksheets').doc(wid).collection('submissions').doc(subId);
    const doc = await ref.get(); const sub = doc.data() || {};
    if(act==='view'){
      const txt = (sub.answers||[]).map((a,i)=>`Q${i+1}: ${a.q}\nA: ${a.a}`).join('\n\n');
      window.showModal('Submission', `<pre style="white-space:pre-wrap">${esc(txt)}</pre>`, [{id:'close', label:'Close', onClick:(w)=>window.closeModal(w)}]);
      return;
    }
    if(act==='mark'){
      const wsDoc = await $fb.db.collection('users').doc(uid).collection('worksheets').doc(wid).get();
      const ws = wsDoc.data() || {};
      const answers = sub.answers||[];
      const qs = ws.questions||[];
      const body = `
        <div class="grid">
          <div><b>Student:</b> ${esc(sub.studentName||'')}</div>
          <div><b>Worksheet:</b> ${esc(ws.title||'')}</div>
        </div>
        <hr style="margin:10px 0">
        <form id="mark-form" class="grid">
          ${answers.map((a,i)=>{
            const q = qs[i] || {};
            const mode = q.mode || 'percentage';
            const max = (q && typeof q.max==='number' && q.max>0) ? q.max : 100;
            const prev = (sub.mark && sub.mark.results && sub.mark.results[i]) || {};
            const prevScore = typeof prev.score==='number' ? Math.round(prev.score * (mode==='competency'?100:max)) : '';
            const prevFb = esc(prev.feedback||'');
            return `
              <div class="card" style="border:1px dashed var(--line)">
                <div class="section-title">Q${i+1}</div>
                <div class="muted" style="margin-bottom:6px">${esc(q.text||a.q||'')}</div>
                <div style="white-space:pre-wrap; margin:8px 0"><b>Answer:</b> ${esc(a.a||'')}</div>
                ${mode==='competency' ? `
                  <label class="row" style="align-items:center; gap:8px">
                    <input type="checkbox" name="competent_${i}" ${prev.score === 1 ? 'checked' : ''}>
                    <span>Competent</span>
                  </label>
                ` : `
                  <label>Score (0–${max})<input class="input" type="number" min="0" max="${max}" step="1" name="score_${i}" value="${prevScore}"></label>
                `}
                <label>Feedback<textarea class="input" name="fb_${i}" rows="2" placeholder="Short comment">${prevFb}</textarea></label>
              </div>`;
          }).join('')}
        </form>`;
      const wrap = window.showModal('Mark submission', body, [
        { id:'save', label:'Save marks', class:'primary', onClick: async (w)=>{
          const formEl = w.querySelector('#mark-form');
          const results = (sub.answers||[]).map((a,i)=>{
            const q = (qs||[])[i] || {};
            const mode = q.mode || 'percentage';
            const max = (q && typeof q.max==='number' && q.max>0) ? q.max : 100;
            let score = 0;
            if (mode==='competency'){
              score = formEl.querySelector(`[name=competent_${i}]`)?.checked ? 1 : 0;
            } else {
              const raw = Number((formEl.querySelector(`[name=score_${i}]`)||{}).value||0);
              const bounded = Math.max(0, Math.min(max, isNaN(raw)?0:raw));
              score = max ? bounded / max : 0;
            }
            const fb = (formEl.querySelector(`[name=fb_${i}]`)||{}).value||'';
            return { q: (q.text||a.q||''), a: a.a||'', mode, max, score, feedback: fb, ok: score >= (mode==='competency' ? 1 : 0.5) };
          });
          const avg = results.length ? (results.reduce((s,r)=>s+(r.score||0),0)/results.length) : 0;
          await ref.update({ mark:{ status:'marked', score: avg, results, markedAt: $fb.firebase.firestore.FieldValue.serverTimestamp() }});
          toast('Marks saved.'); window.closeModal(w);
        }},
        { id:'close', label:'Close', onClick:(w)=> window.closeModal(w) }
      ]);
      return;
    }
    if(act==='export'){
      const wsDoc = await $fb.db.collection('users').doc(uid).collection('worksheets').doc(wid).get();
      const ws = wsDoc.data() || {};
      const qs = ws.questions||[];
      const html = `
        <div class="row" style="justify-content:space-between; align-items:center">
          <img src="assets/logo-page-lines-square.svg" alt="logo" width="120"><div><span class="badge">Export preview</span></div>
        </div>
        <h1 style="margin:6px 0 0;">${esc(ws.title||'')}</h1>
        <div><small class="muted">${esc(ws.description||'')}</small></div>
        <hr style="margin:12px 0">
        <div><b>Student:</b> ${esc(sub.studentName||'')}</div>
        <div><b>Submitted:</b> ${window.fmtDate(sub.submittedAt)}</div>
        <div><b>Code:</b> <span class="code">${esc(sub.code||'')}</span></div>
        <hr style="margin:12px 0">
        ${(sub.answers||[]).map((a,i)=>{
          const q = qs[i] || {};
          const r = (sub.mark && sub.mark.results && sub.mark.results[i]) || {};
          const mode = q.mode || 'percentage';
          const max = (q && typeof q.max==='number' && q.max>0) ? q.max : 100;
          const shownScore = (typeof r.score==='number') ? (mode==='competency' ? (r.score===1 ? 'Competent' : 'Not yet') : `${Math.round(r.score*max)}/${max}`) : '-';
          return `
          <div style="margin-bottom:10px">
            <div><b>Q${i+1}.</b> ${esc(q.text||a.q||'')}</div>
            <div style="white-space:pre-wrap; margin-top:6px">${esc(a.a||'')}</div>
            ${(sub.mark && sub.mark.results && sub.mark.results[i]) ? `<div class="notice" style="margin-top:6px"><b>Mark:</b> ${shownScore}${r.feedback ? ' • '+esc(r.feedback) : ''}</div>`:''}
          </div>`;
        }).join('')}
        <hr style="margin:12px 0">
        <div><b>Total score:</b> ${sub.mark ? Math.round((sub.mark.score||0)*100) : '-'}%</div>
      `;
      const wrap = window.showModal('Export PDF', html, [
        { id:'print', label:'Print / Save as PDF', onClick:()=> window.print() },
        { id:'close', label:'Close', onClick:(w)=> window.closeModal(w) }
      ]);
      return;
    }
  }
})();
