import prisma, { withDbRetry } from '../config/prisma.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.utils.js';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { publicError } from '../utils/http.utils.js';
import { sendPasswordChanged, sendPasswordResetOtp, sendRegistrationOtp } from '../services/email.service.js';

// Helper: Generate 6-digit OTP
const generateOtp = () => randomInt(100000, 1000000).toString();
const sameOtp = (supplied, expected) => {
  const left = Buffer.from(String(supplied));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && timingSafeEqual(left, right);
};
const hashOtp = (otp) => createHmac('sha256', process.env.JWT_SECRET).update(String(otp)).digest('hex');
const normalizeCnic = (value) => String(value || '').replace(/\D/g, '');
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const validPassword = (value) => /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(String(value || ''));

// @desc    Verify if student is eligible for registration
// @route   POST /api/auth/verify-student
// @access  Public
export const verifyStudent = async (req, res) => {
  try {
    const { registration_no, cnic } = req.body;

    if (!registration_no || normalizeCnic(cnic).length !== 13) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a Registration Number and valid 13-digit CNIC.',
      });
    }

    const eligible = await withDbRetry(() =>
      prisma.eligibleStudent.findFirst({
        where: {
          registration_no: { equals: registration_no.trim(), mode: 'insensitive' },
          cnic: normalizeCnic(cnic),
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
        father_name: eligible.father_name,
        program_name: eligible.program.name,
        program_id: eligible.program_id,
        batch_year: eligible.batch_year,
        passing_year: eligible.passing_year,
        cgpa: eligible.cgpa,
      },
    });
  } catch (error) {
    return publicError(res, error, 'Failed to verify student eligibility.');
  }
};

// @desc    Submit registration request + generate OTP
// @route   POST /api/auth/register-request
// @access  Public
export const registerRequest = async (req, res) => {
  try {
    const { registration_no, email, password, cnic, phone } = req.body;

    if (!registration_no || !email || !password || normalizeCnic(cnic).length !== 13) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.',
      });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and contain letters and numbers.' });
    }

    const eligible = await withDbRetry(() =>
      prisma.eligibleStudent.findFirst({
        where: {
          registration_no: { equals: registration_no.trim(), mode: 'insensitive' },
          email: { equals: email.trim(), mode: 'insensitive' },
          cnic: normalizeCnic(cnic),
        },
      })
    );

    if (!eligible || eligible.is_registered) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration attempt or student already registered.',
      });
    }

    const existingRequest = await withDbRetry(() =>
      prisma.registrationRequest.findUnique({ where: { eligible_id: eligible.eligible_id } })
    );

    const password_hash = await hashPassword(password);
    const plainOtp = generateOtp();
    const otp_code = hashOtp(plainOtp);
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const requestData = {
            eligible_id: eligible.eligible_id,
            cnic: normalizeCnic(cnic),
            phone: phone ? phone.trim() : null,
            password_hash,
            otp_code,
            otp_expires_at,
            is_otp_verified: false,
            otp_attempts: 0,
            otp_locked_until: null,
            status: 'pending',
        };
        if (existingRequest) {
          await withDbRetry(() => tx.registrationRequest.update({
            where: { request_id: existingRequest.request_id }, data: requestData,
          }));
        } else {
          await withDbRetry(() => tx.registrationRequest.create({ data: requestData }));
        }

        // Notify all admins
        const admins = await withDbRetry(() => tx.user.findMany({ where: { role: 'admin' } }));
        if (admins.length > 0) {
          await withDbRetry(() => tx.notification.createMany({
            data: admins.map((admin) => ({
              user_id: admin.user_id,
              title: 'New Registration Request',
              message: `${eligible.registration_no} submitted a registration request (OTP pending verification).`,
            })),
          }));
        }
      })
    );

    await sendRegistrationOtp({ email: eligible.email, fullName: eligible.full_name, registrationNo: eligible.registration_no, otp: plainOtp });

    res.status(201).json({
      success: true,
      message: 'Registration request submitted. Please verify the OTP sent to your university email.',
      data: {
        email: eligible.email,
        registration_no: eligible.registration_no,
        otp_required: true,
        expires_in_minutes: 10,
      },
    });
  } catch (error) {
    return publicError(res, error, 'Failed to submit registration request.');
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

    if (request.otp_locked_until && request.otp_locked_until > new Date()) {
      return res.status(429).json({ success: false, message: 'OTP verification is temporarily locked. Please try again later.' });
    }

    const masterOtp = process.env.NODE_ENV !== 'production' ? process.env.DEMO_OTP?.trim() : null;
    const isMasterOtp = Boolean(masterOtp) && sameOtp(otp, masterOtp);
    const storedMatches = request.otp_code?.length === 64
      ? sameOtp(hashOtp(otp), request.otp_code)
      : sameOtp(otp, request.otp_code); // short-lived compatibility for pre-migration pending OTPs
    const isValidOtp = storedMatches || isMasterOtp;

    if (!isValidOtp) {
      const attempts = request.otp_attempts + 1;
      await withDbRetry(() => prisma.registrationRequest.update({
        where: { request_id: request.request_id },
        data: {
          otp_attempts: attempts,
          ...(attempts >= 3 ? { otp_locked_until: new Date(Date.now() + 15 * 60_000), otp_attempts: 0 } : {}),
        },
      }));
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    // Check expiry (skip expiry check for master DEMO_OTP)
    if (!isMasterOtp && request.otp_expires_at && new Date() > request.otp_expires_at) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please submit a new registration request.',
      });
    }

    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.registrationRequest.update({
        where: { request_id: request.request_id },
        data: { is_otp_verified: true, otp_code: null, otp_attempts: 0, otp_locked_until: null, status: 'approved', reviewed_at: new Date() },
      }));
      await withDbRetry(() => tx.eligibleStudent.update({
        where: { eligible_id: eligible.eligible_id }, data: { is_registered: true },
      }));
      const existingUser = await withDbRetry(() => tx.user.findFirst({
        where: { OR: [{ email: eligible.email }, { registration_no: eligible.registration_no }, { cnic: request.cnic }] },
        select: { user_id: true },
      }));
      if (!existingUser) {
        const user = await withDbRetry(() => tx.user.create({ data: {
          full_name: eligible.full_name,
          father_name: eligible.father_name,
          email: eligible.email,
          password_hash: request.password_hash,
          role: 'student',
          registration_no: eligible.registration_no,
          cnic: request.cnic,
          phone: request.phone,
          program_id: eligible.program_id,
          passing_year: eligible.passing_year,
          cgpa: eligible.cgpa,
        } }));
        await withDbRetry(() => tx.notification.create({ data: {
          user_id: user.user_id, title: 'Account Activated', message: 'Your student portal account is active. You can now sign in.',
        } }));
      }
    }));

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. Your student account is now active.',
    });
  } catch (error) {
    return publicError(res, error, 'Failed to verify OTP.');
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid account email.' });
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email }, select: { user_id: true, full_name: true, email: true, is_active: true } }));
    const genericResponse = { success: true, message: 'If an active account matches that email, a reset code has been sent.', data: { expires_in_minutes: 10 } };
    if (!user?.is_active) return res.status(200).json(genericResponse);

    const otp = generateOtp();
    await withDbRetry(() => prisma.passwordResetRequest.upsert({
      where: { user_id: user.user_id },
      update: { otp_hash: hashOtp(otp), otp_expires_at: new Date(Date.now() + 10 * 60_000), otp_attempts: 0, locked_until: null, reset_token_hash: null, reset_expires_at: null, created_at: new Date() },
      create: { user_id: user.user_id, otp_hash: hashOtp(otp), otp_expires_at: new Date(Date.now() + 10 * 60_000) },
    }));
    await sendPasswordResetOtp({ email: user.email, fullName: user.full_name, otp });
    return res.status(200).json(genericResponse);
  } catch (error) {
    return publicError(res, error, 'Failed to start password recovery.');
  }
};

export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    if (!validEmail(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ success: false, message: 'Enter a valid email and six-digit code.' });
    const request = await withDbRetry(() => prisma.passwordResetRequest.findFirst({
      where: { user: { email, is_active: true } },
      include: { user: { select: { user_id: true } } },
    }));
    if (!request || request.otp_expires_at <= new Date()) return res.status(400).json({ success: false, message: 'The reset code is invalid or expired. Request a new code.' });
    if (request.locked_until && request.locked_until > new Date()) return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code later.' });
    const masterOtp = process.env.NODE_ENV !== 'production' ? process.env.DEMO_OTP?.trim() : null;
    if (!sameOtp(hashOtp(otp), request.otp_hash) && !(masterOtp && sameOtp(otp, masterOtp))) {
      const attempts = request.otp_attempts + 1;
      await withDbRetry(() => prisma.passwordResetRequest.update({
        where: { reset_id: request.reset_id },
        data: { otp_attempts: attempts >= 5 ? 0 : attempts, ...(attempts >= 5 && { locked_until: new Date(Date.now() + 15 * 60_000) }) },
      }));
      return res.status(400).json({ success: false, message: 'The reset code is invalid or expired. Request a new code.' });
    }
    const resetToken = randomBytes(32).toString('base64url');
    await withDbRetry(() => prisma.passwordResetRequest.update({
      where: { reset_id: request.reset_id },
      data: { otp_hash: hashOtp(randomBytes(16).toString('hex')), otp_attempts: 0, locked_until: null, reset_token_hash: hashOtp(resetToken), reset_expires_at: new Date(Date.now() + 15 * 60_000) },
    }));
    return res.status(200).json({ success: true, message: 'Code verified. Choose a new password.', data: { reset_token: resetToken, expires_in_minutes: 15 } });
  } catch (error) {
    return publicError(res, error, 'Failed to verify the reset code.');
  }
};

export const resetPassword = async (req, res) => {
  try {
    const resetToken = String(req.body?.reset_token || '').trim();
    const password = String(req.body?.password || '');
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(resetToken) || !validPassword(password)) {
      return res.status(400).json({ success: false, message: 'Provide a valid reset session and a password of 8–128 characters containing letters and numbers.' });
    }
    const request = await withDbRetry(() => prisma.passwordResetRequest.findFirst({
      where: { reset_token_hash: hashOtp(resetToken), reset_expires_at: { gt: new Date() } },
      include: { user: { select: { user_id: true, email: true, full_name: true } } },
    }));
    if (!request) return res.status(400).json({ success: false, message: 'This reset session is invalid or expired. Start again.' });
    const password_hash = await hashPassword(password);
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.user.update({ where: { user_id: request.user_id }, data: { password_hash, auth_version: { increment: 1 } } }));
      await withDbRetry(() => tx.notification.create({ data: { user_id: request.user_id, title: 'Password Changed', message: 'Your account password was changed through secure recovery. Existing sessions were signed out.' } }));
      await withDbRetry(() => tx.activityLog.create({ data: { user_id: request.user_id, action: 'PASSWORD_RECOVERY_COMPLETED', entity_type: 'User', entity_id: request.user_id, description: 'Account owner completed email OTP password recovery.', ip_address: req.ip || null } }));
      await withDbRetry(() => tx.passwordResetRequest.delete({ where: { reset_id: request.reset_id } }));
    }));
    sendPasswordChanged({ email: request.user.email, fullName: request.user.full_name }).catch((error) => console.error('Password change confirmation email failed.', { code: error.code || error.name }));
    res.cookie('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) });
    return res.status(200).json({ success: true, message: 'Password changed successfully. Sign in with your new password.' });
  } catch (error) {
    return publicError(res, error, 'Failed to reset password.');
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

    const token = generateToken({ userId: user.user_id, role: user.role, authVersion: user.auth_version });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        father_name: user.father_name,
        email: user.email,
        role: user.role,
        registration_no: user.registration_no,
        cnic: user.cnic,
        phone: user.phone,
        passing_year: user.passing_year,
        cgpa: user.cgpa,
        department: user.department
          ? { id: user.department.department_id, name: user.department.name, code: user.department.code }
          : null,
        program: user.program
          ? { id: user.program.program_id, name: user.program.name }
          : null,
      },
    });
  } catch (error) {
    return publicError(res, error, 'Login failed.');
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
        father_name: req.user.father_name,
        email: req.user.email,
        role: req.user.role,
        registration_no: req.user.registration_no,
        cnic: req.user.cnic,
        phone: req.user.phone,
        passing_year: req.user.passing_year,
        cgpa: req.user.cgpa,
        department: req.user.department
          ? { id: req.user.department.department_id, name: req.user.department.name, code: req.user.department.code }
          : null,
        program: req.user.program
          ? { id: req.user.program.program_id, name: req.user.program.name }
          : null,
      },
    });
  } catch (error) {
    return publicError(res, error, 'Failed to retrieve profile.');
  }
};

// PUT /api/auth/me — student contact details only; academic identity remains read-only.
export const updateMe = async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[0-9 -]{7,20}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Provide a valid email address and phone number.' });
    }
    const updated = await withDbRetry(() => prisma.$transaction(async (tx) => {
      const user = await withDbRetry(() => tx.user.update({ where: { user_id: req.user.user_id }, data: { email, phone } }));
      await withDbRetry(() => tx.activityLog.create({ data: { user_id: req.user.user_id, action: 'PROFILE_CONTACT_UPDATED', entity_type: 'User', entity_id: req.user.user_id, description: 'Student updated portal email and phone contact details.' } }));
      return user;
    }));
    return res.status(200).json({ success: true, message: 'Contact details updated.', data: { email: updated.email, phone: updated.phone } });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'That email address is already in use.' });
    return publicError(res, error, 'Failed to update contact details.');
  }
};

// @desc    Logout User / Clear Cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  res.cookie('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) });
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};
