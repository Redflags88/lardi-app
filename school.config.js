// ── LARDI SCHOOL MANAGEMENT SYSTEM ──
// School Configuration — edit ONLY this file when onboarding a new school.
// Leone Digital Africa Limited · lardigh.com
//
// CHECKLIST FOR A NEW SCHOOL:
//   1. Fill in every field below.
//   2. Replace /lardi-mark.png with the school logo (keep the same filename).
//   3. Paste Firebase credentials for the school's own Firebase project.
//   4. Update background_color and theme_color in manifest.json to match color below.

const SCHOOL_CONFIG = {

  // ── SCHOOL IDENTITY ──────────────────────────────────────────────────────
  name:  'Lardi Demo School',
  city:  'Accra, Ghana',
  phone: '+233 00 000 0000',
  email: 'hello@lardigh.com',

  // ── BRANDING ─────────────────────────────────────────────────────────────
  logoPath: '/lardi-mark.png',   // path to the school logo image
  color:    '#1a6b3c',           // primary brand colour (hex)
  appName:  'Lardi',             // short name shown in PWA / browser tab

  // ── CURRENT ACADEMIC PERIOD ───────────────────────────────────────────────
  // Update these two values at the start of each new term.
  term: 'Term 2',
  year: '2026–2027',

  // ── FIREBASE CREDENTIALS ─────────────────────────────────────────────────
  // Create a new Firebase project for each school and paste its config here.
  firebase: {
    apiKey:            'AIzaSyDnZpYj6OBJEGIdZ7zZVLGkQHdFhV3sSgA',
    authDomain:        'schoolmanagementsystem-e6554.firebaseapp.com',
    projectId:         'schoolmanagementsystem-e6554',
    storageBucket:     'schoolmanagementsystem-e6554.firebasestorage.app',
    messagingSenderId: '613321242934',
    appId:             '1:613321242934:web:c59ff104159dd248135b97',
  },

};
