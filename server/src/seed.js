// Demo institutions, accounts and sample data.
// The server adds these automatically the first time it starts.
// To wipe everything and start fresh: stop the server, run "npm run reset", start it again.
require('dotenv').config();
process.env.TZ = process.env.APP_TZ || 'Asia/Dhaka';

const store = require('./store');
const { hashPassword } = require('./utils/users');
const { availability, firstFree, lastWorkDay, liveBookings } = require('./utils/time');
const { defaultsFor } = require('./config/terms');
const { addDays, addMonths, priceFor } = require('./config/plans');

const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();

async function seedDatabase() {
  const db = store.reset();
  const hashes = {
    student: await hashPassword('student123'),
    faculty: await hashPassword('faculty123'),
    staff: await hashPassword('staff123'),
    admin: await hashPassword('admin123'),
    superadmin: await hashPassword('owner123'),
    company: await hashPassword('company123'),
  };

  // Campusly company side: the owner, and office staff who read applications and check payments.
  db.users.push({ id: store.newId(), role: 'superadmin', name: 'Campusly Owner', email: 'owner@campusly.com.bd', title: 'Owner', passwordHash: hashes.superadmin, status: 'active', isDemo: true, createdAt: ago(900) });
  db.users.push({ id: store.newId(), role: 'company', name: 'Rina Sultana', email: 'rina@campusly.com.bd', title: 'Sales and onboarding', passwordHash: hashes.company, status: 'active', isDemo: true, createdAt: ago(600) });
  db.users.push({ id: store.newId(), role: 'company', name: 'Imran Hossain', email: 'imran@campusly.com.bd', title: 'Accounts', passwordHash: hashes.company, status: 'active', isDemo: true, createdAt: ago(600) });

  // Builds one institution with its people, courses, meetings, reports and notifications.
  function institution({ type, name, shortName, city, people, courses, appts = [], pastAppts = [], reports = [], notes = [], counter, plan, cycle, daysLeft, trial = false, paid = [] }) {
    const inst = { id: store.newId(), type, name, shortName, city, createdAt: ago(800), ...defaultsFor(type) };
    const endsAt = addDays(new Date().toISOString(), daysLeft);
    inst.subscription = { plan, cycle, trial, startsAt: trial ? ago(24 * (14 - daysLeft)) : addMonths(endsAt, -({ monthly: 1, halfyear: 6, yearly: 12 }[cycle])), endsAt };
    db.institutions.push(inst);
    paid.forEach(([monthsBack, trx, method, kind]) => db.payments.push({
      id: store.newId(), institutionId: inst.id, kind: kind || 'renew', plan, cycle, amount: priceFor(plan, cycle), method, trxId: trx,
      payerNumber: '01712345678', status: 'verified', createdAt: addMonths(new Date().toISOString(), -monthsBack), decidedAt: addMonths(new Date().toISOString(), -monthsBack), decidedBy: 'Imran Hossain',
    }));
    const U = {};
    Object.entries(people).forEach(([key, data]) => {
      U[key] = { id: store.newId(), institutionId: inst.id, status: 'active', ...data, passwordHash: hashes[data.role], isDemo: true, createdAt: ago(400) };
      if (U[key].hours) U[key].hours = U[key].hours.map((h) => ({ _id: store.newId(), ...h }));
      if (U[key].advisor) { U[key].advisorId = U[U[key].advisor].id; delete U[key].advisor; }
      db.users.push(U[key]);
    });
    courses.forEach(([code, title, section, f]) => db.courses.push({ institutionId: inst.id, code, title, section, facultyId: U[f].id }));

    // Upcoming meetings, placed on real free slots so the demo always looks current.
    appts.forEach(({ s, f, skip = 0, ...rest }) => {
      const p = firstFree(availability(U[f].hours, liveBookings(db.appointments, U[f].id)), skip);
      if (!p) return;
      db.appointments.push({ id: store.newId(), institutionId: inst.id, studentId: U[s].id, facultyId: U[f].id, mode: 'In person', note: '', course: null, createdAt: ago(20), ...rest, ...p });
    });
    pastAppts.forEach(({ s, f, back, ...rest }) => db.appointments.push({
      id: store.newId(), institutionId: inst.id, studentId: U[s].id, facultyId: U[f].id, mode: 'In person', course: null, note: '', date: lastWorkDay(back), createdAt: ago(back * 30), ...rest,
    }));

    const H = (status, h, note, by, kind) => ({ status, at: ago(h), note: note || '', by: by || '', kind: kind || null });
    reports.forEach(({ reporter, history, ...o }) => db.reports.push({
      institutionId: inst.id, photo: null, ...o, reporterId: U[reporter].id, reporterName: U[reporter].name,
      history: history.map((h) => H(...h)), createdAt: ago(history[0][1]),
    }));
    inst.reportCounter = counter;
    notes.forEach(([to, text, link, h, read]) => db.notifications.push({ id: store.newId(), to: U[to].id, text, link, read, createdAt: ago(h) }));
    return U;
  }

  // ---------- University: East West University ----------
  institution({
    type: 'university', name: 'East West University', shortName: 'EWU', city: 'Dhaka', counter: 1044,
    plan: 'premium', cycle: 'yearly', daysLeft: 214, paid: [[5, 'BK7H2M9XQ1', 'bkash', 'new']],
    people: {
      f1: { role: 'faculty', name: 'Dr. Mahfuz Rahman', email: 'mahfuz.rahman@ewubd.edu', title: 'Associate Professor, CSE', room: 'Room 642',
        hours: [{ day: 0, start: '10:00', end: '11:20' }, { day: 2, start: '10:00', end: '11:20' }, { day: 3, start: '14:00', end: '15:00' }] },
      f2: { role: 'faculty', name: 'Farhana Akter', email: 'farhana.akter@ewubd.edu', title: 'Lecturer, CSE', room: 'Room 531',
        hours: [{ day: 1, start: '11:30', end: '12:50' }, { day: 3, start: '11:30', end: '12:50' }, { day: 6, start: '10:00', end: '11:00' }] },
      f3: { role: 'faculty', name: 'Tanvir Hasan', email: 'tanvir.hasan@ewubd.edu', title: 'Senior Lecturer, CSE', room: 'Room 538',
        hours: [{ day: 0, start: '13:00', end: '14:20' }, { day: 4, start: '10:00', end: '11:20' }] },
      f4: { role: 'faculty', name: 'Sadia Islam', email: 'sadia.islam@ewubd.edu', title: 'Lecturer, CSE', room: 'Room 627',
        hours: [{ day: 2, start: '14:30', end: '15:50' }, { day: 4, start: '13:00', end: '14:00' }] },
      s1: { role: 'student', name: 'Nusrat Jahan', sid: '2023-1-60-145', email: '2023-1-60-145@std.ewubd.edu', dept: 'CSE', advisor: 'f1', courses: ['CSE302', 'CSE325', 'CSE347', 'CSE405'] },
      s2: { role: 'student', name: 'Arif Hossain', sid: '2022-3-60-021', email: '2022-3-60-021@std.ewubd.edu', dept: 'CSE', advisor: 'f1', courses: ['CSE325', 'CSE347', 'CSE405'] },
      s3: { role: 'student', name: 'Mim Chowdhury', sid: '2023-2-60-110', email: '2023-2-60-110@std.ewubd.edu', dept: 'CSE', advisor: 'f2', courses: ['CSE302', 'CSE347'] },
      s4: { role: 'student', name: 'Rafiq Ahmed', sid: '2022-1-60-087', email: '2022-1-60-087@std.ewubd.edu', dept: 'CSE', advisor: 'f3', courses: ['CSE302', 'CSE325', 'CSE405'] },
      a1: { role: 'admin', name: 'Kamrul Islam', email: 'admin@ewubd.edu', title: 'Services administrator' },
      d2: { role: 'staff', name: 'Rezaul Karim', email: 'proctor@ewubd.edu', title: 'Assistant Proctor', office: 'Proctor Office' },
      d3: { role: 'staff', name: 'Nasima Begum', email: 'cselab@ewubd.edu', title: 'Lab in-charge', office: 'CSE Lab Office' },
      d4: { role: 'staff', name: 'Shafiqul Alam', email: 'itsupport@ewubd.edu', title: 'IT officer', office: 'IT Support' },
      d5: { role: 'staff', name: 'Habibur Rahman', email: 'facilities@ewubd.edu', title: 'Facilities supervisor', office: 'Facilities & Maintenance' },
      d6: { role: 'staff', name: 'Farzana Yasmin', email: 'welfare@ewubd.edu', title: 'Student welfare officer', office: 'Student Welfare' },
    },
    courses: [
      ['CSE302', 'Database Systems', '2', 'f2'],
      ['CSE325', 'Operating Systems', '1', 'f3'],
      ['CSE347', 'Information System Analysis and Design', '1', 'f1'],
      ['CSE405', 'Computer Networks', '3', 'f4'],
    ],
    appts: [
      { s: 's1', f: 'f1', type: 'Advising', agenda: 'Course plan for next semester, and whether I can start my capstone early.', status: 'Confirmed', skip: 1 },
      { s: 's2', f: 'f1', type: 'Advising', agenda: 'Dropping CSE325 and how it affects my graduation plan.', status: 'Pending', mode: 'Online', skip: 2 },
      { s: 's3', f: 'f1', type: 'Course', course: 'CSE347', agenda: 'Feedback on our group project proposal draft.', status: 'Confirmed' },
      { s: 's1', f: 'f3', type: 'Course', course: 'CSE325', agenda: 'Doubt about page replacement in Assignment 2.', status: 'Pending' },
      { s: 's4', f: 'f3', type: 'Advising', agenda: 'Internship credit and summer semester load.', status: 'Pending', skip: 1 },
      { s: 's3', f: 'f2', type: 'Advising', agenda: 'Retaking a course to improve my CGPA.', status: 'Confirmed' },
    ],
    pastAppts: [
      { s: 's1', f: 'f2', back: 4, type: 'Course', course: 'CSE302', time: '11:30', agenda: 'Normalization questions before the midterm.', status: 'Completed', note: 'Practise BCNF decomposition from the shared exercise sheet.' },
      { s: 's4', f: 'f1', back: 1, type: 'Advising', time: '10:20', agenda: 'Choosing between the AI and networking elective tracks.', status: 'Confirmed' },
    ],
    reports: [
      { code: 'CP-1044', title: 'Wi-Fi keeps dropping in the library reading room', category: 'Internet or IT', location: 'Library reading room',
        description: 'The student network disconnects every few minutes since Sunday. Many of us cannot download lecture files.', priority: 'Normal', anonymous: true,
        reporter: 's4', dept: 'IT Support', status: 'Submitted', history: [['Submitted', 1.5, '', 'Anonymous']] },
      { code: 'CP-1043', title: 'Water leaking beside the 3rd floor staircase', category: 'Safety incident', location: '3rd floor corridor',
        description: 'Water is pooling next to the stairs and the floor is slippery. A student almost fell this morning.', priority: 'Urgent', anonymous: false,
        reporter: 's2', dept: 'Proctor Office', status: 'Acknowledged',
        history: [['Submitted', 3, '', 'Arif Hossain'], ['Acknowledged', 2.6, 'Cleaning staff sent and the area is cordoned off.', 'Proctor Office']] },
      { code: 'CP-1042', title: 'Air conditioner in Room 630 drips onto the desks', category: 'Classroom or facility', location: 'Room 630',
        description: 'Water drips from the AC unit onto the front two rows during afternoon classes.', priority: 'Normal', anonymous: false,
        reporter: 's3', dept: 'Facilities & Maintenance', status: 'Submitted', history: [['Submitted', 8, '', 'Mim Chowdhury']] },
      { code: 'CP-1041', title: 'Projector in Room 431 does not turn on', category: 'Classroom or facility', location: 'Room 431',
        description: 'The projector stays on standby. Two classes had to run without slides this week.', priority: 'Normal', anonymous: false,
        reporter: 's1', dept: 'Facilities & Maintenance', status: 'In progress',
        history: [['Submitted', 52, '', 'Nusrat Jahan'], ['Acknowledged', 40, 'Forwarded to the AV technician.', 'Facilities & Maintenance'], ['In progress', 20, 'Replacement lamp ordered, expected within two days.', 'Facilities & Maintenance']] },
      { code: 'CP-1039', title: 'Two oscilloscopes in Lab 324 show no signal', category: 'Lab equipment', location: 'Lab 324',
        description: 'Channel 1 on both units shows a flat line even with the calibration signal.', priority: 'Normal', anonymous: false,
        reporter: 'f3', dept: 'CSE Lab Office', status: 'In progress',
        history: [['Submitted', 30, '', 'Tanvir Hasan'], ['Acknowledged', 26, '', 'CSE Lab Office'], ['In progress', 10, 'Sent to the vendor for inspection.', 'CSE Lab Office']] },
      { code: 'CP-1037', title: 'Three PCs in Lab 532 have broken keyboards', category: 'Lab equipment', location: 'Lab 532',
        description: 'PC 4, 9 and 12 are missing keys, so students share machines during lab tests.', priority: 'Normal', anonymous: false,
        reporter: 's1', dept: 'CSE Lab Office', status: 'Resolved',
        history: [['Submitted', 120, '', 'Nusrat Jahan'], ['Acknowledged', 112, 'Logged with the lab technician.', 'CSE Lab Office'], ['In progress', 100, '', 'CSE Lab Office'], ['Resolved', 74, 'Keyboards replaced on PC 4, 9 and 12.', 'CSE Lab Office']] },
    ],
    notes: [
      ['s1', 'Dr. Mahfuz Rahman confirmed your advising appointment.', '/appointments', 18, false],
      ['s1', 'CP-1041 is now in progress: replacement lamp ordered, expected within two days.', '/reports', 20, false],
      ['s1', 'CP-1037 was resolved: keyboards replaced on PC 4, 9 and 12.', '/reports', 74, true],
      ['s2', 'CP-1043 was acknowledged: cleaning staff sent and the area is cordoned off.', '/reports', 2.6, false],
      ['f1', 'Arif Hossain requested an advising appointment.', '/', 5, false],
      ['f3', 'Rafiq Ahmed requested an advising appointment.', '/', 4, false],
      ['a1', 'Urgent report CP-1043: water leaking beside the 3rd floor staircase.', '/queue', 3, false],
      ['d2', 'Urgent report CP-1043: water leaking beside the 3rd floor staircase.', '/queue', 3, false],
      ['a1', 'New report CP-1044 for IT Support.', '/queue', 1.5, false],
      ['d4', 'New report CP-1044 for IT Support.', '/queue', 1.5, false],
      ['d5', 'New report CP-1042 for Facilities & Maintenance.', '/queue', 8, false],
    ],
  });

  // ---------- College: a demo college ----------
  institution({
    type: 'college', name: 'Greenfield Model College', shortName: 'GMC', city: 'Dhaka', counter: 1003,
    plan: 'standard', cycle: 'monthly', daysLeft: 5, paid: [[2, 'NG4T8K2LP6', 'nagad', 'new'], [1, 'NG9W3R5ZD2', 'nagad']],
    people: {
      t1: { role: 'faculty', name: 'Md. Abdul Karim', email: 'karim@greenfield.edu.bd', title: 'Lecturer, Physics', room: 'Teachers room 2',
        hours: [{ day: 0, start: '12:00', end: '13:00' }, { day: 2, start: '12:00', end: '13:00' }, { day: 4, start: '11:00', end: '12:00' }] },
      t2: { role: 'faculty', name: 'Shirin Akter', email: 'shirin@greenfield.edu.bd', title: 'Lecturer, English', room: 'Teachers room 1',
        hours: [{ day: 1, start: '11:00', end: '12:00' }, { day: 3, start: '11:00', end: '12:00' }, { day: 6, start: '10:00', end: '11:00' }] },
      t3: { role: 'faculty', name: 'Nazmul Hoque', email: 'nazmul@greenfield.edu.bd', title: 'Lecturer, ICT', room: 'Computer lab',
        hours: [{ day: 0, start: '14:00', end: '15:00' }, { day: 3, start: '14:00', end: '15:00' }] },
      s1: { role: 'student', name: 'Tahmid Hasan', sid: 'GMC-24-0112', email: '', dept: 'Science', advisor: 't1', courses: ['PHY-1', 'ENG-1', 'ICT'] },
      s2: { role: 'student', name: 'Sumaiya Rahman', sid: 'GMC-24-0157', email: '', dept: 'Business Studies', advisor: 't2', courses: ['ENG-1', 'ICT'] },
      a1: { role: 'admin', name: 'Prof. Selina Parvin', email: 'admin@greenfield.edu.bd', title: 'Vice Principal' },
      d1: { role: 'staff', name: 'Rakib Hasan', email: 'it@greenfield.edu.bd', title: 'Lab assistant', office: 'IT & Computer Lab' },
      d2: { role: 'staff', name: 'Jamal Uddin', email: 'facilities@greenfield.edu.bd', title: 'Caretaker', office: 'Facilities' },
    },
    courses: [
      ['PHY-1', 'Physics 1st Paper', 'Science A', 't1'],
      ['ENG-1', 'English 1st Paper', 'All groups', 't2'],
      ['ICT', 'Information and Communication Technology', 'All groups', 't3'],
    ],
    appts: [
      { s: 's1', f: 't1', type: 'Advising', agenda: 'Study plan for the test exam and weak chapters in Physics.', status: 'Confirmed' },
      { s: 's2', f: 't3', type: 'Course', course: 'ICT', agenda: 'Help with HTML practical before the lab test.', status: 'Pending' },
    ],
    reports: [
      { code: 'CP-1003', title: 'Ceiling fan in Room 204 makes a loud noise', category: 'Classroom or facility', location: 'Room 204',
        description: 'The second fan from the front shakes and rattles. It is hard to hear the teacher during class.', priority: 'Normal', anonymous: false,
        reporter: 's1', dept: 'Facilities', status: 'Acknowledged',
        history: [['Submitted', 26, '', 'Tahmid Hasan'], ['Acknowledged', 20, 'Electrician will check it on Sunday.', 'Facilities']] },
      { code: 'CP-1002', title: 'Five computers in the lab cannot open the internet', category: 'Internet or IT', location: 'Computer lab',
        description: 'PCs in the back row show no network, so we share computers during ICT practicals.', priority: 'Normal', anonymous: false,
        reporter: 't3', dept: 'IT & Computer Lab', status: 'Submitted', history: [['Submitted', 5, '', 'Nazmul Hoque']] },
    ],
    notes: [
      ['s1', 'Md. Abdul Karim confirmed your guide teacher meeting.', '/appointments', 10, false],
      ['t3', 'Sumaiya Rahman requested an ICT subject meeting.', '/', 3, false],
      ['a1', 'New report CP-1002 for IT & Computer Lab.', '/queue', 5, false],
      ['d1', 'New report CP-1002 for IT & Computer Lab.', '/queue', 5, false],
    ],
  });

  // ---------- School: a demo school ----------
  institution({
    type: 'school', name: 'Sunrise High School', shortName: 'SHS', city: 'Chattogram', counter: 1002,
    plan: 'starter', cycle: 'monthly', trial: true, daysLeft: 9,
    people: {
      t1: { role: 'faculty', name: 'Rokeya Sultana', email: 'rokeya@sunrise.edu.bd', title: 'Assistant Teacher, Mathematics', room: 'Teachers room',
        hours: [{ day: 0, start: '13:00', end: '14:00' }, { day: 2, start: '13:00', end: '14:00' }, { day: 4, start: '13:00', end: '14:00' }] },
      t2: { role: 'faculty', name: 'Habib Ullah', email: 'habib@sunrise.edu.bd', title: 'Assistant Teacher, Science', room: 'Science room',
        hours: [{ day: 1, start: '12:30', end: '13:30' }, { day: 3, start: '12:30', end: '13:30' }] },
      s1: { role: 'student', name: 'Ayan Chowdhury', sid: '8A-07', email: '', dept: 'Class 8', advisor: 't1', courses: ['MATH-8', 'SCI-8'] },
      s2: { role: 'student', name: 'Nabila Islam', sid: '8A-15', email: '', dept: 'Class 8', advisor: 't1', courses: ['MATH-8', 'SCI-8'] },
      a1: { role: 'admin', name: 'Md. Mizanur Rahman', email: 'admin@sunrise.edu.bd', title: 'Head Teacher' },
      d1: { role: 'staff', name: 'Abul Kalam', email: 'office@sunrise.edu.bd', title: 'Office assistant', office: 'Facilities' },
    },
    courses: [
      ['MATH-8', 'Mathematics', 'Class 8 A', 't1'],
      ['SCI-8', 'General Science', 'Class 8 A', 't2'],
    ],
    appts: [
      { s: 's1', f: 't1', type: 'Advising', agenda: 'My mother wants to discuss my half-yearly exam results.', status: 'Pending' },
      { s: 's2', f: 't2', type: 'Course', course: 'SCI-8', agenda: 'I did not understand the chapter on cells.', status: 'Confirmed' },
    ],
    reports: [
      { code: 'CP-1002', title: 'Broken bench in the Class 8 room', category: 'Classroom or facility', location: 'Class 8 room',
        description: 'The third bench on the left has a broken leg and tilts when we sit on it.', priority: 'Normal', anonymous: false,
        reporter: 's1', dept: 'Facilities', status: 'In progress',
        history: [['Submitted', 48, '', 'Ayan Chowdhury'], ['Acknowledged', 40, '', 'Facilities'], ['In progress', 12, 'Carpenter is repairing it this week.', 'Facilities']] },
      { code: 'CP-1001', title: 'Older students tease us near the playground', category: 'Misconduct or bullying', location: 'Playground',
        description: 'Some students from a higher class block the way and take our snacks during tiffin break.', priority: 'Urgent', anonymous: true,
        reporter: 's2', dept: 'Discipline Committee', status: 'Submitted', history: [['Submitted', 2, '', 'Anonymous']] },
    ],
    notes: [
      ['t1', 'Ayan Chowdhury requested a class teacher meeting.', '/', 2, false],
      ['a1', 'Urgent report CP-1001: older students tease us near the playground.', '/queue', 2, false],
    ],
  });

  // A join code, a waiting sign-up, and two applications for the company inbox.
  const ewu = db.institutions.find((i) => i.shortName === 'EWU');
  const adv = db.users.find((u) => u.institutionId === ewu.id && u.role === 'faculty');
  db.joinCodes.push({ id: store.newId(), institutionId: ewu.id, code: 'CSE26A', group: 'CSE', advisorId: adv.id, active: true, expiresAt: null, uses: 0, createdAt: ago(48) });
  db.users.push({
    id: store.newId(), institutionId: ewu.id, role: 'student', name: 'Tasnim Akter', sid: '2024-1-60-310', email: '', dept: 'CSE', advisorId: null, courses: [],
    status: 'pending', passwordHash: hashes.student, isDemo: true, createdAt: ago(5),
  });
  db.counters.application = 1002;
  db.applications.push({
    id: store.newId(), code: 'APP-1001', status: 'new', createdAt: ago(7),
    institution: { type: 'college', name: 'Dhaka Residential Model College', shortName: 'DRMC', city: 'Dhaka', address: 'Mohammadpur' },
    contact: { name: 'Md. Anwar Hossain', designation: 'Vice Principal', email: 'vp@drmc.example.bd', phone: '01711223344' },
    students: 1200, message: 'We want to move appointments and complaints off paper.', notes: [],
    payment: { plan: 'standard', cycle: 'halfyear', trial: false, amount: priceFor('standard', 'halfyear'), method: 'bkash', trxId: 'BK2Q8W4N7D', payerNumber: '01711223344' },
  });
  db.applications.push({
    id: store.newId(), code: 'APP-1002', status: 'new', createdAt: ago(2),
    institution: { type: 'school', name: 'Shapla Kindergarten and School', shortName: 'SKS', city: 'Rajshahi', address: '' },
    contact: { name: 'Shirin Akter', designation: 'Head Teacher', email: 'head@shapla.example.bd', phone: '01855667788' },
    students: 240, message: '', notes: [],
    payment: { plan: 'starter', cycle: 'monthly', trial: true, amount: priceFor('starter', 'monthly'), method: 'trial', trxId: null, payerNumber: null },
  });

  await store.save();
  const count = (role) => db.users.filter((u) => u.role === role).length;
  console.log(`Added 3 demo institutions (school, college, university) with ${count('student')} students, ${count('faculty')} teachers, `
    + `${count('staff')} office staff, ${count('admin')} admins and 1 Campusly owner.`);
}

if (require.main === module) {
  (async () => {
    await store.load(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campusly');
    await seedDatabase();
    await store.close();
  })().catch((e) => {
    console.error('Could not reset:', e.message);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
