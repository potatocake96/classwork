
# Apps Script Proxy for Groq + .docx

1. Create a new Apps Script project (**standalone**).
2. Paste the contents of `groq_proxy_and_docx.gs`.
3. In *Project Settings → Script properties*, set:
   - `SECRET` = your secret (must match `window.GAS_SECRET` in `js/config.js`).
   - `GROQ_API_KEY` = your Groq API key.
4. Deploy → *New deployment* → *Web app*:
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
5. Copy the *web app URL* and set it in the client:
   - `window.GROQ_PROXY_URL = "YOUR_WEB_APP_URL";` (you can put this directly in `js/config.js`).

## Endpoints
- `route="groq"`: POST JSON `{ secret, route, model, temperature, messages }` → returns `{ content, json, usage }`
- `route="docx"`: POST multipart form with `{ secret, route, file }` → returns `{ text }`

> **Note:** Avoid putting your Groq API key in the browser. Use this proxy.

