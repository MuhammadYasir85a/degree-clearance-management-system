import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import PortalLayout from './layouts/PortalLayout.jsx'
import LoginPage from './pages/public/LoginPage.jsx'
import RegisterPage from './pages/public/RegisterPage.jsx'
import StudentDashboard from './pages/student/StudentDashboard.jsx'
import ClearanceApply from './pages/student/ClearanceApply.jsx'
import DegreeWorkspace from './pages/student/DegreeWorkspace.jsx'
import DegreeStatusPage from './pages/student/DegreeStatusPage.jsx'
import ReceiptPage from './pages/student/ReceiptPage.jsx'
import OfficerDashboard from './pages/officer/OfficerDashboard.jsx'
import ControllerDashboard from './pages/controller/ControllerDashboard.jsx'
import VerificationWorkspace from './pages/controller/VerificationWorkspace.jsx'
import HandoverDesk from './pages/controller/HandoverDesk.jsx'
import ControllerReceipt from './pages/controller/ControllerReceipt.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import KnowledgeBaseManager from './pages/admin/KnowledgeBaseManager.jsx'
import EligibleStudentsManager from './pages/admin/EligibleStudentsManager.jsx'
import DepartmentsManager from './pages/admin/DepartmentsManager.jsx'
import UsersManager from './pages/admin/UsersManager.jsx'
import ClearanceOversight from './pages/admin/ClearanceOversight.jsx'
import AuditLogs from './pages/admin/AuditLogs.jsx'
import ReceiptVerificationPage from './pages/public/ReceiptVerificationPage.jsx'
import ForgotPasswordPage from './pages/public/ForgotPasswordPage.jsx'

const homeByRole = { student: '/student/dashboard', officer: '/officer/dashboard', controller: '/controller/dashboard', admin: '/admin/dashboard' }

function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading"><span className="loader" /><p>Loading secure portal</p></div>
  if (!user) return <Navigate to="/login" replace />
  return roles.includes(user.role) ? children : <Navigate to={homeByRole[user.role]} replace />
}

function RoleHome() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading"><span className="loader" /></div>
  return <Navigate to={user ? homeByRole[user.role] : '/login'} replace />
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/verify/:receiptNumber?" element={<ReceiptVerificationPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/" element={<RoleHome />} />
    <Route element={<ProtectedRoute roles={['student', 'officer', 'controller', 'admin']}><PortalLayout /></ProtectedRoute>}>
      <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/clearance/apply" element={<ProtectedRoute roles={['student']}><ClearanceApply /></ProtectedRoute>} />
      <Route path="/student/degree/apply" element={<ProtectedRoute roles={['student']}><DegreeWorkspace /></ProtectedRoute>} />
      <Route path="/student/degree/status" element={<ProtectedRoute roles={['student']}><DegreeStatusPage /></ProtectedRoute>} />
      <Route path="/student/degree/receipt" element={<ProtectedRoute roles={['student']}><ReceiptPage /></ProtectedRoute>} />
      <Route path="/officer/dashboard" element={<ProtectedRoute roles={['officer']}><OfficerDashboard /></ProtectedRoute>} />
      <Route path="/controller/dashboard" element={<ProtectedRoute roles={['controller', 'admin']}><ControllerDashboard /></ProtectedRoute>} />
      <Route path="/controller/verify/:degreeAppId" element={<ProtectedRoute roles={['controller', 'admin']}><VerificationWorkspace /></ProtectedRoute>} />
      <Route path="/controller/handover" element={<ProtectedRoute roles={['controller', 'admin']}><HandoverDesk /></ProtectedRoute>} />
      <Route path="/controller/receipt/:receiptId" element={<ProtectedRoute roles={['controller', 'admin']}><ControllerReceipt /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/knowledge-base" element={<ProtectedRoute roles={['admin']}><KnowledgeBaseManager /></ProtectedRoute>} />
      <Route path="/admin/eligible-students" element={<ProtectedRoute roles={['admin']}><EligibleStudentsManager /></ProtectedRoute>} />
      <Route path="/admin/departments" element={<ProtectedRoute roles={['admin']}><DepartmentsManager /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UsersManager /></ProtectedRoute>} />
      <Route path="/admin/clearances" element={<ProtectedRoute roles={['admin']}><ClearanceOversight /></ProtectedRoute>} />
      <Route path="/admin/audit-logs" element={<ProtectedRoute roles={['admin']}><AuditLogs /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<RoleHome />} />
  </Routes>
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider> }
