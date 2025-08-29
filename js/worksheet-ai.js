
(function(){
  function sysPrompt(){
    return [
      { role:'system', content: [
        "You are an expert Australian teacher's assistant for VCE VM (or generic).",
        "Output strictly valid JSON following this schema:",
        "{",
        '  "title": string,',
        '  "description": string,',
        '  "questions": [',
        '    { "text": string, "mode": "percentage"|"competency", "max": number? }',
        '  ]',
        "}",
        "Rules:",
        "- For 'competency' questions, omit 'max'.",
        "- Keep questions concise, clear, and answerable in a textbox.",
        "- Avoid Markdown, no code fences, no commentary. JSON only."
      ].join("\n") }
    ];
  }

  function buildMessages(params){
    const { numQuestions, subject, theme, skills, competency } = params;
    const user = [
      `Create a worksheet compatible with the app.`,
      `Number of questions: ${numQuestions||10}`,
      subject ? `Subject/Topic: ${subject}` : '',
      theme ? `Theme/Context: ${theme}` : '',
      skills ? `Learning skills/standards: ${skills}` : '',
      (competency===true) ? `All questions should be competency mode.` : (competency===false) ? `All questions percentage mode.` : `Use a suitable mix of competency and percentage.`
    ].filter(Boolean).join('\n');
    return sysPrompt().concat([{ role:'user', content: user }]);
  }

  function renderForm(){
    return `
      <div class="grid">
        <label>Subject / Topic<input class="input" id="ai-subject" placeholder="e.g., Numeracy — Univariate vs Bivariate"></label>
        <label>Theme / Context<input class="input" id="ai-theme" placeholder="e.g., Melbourne job market, hands-on trades"></label>
        <label>Learning skills / outcomes<textarea class="input" id="ai-skills" rows="3" placeholder="Paste relevant skills/outcomes"></textarea></label>
        <label>Number of questions<input class="input" id="ai-count" type="number" min="1" max="60" value="10"></label>
        <label>Mode<select class="input" id="ai-mode">
          <option value="mix" selected>Mix (auto)</option>
          <option value="percentage">All percentage</option>
          <option value="competency">All competency</option>
        </select></label>
      </div>
      <div id="ai-msg" class="muted" style="min-height:18px"></div>
      <div id="ai-preview" class="card" style="display:none"></div>
    `;
  }

  async function onGenerate(modal){
    const subject = document.getElementById('ai-subject').value.trim();
    const theme   = document.getElementById('ai-theme').value.trim();
    const skills  = document.getElementById('ai-skills').value.trim();
    const numQuestions = Math.max(1, Math.min(60, Number(document.getElementById('ai-count').value)||10));
    const modeSel = document.getElementById('ai-mode').value;
    const competency = (modeSel==='competency') ? true : (modeSel==='percentage' ? false : null);

    const messages = buildMessages({ numQuestions, subject, theme, skills, competency });
    const msgEl = document.getElementById('ai-msg');
    msgEl.textContent = 'Generating with AI...';
    try{
      const result = await window.AI.chat(messages, { model: window.GROQ_MODEL });
      const json = result.json || JSON.parse(result.content||'{}');
      if(!json || !Array.isArray(json.questions)) throw new Error('Bad JSON from model');
      const questions = json.questions.map(q=>{
        const mode = (q.mode==='competency') ? 'competency' : 'percentage';
        const obj = { text: String(q.text||'').trim(), mode };
        if (mode!=='competency'){ const m = Number(q.max||100); obj.max = (isNaN(m)||m<=0) ? 100 : Math.min(1000, m); }
        return obj;
      }).filter(q=>q.text.length>0);
      const preview = document.getElementById('ai-preview');
      preview.style.display='block';
      preview.innerHTML = `
        <h3 style="margin:0 0 8px">Preview: ${window.esc(json.title||'Untitled')}</h3>
        <p>${window.esc(json.description||'')}</p>
        <ol>${questions.map(q=>`<li>${window.esc(q.text)} <span class="muted">(${q.mode}${q.max?'/'+q.max:''})</span></li>`).join('')}</ol>
      `;
      // Attach to modal dataset for saving
      modal.__aiQuestions = { title: json.title||'Worksheet', description: json.description||'', questions };
      msgEl.textContent = 'Looks good. Click "Save as worksheet".';
    }catch(e){
      msgEl.textContent = 'AI error: ' + (e.message||e);
    }
  }

  async function saveAsWorksheet(modal){
    const data = modal.__aiQuestions;
    if(!data || !Array.isArray(data.questions) || !data.questions.length){
      window.toast('Nothing to save yet'); return;
    }
    const uid = window.$fb.auth.currentUser.uid;
    // Create worksheet
    const wsRef = await window.$fb.db.collection('users').doc(uid).collection('worksheets').add({
      title: data.title, description: data.description, createdAt: window.$fb.firebase.firestore.FieldValue.serverTimestamp(),
      open:false, questionCount: data.questions.length, questions: data.questions
    });
    const wid = wsRef.id;
    // Allocate code
    async function allocateCode(uid, wid){
      let code, exists=true;
      while(exists){
        code = window.shortCode();
        const doc = await window.$fb.db.collection('codes').doc(code).get();
        exists = doc.exists;
      }
      await window.$fb.db.collection('codes').doc(code).set({
        teacherId: uid, worksheetId: wid, open:false,
        createdAt: window.$fb.firebase.firestore.FieldValue.serverTimestamp()
      });
      return code;
    }
    const code = await allocateCode(uid, wid);
    await wsRef.update({ code });
    await window.$fb.db.collection('shared').doc(code).set({
      code, title: data.title, description: data.description, teacherId: uid, worksheetId: wid,
      questions: data.questions, open:false, updatedAt: window.$fb.firebase.firestore.FieldValue.serverTimestamp()
    });
    window.toast('Worksheet saved.');
    if (window.loadWorksheets) window.loadWorksheets();
    window.closeModal(modal);
  }

  async function openGenerator(){
    const body = renderForm();
    const modal = window.showModal('AI Worksheet Generator', body, [
      { id:'gen', label:'Generate', class:'primary', onClick: onGenerate },
      { id:'save', label:'Save as worksheet', onClick: saveAsWorksheet },
      { id:'close', label:'Close', onClick: (m)=>window.closeModal(m) }
    ]);
  }

  function renderDocxForm(){
    return `
      <div class="grid">
        <label>Upload .docx file<input class="input" type="file" id="docx-file" accept=".docx"></label>
      </div>
      <div id="docx-msg" class="muted" style="min-height:18px"></div>
      <div id="docx-preview" class="card" style="display:none"></div>
    `;
  }

  async function onDocxParse(modal){
    const file = (document.getElementById('docx-file')||{}).files?.[0];
    if(!file){ window.toast('Please choose a .docx'); return; }
    const msg = document.getElementById('docx-msg');
    msg.textContent = 'Extracting text...';
    try{
      const out = await window.AI.extractDocxText(file);
      const text = out && out.text || '';
      if(!text.trim()) throw new Error('No text extracted');
      msg.textContent = 'Parsing questions with AI...';

      const messages = [
        { role:'system', content: [
          'You convert pasted worksheet text into strict JSON matching:',
          '{ "title": string, "description": string, "questions":[{ "text": string, "mode":"percentage"|"competency", "max": number? }] }',
          'Extract only actual questions. Mode: infer as "competency" if it reads like checklist/performance or yes/no; otherwise "percentage". Set a reasonable max (default 100) for percentage mode. JSON only.'
        ].join('\\n')},
        { role:'user', content: text.slice(0, 28000) } // safety
      ];
      const result = await window.AI.chat(messages, { model: window.GROQ_MODEL });
      const json = result.json || JSON.parse(result.content||'{}');
      if(!json || !Array.isArray(json.questions)) throw new Error('Bad JSON from model');
      modal.__aiQuestions = { title: json.title||'Worksheet', description: json.description||'', questions: json.questions.map(q=>{
        const mode = (q.mode==='competency') ? 'competency' : 'percentage';
        const obj = { text: String(q.text||'').trim(), mode };
        if (mode!=='competency'){ const m = Number(q.max||100); obj.max = (isNaN(m)||m<=0) ? 100 : Math.min(1000, m); }
        return obj;
      }).filter(q=>q.text.length>0) };
      const preview = document.getElementById('docx-preview');
      preview.style.display='block';
      preview.innerHTML = `<h3 style="margin:0 0 8px">Parsed preview</h3><ol>${modal.__aiQuestions.questions.map(q=>`<li>${window.esc(q.text)} <span class="muted">(${q.mode}${q.max?'/'+q.max:''})</span></li>`).join('')}</ol>`;
      msg.textContent = 'Looks good. Click "Save as worksheet".';
    }catch(e){
      msg.textContent = 'Parse failed: ' + (e.message||e);
    }
  }

  async function openDocxImport(){
    const body = renderDocxForm();
    const modal = window.showModal('Import .docx Worksheet', body, [
      { id:'parse', label:'Parse', class:'primary', onClick: onDocxParse },
      { id:'save', label:'Save as worksheet', onClick: saveAsWorksheet },
      { id:'close', label:'Close', onClick: (m)=>window.closeModal(m) }
    ]);
  }

  async function aiMark(uid, wid, subId){
    const wRef = window.$fb.db.collection('users').doc(uid).collection('worksheets').doc(wid);
    const sRef = wRef.collection('submissions').doc(subId);
    const [wDoc, sDoc] = await Promise.all([wRef.get(), sRef.get()]);
    const ws = wDoc.data()||{}; const sub = sDoc.data()||{};
    const qs = ws.questions||[]; const answers = sub.answers||[];
    const payload = {
      questions: qs.map(q=>({ text:q.text||'', mode:q.mode||'percentage', max:(typeof q.max==='number'&&q.max>0)?q.max:100 })),
      answers: answers.map(a=>({ q:a.q||'', a:a.a||'' }))
    };
    const messages = [
      { role:'system', content: [
        'You are an expert marker. Score each student answer for its question.',
        'Input JSON has "questions" and "answers" arrays. Align by index.',
        'For mode "percentage": return a score from 0.0 to 1.0 representing percent/100.',
        'For mode "competency": return 1.0 for competent, 0.0 for not yet, based on evidence.',
        'Return strict JSON: { "results":[{ "score": number, "feedback": string }...], "overall": number }',
        'No narration. JSON only.'
      ].join('\\n')},
      { role:'user', content: JSON.stringify(payload).slice(0, 28000) }
    ];
    const res = await window.AI.chat(messages, { model: window.GROQ_MODEL, temperature: 0 });
    const json = res.json || JSON.parse(res.content||'{}');
    const results = Array.isArray(json.results) ? json.results : [];
    const overall = (typeof json.overall==='number') ? json.overall : (
      results.length ? (results.reduce((s,r)=>s+(r.score||0),0)/results.length) : 0
    );
    await sRef.update({ mark: { status:'ai-marked', score: overall, results, model: (window.GROQ_MODEL||'') , markedAt: window.$fb.firebase.firestore.FieldValue.serverTimestamp() } });
    window.toast('AI marked.');
  }

  window.WSAI = { openGenerator, openDocxImport, aiMark };
  console.log('[Classwork] Worksheet AI helpers ready');
})();
