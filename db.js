// ── LARDI — DATABASE LAYER ──
// Rules:
//   • getStudents() fetches ALL docs — no Firestore where() on multiple fields
//   • No firebase.firestore.FieldValue — use new Date() for timestamps
//   • No db.batch() — individual await doc.set() calls only
//   • Every function in try/catch with console.error

// ── DASHBOARD ──

async function getDashboardStats() {
  const term = SCHOOL.term, year = SCHOOL.year, today = todayStr();
  const safe = async fn => { try { return await fn(); } catch(e) { console.error('stat:', e.message); return null; } };
  const [sSnap, stSnap, fSnap, aSnap] = await Promise.all([
    safe(() => db.collection('students').get()),
    safe(() => db.collection('staff').get()),
    safe(() => db.collection('fee_payments').where('term','==',term).get()),
    safe(() => db.collection('attendance').where('date','==',today).get()),
  ]);
  return {
    totalStudents: sSnap ? sSnap.size : 0,
    totalStaff:    stSnap ? stSnap.docs.filter(d => { const s=d.data().status; return !s||s==='active'; }).length : 0,
    feesCollected: fSnap  ? fSnap.docs.filter(d => d.data().year===year).reduce((s,d) => s+(d.data().amount||0), 0) : 0,
    absentToday:   aSnap  ? aSnap.docs.filter(d => d.data().status==='absent').length : 0,
  };
}

async function getAttTrend(days=5) {
  try {
    const results = [];
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      if (d.getDay()===0||d.getDay()===6) continue;
      const ds   = d.toISOString().slice(0,10);
      const snap = await db.collection('attendance').where('date','==',ds).get();
      const pres = snap.docs.filter(d=>d.data().status==='present').length;
      results.push({ date:ds, label:d.toLocaleDateString('en-GH',{weekday:'short'}), pct: snap.size ? pct(pres,snap.size):0 });
    }
    return results;
  } catch(e) { console.error('getAttTrend:', e.message); return []; }
}

async function getFeeCollectionByClass(term, year) {
  try {
    const [fSnap, sSnap] = await Promise.all([
      db.collection('fee_payments').where('term','==',term).get(),
      db.collection('students').get(),
    ]);
    const paid={}, exp={};
    fSnap.docs.forEach(d => { const x=d.data(); if(x.year!==year)return; paid[x.classKey]=(paid[x.classKey]||0)+(x.amount||0); });
    sSnap.docs.forEach(d => { const s=d.data(); if(s.status&&s.status!=='active')return; const fee=s.classKey?.startsWith('jhs')?2400:2000; exp[s.classKey]=(exp[s.classKey]||0)+fee; });
    return Object.keys(exp).map(cls=>({ classKey:cls, classLabel:getClassLabel(cls), expected:exp[cls]||0, collected:paid[cls]||0, rate:pct(paid[cls]||0,exp[cls]||1) })).sort((a,b)=>b.rate-a.rate);
  } catch(e) { console.error('getFeeCollectionByClass:', e.message); return []; }
}

async function getRecentPayments(limitTo=8) {
  try {
    const snap = await db.collection('fee_payments').get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.paidAt?.toMillis?.()??0)-(a.paidAt?.toMillis?.()??0)).slice(0,limitTo);
  } catch(e) { console.error('getRecentPayments:', e.message); return []; }
}

async function getTopStudents(term, limitTo=5) {
  try {
    const snap = await db.collection('grade_summaries').where('term','==',term).get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.avgScore||0)-(a.avgScore||0)).slice(0,limitTo);
  } catch(e) { console.error('getTopStudents:', e.message); return []; }
}

async function getRecentAnnouncements(limitTo=3) {
  try {
    const snap = await db.collection('announcements').get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0)).slice(0,limitTo);
  } catch(e) { console.error('getRecentAnnouncements:', e.message); return []; }
}

// ── STUDENTS ──

// Fetches ALL documents — no Firestore where() on multiple fields, filters in memory
async function getStudents({ classKey=null, search='' } = {}) {
  try {
    const snap = await db.collection('students').get();
    let docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (classKey) docs = docs.filter(d => d.classKey === classKey);
    docs.sort((a,b) => (a.lastName||'').localeCompare(b.lastName||''));
    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter(d =>
        (d.firstName||'').toLowerCase().includes(q) ||
        (d.lastName||'').toLowerCase().includes(q)  ||
        (d.studentId||'').toLowerCase().includes(q) ||
        (d.parentPhone||'').includes(q)
      );
    }
    return docs;
  } catch(e) { console.error('getStudents:', e); return []; }
}

async function getStudentById(id) {
  try {
    const doc = await db.collection('students').doc(id).get();
    return doc.exists ? { id:doc.id, ...doc.data() } : null;
  } catch(e) { console.error('getStudentById:', e.message); return null; }
}

async function getStudentCount() {
  try { return (await db.collection('students').get()).size; } catch(e) { return 0; }
}

async function addStudent({ firstName, lastName, dob, gender, classKey, parentName, parentPhone, parentEmail, address }) {
  try {
    const count     = await getStudentCount();
    const studentId = `GA-${new Date().getFullYear()}-${String(count+1).padStart(4,'0')}`;
    await db.collection('students').doc(studentId).set({
      studentId, firstName, lastName,
      dob:dob||'', gender:gender||'Male', classKey:classKey||'',
      parentName:parentName||'', parentPhone:parentPhone||'',
      parentEmail:parentEmail||'', address:address||'',
      status:'active', photoURL:'',
      enrolledAt:new Date(), updatedAt:new Date(),
    });
    return { success:true, studentId };
  } catch(e) { console.error('addStudent:', e); return { success:false, error:e.message }; }
}

async function updateStudent(id, data) {
  try {
    await db.collection('students').doc(id).update({ ...data, updatedAt:new Date() });
    return { success:true };
  } catch(e) { console.error('updateStudent:', e); return { success:false, error:e.message }; }
}

// ── STAFF ──

async function getStaff({ status='active' } = {}) {
  try {
    const snap = await db.collection('staff').get();
    let docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (status) docs = docs.filter(d => !d.status || d.status===status);
    return docs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  } catch(e) { console.error('getStaff:', e); return []; }
}

async function getStaffById(id) {
  try {
    const doc = await db.collection('staff').doc(id).get();
    return doc.exists ? { id:doc.id, ...doc.data() } : null;
  } catch(e) { console.error('getStaffById:', e.message); return null; }
}

async function getStaffCount() {
  try { return (await db.collection('staff').get()).size; } catch(e) { return 0; }
}

async function addStaff({ name, role, department, subjects, phone, email, salary }) {
  try {
    const staffId = `ST-${String((await getStaffCount())+1).padStart(3,'0')}`;
    const ref = await db.collection('staff').add({
      staffId, name, role:role||'Teacher', department:department||'',
      subjects:subjects||[], phone:phone||'', email:email||'',
      salary:parseFloat(salary)||0, status:'active', photoURL:'',
      joinedAt:new Date(), updatedAt:new Date(),
    });
    return { success:true, id:ref.id, staffId };
  } catch(e) { console.error('addStaff:', e); return { success:false, error:e.message }; }
}

async function updateStaff(id, data) {
  try {
    await db.collection('staff').doc(id).update({ ...data, updatedAt:new Date() });
    return { success:true };
  } catch(e) { console.error('updateStaff:', e); return { success:false, error:e.message }; }
}

// ── ATTENDANCE ──

async function getAttendance(classKey, date) {
  try {
    // Single where() on date; classKey filtered in memory
    const snap = await db.collection('attendance').where('date','==',date).get();
    const map = {};
    snap.docs.forEach(d => { const x=d.data(); if(x.classKey===classKey) map[x.studentId]={id:d.id,...x}; });
    return map;
  } catch(e) { console.error('getAttendance:', e); return {}; }
}

async function getStudentAttendance(studentId) {
  try {
    const snap = await db.collection('attendance').where('studentId','==',studentId).get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,60);
  } catch(e) { console.error('getStudentAttendance:', e.message); return []; }
}

async function saveAttendance(records, classKey, date, markedBy) {
  try {
    for (const rec of records) {
      await db.collection('attendance').doc(`${rec.studentId}_${date}`).set({
        studentId:rec.studentId, studentName:rec.studentName,
        classKey, date, status:rec.status, note:rec.note||'', markedBy, createdAt:new Date(),
      }, { merge:true });
    }
    return { success:true, count:records.length };
  } catch(e) { console.error('saveAttendance:', e); return { success:false, error:e.message }; }
}

// ── GRADES ──

async function getClassGrades(classKey, term, year) {
  try {
    const snap = await db.collection('grades').where('classKey','==',classKey).get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.term===term&&d.year===year);
  } catch(e) { console.error('getClassGrades:', e); return []; }
}

async function getStudentGrades(studentId, term, year) {
  try {
    const snap = await db.collection('grades').where('studentId','==',studentId).get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.term===term&&d.year===year).sort((a,b)=>(a.subjectKey||'').localeCompare(b.subjectKey||''));
  } catch(e) { console.error('getStudentGrades:', e.message); return []; }
}

async function saveGrades(entries, term, year, enteredBy) {
  try {
    for (const e of entries) {
      const g = getGrade(e.score);
      await db.collection('grades').doc(`${e.studentId}_${e.subjectKey}_${term}_${year}`).set({
        studentId:e.studentId, studentName:e.studentName, classKey:e.classKey,
        subjectKey:e.subjectKey, term, year, score:parseFloat(e.score)||0,
        grade:g.grade, remark:g.remark, enteredBy, updatedAt:new Date(),
      }, { merge:true });
    }
    const ids = [...new Set(entries.map(e=>e.studentId))];
    for (const id of ids) await rebuildGradeSummary(id, term, year);
    return { success:true };
  } catch(e) { console.error('saveGrades:', e); return { success:false, error:e.message }; }
}

async function rebuildGradeSummary(studentId, term, year) {
  try {
    const snap   = await db.collection('grades').where('studentId','==',studentId).get();
    const grades = snap.docs.map(d=>d.data()).filter(d=>d.term===term&&d.year===year);
    if (!grades.length) return;
    const avg = grades.reduce((s,g)=>s+(g.score||0),0)/grades.length;
    const stu = await getStudentById(studentId);
    await db.collection('grade_summaries').doc(`${studentId}_${term}_${year}`).set({
      studentId, studentName:stu?`${stu.firstName} ${stu.lastName}`:'',
      classKey:stu?.classKey||'', term, year,
      avgScore:parseFloat(avg.toFixed(1)), subjectCount:grades.length, updatedAt:new Date(),
    }, { merge:true });
  } catch(e) { console.error('rebuildGradeSummary:', e); }
}

// ── FINANCE ──

async function getStudentPayments(studentId, term, year) {
  try {
    const snap = await db.collection('fee_payments').where('studentId','==',studentId).get();
    let docs = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (term) docs = docs.filter(d=>d.term===term);
    if (year) docs = docs.filter(d=>d.year===year);
    return docs.sort((a,b)=>(b.paidAt?.toMillis?.()??0)-(a.paidAt?.toMillis?.()??0));
  } catch(e) { console.error('getStudentPayments:', e.message); return []; }
}

async function getPaymentsByTerm(term, year, limitTo=50) {
  try {
    const snap = await db.collection('fee_payments').where('term','==',term).get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.year===year).sort((a,b)=>(b.paidAt?.toMillis?.()??0)-(a.paidAt?.toMillis?.()??0)).slice(0,limitTo);
  } catch(e) { console.error('getPaymentsByTerm:', e.message); return []; }
}

async function recordPayment({ studentId, studentName, classKey, term, year, amount, method, reference, recordedBy, notes }) {
  try {
    const ref = await db.collection('fee_payments').add({
      studentId, studentName, classKey, term, year,
      amount:parseFloat(amount), method:method||'Cash',
      reference:reference||'', notes:notes||'', recordedBy, paidAt:new Date(),
    });
    return { success:true, id:ref.id };
  } catch(e) { console.error('recordPayment:', e); return { success:false, error:e.message }; }
}

async function getOutstanding(term, year, limitTo=50) {
  try {
    const [sSnap, fSnap] = await Promise.all([
      db.collection('students').get(),
      db.collection('fee_payments').where('term','==',term).get(),
    ]);
    const paid={};
    fSnap.docs.forEach(d=>{ const x=d.data(); if(x.year!==year)return; paid[x.studentId]=(paid[x.studentId]||0)+(x.amount||0); });
    const out=[];
    sSnap.docs.forEach(doc=>{ const s={id:doc.id,...doc.data()}; if(s.status&&s.status!=='active')return; const exp=s.classKey?.startsWith('jhs')?2400:2000; const p=paid[s.studentId]||paid[doc.id]||0; const bal=exp-p; if(bal>0)out.push({...s,expected:exp,paidAmt:p,balance:bal}); });
    return out.sort((a,b)=>b.balance-a.balance).slice(0,limitTo);
  } catch(e) { console.error('getOutstanding:', e); return []; }
}

// ── LIBRARY ──

async function getBooks({ search='' } = {}) {
  try {
    const snap = await db.collection('books').get();
    let docs = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.title||'').localeCompare(b.title||''));
    if (search) { const q=search.toLowerCase(); docs=docs.filter(d=>(d.title||'').toLowerCase().includes(q)||(d.author||'').toLowerCase().includes(q)||(d.isbn||'').includes(q)); }
    return docs;
  } catch(e) { console.error('getBooks:', e.message); return []; }
}

async function addBook({ title, author, isbn, category, totalCopies }) {
  try {
    const copies = parseInt(totalCopies)||1;
    const ref = await db.collection('books').add({ title, author:author||'', isbn:isbn||'', category:category||'Textbook', totalCopies:copies, availableCopies:copies, createdAt:new Date() });
    return { success:true, id:ref.id };
  } catch(e) { console.error('addBook:', e); return { success:false, error:e.message }; }
}

async function getBorrowedBooks() {
  try {
    const snap = await db.collection('book_borrows').where('status','==','borrowed').get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
  } catch(e) { console.error('getBorrowedBooks:', e.message); return []; }
}

async function issueBook({ bookId, studentId, studentName, dueDate, issuedBy }) {
  try {
    const bookRef = db.collection('books').doc(bookId);
    const book    = await bookRef.get();
    if (!book.exists || book.data().availableCopies < 1) return { success:false, error:'Book not available.' };
    const avail = book.data().availableCopies;
    const ref = await db.collection('book_borrows').add({ bookId, bookTitle:book.data().title, studentId, studentName, issuedAt:new Date(), dueDate, issuedBy, status:'borrowed', returnedAt:null });
    await bookRef.update({ availableCopies:avail-1 });
    return { success:true, id:ref.id };
  } catch(e) { console.error('issueBook:', e); return { success:false, error:e.message }; }
}

async function returnBook(borrowId, bookId) {
  try {
    const bookRef = db.collection('books').doc(bookId);
    const book    = await bookRef.get();
    const avail   = book.exists ? (book.data().availableCopies||0) : 0;
    await db.collection('book_borrows').doc(borrowId).update({ status:'returned', returnedAt:new Date() });
    await bookRef.update({ availableCopies:avail+1 });
    return { success:true };
  } catch(e) { console.error('returnBook:', e); return { success:false, error:e.message }; }
}

// ── ANNOUNCEMENTS ──

async function getAnnouncements(limitTo=20) {
  try {
    const snap = await db.collection('announcements').get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0)).slice(0,limitTo);
  } catch(e) { console.error('getAnnouncements:', e.message); return []; }
}

async function addAnnouncement({ title, body, audience, classKey, priority, channel, createdBy }) {
  try {
    const ref = await db.collection('announcements').add({ title, body, audience:audience||'everyone', classKey:classKey||null, priority:priority||'normal', channel:channel||'in-app', createdBy, createdAt:new Date() });
    return { success:true, id:ref.id };
  } catch(e) { console.error('addAnnouncement:', e); return { success:false, error:e.message }; }
}

// ── TIMETABLE ──

async function getTimetable(classKey, term, year) {
  try {
    const snap = await db.collection('timetable').where('classKey','==',classKey).get();
    return snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>!d.term||(d.term===term&&(!d.year||d.year===year)));
  } catch(e) { console.error('getTimetable:', e.message); return []; }
}

async function saveTimetableSlot({ classKey, subjectKey, staffId, staffName, day, startTime, endTime, term, year }) {
  try {
    await db.collection('timetable').doc(`${classKey}_${day}_${startTime}_${term}_${year}`).set({ classKey, subjectKey, staffId:staffId||'', staffName:staffName||'', day, startTime, endTime, term, year, updatedAt:new Date() }, { merge:true });
    return { success:true };
  } catch(e) { console.error('saveTimetableSlot:', e); return { success:false, error:e.message }; }
}
