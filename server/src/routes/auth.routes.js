import express from 'express';
import {
  verifyStudent,
  registerRequest,
  verifyOtp,
  login,
  getMe,
  logout,
  updateMe,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authRateLimit, loginRateLimit, passwordRecoveryRateLimit } from '../middleware/rate-limit.middleware.js';

const router = express.Router();

// PUBLIC ROUTES (No protect middleware here!)
router.post('/verify-student', authRateLimit, verifyStudent);
router.post('/register-request', authRateLimit, registerRequest);
router.post('/verify-otp', authRateLimit, verifyOtp);
router.post('/login', loginRateLimit, login);
router.post('/forgot-password', passwordRecoveryRateLimit, requestPasswordReset);
router.post('/forgot-password/verify', passwordRecoveryRateLimit, verifyPasswordResetOtp);
router.post('/forgot-password/reset', passwordRecoveryRateLimit, resetPassword);

// PROTECTED ROUTES (Only these require protect)
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.post('/logout', protect, logout);

export default router;
