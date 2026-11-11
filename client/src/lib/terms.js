// Words that change with the type of institution. The server has a matching copy in server/src/config/terms.js.
export const TERMS = {
  university: {
    inst: 'university', teacher: 'Faculty', teachers: 'Faculty', teacherLower: 'faculty member', advisor: 'Advisor', advisorLong: 'Academic advisor',
    course: 'Course', courses: 'Courses', instructor: 'Course instructor', sid: 'Student ID', sidExample: '2023-1-60-145', group: 'Department', groups: 'Departments',
    advisingAppt: 'advising appointment', courseAppt: 'office hour', apptShort: 'Advising',
  },
  college: {
    inst: 'college', teacher: 'Teacher', teachers: 'Teachers', teacherLower: 'teacher', advisor: 'Guide teacher', advisorLong: 'Guide teacher',
    course: 'Subject', courses: 'Subjects', instructor: 'Subject teacher', sid: 'College roll', sidExample: 'GMC-24-0112', group: 'Group', groups: 'Groups',
    advisingAppt: 'guide teacher meeting', courseAppt: 'subject meeting', apptShort: 'Guide teacher',
  },
  school: {
    inst: 'school', teacher: 'Teacher', teachers: 'Teachers', teacherLower: 'teacher', advisor: 'Class teacher', advisorLong: 'Class teacher',
    course: 'Subject', courses: 'Subjects', instructor: 'Subject teacher', sid: 'Roll no.', sidExample: '8A-07', group: 'Class', groups: 'Classes',
    advisingAppt: 'class teacher meeting', courseAppt: 'subject meeting', apptShort: 'Class teacher',
  },
};

export const TYPES = [
  { key: 'school', label: 'School', plural: 'Schools', icon: 'school', blurb: 'Primary and high schools, classes 1 to 10' },
  { key: 'college', label: 'College', plural: 'Colleges', icon: 'college', blurb: 'Higher secondary and degree colleges' },
  { key: 'university', label: 'University', plural: 'Universities', icon: 'university', blurb: 'Public and private universities' },
];
export const typeLabel = (type) => (TYPES.find((x) => x.key === type) || {}).label || '';

export const termsFor = (type) => TERMS[type] || TERMS.university;

export const roleLabel = (role, t) => ({
  student: 'Student', faculty: t.teacher, staff: 'Office staff', admin: 'Admin', superadmin: 'Campusly owner', company: 'Campusly staff',
}[role] || role);
