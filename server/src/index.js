import { validateEnvironment } from './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';

// Routes
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import clearanceRoutes from './routes/clearance.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import degreeRoutes from './routes/degree.routes.js';
import chatRoutes from './routes/chat.routes.js';
import fileRoutes from './routes/file.routes.js';

const app = express();
validateEnvironment();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middleware
// ==========================================

app.use(morgan('dev'));
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

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

// Opening the API port in a browser should lead users to the React portal.
// API consumers continue to use the explicit /api/* routes below.
app.get('/', (req, res) => {
  const clientUrl = process.env.CLIENT_URL?.trim() || 'http://localhost:5173';
  return res.redirect(302, clientUrl);
});

app.get('/api', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'GradFlow Academic Operations API',
    health: '/api/health',
    frontend: process.env.CLIENT_URL?.trim() || 'http://localhost:5173',
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
app.use('/api/files', fileRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'API route not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.name === 'MulterError') return res.status(400).json({ success: false, message: error.message });
  if (error?.status === 400) return res.status(400).json({ success: false, message: error.message });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
  console.error('Unhandled request error', { code: error?.code || error?.name });
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

// ==========================================
// Start Server
// ==========================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
