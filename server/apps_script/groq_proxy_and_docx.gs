
/**
 * Apps Script proxy for Groq + .docx parsing
 * Deploy as a web app (execute as you, accessible to anyone with link).
 * Set SECRET to match window.GAS_SECRET in the client.
 */
const SECRET = PropertiesService.getScriptProperties().getProperty('SECRET') || 'CHANGE_ME';
const GROQ_API_KEY = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY'); // set in script properties
const MODEL_DEFAULT = 'llama-3.1-8b-instant';

function doPost(e){
  try{
    if(e.postData && e.postData.type === 'application/json'){
      const body = JSON.parse(e.postData.contents || '{}');
      if(body.secret !== SECRET) return respondJSON({ error: 'Forbidden' }, 403);
      if(body.route === 'groq') return handleGroq(body);
      return respondJSON({ error: 'Unknown route' }, 400);
    }else if (e.postData && e.postData.length > 0){
      const params = e.parameter || {};
      if(params.secret !== SECRET) return respondJSON({ error: 'Forbidden' }, 403);
      if(params.route === 'docx') return handleDocx(e);
      return respondJSON({ error: 'Unknown route' }, 400);
    }else{
      return respondJSON({ ok: true, ping: true });
    }
  }catch(err){
    return respondJSON({ error: String(err) }, 500);
  }
}

function handleGroq(body){
  const model = body.model || MODEL_DEFAULT;
  const temperature = (typeof body.temperature === 'number') ? body.temperature : 0.2;
  const messages = body.messages || [];
  const apiKey = GROQ_API_KEY;
  if(!apiKey) return respondJSON({ error: 'Server missing GROQ_API_KEY' }, 500);
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload = {
    model, temperature,
    response_format: { type: 'json_schema', json_schema: { name:'struct', schema: { type:'object' } } }, // encourage JSON
    messages: messages.map(m=>({ role:m.role, content:String(m.content||'') }))
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const txt = res.getContentText();
  let out;
  try{ out = JSON.parse(txt); }catch(e){ out = { raw: txt }; }
  if(code >= 300) return respondJSON({ error: out && out.error && out.error.message || ('HTTP '+code) }, code);
  const choice = out.choices && out.choices[0];
  const content = choice && choice.message && choice.message.content || '';
  let json;
  try{ json = JSON.parse(content); }catch(e){ json = null; }
  return respondJSON({ content, json, usage: out.usage||null });
}

function handleDocx(e){
  const fileBlob = e && e.postData && e.postData.length ? Utilities.newBlob(e.postData.bytes) : null;
  // For multipart/form-data, use e.parameters? Apps Script provides the file via the built-in blob function:
  const file = (e && e.parameters && e.parameters.file) ? e.parameters.file : null;
  // The better approach for Apps Script Web Apps is to use HtmlService upload, but we can attempt unzip here:
  try{
    const blobs = Utilities.unzip(fileBlob);
    const docXmlBlob = blobs.find(b => String(b.getName()).match(/word\/document\.xml$/));
    if (!docXmlBlob) return respondJSON({ error: 'Not a .docx or missing document.xml' }, 400);
    const xml = docXmlBlob.getDataAsString('UTF-8');
    // Rough extraction of text nodes:
    const text = xml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+\n/g,'\n').trim();
    return respondJSON({ text });
  }catch(err){
    return respondJSON({ error: String(err) }, 500);
  }
}

function respondJSON(obj, status){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
