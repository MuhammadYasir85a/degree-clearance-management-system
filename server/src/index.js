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

// Mount route:
app.use('/api/admin', adminRoutes);

app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI-Powered Degree Issuance & Clearance API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mounting Auth API Routes
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});