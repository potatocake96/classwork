
export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    // Read body safely
    let bodyText = '';
    let contentType = request.headers.get('content-type') || '';

    // Route selection
    if (request.method === 'POST') {
      if (contentType.includes('multipart/form-data')) {
        // Forward multipart (docx route) to Apps Script
        const target = env.APPS_SCRIPT_URL; // set in worker env
        if (!target) return cors(new Response(JSON.stringify({ error: 'Missing APPS_SCRIPT_URL' }), { status: 500 }));
        const resp = await fetch(target, {
          method: 'POST',
          body: request.body, // stream pass-through
          headers: {
            // preserve content type to keep boundary
            'content-type': contentType
          }
        });
        return passthroughCORS(resp);
      } else {
        bodyText = await request.text();
        let data = {};
        try { data = JSON.parse(bodyText || '{}'); } catch (e) {}
        const route = data.route || '';

        if (route === 'groq') {
          // Call Groq API directly, add CORS
          const apiKey = env.GROQ_API_KEY;
          if (!apiKey) return cors(new Response(JSON.stringify({ error: 'Worker missing GROQ_API_KEY' }), { status: 500 }));

          const payload = {
            model: data.model || 'llama-3.1-8b-instant',
            temperature: (typeof data.temperature === 'number') ? data.temperature : 0.2,
            response_format: { type: 'json_object' },
            messages: (data.messages || []).map(m => ({ role: m.role, content: String(m.content || '') }))
          };

          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
          });

          const txt = await resp.text();
          if (!resp.ok) return cors(new Response(JSON.stringify({ error: txt || (`HTTP ${resp.status}`) }), { status: resp.status }));
          let out = {};
          try { out = JSON.parse(txt); } catch (e) { out = { raw: txt }; }
          const choice = out.choices && out.choices[0];
          const content = choice && choice.message && choice.message.content || '';
          let json;
          try { json = JSON.parse(content); } catch (e) { json = null; }
          return cors(jsonResponse({ content, json, usage: out.usage || null }));
        }

        if (route === 'docx') {
          // Should be handled via multipart/form-data; if JSON hits here, redirect error
          return cors(new Response(JSON.stringify({ error: 'Send docx as multipart/form-data' }), { status: 400 }));
        }

        // Unknown
        return cors(new Response(JSON.stringify({ error: 'Unknown route' }), { status: 400 }));
      }
    }

    // Fallback
    return cors(new Response(JSON.stringify({ ok: true, worker: 'up' }), { headers: { 'content-type': 'application/json' } }));
  }
};

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Headers', '*');
  resp.headers.set('Access-Control-Expose-Headers', '*');
  resp.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  return resp;
}

function jsonResponse(obj, init = {}) {
  return new Response(JSON.stringify(obj), { headers: { 'content-type': 'application/json' }, ...init });
}

async function passthroughCORS(resp) {
  const txt = await resp.text();
  const out = new Response(txt, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' } });
  return cors(out);
}
