// ── LARDI SCHOOL MANAGEMENT SYSTEM ──
// Shared constants, helpers and school settings loader
// Leone Digital Africa Limited · lardigh.com

// ─────────────────────────────────────────
// SCHOOL DEFAULTS — initialised from school.config.js; overridden at runtime by Firestore
// ─────────────────────────────────────────
const SCHOOL = {
  name:  SCHOOL_CONFIG.name,
  city:  SCHOOL_CONFIG.city,
  phone: SCHOOL_CONFIG.phone,
  email: SCHOOL_CONFIG.email,
  term:  SCHOOL_CONFIG.term,
  year:  SCHOOL_CONFIG.year,
  color: SCHOOL_CONFIG.color,
};

// Load school settings from Firestore — never throws
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
  } catch(e) {
    console.warn('School settings not found, using defaults.');
  }
}

// ─────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────
const SUBJECTS = [
  { key: 'maths',    label: 'Mathematics',       icon: '🔢' },
  { key: 'english',  label: 'English Language',  icon: '📖' },
  { key: 'science',  label: 'Integrated Science',icon: '🔬' },
  { key: 'social',   label: 'Social Studies',    icon: '🌍' },
  { key: 'ict',      label: 'ICT',               icon: '💻' },
  { key: 'rme',      label: 'RME',               icon: '✝️'  },
  { key: 'history',  label: 'History',           icon: '📜' },
  { key: 'french',   label: 'French',            icon: '🇫🇷' },
  { key: 'ghanalang',label: 'Ghanaian Language', icon: '🇬🇭' },
  { key: 'bdt',      label: 'BDT / Creative Arts',icon:'🎨' },
];

// ─────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GRADE SCALE
// ─────────────────────────────────────────
const GRADE_SCALE = [
  { min:90, grade:'A+', remark:'Excellent'      },
  { min:80, grade:'A',  remark:'Very Good'       },
  { min:70, grade:'B+', remark:'Good'            },
  { min:60, grade:'B',  remark:'Above Average'   },
  { min:50, grade:'C',  remark:'Average'         },
  { min:40, grade:'D',  remark:'Below Average'   },
  { min:0,  grade:'F',  remark:'Failing'         },
];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
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
  return GRADE_SCALE.find(g => score >= g.min) || GRADE_SCALE[GRADE_SCALE.length-1];
}
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase()).filter(Boolean).slice(0,2).join('');
}
function fmtGHS(amount) {
  if (!amount && amount !== 0) return '—';
  return 'GHS ' + Number(amount).toLocaleString('en-GH', { minimumFractionDigits:0, maximumFractionDigits:0 });
}
function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}
function todayStr() {
  return new Date().toISOString().slice(0,10);
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GH', { day:'numeric', month:'short', year:'numeric' });
}
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = type === 'err' ? 'var(--red)' : 'var(--green)';
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2800);
}

// Apply school logo from school.config.js to every img on this page
(function() {
  document.querySelectorAll('img').forEach(function(img) {
    if (img.getAttribute('src') && img.getAttribute('src').includes('lardi-mark')) {
      img.src = SCHOOL_CONFIG.logoPath;
    }
  });
})();
