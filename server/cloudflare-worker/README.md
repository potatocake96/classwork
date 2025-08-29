
# Cloudflare Worker CORS Proxy

This worker solves browser CORS for both:
- `route="groq"` → calls Groq API directly
- `route="docx"` (multipart/form-data) → forwards to your Apps Script .docx extractor

## Quick start
1) Install Cloudflare Wrangler: https://developers.cloudflare.com/workers/wrangler/install-and-update/
2) In this folder, run:
   ```bash
   wrangler login
   wrangler secret put GROQ_API_KEY
   wrangler secret put APPS_SCRIPT_URL    # paste your Apps Script Web App URL
   wrangler deploy
   ```
3) Copy the deployed Worker URL and set in `js/config.js`:
   ```js
   window.GROQ_PROXY_URL = "https://<your-worker>.<subdomain>.workers.dev";
   ```

Now your frontend at any origin (localhost, GitHub Pages, school domain) can call the AI features without CORS issues.
