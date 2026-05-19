// ── LARDI SCHOOL MANAGEMENT SYSTEM ──
// Service Worker v1
// Leone Digital Africa Limited · lardigh.com

const CACHE = 'lardi-v4';

const STATIC = [
  '/', '/index.html',
  '/login.html', '/landing.html', '/dashboard.html',
  '/students.html', '/attendance.html', '/grades.html',
  '/staff.html', '/finance.html', '/library.html',
  '/comms.html', '/timetable.html', '/parent.html',
  '/student.html', '/export.html', '/settings.html',
  '/demo-reset.html', '/privacy.html',
  '/shared.css', '/shared.js', '/auth.js', '/db.js',
  '/firebase-config.js', '/school.config.js', '/manifest.json',
  '/lardi-mark.png', '/icon-192.png', '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install error:', err))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (url.includes('firestore.googleapis.com') || url.includes('firebase') ||
      url.includes('googleapis.com') || url.includes('gstatic.com') ||
      url.includes('fonts.googleapis') || url.includes('cdnjs')) return;

  const isHTML = req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(req, resClone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const resClone = res.clone();
            caches.open(CACHE).then(c => c.put(req, resClone));
          }
          return res;
        });
        return cached || fresh;
      })
    );
  }
});
