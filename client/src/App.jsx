import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Shell from './components/Shell';
import { Loading, Toast } from './components/ui';
import PublicLayout from './pages/public/PublicLayout';
import Home from './pages/public/Home';
import Pricing from './pages/public/Pricing';
import Apply from './pages/public/Apply';
import ApplyStatus from './pages/public/ApplyStatus';
import Login from './pages/auth/Login';
import Join from './pages/auth/Join';
import CompanyLogin from './pages/auth/CompanyLogin';
import ForcePassword from './pages/auth/ForcePassword';
import { Forgot, Reset } from './pages/auth/Forgot';
import StudentHome from './pages/student/StudentHome';
import Advisor from './pages/student/Advisor';
import Instructors from './pages/student/Instructors';
import Appointments from './pages/student/Appointments';
import Reports from './pages/Reports';
import ReportForm from './pages/ReportForm';
import FacultyHome from './pages/faculty/FacultyHome';
import Schedule from './pages/faculty/Schedule';
import Hours from './pages/faculty/Hours';
import Queue from './pages/staff/Queue';
import Insights from './pages/staff/Insights';
import AdminHome from './pages/admin/AdminHome';
import People from './pages/admin/People';
import Courses from './pages/admin/Courses';
import Offices from './pages/admin/Offices';
import JoinCodes from './pages/admin/JoinCodes';
import Billing from './pages/admin/Billing';
import Settings, { Account } from './pages/admin/Settings';
import CompanyHome from './pages/company/CompanyHome';
import Applications from './pages/company/Applications';
import Institutions from './pages/company/Institutions';
import Payments from './pages/company/Payments';
import Team from './pages/company/Team';

function RoleRoutes({ role }) {
  if (role === 'superadmin' || role === 'company') {
    return (
      <Route element={<Shell />}>
        <Route path="/" element={<CompanyHome />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/institutions" element={<Institutions />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/team" element={<Team />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    );
  }
  if (role === 'admin') {
    return (
      <Route element={<Shell />}>
        <Route path="/" element={<AdminHome />} />
        <Route path="/people" element={<People />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/join-codes" element={<JoinCodes />} />
        <Route path="/offices" element={<Offices />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    );
  }
  if (role === 'staff') {
    return (
      <Route element={<Shell />}>
        <Route path="/queue" element={<Queue />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="*" element={<Navigate to="/queue" replace />} />
      </Route>
    );
  }
  return (
    <Route element={<Shell />}>
      <Route path="/" element={role === 'student' ? <StudentHome /> : <FacultyHome />} />
      {role === 'student' && <Route path="/advisor" element={<Advisor />} />}
      {role === 'student' && <Route path="/instructors" element={<Instructors />} />}
      {role === 'student' && <Route path="/appointments" element={<Appointments />} />}
      {role === 'faculty' && <Route path="/schedule" element={<Schedule />} />}
      {role === 'faculty' && <Route path="/hours" element={<Hours />} />}
      <Route path="/reports" element={<Reports />} />
      <Route path="/reports/new" element={<ReportForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  );
}

export default function App() {
  const { user, booting } = useApp();
  if (booting) return <div className="boot"><Loading text="Opening Campusly…" /></div>;
  // A temporary password must be replaced before anything else.
  if (user && user.mustChangePassword) return <><ForcePassword /><Toast /></>;
  return (
    <>
      <Routes>
        {user ? RoleRoutes({ role: user.role }) : (
          <>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/apply/status" element={<ApplyStatus />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Join />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/company/login" element={<CompanyLogin />} />
            <Route path="/owner" element={<Navigate to="/company/login" replace />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset/:token" element={<Reset />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <Toast />
    </>
  );
}
