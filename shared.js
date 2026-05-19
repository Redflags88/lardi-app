// ── LARDI — SHARED CONSTANTS, HELPERS & SETTINGS ──

// Feature flags — set profilePhotos:true when Firebase Storage is configured
const FEATURES = {
  profilePhotos: false,
};

// ── SCHOOL DEFAULTS — overridden by Firestore settings/school document ──
const SCHOOL = {
  name:  'Your School',
  city:  'Accra, Ghana',
  phone: '',
  email: '',
  term:  'Term 1',
  year:  '2025–2026',
  color: '#1a6b3c',
};

async function loadSchoolSettings() {
  try {
    if (typeof db === 'undefined') return;
    const doc = await db.collection('settings').doc('school').get();
    if (doc.exists) {
      const d = doc.data();
      if (d.name)  SCHOOL.name  = d.name;
      if (d.city)  SCHOOL.city  = d.city;
      if (d.phone) SCHOOL.phone = d.phone;
      if (d.email) SCHOOL.email = d.email;
      if (d.term)  SCHOOL.term  = d.term;
      if (d.year)  SCHOOL.year  = d.year;
    }
  } catch (e) {
    console.warn('loadSchoolSettings:', e.message);
  }
}

// ── CLASSES ──
const CLASSES = [
  { key:'primary-1a', label:'Primary 1A', level:'Primary', order:1  },
  { key:'primary-1b', label:'Primary 1B', level:'Primary', order:2  },
  { key:'primary-2a', label:'Primary 2A', level:'Primary', order:3  },
  { key:'primary-2b', label:'Primary 2B', level:'Primary', order:4  },
  { key:'primary-3a', label:'Primary 3A', level:'Primary', order:5  },
  { key:'primary-3b', label:'Primary 3B', level:'Primary', order:6  },
  { key:'primary-4a', label:'Primary 4A', level:'Primary', order:7  },
  { key:'primary-4b', label:'Primary 4B', level:'Primary', order:8  },
  { key:'primary-5a', label:'Primary 5A', level:'Primary', order:9  },
  { key:'primary-5b', label:'Primary 5B', level:'Primary', order:10 },
  { key:'primary-6a', label:'Primary 6A', level:'Primary', order:11 },
  { key:'primary-6b', label:'Primary 6B', level:'Primary', order:12 },
  { key:'jhs-1a',     label:'JHS 1A',     level:'JHS',     order:13 },
  { key:'jhs-1b',     label:'JHS 1B',     level:'JHS',     order:14 },
  { key:'jhs-2a',     label:'JHS 2A',     level:'JHS',     order:15 },
  { key:'jhs-2b',     label:'JHS 2B',     level:'JHS',     order:16 },
  { key:'jhs-3a',     label:'JHS 3A',     level:'JHS',     order:17 },
  { key:'jhs-3b',     label:'JHS 3B',     level:'JHS',     order:18 },
];

// ── SUBJECTS ──
const SUBJECTS = [
  { key:'maths',     label:'Mathematics',        icon:'🔢' },
  { key:'english',   label:'English Language',   icon:'📖' },
  { key:'science',   label:'Integrated Science', icon:'🔬' },
  { key:'social',    label:'Social Studies',      icon:'🌍' },
  { key:'ict',       label:'ICT',                icon:'💻' },
  { key:'rme',       label:'RME',                icon:'✝️'  },
  { key:'history',   label:'History',            icon:'📜' },
  { key:'french',    label:'French',             icon:'🇫🇷' },
  { key:'ghanalang', label:'Ghanaian Language',  icon:'🇬🇭' },
  { key:'bdt',       label:'BDT / Creative Arts',icon:'🎨' },
];

// ── GRADE SCALE ──
const GRADE_SCALE = [
  { min:90, grade:'A+', remark:'Excellent',     color:'#059669' },
  { min:80, grade:'A',  remark:'Very Good',      color:'#10b981' },
  { min:70, grade:'B+', remark:'Good',           color:'#2d9b5a' },
  { min:60, grade:'B',  remark:'Above Average',  color:'#1a6b3c' },
  { min:50, grade:'C',  remark:'Average',        color:'#c8922a' },
  { min:40, grade:'D',  remark:'Below Average',  color:'#d97706' },
  { min:0,  grade:'F',  remark:'Failing',        color:'#dc2626' },
];

// ── STAFF ──
const DEPARTMENTS = ['Administration','Primary','JHS','Support'];
const STAFF_ROLES  = ['Head Teacher','Assistant Head Teacher','Teacher','Bursar','Librarian','Counsellor','Support Staff'];

// ── LIBRARY ──
const BOOK_CATS = ['Textbook','Literature','Science','Mathematics','Language','Social Studies','History','Reference','Story Book','Other'];

// ── HELPERS ──
function getClassLabel(key) {
  return CLASSES.find(c => c.key === key)?.label || key || '—';
}
function getSubjectLabel(key) {
  return SUBJECTS.find(s => s.key === key)?.label || key || '—';
}
function getSubjectIcon(key) {
  return SUBJECTS.find(s => s.key === key)?.icon || '📚';
}
function getGrade(score) {
  return GRADE_SCALE.find(g => score >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
}
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('');
}
function fmtGHS(amount) {
  if (amount === null || amount === undefined) return '—';
  return 'GHS ' + Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GH', { day:'numeric', month:'short', year:'numeric' });
}

// Avatar — respects FEATURES.profilePhotos flag
function avatarHtml(name, photoURL, extraClass = '') {
  if (FEATURES.profilePhotos && photoURL) {
    return `<img src="${photoURL}" class="av ${extraClass}" style="object-fit:cover;border-radius:50%" alt="${name}">`;
  }
  return `<div class="av av-green ${extraClass}">${getInitials(name)}</div>`;
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast ' + (type === 'err' ? 'toast-err' : 'toast-ok');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2800);
}

// Populate sidebar with profile info and school name/term
function initSidebar(profile) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sb-av',   getInitials(profile.name));
  set('sb-name', profile.name || profile.email);
  set('sb-role', profile.role);
  set('sb-school', SCHOOL.name);
  set('sb-term',   `${SCHOOL.term} · ${SCHOOL.year}`);
  const badge = document.getElementById('term-badge');
  if (badge) badge.textContent = `${SCHOOL.term} · ${SCHOOL.year}`;
  if (profile.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

function openSidebar()  {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}
