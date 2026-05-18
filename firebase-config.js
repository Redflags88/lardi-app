// ── LARDI SCHOOL MANAGEMENT SYSTEM ──
// Firebase Configuration — credentials are loaded from school.config.js
// Leone Digital Africa Limited · lardigh.com

firebase.initializeApp(SCHOOL_CONFIG.firebase);

const db   = firebase.firestore();
const auth = firebase.auth();
