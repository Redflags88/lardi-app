// Known demo accounts — role auto-assigned so Firestore user doc isn't required on first login
const DEMO_ROLES = {
  'admin@lardigh.com':   { role:'admin',   name:'Demo Admin'   },
  'teacher@lardigh.com': { role:'teacher', name:'Demo Teacher' },
  'parent@lardigh.com':  { role:'parent',  name:'Demo Parent'  },
  'student@lardigh.com': { role:'student', name:'Demo Student' },
};

async function requireAuth(allowedRoles) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async user => {
      if (!user) { window.location.href = '/'; return; }
      try {
        let profile;
        const snap = await db.collection('users').doc(user.uid).get();
        if (snap.exists) {
          profile = { uid: user.uid, email: user.email, ...snap.data() };
        } else {
          const demo = DEMO_ROLES[user.email?.toLowerCase()];
          if (demo) {
            await db.collection('users').doc(user.uid).set({
              email: user.email, name: demo.name, role: demo.role, createdAt: new Date(),
            });
            profile = { uid: user.uid, email: user.email, ...demo };
          } else {
            profile = { uid: user.uid, email: user.email, role: 'teacher', name: user.email };
          }
        }
        if (allowedRoles && !allowedRoles.includes(profile.role)) {
          const portals = { parent:'/parent.html', student:'/student.html' };
          window.location.href = portals[profile.role] || '/dashboard.html';
          return;
        }
        resolve({ user, profile });
      } catch (e) {
        console.error('requireAuth:', e);
        window.location.href = '/';
      }
    });
  });
}

async function signOut() {
  try { await auth.signOut(); } catch (e) { console.error('signOut:', e); }
  window.location.href = '/';
}
