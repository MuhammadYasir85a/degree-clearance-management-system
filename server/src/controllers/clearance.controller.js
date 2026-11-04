import prisma, { withDbRetry } from '../config/prisma.js';

// =============================================
// MILESTONE 04A ENDPOINTS
// =============================================

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
      })
    );

    if (activeRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active clearance request.',
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
        const newClearance = await tx.clearanceRequest.create({
          data: {
            student_id: studentId,
            status: 'in_progress',
            submitted_at: new Date(),
          },
        });

        const reviewRows = activeDepartments.map((dept) => ({
          clearance_id: newClearance.clearance_id,
          department_id: dept.department_id,
          status: 'pending',
        }));

        await tx.departmentReview.createMany({ data: reviewRows });

        await tx.activityLog.create({
          data: {
            user_id: studentId,
            action: 'CLEARANCE_APPLIED',
            entity_type: 'ClearanceRequest',
            entity_id: newClearance.clearance_id,
            description: `Student ${studentName} submitted clearance request #${newClearance.clearance_id}.`,
          },
        });

        await tx.notification.create({
          data: {
            user_id: studentId,
            title: 'Clearance Submitted',
            message: 'Your clearance request has been submitted successfully.',
          },
        });

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
      error: error.message,
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
        certificate_uri: clearance.certificate_uri,
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
      error: error.message,
    });
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
      error: error.message,
    });
  }
};

// PUT /api/clearance/officer/review/:review_id (Officer Only)
export const submitReviewAction = async (req, res) => {
  try {
    const officerId = req.user.user_id;
    const departmentId = req.user.department_id;
    const reviewId = parseInt(req.params.review_id, 10);
    const { status, remarks } = req.body;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Officer is not assigned to any department.',
      });
    }

    if (isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID.',
      });
    }

    const allowedStatuses = ['approved', 'correction_required', 'not_applicable'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`,
      });
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
        await tx.departmentReview.update({
          where: { review_id: reviewId },
          data: {
            status,
            remarks: remarks || null,
            reviewed_at: new Date(),
            officer_id: officerId,
          },
        });

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
          const allReviews = await tx.departmentReview.findMany({
            where: { clearance_id: clearanceId },
          });

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

        await tx.clearanceRequest.update({
          where: { clearance_id: clearanceId },
          data: clearanceData,
        });

        await tx.activityLog.create({
          data: {
            user_id: officerId,
            action: logAction,
            entity_type: 'DepartmentReview',
            entity_id: reviewId,
            description: logDescription,
          },
        });

        await tx.notification.create({
          data: {
            user_id: studentId,
            title: notifTitle,
            message: notifMessage,
          },
        });

        if (newClearanceStatus === 'completed') {
          await tx.activityLog.create({
            data: {
              user_id: studentId,
              action: 'CLEARANCE_COMPLETED',
              entity_type: 'ClearanceRequest',
              entity_id: clearanceId,
              description: `Clearance request #${clearanceId} completed successfully.`,
            },
          });

          await tx.notification.create({
            data: {
              user_id: studentId,
              title: 'Clearance Completed',
              message: 'Congratulations. Your clearance process has been completed.',
            },
          });
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: `Review updated to '${status}' successfully.`,
    });
  } catch (error) {
    console.error('Submit Review Action Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process review action.',
      error: error.message,
    });
  }
};


// =============================================
// MILESTONE 04B ENDPOINTS
// =============================================

// GET /api/clearance/admin/all (Admin & Controller Only)
// Query Params: status, search, program_id, page, limit
export const getAllClearanceRequests = async (req, res) => {
  try {
    const { status, search, program_id, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

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
      prisma.$transaction([
        prisma.clearanceRequest.count({ where: whereClause }),
        prisma.clearanceRequest.findMany({
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
        }),
      ])
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
        certificate_uri: reqItem.certificate_uri,
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
        page: parseInt(page, 10),
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
      error: error.message,
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
      error: error.message,
    });
  }
};

// GET /api/clearance/:clearance_id (Admin, Controller, or Owning Student)
export const getClearanceDetailWithAudit = async (req, res) => {
  try {
    const clearanceId = parseInt(req.params.clearance_id, 10);
    const currentUser = req.user;

    if (isNaN(clearanceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clearance ID.',
      });
    }

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
        certificate_uri: clearance.certificate_uri,
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
      error: error.message,
    });
  }
};

// POST /api/clearance/:clearance_id/generate-certificate (Admin & Controller Only)
export const generateClearanceCertificate = async (req, res) => {
  try {
    const clearanceId = parseInt(req.params.clearance_id, 10);
    const issuerId = req.user.user_id;

    if (isNaN(clearanceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clearance ID.',
      });
    }

    const clearance = await withDbRetry(() =>
      prisma.clearanceRequest.findUnique({
        where: { clearance_id: clearanceId },
        include: { student: { select: { user_id: true, full_name: true } } },
      })
    );

    if (!clearance) {
      return res.status(404).json({
        success: false,
        message: 'Clearance request not found.',
      });
    }

    if (clearance.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot issue certificate. Clearance status is '${clearance.status}'. Must be 'completed'.`,
      });
    }

    const certNumber = `CERT-UETM-${Date.now()}-${clearanceId}`;
    const certificateUri = `/certificates/${certNumber}.pdf`;
    const now = new Date();

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.clearanceRequest.update({
          where: { clearance_id: clearanceId },
          data: {
            certificate_uri: certificateUri,
            certificate_generated_at: now,
          },
        });

        await tx.activityLog.create({
          data: {
            user_id: issuerId,
            action: 'CERTIFICATE_GENERATED',
            entity_type: 'ClearanceRequest',
            entity_id: clearanceId,
            description: `Clearance certificate #${certNumber} issued for student ${clearance.student.full_name}.`,
          },
        });

        await tx.notification.create({
          data: {
            user_id: clearance.student_id,
            title: 'Clearance Certificate Ready',
            message: 'Your official UET Mardan clearance certificate is now ready to download.',
          },
        });
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Clearance certificate generated successfully.',
      data: {
        clearance_id: clearanceId,
        certificate_uri: certificateUri,
        certificate_generated_at: now,
      },
    });
  } catch (error) {
    console.error('Generate Certificate Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate clearance certificate.',
      error: error.message,
    });
  }
};