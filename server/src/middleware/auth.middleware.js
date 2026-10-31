import { verifyToken } from '../utils/auth.utils.js';
import prisma, { withDbRetry } from '../config/prisma.js';

// Protect Routes: Verifies JWT token from Cookies or Authorization Header
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check Header or Cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please log in first.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Fetch user from DB
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { user_id: decoded.userId },
        include: {
          department: true,
          program: true,
        },
      })
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.',
      });
    }

    // Attach user object to request
    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

// Role-Based Access Control (RBAC) Middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user?.role}) is not authorized to access this resource.`,
      });
    }

    next();
  };
};