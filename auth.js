// ── LARDI SCHOOL MANAGEMENT SYSTEM ──
// Authentication layer
// Leone Digital Africa Limited · lardigh.com

// Demo account role mapping — auto-assigns roles for demo accounts
// so you never have to manually create Firestore user documents
const DEMO_ROLES = {
  'admin@lardigh.com':   { role: 'admin',   name: 'Demo Admin'   },
  'teacher@lardigh.com': { role: 'teacher', name: 'Demo Teacher' },
  'parent@lardigh.com':  { role: 'parent',  name: 'Demo Parent'  },
  'student@lardigh.com': { role: 'student', name: 'Demo Student' },
};

async function requireAuth(allowedRoles) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async user => {
      if (!user) {
        window.location.href = '/';
        return;
      }
      try {
        let profile;
        const doc = await db.collection('users').doc(user.uid).get();

        if (doc.exists) {
          profile = { uid: user.uid, email: user.email, ...doc.data() };
        } else {
          // Check if this is a known demo account
          const demoInfo = DEMO_ROLES[user.email?.toLowerCase()];
          if (demoInfo) {
            // Auto-create the user document with correct role
            await db.collection('users').doc(user.uid).set({
              email: user.email,
              name:  demoInfo.name,
              role:  demoInfo.role,
              createdAt: new Date(),
            });
            profile = { uid: user.uid, email: user.email, ...demoInfo };
          } else {
            // Real user with no document — default to teacher
            profile = { uid: user.uid, email: user.email, role: 'teacher', name: user.email };
          }
        }

        if (allowedRoles && !allowedRoles.includes(profile.role)) {
          const portals = { parent: '/parent.html', student: '/student.html' };
          window.location.href = portals[profile.role] || '/dashboard.html';
          return;
        }
        resolve({ user, profile });
      } catch(e) {
        console.error('Auth error:', e);
        window.location.href = '/';
      }
    });
  });
}

async function signOut() {
  try {
    await auth.signOut();
    window.location.href = '/';
  } catch(e) {
    console.error('Sign out error:', e);
  }
}
