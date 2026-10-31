import prisma, { withDbRetry } from '../config/prisma.js';

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
      return res.status(404).json({ success: false, message: 'Pending request not found.' });
    }

    // Transaction: Approve Request -> Mark Eligible -> Create User -> Notify User
    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        // 1. Update Request Status
        await tx.registrationRequest.update({
          where: { request_id: request.request_id },
          data: { status: 'approved', reviewed_at: new Date() },
        });

        // 2. Mark Eligible Student as Registered
        await tx.eligibleStudent.update({
          where: { eligible_id: request.eligible_id },
          data: { is_registered: true },
        });

        // 3. Create the actual User Account
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

        // 4. Create Welcome Notification for the Student
        await tx.notification.create({
          data: {
            user_id: user.user_id,
            title: 'Account Approved',
            message: 'Your account has been approved by the Admin. Welcome to the system!',
          },
        });
      })
    );

    res.status(200).json({ success: true, message: 'Student account approved and created successfully.' });
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