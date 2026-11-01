import prisma, { withDbRetry } from '../config/prisma.js';
import csv from 'csv-parser';
import { Readable } from 'stream';

// @desc    Get all pending registration requests
// @route   GET /api/admin/registration-requests
// @access  Private (Admin)
export const getPendingRequests = async (req, res) => {
  try {
    const requests = await withDbRetry(() =>
      prisma.registrationRequest.findMany({
        where: { status: 'pending' },
        include: {
          eligibleStudent: {
            include: { program: true },
          },
        },
        orderBy: { created_at: 'asc' },
      })
    );

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve a registration request
// @route   PUT /api/admin/registration-requests/:id/approve
// @access  Private (Admin)
export const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await withDbRetry(() =>
      prisma.registrationRequest.findUnique({
        where: { request_id: Number(id) },
        include: { eligibleStudent: true },
      })
    );

    if (!request || request.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: 'Pending request not found.',
      });
    }

    if (!request.is_otp_verified) {
      return res.status(400).json({
        success: false,
        message: 'Student has not verified OTP yet. Cannot approve.',
      });
    }

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.registrationRequest.update({
          where: { request_id: request.request_id },
          data: { status: 'approved', reviewed_at: new Date() },
        });

        await tx.eligibleStudent.update({
          where: { eligible_id: request.eligible_id },
          data: { is_registered: true },
        });

        const user = await tx.user.create({
          data: {
            full_name: request.eligibleStudent.full_name,
            email: request.eligibleStudent.email,
            password_hash: request.password_hash,
            role: 'student',
            registration_no: request.eligibleStudent.registration_no,
            cnic: request.cnic,
            phone: request.phone,
            program_id: request.eligibleStudent.program_id,
          },
        });

        await tx.notification.create({
          data: {
            user_id: user.user_id,
            title: 'Account Approved',
            message: 'Your account has been approved by the Admin. You can now login.',
          },
        });
      })
    );

    res.status(200).json({
      success: true,
      message: 'Student account approved and created successfully.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject a registration request
// @route   PUT /api/admin/registration-requests/:id/reject
// @access  Private (Admin)
export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const request = await withDbRetry(() =>
      prisma.registrationRequest.findUnique({ where: { request_id: Number(id) } })
    );

    if (!request || request.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Pending request not found.' });
    }

    await withDbRetry(() =>
      prisma.registrationRequest.update({
        where: { request_id: Number(id) },
        data: {
          status: 'rejected',
          admin_remarks: remarks || 'Rejected by administration.',
          reviewed_at: new Date(),
        },
      })
    );

    res.status(200).json({ success: true, message: 'Registration request rejected.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin uploads CSV of eligible graduating students
// @route   POST /api/admin/import-eligible-students
// @access  Private (Admin)
export const importEligibleStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV file.',
      });
    }

    const results = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let importedCount = 0;

        for (const row of results) {
          const regNo = row.registration_no?.trim();
          const email = row.email?.trim().toLowerCase();
          const fullName = row.full_name?.trim();
          const programCode = row.program_code?.trim();
          const batchYear = row.batch_year ? parseInt(row.batch_year) : null;

          if (!regNo || !email || !fullName || !programCode) continue;

          const program = await withDbRetry(() =>
            prisma.academicProgram.findUnique({
              where: { code: programCode },
            })
          );

          if (!program) continue;

          await withDbRetry(() =>
            prisma.eligibleStudent.upsert({
              where: { registration_no: regNo },
              update: {
                email,
                full_name: fullName,
                program_id: program.program_id,
                batch_year: batchYear,
                is_registered: false,
              },
              create: {
                registration_no: regNo,
                email,
                full_name: fullName,
                program_id: program.program_id,
                batch_year: batchYear,
              },
            })
          );

          importedCount++;
        }

        res.status(200).json({
          success: true,
          message: `CSV import completed successfully. ${importedCount} eligible students loaded.`,
        });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};