import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. MIDDLEWARES (Must run BEFORE routes)
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 2. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI-Powered Degree Issuance & Clearance API is running',
    timestamp: new Date().toISOString(),
  });
});

// 3. API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 4. START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});