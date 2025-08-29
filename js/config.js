
// === Firebase + GAS config (DEV) ===
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDDnI9vBDT0NvqwaE5JeZ-fVSy8xX86Ft4",
  authDomain: "classwork-5100a.firebaseapp.com",
  projectId: "classwork-5100a",
  storageBucket: "classwork-5100a.firebasestorage.app",
  messagingSenderId: "787859643174",
  appId: "1:787859643174:web:ca04833c4dc38ff68bffe7"
};
window.GAS_URL = "https://script.google.com/macros/s/AKfycbz4fd1WbGa3Li3vbxDA3ftzmYeKC0KiUvCh0NKdKnmgYeOa1YwxW5ZR0JuhAi0drYlU/exec";
window.GAS_SECRET = "123classwork"; // dev only


// === Groq / AI config ===
// Prefer using a proxy (Apps Script) to keep your API key safe.
// Set this to your deployed Apps Script web app URL (doPost supports routes: "groq", "docx").
window.GROQ_PROXY_URL = "https://classwork-groq-proxy.simon-dass-1996.workers.dev" || window.GAS_URL; // fallback to GAS_URL if not set
window.GROQ_MODEL = window.GROQ_MODEL || "llama-3.1-8b-instant";
