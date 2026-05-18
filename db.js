// ── LARDI — DATABASE LAYER ──
// All Firestore operations. No composite index dependencies —
// complex sorts happen in memory to work out-of-the-box.

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────

async function getDashboardStats() {
  const term = SCHOOL.term, year = SCHOOL.year;
  const today = todayStr();

  // Run each query independently so one failure cannot zero-out the others.
  // All multi-field filtering is done in memory to avoid composite index requirements.
  const safe = async (fn) => { try { return await fn(); } catch(e) { console.error('getDashboardStats partial error:', e.message); return null; } };

  const [studSnap, staffSnap, feeSnap, attSnap] = await Promise.all([
    safe(() => db.collection('students').get()),
    safe(() => db.collection('staff').where('status','==','active').get()),
    safe(() => db.collection('fee_payments').where('term','==',term).get()),
    safe(() => db.collection('attendance').where('date','==',today).get()),
  ]);

  // Students: include docs with status='active' OR no status field (handles manually-added records)
  const totalStudents = studSnap
    ? studSnap.docs.filter(d => { const s = d.data().status; return !s || s === 'active'; }).length
    : 0;

  const totalStaff = staffSnap ? staffSnap.size : 0;

  // Fee payments: filter by year in memory (avoids composite index on term+year)
  const feesCollected = feeSnap
    ? feeSnap.docs.filter(d => d.data().year === year).reduce((s,d) => s + (d.data().amount||0), 0)
    : 0;

  // Attendance: filter by status in memory (avoids composite index on date+status)
  const absentToday = attSnap
    ? attSnap.docs.filter(d => d.data().status === 'absent').length
    : 0;

  return { totalStudents, totalStaff, feesCollected, absentToday };
}

async function getAttTrend(days = 5) {
  try {
    const results = [];
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      // Skip weekends
      if (d.getDay()===0||d.getDay()===6) continue;
      const dateStr = d.toISOString().split('T')[0];
      const snap = await db.collection('attendance').where('date','==',dateStr).get();
      const total   = snap.size;
      const present = snap.docs.filter(d => d.data().status==='present').length;
      results.push({ date:dateStr, label:d.toLocaleDateString('en-GH',{weekday:'short'}), pct: total ? pct(present,total) : 0 });
    }
    return results;
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function getFeeCollectionByClass(term, year) {
  try {
    const [feeSnap, stuSnap] = await Promise.all([
      db.collection('fee_payments').where('term','==',term).get(),
      db.collection('students').get(),
    ]);
    const paid = {};
    feeSnap.docs.forEach(d => {
      const x = d.data();
      if (x.year !== year) return; // filter by year in memory
      paid[x.classKey] = (paid[x.classKey]||0) + (x.amount||0);
    });
    const expected = {};
    stuSnap.docs.forEach(d => {
      const s = d.data();
      const st = s.status;
      if (st && st !== 'active') return; // skip inactive students
      const fee = s.classKey?.startsWith('jhs') ? 2400 : 2000;
      expected[s.classKey] = (expected[s.classKey]||0) + fee;
    });
    return Object.keys(expected).map(cls => ({
      classKey: cls,
      classLabel: getClassLabel(cls),
      expected: expected[cls]||0,
      collected: paid[cls]||0,
      rate: pct(paid[cls]||0, expected[cls]||1),
    })).sort((a,b) => b.rate - a.rate);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function getRecentPayments(limitTo = 8) {
  try {
    const snap = await db.collection('fee_payments').get();
    const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    docs.sort((a,b) => {
      const ta = a.paidAt?.toMillis ? a.paidAt.toMillis() : 0;
      const tb = b.paidAt?.toMillis ? b.paidAt.toMillis() : 0;
      return tb - ta;
    });
    return docs.slice(0, limitTo);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function getTopStudents(term, limitTo = 5) {
  try {
    const snap = await db.collection('grade_summaries').where('term','==',term).get();
    const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    docs.sort((a,b) => (b.avgScore||0)-(a.avgScore||0));
    return docs.slice(0, limitTo);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function getRecentAnnouncements(limitTo = 3) {
  try {
    const snap = await db.collection('announcements').get();
    const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    docs.sort((a,b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    return docs.slice(0, limitTo);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

// ─────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────

async function getStudents({ classKey=null, status='active', search='' } = {}) {
  try {
    // Fetch all students then filter in memory — avoids composite index requirements
    // and handles documents where the status field is absent.
    const snap = await db.collection('students').get();
    let docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (status) docs = docs.filter(d => !d.status || d.status === status);
    if (classKey) docs = docs.filter(d => d.classKey === classKey);
    docs.sort((a,b) => (a.lastName||'').localeCompare(b.lastName||''));
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d =>
        (d.firstName||'').toLowerCase().includes(s) ||
        (d.lastName||'').toLowerCase().includes(s) ||
        (d.studentId||'').toLowerCase().includes(s) ||
        (d.parentPhone||'').includes(s)
      );
    }
    return docs;
  } catch(e) { console.error('getStudents:',e); return []; }
}

async function getStudentById(id) {
  try {
    const doc = await db.collection('students').doc(id).get();
    if (!doc.exists) return null;
    return { id:doc.id, ...doc.data() };
  } catch(e) { console.error('DB error:', e.message); return null; }
}

async function getStudentCount() {
  try {
    const snap = await db.collection('students').where('status','==','active').get();
    return snap.size;
  } catch(e) { return 0; }
}

async function addStudent({ firstName, lastName, dob, gender, classKey, parentName, parentPhone, parentEmail, address }) {
  try {
    const count = await getStudentCount();
    const year  = new Date().getFullYear();
    const studentId = `GA-${year}-${String(count+1).padStart(4,'0')}`;
    await db.collection('students').doc(studentId).set({
      studentId, firstName, lastName,
      dob: dob||'', gender: gender||'Male', classKey: classKey||'',
      parentName: parentName||'', parentPhone: parentPhone||'',
      parentEmail: parentEmail||'', address: address||'',
      status:'active', photoURL:'',
      enrolledAt: new Date(),
      updatedAt:  new Date(),
    });
    return { success:true, id:studentId, studentId };
  } catch(e) {
    console.error('addStudent:',e);
    return { success:false, error:e.message };
  }
}

async function updateStudent(id, data) {
  try {
    await db.collection('students').doc(id).update({
      ...data, updatedAt: new Date()
    });
    return { success:true };
  } catch(e) { return { success:false, error:e.message }; }
}

// ─────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────

async function getStaff({ status='active' } = {}) {
  try {
    const snap = await db.collection('staff').where('status','==',status).get();
    const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    docs.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    return docs;
  } catch(e) { console.error('getStaff:',e); return []; }
}

async function getStaffById(id) {
  try {
    const doc = await db.collection('staff').doc(id).get();
    if (!doc.exists) return null;
    return { id:doc.id, ...doc.data() };
  } catch(e) { console.error('DB error:', e.message); return null; }
}

async function getStaffCount() {
  try {
    const snap = await db.collection('staff').where('status','==','active').get();
    return snap.size;
  } catch(e) { return 0; }
}

async function addStaff({ name, role, department, subjects, phone, email, salary }) {
  try {
    const count   = await getStaffCount();
    const staffId = `ST-${String(count+1).padStart(3,'0')}`;
    const ref = await db.collection('staff').add({
      staffId, name, role: role||'Teacher',
      department: department||'', subjects: subjects||[],
      phone: phone||'', email: email||'',
      salary: parseFloat(salary)||0,
      status:'active', photoURL:'',
      joinedAt:  new Date(),
      updatedAt: new Date(),
    });
    return { success:true, id:ref.id, staffId };
  } catch(e) { return { success:false, error:e.message }; }
}

async function updateStaff(id, data) {
  try {
    await db.collection('staff').doc(id).update({
      ...data, updatedAt: new Date()
    });
    return { success:true };
  } catch(e) { return { success:false, error:e.message }; }
}

// ─────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────

async function getAttendance(classKey, date) {
  try {
    const snap = await db.collection('attendance')
      .where('classKey','==',classKey)
      .where('date','==',date)
      .get();
    const map = {};
    snap.docs.forEach(d => { map[d.data().studentId] = { id:d.id, ...d.data() }; });
    return map;
  } catch(e) { console.error('getAttendance:',e); return {}; }
}

async function getStudentAttendance(studentId) {
  try {
    const snap = await db.collection('attendance')
      .where('studentId','==',studentId)
      .get();
    const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    docs.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    return docs.slice(0, 60);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function saveAttendance(records, classKey, date, markedBy) {
  try {
    const batch = db.batch();
    for (const rec of records) {
      const docId = `${rec.studentId}_${date}`;
      const ref   = db.collection('attendance').doc(docId);
      batch.set(ref, {
        studentId: rec.studentId, studentName: rec.studentName,
        classKey, date, status: rec.status,
        note: rec.note||'', markedBy,
        createdAt: new Date(),
      }, { merge:true });
    }
    await batch.commit();
    return { success:true, count:records.length };
  } catch(e) {
    console.error('saveAttendance:',e);
    return { success:false, error:e.message };
  }
}

async function getClassAttendanceSummary(classKey, term) {
  try {
    const snap = await db.collection('attendance').where('classKey','==',classKey).get();
    const docs = snap.docs.map(d=>d.data());
    const total = docs.length;
    const present = docs.filter(d=>d.status==='present').length;
    const absent  = docs.filter(d=>d.status==='absent').length;
    const late    = docs.filter(d=>d.status==='late').length;
    return { total, present, absent, late, rate: pct(present,total||1) };
  } catch(e) { return { total:0, present:0, absent:0, late:0, rate:0 }; }
}

// ─────────────────────────────────────────
// GRADES
// ─────────────────────────────────────────

async function getClassGrades(classKey, term, year) {
  try {
    const snap = await db.collection('grades').where('classKey','==',classKey).get();
    return snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .filter(d => d.term === term && d.year === year);
  } catch(e) { console.error('getClassGrades:',e); return []; }
}

async function getStudentGrades(studentId, term, year) {
  try {
    const snap = await db.collection('grades').where('studentId','==',studentId).get();
    let docs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .filter(d => d.term === term && d.year === year);
    docs.sort((a,b) => (a.subjectKey||'').localeCompare(b.subjectKey||''));
    return docs;
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function saveGrades(entries, term, year, enteredBy) {
  try {
    const batch = db.batch();
    for (const e of entries) {
      const docId = `${e.studentId}_${e.subjectKey}_${term}_${year}`;
      const ref   = db.collection('grades').doc(docId);
      const g     = getGrade(e.score);
      batch.set(ref, {
        studentId:e.studentId, studentName:e.studentName,
        classKey:e.classKey, subjectKey:e.subjectKey,
        term, year, score:parseFloat(e.score)||0,
        grade:g.grade, remark:g.remark,
        enteredBy, updatedAt:new Date(),
      }, { merge:true });
    }
    await batch.commit();
    const studentIds = [...new Set(entries.map(e=>e.studentId))];
    await Promise.all(studentIds.map(id => rebuildGradeSummary(id,term,year)));
    return { success:true };
  } catch(e) {
    console.error('saveGrades:',e);
    return { success:false, error:e.message };
  }
}

async function rebuildGradeSummary(studentId, term, year) {
  try {
    const snap = await db.collection('grades').where('studentId','==',studentId).get();
    const filtered = snap.docs.filter(d => { const x=d.data(); return x.term===term && x.year===year; });
    const snap2 = { docs: filtered, empty: filtered.length===0 };
    if (snap2.empty) return;
    const scores = snap2.docs.map(d => (d.data ? d.data() : d).score||0);
    const avg = scores.reduce((s,n)=>s+n,0) / scores.length;
    const student = await getStudentById(studentId);
    await db.collection('grade_summaries').doc(`${studentId}_${term}_${year}`).set({
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : '',
      classKey: student ? student.classKey : '',
      term, year,
      avgScore: parseFloat(avg.toFixed(1)),
      subjectCount: scores.length,
      updatedAt: new Date(),
    }, { merge:true });
  } catch(e) { console.error('rebuildGradeSummary:',e); }
}

// ─────────────────────────────────────────
// FINANCE
// ─────────────────────────────────────────

async function getFeeStructure(classKey, term, year) {
  try {
    const doc = await db.collection('fee_structure').doc(`${classKey}_${term}_${year}`).get();
    if (!doc.exists) {
      // Fallback: derive from level
      const lvl = classKey?.startsWith('jhs') ? 'jhs' : 'primary';
      return { amount: lvl==='jhs' ? 2400 : 2000 };
    }
    return { id:doc.id, ...doc.data() };
  } catch(e) { return { amount:2000 }; }
}

async function getStudentPayments(studentId, term, year) {
  try {
    const snap = await db.collection('fee_payments').where('studentId','==',studentId).get();
    let docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (term) docs = docs.filter(d => d.term === term);
    if (year) docs = docs.filter(d => d.year === year);
    docs.sort((a,b)=>{
      const ta = a.paidAt?.toMillis ? a.paidAt.toMillis() : 0;
      const tb = b.paidAt?.toMillis ? b.paidAt.toMillis() : 0;
      return tb - ta;
    });
    return docs;
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function getPaymentsByTerm(term, year, limitTo=50) {
  try {
    const snap = await db.collection('fee_payments').where('term','==',term).get();
    let docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    docs = docs.filter(d => d.year === year);
    docs.sort((a,b)=>{
      const ta = a.paidAt?.toMillis ? a.paidAt.toMillis() : 0;
      const tb = b.paidAt?.toMillis ? b.paidAt.toMillis() : 0;
      return tb - ta;
    });
    return docs.slice(0, limitTo);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function recordPayment({ studentId, studentName, classKey, term, year, amount, method, reference, recordedBy, notes }) {
  try {
    const ref = await db.collection('fee_payments').add({
      studentId, studentName, classKey, term, year,
      amount: parseFloat(amount),
      method: method||'Cash',
      reference: reference||'',
      notes: notes||'',
      recordedBy,
      paidAt: new Date(),
    });
    return { success:true, id:ref.id };
  } catch(e) { return { success:false, error:e.message }; }
}

async function getOutstanding(term, year, limitTo=50) {
  try {
    const [studSnap, feeSnap] = await Promise.all([
      db.collection('students').get(),
      db.collection('fee_payments').where('term','==',term).get(),
    ]);
    const paid = {};
    feeSnap.docs.forEach(d => {
      const x = d.data();
      if (x.year !== year) return;
      paid[x.studentId] = (paid[x.studentId]||0) + (x.amount||0);
    });
    const outstanding = [];
    for (const doc of studSnap.docs) {
      const s = { id:doc.id, ...doc.data() };
      if (s.status && s.status !== 'active') continue;
      const expected = s.classKey?.startsWith('jhs') ? 2400 : 2000;
      const paidAmt  = paid[s.studentId] || paid[doc.id] || 0;
      const balance  = expected - paidAmt;
      if (balance > 0) outstanding.push({ ...s, expected, paidAmt, balance });
    }
    outstanding.sort((a,b) => b.balance - a.balance);
    return outstanding.slice(0, limitTo);
  } catch(e) { console.error('getOutstanding:',e); return []; }
}

// ─────────────────────────────────────────
// LIBRARY
// ─────────────────────────────────────────

async function getBooks({ search='' } = {}) {
  try {
    const snap = await db.collection('books').get();
    let docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    docs.sort((a,b) => (a.title||'').localeCompare(b.title||''));
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d =>
        (d.title||'').toLowerCase().includes(s) ||
        (d.author||'').toLowerCase().includes(s) ||
        (d.isbn||'').includes(s)
      );
    }
    return docs;
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function addBook({ title, author, isbn, category, totalCopies }) {
  try {
    const copies = parseInt(totalCopies)||1;
    const ref = await db.collection('books').add({
      title, author:author||'', isbn:isbn||'',
      category: category||'Textbook',
      totalCopies: copies, availableCopies: copies,
      createdAt: new Date(),
    });
    return { success:true, id:ref.id };
  } catch(e) { return { success:false, error:e.message }; }
}

async function getBorrowedBooks() {
  try {
    const snap = await db.collection('book_borrows').where('status','==','borrowed').get();
    const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    docs.sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||''));
    return docs;
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function issueBook({ bookId, studentId, studentName, dueDate, issuedBy }) {
  try {
    const bookRef = db.collection('books').doc(bookId);
    const book    = await bookRef.get();
    if (!book.exists || book.data().availableCopies < 1)
      return { success:false, error:'Book not available.' };
    const ref = await db.collection('book_borrows').add({
      bookId, bookTitle:book.data().title,
      studentId, studentName,
      issuedAt: new Date(),
      dueDate, issuedBy, status:'borrowed', returnedAt:null,
    });
    await bookRef.update({ availableCopies: (currentVal - 1) });
    return { success:true, id:ref.id };
  } catch(e) { return { success:false, error:e.message }; }
}

async function returnBook(borrowId, bookId) {
  try {
    const batch = db.batch();
    batch.update(db.collection('book_borrows').doc(borrowId), {
      status:'returned', returnedAt:new Date(),
    });
    batch.update(db.collection('books').doc(bookId), {
      availableCopies: (currentVal + 1),
    });
    await batch.commit();
    return { success:true };
  } catch(e) { return { success:false, error:e.message }; }
}

// ─────────────────────────────────────────
// ANNOUNCEMENTS
// ─────────────────────────────────────────

async function getAnnouncements(limitTo=20) {
  try {
    const snap = await db.collection('announcements').get();
    const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    docs.sort((a,b)=>{
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    return docs.slice(0, limitTo);
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function addAnnouncement({ title, body, audience, classKey, priority, channel, createdBy }) {
  try {
    const ref = await db.collection('announcements').add({
      title, body,
      audience: audience||'everyone',
      classKey: classKey||null,
      priority: priority||'normal',
      channel:  channel||'in-app',
      createdBy,
      createdAt: new Date(),
    });
    return { success:true, id:ref.id };
  } catch(e) { return { success:false, error:e.message }; }
}

// ─────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────

async function getTimetable(classKey, term, year) {
  try {
    const snap = await db.collection('timetable').where('classKey','==',classKey).get();
    return snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(d => !d.term || (d.term === term && (!d.year || d.year === year)));
  } catch(e) { console.error('DB error:', e.message); return []; }
}

async function saveTimetableSlot({ classKey, subjectKey, staffId, staffName, day, startTime, endTime, term, year }) {
  try {
    const docId = `${classKey}_${day}_${startTime}_${term}_${year}`;
    await db.collection('timetable').doc(docId).set({
      classKey, subjectKey, staffId:staffId||'',
      staffName:staffName||'', day, startTime, endTime, term, year,
      updatedAt: new Date(),
    }, { merge:true });
    return { success:true };
  } catch(e) { return { success:false, error:e.message }; }
}

// ─────────────────────────────────────────
// DEMO RESET
// ─────────────────────────────────────────

async function getDemoStatus() {
  try {
    const [s,p,a] = await Promise.all([
      db.collection('students').get(),
      db.collection('fee_payments').get(),
      db.collection('attendance').get(),
    ]);
    return { students:s.size, payments:p.size, attendance:a.size };
  } catch(e) { return { students:0, payments:0, attendance:0 }; }
}

async function resetDemo(key, logFn) {
  if (key !== DEMO_RESET_KEY) return { success:false, error:'Invalid reset key.' };
  try {
    const log = logFn || (()=>{});
    const COLS = ['students','staff','attendance','grades','grade_summaries',
                  'fee_payments','fee_structure','books','book_borrows',
                  'timetable','announcements'];
    for (const col of COLS) {
      const snap = await db.collection(col).get();
      if (snap.size === 0) { log(`Skipping ${col} (empty)`); continue; }
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      log(`✓ Cleared ${col} (${snap.size} records)`);
    }
    log('All data cleared. Please run seed.js to reload demo data.');
    await db.collection('demo_resets').add({
      resetAt: new Date(),
    });
    return { success:true };
  } catch(e) { return { success:false, error:e.message }; }
}
