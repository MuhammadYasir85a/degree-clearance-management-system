import prisma, { withDbRetry } from '../config/prisma.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.utils.js';

// @desc    Verify if student is eligible for registration
// @route   POST /api/auth/verify-student
// @access  Public
export const verifyStudent = async (req, res) => {
  try {
    const { registration_no, email } = req.body;

    if (!registration_no || !email) {
      return res.status(400).json({ success: false, message: 'Please provide both Registration Number and Email.' });
    }

    const eligible = await withDbRetry(() =>
      prisma.eligibleStudent.findFirst({
        where: {
          registration_no: { equals: registration_no.trim(), mode: 'insensitive' },
          email: { equals: email.trim(), mode: 'insensitive' },
        },
        include: { program: true },
      })
    );

    if (!eligible) {
      return res.status(404).json({ success: false, message: 'Record not found in the university eligible students list. Please contact admin.' });
    }

    if (eligible.is_registered) {
      return res.status(400).json({ success: false, message: 'Account already registered for this registration number. Please login instead.' });
    }

    res.status(200).json({
      success: true,
      message: 'Verification successful. You are eligible to create an account.',
      data: {
        registration_no: eligible.registration_no,
        email: eligible.email,
        full_name: eligible.full_name,
        program_name: eligible.program.name,
        program_id: eligible.program_id,
        batch_year: eligible.batch_year,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit a registration request for Admin approval
// @route   POST /api/auth/register-request
// @access  Public
export const registerRequest = async (req, res) => {
  try {
    const { registration_no, email, password, cnic, phone } = req.body;

    if (!registration_no || !email || !password || !cnic) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    // 1. Verify Eligible Student
    const eligible = await withDbRetry(() =>
      prisma.eligibleStudent.findFirst({
        where: {
          registration_no: { equals: registration_no.trim(), mode: 'insensitive' },
          email: { equals: email.trim(), mode: 'insensitive' },
        },
      })
    );

    if (!eligible || eligible.is_registered) {
      return res.status(400).json({ success: false, message: 'Invalid registration attempt or student already registered.' });
    }

    // 2. Check if a pending request already exists
    const existingRequest = await withDbRetry(() =>
      prisma.registrationRequest.findFirst({
        where: { eligible_id: eligible.eligible_id, status: 'pending' },
      })
    );

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'A registration request is already pending admin approval.' });
    }

    const password_hash = await hashPassword(password);

    // 3. Transaction: Create Request & Notify Admins
    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        // Create the request
        await tx.registrationRequest.create({
          data: {
            eligible_id: eligible.eligible_id,
            cnic: cnic.trim(),
            phone: phone ? phone.trim() : null,
            password_hash,
          },
        });

        // Find all admins to notify
        const admins = await tx.user.findMany({ where: { role: 'admin' } });
        
        if (admins.length > 0) {
          const notifications = admins.map((admin) => ({
            user_id: admin.user_id,
            title: 'New Registration Request',
            message: `${eligible.registration_no} requested account activation.`,
          }));
          await tx.notification.createMany({ data: notifications });
        }
      })
    );

    res.status(201).json({
      success: true,
      message: 'Registration request submitted successfully. You will be notified once the Admin approves your account.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Universal Login
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        include: { department: true, program: true },
      })
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account.' });
    }

    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken({ userId: user.user_id, role: user.role });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        registration_no: user.registration_no,
        department: user.department ? { id: user.department.department_id, name: user.department.name, code: user.department.code } : null,
        program: user.program ? { id: user.program.program_id, name: user.program.name } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Current Logged-in User Profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: {
        user_id: req.user.user_id,
        full_name: req.user.full_name,
        email: req.user.email,
        role: req.user.role,
        registration_no: req.user.registration_no,
        cnic: req.user.cnic,
        phone: req.user.phone,
        department: req.user.department ? { id: req.user.department.department_id, name: req.user.department.name, code: req.user.department.code } : null,
        program: req.user.program ? { id: req.user.program.program_id, name: req.user.program.name } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout User / Clear Cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};