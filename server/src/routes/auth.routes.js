import express from 'express';
import {
  verifyStudent,
  registerRequest,
  verifyOtp,
  login,
  getMe,
  logout,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// PUBLIC ROUTES (No protect middleware here!)
router.post('/verify-student', verifyStudent);
router.post('/register-request', registerRequest);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// PROTECTED ROUTES (Only these require protect)
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;