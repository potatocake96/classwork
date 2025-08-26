
(function(){
  const params = new URLSearchParams(location.search);
  const codeParam = params.get('code')||'';
  document.getElementById('code').value = codeParam;

  let sheet = null;
  async function fetchSheetByCode(code){
    const doc = await $fb.db.collection('shared').doc(code).get();
    if(!doc.exists) throw new Error('Invalid code');
    return doc.data();
  }

  document.getElementById('startBtn').addEventListener('click', async ()=>{
    const code = (document.getElementById('code').value||'').trim().toUpperCase();
    const name = (document.getElementById('name').value||'').trim();
    if(!code || !name){ alert('Enter both code and name.'); return; }
    try{
      sheet = await fetchSheetByCode(code);
      if (!sheet.open){ alert('Worksheet not open yet.'); return; }
      renderForm(sheet, name);
    }catch(err){
      alert('Invalid code.');
    }
  });

  function renderForm(ws, studentName){
    const mount = document.getElementById('mount');
    const qs = ws.questions||[];
    let html = `<div class="card"><h2 class="section-title">${ws.title||'Worksheet'}</h2><p>${ws.description||''}</p>`;
    qs.forEach((q,i)=>{
      html += `<label style="display:block;margin:10px 0"><b>Q${i+1}.</b> ${q.text||''}<textarea class="input" rows="3" data-a="${i}" placeholder="Your answer"></textarea></label>`;
    });
    html += `<div class="row" style="margin-top:10px"><button class="btn primary" id="submitAnswers">Submit</button></div></div>`;
    mount.innerHTML = html;
    document.getElementById('submitAnswers').addEventListener('click', async ()=>{
      const answers = qs.map((q,i)=>({ q:q.text||'', a: (document.querySelector(`[data-a="${i}"]`)||{}).value||'' }));
      const subRef = $fb.db.collection('users').doc(ws.teacherId).collection('worksheets').doc(ws.worksheetId).collection('submissions');
      await subRef.add({ code: ws.code, studentName, answers, submittedAt: $fb.firebase.firestore.FieldValue.serverTimestamp() });
      mount.innerHTML = `<div class="card"><h2>Submitted</h2><p class="muted">Thanks ${studentName}! You can close this page.</p></div>`;
    });
  }
})();
