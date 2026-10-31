import express from 'express';
import {
  verifyStudent,
  registerRequest,
  login,
  getMe,
  logout,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/verify-student', verifyStudent);
router.post('/register-request', registerRequest);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;