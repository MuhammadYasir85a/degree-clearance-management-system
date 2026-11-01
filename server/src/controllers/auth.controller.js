import prisma, { withDbRetry } from '../config/prisma.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.utils.js';

// Helper: Generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// @desc    Verify if student is eligible for registration
// @route   POST /api/auth/verify-student
// @access  Public
export const verifyStudent = async (req, res) => {
  try {
    const { registration_no, email } = req.body;

    if (!registration_no || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Registration Number and Email.',
      });
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
      return res.status(404).json({
        success: false,
        message: 'Record not found in the university eligible students list. Please contact admin.',
      });
    }

    if (eligible.is_registered) {
      return res.status(400).json({
        success: false,
        message: 'Account already registered for this registration number. Please login instead.',
      });
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

// @desc    Submit registration request + generate OTP
// @route   POST /api/auth/register-request
// @access  Public
export const registerRequest = async (req, res) => {
  try {
    const { registration_no, email, password, cnic, phone } = req.body;

    if (!registration_no || !email || !password || !cnic) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.',
      });
    }

    const eligible = await withDbRetry(() =>
      prisma.eligibleStudent.findFirst({
        where: {
          registration_no: { equals: registration_no.trim(), mode: 'insensitive' },
          email: { equals: email.trim(), mode: 'insensitive' },
        },
      })
    );

    if (!eligible || eligible.is_registered) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration attempt or student already registered.',
      });
    }

    // Block if already has a pending request
    const existingRequest = await withDbRetry(() =>
      prisma.registrationRequest.findFirst({
        where: {
          eligible_id: eligible.eligible_id,
          status: 'pending',
        },
      })
    );

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'A registration request is already pending. Please verify OTP or wait for admin approval.',
      });
    }

    const password_hash = await hashPassword(password);
    const otp_code = generateOtp();
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.registrationRequest.create({
          data: {
            eligible_id: eligible.eligible_id,
            cnic: cnic.trim(),
            phone: phone ? phone.trim() : null,
            password_hash,
            otp_code,
            otp_expires_at,
            is_otp_verified: false,
            status: 'pending',
          },
        });

        // Notify all admins
        const admins = await tx.user.findMany({ where: { role: 'admin' } });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              user_id: admin.user_id,
              title: 'New Registration Request',
              message: `${eligible.registration_no} submitted a registration request (OTP pending verification).`,
            })),
          });
        }
      })
    );

    // AZURE / LOCAL DEMO LOG — copy OTP from here or Log Stream
    console.log('================================================');
    console.log(`🔑 OTP for ${eligible.registration_no} (${eligible.email}): ${otp_code}`);
    console.log(`   Expires in 10 minutes | Master DEMO_OTP also accepted if set in .env`);
    console.log('================================================');

    res.status(201).json({
      success: true,
      message: 'Registration request submitted. Please verify the OTP sent to your university email (check server logs / Azure Log Stream in demo mode).',
      data: {
        email: eligible.email,
        registration_no: eligible.registration_no,
        otp_required: true,
        expires_in_minutes: 10,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP for registration request
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOtp = async (req, res) => {
  try {
    const { registration_no, email, otp } = req.body;

    if (!registration_no || !email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide registration_no, email, and otp.',
      });
    }

    const eligible = await withDbRetry(() =>
      prisma.eligibleStudent.findFirst({
        where: {
          registration_no: { equals: registration_no.trim(), mode: 'insensitive' },
          email: { equals: email.trim(), mode: 'insensitive' },
        },
      })
    );

    if (!eligible) {
      return res.status(404).json({
        success: false,
        message: 'Eligible student record not found.',
      });
    }

    const request = await withDbRetry(() =>
      prisma.registrationRequest.findFirst({
        where: {
          eligible_id: eligible.eligible_id,
          status: 'pending',
        },
      })
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'No pending registration request found. Please submit a request first.',
      });
    }

    if (request.is_otp_verified) {
      return res.status(200).json({
        success: true,
        message: 'OTP already verified. Waiting for admin approval.',
      });
    }

    // Accept real OTP OR master DEMO_OTP from .env (for Azure testing)
    const masterOtp = process.env.DEMO_OTP || '123456';
    const isValidOtp = otp === request.otp_code || otp === masterOtp;

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    // Check expiry (skip expiry check for master DEMO_OTP)
    if (otp !== masterOtp && request.otp_expires_at && new Date() > request.otp_expires_at) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please submit a new registration request.',
      });
    }

    await withDbRetry(() =>
      prisma.registrationRequest.update({
        where: { request_id: request.request_id },
        data: {
          is_otp_verified: true,
          otp_code: null, // clear OTP after success
        },
      })
    );

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. Your request is now waiting for Admin approval.',
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
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        include: { department: true, program: true },
      })
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
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
        department: user.department
          ? { id: user.department.department_id, name: user.department.name, code: user.department.code }
          : null,
        program: user.program
          ? { id: user.program.program_id, name: user.program.name }
          : null,
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
        department: req.user.department
          ? { id: req.user.department.department_id, name: req.user.department.name, code: req.user.department.code }
          : null,
        program: req.user.program
          ? { id: req.user.program.program_id, name: req.user.program.name }
          : null,
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