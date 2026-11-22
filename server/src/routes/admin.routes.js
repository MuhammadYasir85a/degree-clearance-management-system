import express from 'express';
import {
  getPendingRequests,
  approveRequest,
  rejectRequest,
  importEligibleStudents,
  uploadEligibleStudents,
  downloadRosterTemplate,
  listEligibleStudents,
  createEligibleStudent,
  updateEligibleStudent,
  deleteEligibleStudent,
  getAdminDashboard,
  listDepartments,
  createDepartment,
  toggleDepartment,
  listUsers,
  createStaff,
  setUserStatus,
  resetUserPassword,
  listAuditLogs,
  exportAuditLogs,
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { csvUpload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/registration-requests', getPendingRequests);
router.put('/registration-requests/:id/approve', approveRequest);
router.put('/registration-requests/:id/reject', rejectRequest);
router.post('/import-eligible-students', csvUpload.single('file'), importEligibleStudents);
router.get('/dashboard', getAdminDashboard);
router.get('/eligible-students/template', downloadRosterTemplate);
router.post('/eligible-students/upload', csvUpload.single('file'), uploadEligibleStudents);
router.get('/eligible-students', listEligibleStudents);
router.post('/eligible-students', createEligibleStudent);
router.put('/eligible-students/:id', updateEligibleStudent);
router.delete('/eligible-students/:id', deleteEligibleStudent);
router.get('/departments', listDepartments);
router.post('/departments', createDepartment);
router.patch('/departments/:id/status', toggleDepartment);
router.get('/users', listUsers);
router.post('/users', createStaff);
router.patch('/users/:id/status', setUserStatus);
router.patch('/users/:id/password', resetUserPassword);
router.get('/audit-logs/export', exportAuditLogs);
router.get('/audit-logs', listAuditLogs);

export default router;
