// Words and starting settings that change with the type of institution.
// The client has a matching copy in client/src/lib/terms.js.

const TYPES = ['school', 'college', 'university'];

const TERMS = {
  university: {
    inst: 'university', teacher: 'Faculty', teacherLower: 'faculty member', advisor: 'Advisor', advisorLong: 'Academic advisor',
    course: 'Course', instructor: 'Course instructor', sid: 'Student ID', group: 'Department',
    advisingAppt: 'advising appointment', courseAppt: 'office hour',
  },
  college: {
    inst: 'college', teacher: 'Teacher', teacherLower: 'teacher', advisor: 'Guide teacher', advisorLong: 'Guide teacher',
    course: 'Subject', instructor: 'Subject teacher', sid: 'College roll', group: 'Group',
    advisingAppt: 'guide teacher meeting', courseAppt: 'subject meeting',
  },
  school: {
    inst: 'school', teacher: 'Teacher', teacherLower: 'teacher', advisor: 'Class teacher', advisorLong: 'Class teacher',
    course: 'Subject', instructor: 'Subject teacher', sid: 'Roll no.', group: 'Class',
    advisingAppt: 'class teacher meeting', courseAppt: 'subject meeting',
  },
};

const DEFAULT_GROUPS = {
  university: ['CSE', 'EEE', 'ECE', 'BBA', 'Economics', 'English', 'Pharmacy', 'Civil Engineering'],
  college: ['Science', 'Business Studies', 'Humanities'],
  school: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'],
};

// [office name, report categories it receives by default]
const DEFAULT_OFFICES = {
  university: [
    ['CSE Lab Office', ['Lab equipment']],
    ['Facilities & Maintenance', ['Classroom or facility']],
    ['IT Support', ['Internet or IT']],
    ['Proctor Office', ['Safety incident']],
    ['Student Welfare', ['Misconduct or bullying']],
    ['Student Services', ['Something else']],
  ],
  college: [
    ["Principal's Office", ['Something else']],
    ['Science Lab', ['Lab equipment']],
    ['IT & Computer Lab', ['Internet or IT']],
    ['Facilities', ['Classroom or facility', 'Safety incident']],
    ['Discipline Committee', ['Misconduct or bullying']],
  ],
  school: [
    ["Head Teacher's Office", ['Something else', 'Safety incident']],
    ['Facilities', ['Classroom or facility']],
    ['Computer Lab', ['Lab equipment', 'Internet or IT']],
    ['Discipline Committee', ['Misconduct or bullying']],
  ],
};

const CATEGORY_LIST = [
  { name: 'Lab equipment', desc: 'Broken PCs, instruments, missing parts', ic: 'flask' },
  { name: 'Classroom or facility', desc: 'Projectors, fans, AC, lights, furniture', ic: 'building' },
  { name: 'Internet or IT', desc: 'Wi-Fi, portal login, lab network', ic: 'wifi' },
  { name: 'Safety incident', desc: 'Leaks, electrical hazards, injuries', ic: 'alert' },
  { name: 'Misconduct or bullying', desc: 'Bullying, harassment, ragging', ic: 'shield' },
  { name: 'Something else', desc: 'Anything the institution should know', ic: 'info' },
];

const DEFAULT_LOCATIONS = {
  university: ['Lab 532', 'Lab 534', 'Lab 324', 'Room 431', 'Room 630', 'Library reading room', 'Cafeteria', '3rd floor corridor', 'Main gate'],
  college: ['Room 101', 'Room 204', 'Physics lab', 'Chemistry lab', 'Computer lab', 'Library', 'Canteen', 'Playground', 'Main gate'],
  school: ['Class 6 room', 'Class 7 room', 'Class 8 room', 'Class 9 room', 'Class 10 room', 'Computer lab', 'Science room', 'Playground', 'Toilet block', 'Main gate'],
};

// Everything a brand-new institution starts with.
function defaultsFor(type) {
  const offices = DEFAULT_OFFICES[type].map(([o]) => o);
  const categories = CATEGORY_LIST.map((c) => ({
    ...c, dept: (DEFAULT_OFFICES[type].find(([, cats]) => cats.includes(c.name)) || [offices[0]])[0],
  }));
  return {
    offices, categories,
    groups: [...DEFAULT_GROUPS[type]],
    locations: [...DEFAULT_LOCATIONS[type]],
    reportCounter: 1000,
  };
}

module.exports = { TYPES, TERMS, defaultsFor };
