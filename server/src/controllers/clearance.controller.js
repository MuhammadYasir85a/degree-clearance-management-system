import prisma, { withDbRetry } from '../config/prisma.js';
import { pagination, positiveInteger, publicError } from '../utils/http.utils.js';
import { createUniversityPdf } from '../services/pdf.service.js';
import { removeFile } from '../services/file-storage.service.js';
import { createHash } from 'node:crypto';

// =============================================
// MILESTONE 04A ENDPOINTS
// =============================================

// GET /api/clearance/preview (Student Only)
export const previewClearanceApplication = async (req, res) => {
  try {
    const departments = await withDbRetry(() => prisma.department.findMany({
      where: { is_active: true },
      select: { department_id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }));
    return res.status(200).json({
      success: true,
      data: {
        student: {
          full_name: req.user.full_name,
          father_name: req.user.father_name,
          registration_no: req.user.registration_no,
          email: req.user.email,
          phone: req.user.phone,
          passing_year: req.user.passing_year,
          cgpa: req.user.cgpa,
          cnic: req.user.cnic,
          program: req.user.program ? { name: req.user.program.name, code: req.user.program.code } : null,
        },
        departments,
      },
    });
  } catch (error) {
    return publicError(res, error, 'Failed to prepare clearance application.');
  }
};

// DELETE /api/clearance/withdraw/:clearance_id (Student Only)
export const withdrawClearanceApplication = async (req, res) => {
  try {
    const clearanceId = positiveInteger(req.params.clearance_id, 'clearance_id');
    const clearance = await withDbRetry(() => prisma.clearanceRequest.findUnique({
      where: { clearance_id: clearanceId }, include: { departmentReviews: true },
    }));
    if (!clearance || clearance.student_id !== req.user.user_id) {
      return res.status(404).json({ success: false, message: 'Clearance application not found.' });
    }
    if (clearance.departmentReviews.some((review) => review.status !== 'pending')) {
      return res.status(409).json({ success: false, message: 'The application cannot be withdrawn after an office has reviewed it.' });
    }
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.clearanceRequest.delete({ where: { clearance_id: clearanceId } }));
      await withDbRetry(() => tx.activityLog.create({ data: {
        user_id: req.user.user_id,
        action: 'CLEARANCE_WITHDRAWN',
        entity_type: 'ClearanceRequest',
        entity_id: clearanceId,
        description: `Student withdrew clearance request #${clearanceId} before departmental review.`,
      } }));
    }));
    return res.status(200).json({ success: true, message: 'Clearance application withdrawn successfully.' });
  } catch (error) {
    return publicError(res, error, 'Failed to withdraw clearance application.');
  }
};

// POST /api/clearance/apply (Student Only)
export const applyForClearance = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const studentName = req.user.full_name;

    const activeRequest = await withDbRetry(() =>
      prisma.clearanceRequest.findFirst({
        where: {
          student_id: studentId,
          status: {
            in: ['draft', 'applied', 'in_progress', 'correction_required'],
          },
        },
      }, { maxWait: 10000, timeout: 60000 })
    );

    if (activeRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active clearance request.',
      });
    }

    const existingDegreeApplication = await withDbRetry(() =>
      prisma.degreeApplication.findFirst({
        where: { student_id: studentId },
        select: { degree_app_id: true, status: true },
        orderBy: { degree_app_id: 'desc' },
      })
    );

    if (existingDegreeApplication) {
      return res.status(409).json({
        success: false,
        message: 'A degree issuance workflow already exists for this student. A second clearance application cannot be created.',
      });
    }

    const activeDepartments = await withDbRetry(() =>
      prisma.department.findMany({
        where: { is_active: true },
        select: { department_id: true, name: true },
      })
    );

    if (activeDepartments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active departments available for clearance.',
      });
    }

    const clearance = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const newClearance = await withDbRetry(() => tx.clearanceRequest.create({
          data: {
            student_id: studentId,
            status: 'in_progress',
            submitted_at: new Date(),
          },
        }));

        const reviewRows = activeDepartments.map((dept) => ({
          clearance_id: newClearance.clearance_id,
          department_id: dept.department_id,
          status: 'pending',
        }));

        await withDbRetry(() => tx.departmentReview.createMany({ data: reviewRows }));

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: studentId,
            action: 'CLEARANCE_APPLIED',
            entity_type: 'ClearanceRequest',
            entity_id: newClearance.clearance_id,
            description: `Student ${studentName} submitted clearance request #${newClearance.clearance_id}.`,
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: studentId,
            title: 'Clearance Submitted',
            message: 'Your clearance request has been submitted successfully.',
          },
        }));

        return newClearance;
      })
    );

    return res.status(201).json({
      success: true,
      message: 'Clearance request submitted successfully.',
      data: {
        clearance_id: clearance.clearance_id,
        status: clearance.status,
        departments_count: activeDepartments.length,
      },
    });
  } catch (error) {
    console.error('Apply Clearance Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit clearance request.',
    });
  }
};

// GET /api/clearance/my-status (Student Only)
export const getMyClearanceStatus = async (req, res) => {
  try {
    const studentId = req.user.user_id;

    const clearance = await withDbRetry(() =>
      prisma.clearanceRequest.findFirst({
        where: { student_id: studentId },
        orderBy: { clearance_id: 'desc' },
        include: {
          departmentReviews: {
            include: {
              department: {
                select: { department_id: true, name: true, code: true },
              },
              officer: {
                select: { user_id: true, full_name: true },
              },
            },
            orderBy: { department_id: 'asc' },
          },
        },
      })
    );

    if (!clearance) {
      return res.status(404).json({
        success: false,
        message: 'No clearance request found.',
      });
    }

    const total = clearance.departmentReviews.length;
    const done = clearance.departmentReviews.filter(
      (r) => r.status === 'approved' || r.status === 'not_applicable'
    ).length;

    return res.status(200).json({
      success: true,
      data: {
        clearance_id: clearance.clearance_id,
        status: clearance.status,
        submitted_at: clearance.submitted_at,
        completed_at: clearance.completed_at,
        certificate_uri: clearance.certificate_uri ? `/api/files/clearance-certificates/${clearance.clearance_id}` : null,
        certificate_generated_at: clearance.certificate_generated_at,
        progress: {
          total,
          completed: done,
          percentage: total > 0 ? Math.round((done / total) * 100) : 0,
        },
        reviews: clearance.departmentReviews,
      },
    });
  } catch (error) {
    console.error('Get Clearance Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch clearance status.',
    });
  }
};

// PUT /api/clearance/reviews/:review_id/resubmit (Student Only)
export const resubmitCorrection = async (req, res) => {
  try {
    const reviewId = positiveInteger(req.params.review_id, 'review_id');
    const response = typeof req.body?.response === 'string' ? req.body.response.trim() : '';
    if (!response || response.length > 1000) return res.status(400).json({ success: false, message: 'A correction response of up to 1000 characters is required.' });
    const review = await withDbRetry(() => prisma.departmentReview.findUnique({
      where: { review_id: reviewId },
      include: { clearanceRequest: true, department: { select: { name: true } } },
    }));
    if (!review || review.clearanceRequest.student_id !== req.user.user_id) return res.status(404).json({ success: false, message: 'Correction review not found.' });
    if (review.status !== 'correction_required') return res.status(409).json({ success: false, message: 'Only a correction-required review can be resubmitted.' });
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.departmentReview.update({ where: { review_id: reviewId }, data: { status: 'pending', student_response: response, resubmitted_at: new Date() } }));
      const remaining = await withDbRetry(() => tx.departmentReview.count({ where: { clearance_id: review.clearance_id, status: 'correction_required', review_id: { not: reviewId } } }));
      await withDbRetry(() => tx.clearanceRequest.update({ where: { clearance_id: review.clearance_id }, data: { status: remaining ? 'correction_required' : 'in_progress' } }));
      await withDbRetry(() => tx.activityLog.create({ data: { user_id: req.user.user_id, action: 'CORRECTION_RESUBMITTED', entity_type: 'DepartmentReview', entity_id: reviewId, description: `Student submitted a correction response to ${review.department.name}.` } }));
      if (review.officer_id) await withDbRetry(() => tx.notification.create({ data: { user_id: review.officer_id, title: 'Correction Resubmitted', message: `${req.user.full_name} resubmitted the ${review.department.name} clearance review.` } }));
    }));
    return res.status(200).json({ success: true, message: 'Correction submitted for departmental re-review.' });
  } catch (error) {
    return publicError(res, error, 'Failed to resubmit correction.');
  }
};

// GET /api/clearance/officer/pending (Officer Only)
export const getOfficerPendingQueue = async (req, res) => {
  try {
    const departmentId = req.user.department_id;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Officer is not assigned to any department.',
      });
    }

    const reviews = await withDbRetry(() =>
      prisma.departmentReview.findMany({
        where: {
          department_id: departmentId,
          status: { in: ['pending', 'correction_required'] },
        },
        include: {
          clearanceRequest: {
            include: {
              student: {
                select: {
                  user_id: true,
                  full_name: true,
                  registration_no: true,
                  email: true,
                  program: {
                    select: { program_id: true, name: true, code: true, level: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { review_id: 'asc' },
      })
    );

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews.map((r) => ({
        review_id: r.review_id,
        status: r.status,
        remarks: r.remarks,
        clearance_id: r.clearance_id,
        student: r.clearanceRequest.student,
        submitted_at: r.clearanceRequest.submitted_at,
      })),
    });
  } catch (error) {
    console.error('Officer Pending Queue Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending queue.',
    });
  }
};

// GET /api/clearance/officer/queue — department-isolated operational registry
export const getOfficerQueue = async (req, res) => {
  try {
    const departmentId = req.user.department_id;
    if (!departmentId) return res.status(400).json({ success: false, message: 'Officer is not assigned to any department.' });
    const { page, limit, skip } = pagination(req.query, 15);
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'action_required';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const programId = req.query.program_id ? positiveInteger(req.query.program_id, 'program_id') : null;
    const allowedTabs = ['action_required', 'under_correction', 'approved', 'all'];
    if (!allowedTabs.includes(tab)) return res.status(400).json({ success: false, message: 'Invalid officer queue tab.' });
    const studentWhere = { ...(programId && { program_id: programId }), ...(search && { OR: [{ full_name: { contains: search, mode: 'insensitive' } }, { registration_no: { contains: search, mode: 'insensitive' } }, { cnic: { contains: search, mode: 'insensitive' } }] }) };
    const statusWhere = tab === 'action_required' ? { status: 'pending' } : tab === 'under_correction' ? { status: 'correction_required' } : tab === 'approved' ? { status: 'approved' } : {};
    const where = { department_id: departmentId, ...statusWhere, ...(Object.keys(studentWhere).length && { clearanceRequest: { student: studentWhere } }) };
    const orderBy = req.query.sort === 'oldest' ? { clearanceRequest: { submitted_at: 'asc' } } : req.query.sort === 'registration' ? { clearanceRequest: { student: { registration_no: 'asc' } } } : { clearanceRequest: { submitted_at: 'desc' } };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [department, rows, total, actionNeeded, resubmissions, approvedToday, totalProcessed, underCorrection, approvedTotal, allTotal, programs] = await Promise.all([
      withDbRetry(() => prisma.department.findUnique({ where: { department_id: departmentId }, select: { department_id: true, name: true, code: true } })),
      withDbRetry(() => prisma.departmentReview.findMany({ where, skip, take: limit, orderBy, include: { clearanceRequest: { include: { student: { select: { user_id: true, full_name: true, father_name: true, registration_no: true, cnic: true, email: true, cgpa: true, passing_year: true, program: true } }, departmentReviews: { select: { review_id: true, status: true, department: { select: { name: true, code: true } } } } } }, officer: { select: { full_name: true, email: true } } } })),
      withDbRetry(() => prisma.departmentReview.count({ where })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId, status: 'pending', resubmitted_at: null } })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId, status: 'pending', resubmitted_at: { not: null } } })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId, status: 'approved', reviewed_at: { gte: since } } })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId, status: { in: ['approved', 'correction_required', 'not_applicable'] } } })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId, status: 'correction_required' } })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId, status: 'approved' } })),
      withDbRetry(() => prisma.departmentReview.count({ where: { department_id: departmentId } })),
      withDbRetry(() => prisma.academicProgram.findMany({ where: { is_active: true }, select: { program_id: true, name: true, code: true }, orderBy: { name: 'asc' } })),
    ]);
    const reviewIds = rows.map((row) => row.review_id);
    const history = reviewIds.length ? await withDbRetry(() => prisma.activityLog.findMany({ where: { entity_type: 'DepartmentReview', entity_id: { in: reviewIds } }, include: { user: { select: { full_name: true, role: true } } }, orderBy: { created_at: 'asc' } })) : [];
    const historyByReview = new Map(reviewIds.map((id) => [id, history.filter((log) => log.entity_id === id)]));
    const data = rows.map((row) => { const all = row.clearanceRequest.departmentReviews; const approved = all.filter((item) => ['approved', 'not_applicable'].includes(item.status)).length; return { review_id: row.review_id, clearance_id: row.clearance_id, status: row.status, remarks: row.remarks, student_response: row.student_response, resubmitted_at: row.resubmitted_at, reviewed_at: row.reviewed_at, submitted_at: row.clearanceRequest.submitted_at, student: row.clearanceRequest.student, progress: { approved, total: all.length }, department_reviews: all, history: historyByReview.get(row.review_id) || [] }; });
    return res.status(200).json({ success: true, data, department, officer: { full_name: req.user.full_name, email: req.user.email }, metrics: { action_needed: actionNeeded, resubmissions, approved_today: approvedToday, total_processed: totalProcessed, under_correction: underCorrection, approved_total: approvedTotal, all_total: allTotal }, programs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return publicError(res, error, 'Failed to load department clearance workspace.'); }
};

// POST /api/clearance/officer/bulk-approve
export const bulkApproveReviews = async (req, res) => {
  try {
    const departmentId = req.user.department_id;
    const ids = Array.isArray(req.body?.review_ids) ? [...new Set(req.body.review_ids.map((id) => positiveInteger(id, 'review id')))] : [];
    if (!departmentId) return res.status(400).json({ success: false, message: 'Officer is not assigned to any department.' });
    if (!ids.length || ids.length > 100) return res.status(400).json({ success: false, message: 'Select between 1 and 100 pending reviews.' });
    const reviews = await withDbRetry(() => prisma.departmentReview.findMany({ where: { review_id: { in: ids }, department_id: departmentId, status: 'pending' }, include: { clearanceRequest: { select: { student_id: true } }, department: { select: { name: true } } } }));
    if (reviews.length !== ids.length) return res.status(409).json({ success: false, message: 'One or more selected records are unavailable, already decided, or belong to another department.' });
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      const updated = await withDbRetry(() => tx.departmentReview.updateMany({ where: { review_id: { in: ids }, department_id: departmentId, status: 'pending' }, data: { status: 'approved', officer_id: req.user.user_id, reviewed_at: new Date(), remarks: 'Approved through department bulk review.' } }));
      if (updated.count !== ids.length) throw Object.assign(new Error('A selected review changed during approval. Reload the queue and try again.'), { status: 409 });
      for (const review of reviews) {
        const remaining = await withDbRetry(() => tx.departmentReview.count({ where: { clearance_id: review.clearance_id, status: { notIn: ['approved', 'not_applicable'] } } }));
        await withDbRetry(() => tx.clearanceRequest.update({ where: { clearance_id: review.clearance_id }, data: remaining ? { status: 'in_progress' } : { status: 'completed', completed_at: new Date() } }));
        await withDbRetry(() => tx.activityLog.create({ data: { user_id: req.user.user_id, action: 'REVIEW_APPROVED', entity_type: 'DepartmentReview', entity_id: review.review_id, description: `${review.department.name} Officer approved review #${review.review_id} through bulk review.`, ip_address: req.ip || null, details: { mode: 'bulk', department_id: departmentId } } }));
        await withDbRetry(() => tx.notification.create({ data: { user_id: review.clearanceRequest.student_id, title: 'Department Approval', message: `${review.department.name} department approved your clearance review.` } }));
        if (!remaining) {
          await withDbRetry(() => tx.activityLog.create({ data: { user_id: review.clearanceRequest.student_id, action: 'CLEARANCE_COMPLETED', entity_type: 'ClearanceRequest', entity_id: review.clearance_id, description: `Clearance request #${review.clearance_id} completed successfully.` } }));
          await withDbRetry(() => tx.notification.create({ data: { user_id: review.clearanceRequest.student_id, title: 'Clearance Completed', message: 'Congratulations. Your clearance process has been completed.' } }));
        }
      }
    }));
    return res.status(200).json({ success: true, message: `${ids.length} clearance reviews approved and permanently locked.` });
  } catch (error) { return publicError(res, error, 'Failed to bulk approve clearance reviews.'); }
};

// GET /api/clearance/officer/export
export const exportOfficerClearances = async (req, res) => {
  try {
    const departmentId = req.user.department_id;
    if (!departmentId) return res.status(400).json({ success: false, message: 'Officer is not assigned to any department.' });
    const rows = await withDbRetry(() => prisma.departmentReview.findMany({ where: { department_id: departmentId }, include: { clearanceRequest: { include: { student: { select: { registration_no: true, full_name: true, cnic: true, program: { select: { name: true } } } } } }, officer: { select: { email: true } } }, orderBy: { review_id: 'desc' } }));
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const output = ['Reg No,Student Name,CNIC,Program,Status,Officer Email,Decision Timestamp,Remarks', ...rows.map((row) => [row.clearanceRequest.student.registration_no, row.clearanceRequest.student.full_name, row.clearanceRequest.student.cnic, row.clearanceRequest.student.program?.name, row.status, row.officer?.email || req.user.email, row.reviewed_at?.toISOString(), row.remarks].map(quote).join(','))].join('\n');
    return res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${req.user.department.code}-clearance-report.csv"` }).send(output);
  } catch (error) { return publicError(res, error, 'Failed to export department clearance report.'); }
};

// PUT /api/clearance/officer/review/:review_id (Officer Only)
export const submitReviewAction = async (req, res) => {
  try {
    const officerId = req.user.user_id;
    const departmentId = req.user.department_id;
    const reviewId = positiveInteger(req.params.review_id, 'review_id');
    const { status, remarks } = req.body;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Officer is not assigned to any department.',
      });
    }

    const allowedStatuses = ['approved', 'correction_required', 'not_applicable'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`,
      });
    }
    const cleanRemarks = typeof remarks === 'string' ? remarks.trim() : '';
    if (status === 'correction_required' && cleanRemarks.length < 10) {
      return res.status(400).json({ success: false, message: 'Correction remarks must clearly explain the issue using at least 10 characters.' });
    }

    const review = await withDbRetry(() =>
      prisma.departmentReview.findUnique({
        where: { review_id: reviewId },
        include: {
          clearanceRequest: {
            select: {
              clearance_id: true,
              student_id: true,
              status: true,
              student: { select: { full_name: true } },
            },
          },
          department: { select: { name: true } },
        },
      })
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
      });
    }

    if (review.department_id !== departmentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only review records belonging to your department.',
      });
    }

    if (review.status === 'approved') {
      return res.status(403).json({
        success: false,
        message: 'This review is already approved and locked. No further changes allowed.',
      });
    }

    const clearanceId = review.clearanceRequest.clearance_id;
    const studentId = review.clearanceRequest.student_id;
    const deptName = review.department.name;

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const claimed = await withDbRetry(() => tx.departmentReview.updateMany({
          where: { review_id: reviewId, department_id: departmentId, status: { not: 'approved' } },
          data: {
            status,
            remarks: cleanRemarks || null,
            reviewed_at: new Date(),
            officer_id: officerId,
          },
        }));
        if (claimed.count !== 1) throw Object.assign(new Error('This review is already approved and permanently locked.'), { status: 403 });

        let newClearanceStatus;
        let logAction;
        let logDescription;
        let notifTitle;
        let notifMessage;

        if (status === 'correction_required') {
          newClearanceStatus = 'correction_required';
          logAction = 'CORRECTION_REQUESTED';
          logDescription = `${deptName} Officer requested correction for review #${reviewId}.`;
          notifTitle = 'Correction Required';
          notifMessage = `${deptName} department requested correction. Please review remarks.`;
        } else {
          const allReviews = await withDbRetry(() => tx.departmentReview.findMany({
            where: { clearance_id: clearanceId },
          }));

          const allDone = allReviews.every(
            (r) => r.status === 'approved' || r.status === 'not_applicable'
          );

          newClearanceStatus = allDone ? 'completed' : 'in_progress';

          logAction = 'REVIEW_APPROVED';
          logDescription = `${deptName} Officer approved review #${reviewId}.`;
          notifTitle = 'Department Approval';
          notifMessage = `${deptName} department has approved your clearance review.`;
        }

        const clearanceData = { status: newClearanceStatus };
        if (newClearanceStatus === 'completed') {
          clearanceData.completed_at = new Date();
        }

        await withDbRetry(() => tx.clearanceRequest.update({
          where: { clearance_id: clearanceId },
          data: clearanceData,
        }));

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: officerId,
            action: logAction,
            entity_type: 'DepartmentReview',
            entity_id: reviewId,
            description: logDescription,
            ip_address: req.ip || null,
            details: { remarks: cleanRemarks || null, previous_status: review.status, new_status: status, student_response: review.student_response || null },
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: studentId,
            title: notifTitle,
            message: notifMessage,
          },
        }));

        if (newClearanceStatus === 'completed') {
          await withDbRetry(() => tx.activityLog.create({
            data: {
              user_id: studentId,
              action: 'CLEARANCE_COMPLETED',
              entity_type: 'ClearanceRequest',
              entity_id: clearanceId,
              description: `Clearance request #${clearanceId} completed successfully.`,
            },
          }));

          await withDbRetry(() => tx.notification.create({
            data: {
              user_id: studentId,
              title: 'Clearance Completed',
              message: 'Congratulations. Your clearance process has been completed.',
            },
          }));
        }
      }, { maxWait: 10000, timeout: 60000 })
    );

    return res.status(200).json({
      success: true,
      message: `Review updated to '${status}' successfully.`,
    });
  } catch (error) {
    return publicError(res, error, 'Failed to process review action.');
  }
};


// =============================================
// MILESTONE 04B ENDPOINTS
// =============================================

// GET /api/clearance/admin/all (Admin & Controller Only)
// Query Params: status, search, program_id, page, limit
export const getAllClearanceRequests = async (req, res) => {
  try {
    const { status, search, program_id } = req.query;
    const { page, limit: take, skip } = pagination(req.query);

    const whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (program_id) {
      whereClause.student = {
        ...whereClause.student,
        program_id: parseInt(program_id, 10),
      };
    }

    if (search) {
      whereClause.student = {
        ...whereClause.student,
        OR: [
          { full_name: { contains: search, mode: 'insensitive' } },
          { registration_no: { contains: search, mode: 'insensitive' } },
          { cnic: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, requests] = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const total = await withDbRetry(() => tx.clearanceRequest.count({ where: whereClause }));
        const requests = await withDbRetry(() => tx.clearanceRequest.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { clearance_id: 'desc' },
          include: {
            student: {
              select: {
                user_id: true,
                full_name: true,
                registration_no: true,
                email: true,
                cnic: true,
                program: { select: { program_id: true, name: true, code: true } },
              },
            },
            departmentReviews: {
              select: {
                review_id: true,
                status: true,
                department: { select: { name: true, code: true } },
              },
            },
          },
        }));
        return [total, requests];
      })
    );

    const formattedData = requests.map((reqItem) => {
      const reviews = reqItem.departmentReviews;
      const totalReviews = reviews.length;
      const completedReviews = reviews.filter(
        (r) => r.status === 'approved' || r.status === 'not_applicable'
      ).length;

      return {
        clearance_id: reqItem.clearance_id,
        status: reqItem.status,
        submitted_at: reqItem.submitted_at,
        completed_at: reqItem.completed_at,
        certificate_uri: reqItem.certificate_uri ? `/api/files/clearance-certificates/${reqItem.clearance_id}` : null,
        student: reqItem.student,
        progress: {
          total: totalReviews,
          completed: completedReviews,
          percentage: totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0,
        },
      };
    });

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      data: formattedData,
    });
  } catch (error) {
    console.error('Get All Clearance Requests Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch clearance requests.',
    });
  }
};

// GET /api/clearance/analytics (Admin & Controller Only)
export const getClearanceAnalytics = async (req, res) => {
  try {
    const statusCounts = await withDbRetry(() =>
      prisma.clearanceRequest.groupBy({
        by: ['status'],
        _count: { clearance_id: true },
      })
    );

    const statusMap = {
      draft: 0,
      applied: 0,
      in_progress: 0,
      correction_required: 0,
      completed: 0,
    };

    let totalApplications = 0;
    statusCounts.forEach((item) => {
      statusMap[item.status] = item._count.clearance_id;
      totalApplications += item._count.clearance_id;
    });

    const pendingByDept = await withDbRetry(() =>
      prisma.departmentReview.groupBy({
        by: ['department_id'],
        where: { status: { in: ['pending', 'correction_required'] } },
        _count: { review_id: true },
      })
    );

    const departments = await withDbRetry(() =>
      prisma.department.findMany({
        select: { department_id: true, name: true, code: true },
      })
    );

    const departmentBottlenecks = departments.map((dept) => {
      const match = pendingByDept.find((p) => p.department_id === dept.department_id);
      return {
        department_id: dept.department_id,
        name: dept.name,
        code: dept.code,
        pending_reviews: match ? match._count.review_id : 0,
      };
    });

    departmentBottlenecks.sort((a, b) => b.pending_reviews - a.pending_reviews);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total_applications: totalApplications,
          in_progress: statusMap.in_progress,
          correction_required: statusMap.correction_required,
          completed: statusMap.completed,
          draft: statusMap.draft,
        },
        department_bottlenecks: departmentBottlenecks,
      },
    });
  } catch (error) {
    console.error('Clearance Analytics Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate clearance analytics.',
    });
  }
};

// GET /api/clearance/:clearance_id (Admin, Controller, or Owning Student)
export const getClearanceDetailWithAudit = async (req, res) => {
  try {
    const clearanceId = positiveInteger(req.params.clearance_id, 'clearance_id');
    const currentUser = req.user;

    const clearance = await withDbRetry(() =>
      prisma.clearanceRequest.findUnique({
        where: { clearance_id: clearanceId },
        include: {
          student: {
            select: {
              user_id: true,
              full_name: true,
              registration_no: true,
              email: true,
              cnic: true,
              phone: true,
              program: { select: { name: true, code: true, level: true } },
            },
          },
          departmentReviews: {
            include: {
              department: { select: { department_id: true, name: true, code: true } },
              officer: { select: { user_id: true, full_name: true, email: true } },
            },
            orderBy: { department_id: 'asc' },
          },
        },
      })
    );

    if (!clearance) {
      return res.status(404).json({
        success: false,
        message: 'Clearance request not found.',
      });
    }

    if (
      currentUser.role === 'student' &&
      clearance.student_id !== currentUser.user_id
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this clearance request.',
      });
    }

    const auditLogs = await withDbRetry(() =>
      prisma.activityLog.findMany({
        where: {
          entity_type: { in: ['ClearanceRequest', 'DepartmentReview'] },
          OR: [
            { entity_id: clearanceId },
            {
              entity_id: {
                in: clearance.departmentReviews.map((r) => r.review_id),
              },
            },
          ],
        },
        include: {
          user: { select: { user_id: true, full_name: true, role: true } },
        },
        orderBy: { created_at: 'desc' },
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        clearance_id: clearance.clearance_id,
        status: clearance.status,
        submitted_at: clearance.submitted_at,
        completed_at: clearance.completed_at,
        certificate_uri: clearance.certificate_uri ? `/api/files/clearance-certificates/${clearance.clearance_id}` : null,
        certificate_generated_at: clearance.certificate_generated_at,
        student: clearance.student,
        reviews: clearance.departmentReviews,
        audit_trail: auditLogs,
      },
    });
  } catch (error) {
    console.error('Clearance Detail Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch clearance details.',
    });
  }
};

// POST /api/clearance/:clearance_id/generate-certificate (Admin & Controller Only)
export const generateClearanceCertificate = async (req, res) => {
  try {
    const clearanceId = positiveInteger(req.params.clearance_id, 'clearance_id');
    const issuerId = req.user.user_id;

    const clearance = await withDbRetry(() =>
      prisma.clearanceRequest.findUnique({
        where: { clearance_id: clearanceId },
        include: {
          student: { select: { user_id: true, full_name: true, father_name: true, registration_no: true, program: { select: { name: true } } } },
          departmentReviews: { include: { department: { select: { name: true, code: true } }, officer: { select: { full_name: true } } }, orderBy: { department_id: 'asc' } },
        },
      })
    );

    if (!clearance) {
      return res.status(404).json({
        success: false,
        message: 'Clearance request not found.',
      });
    }

    if (req.user.role === 'student' && clearance.student_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You can only generate your own clearance certificate.' });
    }

    if (clearance.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot issue certificate. Clearance status is '${clearance.status}'. Must be 'completed'.`,
      });
    }
    if (!clearance.departmentReviews.length || clearance.departmentReviews.some((review) => !['approved', 'not_applicable'].includes(review.status))) {
      return res.status(409).json({ success: false, message: 'Certificate generation requires every assigned department review to be approved.' });
    }

    if (clearance.certificate_uri) {
      return res.status(200).json({
        success: true,
        message: 'Clearance certificate has already been generated.',
        data: {
          clearance_id: clearanceId,
          certificate_uri: `/api/files/clearance-certificates/${clearanceId}`,
          certificate_generated_at: clearance.certificate_generated_at,
        },
      });
    }

    const certNumber = `CERT-GRADFLOW-${Date.now()}-${clearanceId}`;
    const pakistanTime = (date) => date ? new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' }).format(date) : 'Recorded';
    const departmentApprovals = clearance.departmentReviews.map((review) => ({
      department: `${review.department.name} [${review.department.code}]`,
      officer: review.officer?.full_name || (review.status === 'not_applicable' ? 'Not applicable' : 'Authorized Officer'),
      approvedAt: pakistanTime(review.reviewed_at),
      verification: createHash('sha256').update(`${certNumber}|${review.review_id}|${review.department.code}|${review.reviewed_at?.toISOString() || review.status}`).digest('hex').slice(0, 12).toUpperCase(),
    }));
    const generated = await createUniversityPdf({
      kind: 'clearance-certificate', reference: certNumber, title: 'Clearance Certificate',
      fields: [['Student', clearance.student.full_name], ['Father Name', clearance.student.father_name], ['Registration No.', clearance.student.registration_no], ['Program', clearance.student.program?.name], ['Clearance Request', clearanceId], ['Status', `Completed (${departmentApprovals.length}/${departmentApprovals.length} departments)`], ['Issued Date', pakistanTime(new Date())]],
      qrText: `GRADFLOW-CLEARANCE|${certNumber}|STUDENT-${clearance.student.registration_no}|DEPARTMENTS-${departmentApprovals.length}`,
      departmentApprovals,
    });
    const certificateUri = generated.uri;
    const now = new Date();

    try {
      await withDbRetry(() => prisma.$transaction(async (tx) => {
        await withDbRetry(() => tx.clearanceRequest.update({
          where: { clearance_id: clearanceId },
          data: {
            certificate_uri: certificateUri,
            certificate_generated_at: now,
          },
        }));

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: issuerId,
            action: 'CERTIFICATE_GENERATED',
            entity_type: 'ClearanceRequest',
            entity_id: clearanceId,
            description: `Clearance certificate #${certNumber} issued for student ${clearance.student.full_name}.`,
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: clearance.student_id,
            title: 'Clearance Certificate Ready',
            message: 'Your official clearance certificate is now ready to download.',
          },
        }));
      }));
    } catch (error) {
      await removeFile(generated.path);
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: 'Clearance certificate generated successfully.',
      data: {
        clearance_id: clearanceId,
        certificate_uri: `/api/files/clearance-certificates/${clearanceId}`,
        certificate_generated_at: now,
      },
    });
  } catch (error) {
    console.error('Generate Certificate Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate clearance certificate.',
    });
  }
};
