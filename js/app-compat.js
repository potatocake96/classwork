// Initialize Firebase using compat globals
(function(){
  const cfg = window.FIREBASE_CONFIG || {};
  if (!cfg || !cfg.apiKey){ console.warn('[Classwork] Missing FIREBASE_CONFIG'); }
  const app = firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();
  window.$fb = { app, auth, db, firebase };
  console.log('[Classwork] Firebase ready');
})();