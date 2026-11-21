import './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';

// Routes
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import clearanceRoutes from './routes/clearance.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import degreeRoutes from './routes/degree.routes.js';
import chatRoutes from './routes/chat.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middleware
// ==========================================

app.use(morgan('dev'));

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==========================================
// Static File Hosting
// ==========================================

app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'))
);

// ==========================================
// Health Check
// ==========================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'UET Clearance & Degree API is running smoothly.',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// API Routes
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clearance', clearanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/degree', degreeRoutes);
app.use('/api/chat', chatRoutes);

// ==========================================
// Start Server
// ==========================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
