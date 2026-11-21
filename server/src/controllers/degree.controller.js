import prisma, { withDbRetry } from '../config/prisma.js';

// =============================================
// ENDPOINT 1 — Student Initiates Degree Application
// POST /api/degree/apply
// =============================================
export const applyForDegree = async (req, res) => {
  try {
    const studentId = req.user.user_id;

    // 1. Verify student has a completed clearance request
    const clearance = await withDbRetry(() =>
      prisma.clearanceRequest.findFirst({
        where: {
          student_id: studentId,
          status: 'completed',
        },
        orderBy: { clearance_id: 'desc' },
      })
    );

    if (!clearance) {
      return res.status(400).json({
        success: false,
        message:
          'Degree application denied. You must complete your clearance process first.',
      });
    }

    // 2. Check if degree application already exists for this clearance
    const existingApp = await withDbRetry(() =>
      prisma.degreeApplication.findUnique({
        where: { clearance_id: clearance.clearance_id },
      })
    );

    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'Degree application has already been submitted.',
        data: existingApp,
      });
    }

    // 3. Create Degree Application inside a transaction + Log + Notification
    const degreeApp = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const newApp = await tx.degreeApplication.create({
          data: {
            student_id: studentId,
            clearance_id: clearance.clearance_id,
            status: 'application_started',
          },
        });

        await tx.activityLog.create({
          data: {
            user_id: studentId,
            action: 'DEGREE_APPLICATION_STARTED',
            entity_type: 'DegreeApplication',
            entity_id: newApp.degree_app_id,
            description: `Student ${req.user.full_name} initiated degree application #${newApp.degree_app_id}.`,
          },
        });

        await tx.notification.create({
          data: {
            user_id: studentId,
            title: 'Degree Application Started',
            message:
              'Your degree application has been initiated. Please upload required documents.',
          },
        });

        return newApp;
      })
    );

    return res.status(201).json({
      success: true,
      message: 'Degree application initiated successfully.',
      data: degreeApp,
    });
  } catch (error) {
    console.error('Apply For Degree Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate degree application.',
      error: error.message,
    });
  }
};

// =============================================
// ENDPOINT 2 — Student Uploads Required Document
// POST /api/degree/documents/upload
// Body: multipart/form-data (file, document_type, degree_app_id)
// =============================================
export const uploadDocument = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { document_type, degree_app_id } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded.',
      });
    }

    const appId = parseInt(degree_app_id, 10);
    if (isNaN(appId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid degree application ID.',
      });
    }

    const validDocTypes = [
      'CNIC',
      'PHOTO',
      'SSC_DMC',
      'SSC_CERT',
      'HSSC_DMC',
      'HSSC_CERT',
      'FEE_SLIP',
      'VERIFICATION_SLIP',
      'INTERNSHIP',
      'CLEARANCE_CERT',
    ];

    if (!document_type || !validDocTypes.includes(document_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid document type. Allowed types: ${validDocTypes.join(', ')}`,
      });
    }

    // Verify degree app belongs to student
    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findUnique({
        where: { degree_app_id: appId },
      })
    );

    if (!degreeApp || degreeApp.student_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this degree application.',
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const document = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        // Upsert document (replace existing if re-uploading same doc type)
        const existingDoc = await tx.document.findFirst({
          where: { degree_app_id: appId, document_type },
        });

        let savedDoc;
        if (existingDoc) {
          savedDoc = await tx.document.update({
            where: { document_id: existingDoc.document_id },
            data: {
              file_url: fileUrl,
              verification_status: 'pending',
              remarks: null,
              uploaded_at: new Date(),
            },
          });
        } else {
          savedDoc = await tx.document.create({
            data: {
              degree_app_id: appId,
              document_type,
              file_url: fileUrl,
              verification_status: 'pending',
            },
          });
        }

        // Auto advance pipeline status to 'documents_uploaded' if currently 'application_started'
        if (degreeApp.status === 'application_started') {
          await tx.degreeApplication.update({
            where: { degree_app_id: appId },
            data: { status: 'documents_uploaded' },
          });
        }

        await tx.activityLog.create({
          data: {
            user_id: studentId,
            action: 'DOCUMENT_UPLOADED',
            entity_type: 'Document',
            entity_id: savedDoc.document_id,
            description: `Student uploaded document '${document_type}' for degree app #${appId}.`,
          },
        });

        return savedDoc;
      })
    );

    return res.status(200).json({
      success: true,
      message: `Document '${document_type}' uploaded successfully.`,
      data: document,
    });
  } catch (error) {
    console.error('Upload Document Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload document.',
      error: error.message,
    });
  }
};

// =============================================
// ENDPOINT 3 — Student Views Degree Application Status
// GET /api/degree/my-application
// =============================================
export const getMyDegreeApplication = async (req, res) => {
  try {
    const studentId = req.user.user_id;

    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findFirst({
        where: { student_id: studentId },
        orderBy: { degree_app_id: 'desc' },
        include: {
          documents: {
            orderBy: { uploaded_at: 'desc' },
          },
          receipt: true,
          clearanceRequest: {
            select: {
              clearance_id: true,
              status: true,
              certificate_uri: true,
            },
          },
        },
      })
    );

    if (!degreeApp) {
      return res.status(404).json({
        success: false,
        message: 'No active degree application found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: degreeApp,
    });
  } catch (error) {
    console.error('Get My Degree Application Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch degree application.',
      error: error.message,
    });
  }
};

// =============================================
// ENDPOINT 4 — Controller Views Queue
// GET /api/degree/controller/queue
// Access: Controller & Admin
// Query: status, page, limit
// =============================================
export const getControllerDegreeQueue = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const [total, applications] = await withDbRetry(() =>
      prisma.$transaction([
        prisma.degreeApplication.count({ where: whereClause }),
        prisma.degreeApplication.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { updated_at: 'desc' },
          include: {
            student: {
              select: {
                user_id: true,
                full_name: true,
                registration_no: true,
                email: true,
                cnic: true,
                phone: true,
                program: { select: { name: true, code: true } },
              },
            },
            documents: true,
            receipt: true,
          },
        }),
      ])
    );

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      data: applications,
    });
  } catch (error) {
    console.error('Controller Queue Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch controller degree queue.',
      error: error.message,
    });
  }
};

// =============================================
// ENDPOINT 5 — Controller Verifies or Rejects a Document
// PUT /api/degree/controller/verify-document/:document_id
// Access: Controller & Admin
// Body: { verification_status: "verified" | "rejected", remarks: string }
// =============================================
export const verifyDocument = async (req, res) => {
  try {
    const controllerId = req.user.user_id;
    const documentId = parseInt(req.params.document_id, 10);
    const { verification_status, remarks } = req.body;

    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID.',
      });
    }

    const allowedStatuses = ['verified', 'rejected'];
    if (!verification_status || !allowedStatuses.includes(verification_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status. Allowed: 'verified', 'rejected'.",
      });
    }

    const doc = await withDbRetry(() =>
      prisma.document.findUnique({
        where: { document_id: documentId },
        include: {
          degreeApplication: {
            select: { degree_app_id: true, student_id: true },
          },
        },
      })
    );

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const studentId = doc.degreeApplication.student_id;

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { document_id: documentId },
          data: {
            verification_status,
            remarks: remarks || null,
          },
        });

        const statusText = verification_status.toUpperCase();

        await tx.activityLog.create({
          data: {
            user_id: controllerId,
            action: `DOCUMENT_${statusText}`,
            entity_type: 'Document',
            entity_id: documentId,
            description: `Controller ${req.user.full_name} set document '${doc.document_type}' status to ${verification_status}.`,
          },
        });

        await tx.notification.create({
          data: {
            user_id: studentId,
            title: `Document ${verification_status === 'verified' ? 'Verified' : 'Rejected'}`,
            message: `Your uploaded document '${doc.document_type}' was ${verification_status}.${remarks ? ` Remarks: ${remarks}` : ''}`,
          },
        });
      })
    );

    return res.status(200).json({
      success: true,
      message: `Document status updated to '${verification_status}'.`,
    });
  } catch (error) {
    console.error('Verify Document Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify document.',
      error: error.message,
    });
  }
};

// =============================================
// ENDPOINT 6 — Controller Advances Degree Status Pipeline
// PUT /api/degree/controller/update-status/:degree_app_id
// Access: Controller & Admin
// Body: { status: DegreeStatus }
// =============================================
export const updateDegreeStatus = async (req, res) => {
  try {
    const controllerId = req.user.user_id;
    const appId = parseInt(req.params.degree_app_id, 10);
    const { status } = req.body;

    if (isNaN(appId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid degree application ID.',
      });
    }

    const validPipelineStatuses = [
      'application_started',
      'documents_uploaded',
      'controller_review',
      'degree_processing',
      'degree_ready',
      'degree_collected',
      'completed',
    ];

    if (!status || !validPipelineStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid degree status. Allowed values: ${validPipelineStatuses.join(', ')}`,
      });
    }

    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findUnique({
        where: { degree_app_id: appId },
      })
    );

    if (!degreeApp) {
      return res.status(404).json({
        success: false,
        message: 'Degree application not found.',
      });
    }

    const updateData = { status };
    const now = new Date();

    if (status === 'controller_review' && !degreeApp.approved_at) {
      updateData.approved_at = now;
    } else if (status === 'degree_ready' && !degreeApp.ready_at) {
      updateData.ready_at = now;
    } else if (status === 'degree_collected' && !degreeApp.collected_at) {
      updateData.collected_at = now;
    }

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.degreeApplication.update({
          where: { degree_app_id: appId },
          data: updateData,
        });

        await tx.activityLog.create({
          data: {
            user_id: controllerId,
            action: 'DEGREE_STATUS_UPDATED',
            entity_type: 'DegreeApplication',
            entity_id: appId,
            description: `Controller updated degree app #${appId} status to '${status}'.`,
          },
        });

        await tx.notification.create({
          data: {
            user_id: degreeApp.student_id,
            title: 'Degree Status Updated',
            message: `Your degree application status has been updated to '${status.replace(/_/g, ' ').toUpperCase()}'.`,
          },
        });
      })
    );

    return res.status(200).json({
      success: true,
      message: `Degree application status updated to '${status}'.`,
    });
  } catch (error) {
    console.error('Update Degree Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update degree status.',
      error: error.message,
    });
  }
};

// =============================================
// ENDPOINT 7 — Controller Issues Collection Receipt / Challan
// POST /api/degree/controller/generate-receipt/:degree_app_id
// Access: Controller & Admin
// Body: { collection_date: "YYYY-MM-DD" }
// =============================================
export const generateCollectionReceipt = async (req, res) => {
  try {
    const controllerId = req.user.user_id;
    const appId = parseInt(req.params.degree_app_id, 10);
    const { collection_date } = req.body;

    if (isNaN(appId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid degree application ID.',
      });
    }

    if (!collection_date) {
      return res.status(400).json({
        success: false,
        message: 'Collection date is required (YYYY-MM-DD).',
      });
    }

    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findUnique({
        where: { degree_app_id: appId },
        include: { receipt: true },
      })
    );

    if (!degreeApp) {
      return res.status(404).json({
        success: false,
        message: 'Degree application not found.',
      });
    }

    if (degreeApp.receipt) {
      return res.status(400).json({
        success: false,
        message: 'Collection receipt has already been generated for this application.',
        data: degreeApp.receipt,
      });
    }

    const receiptNumber = `RCT-UETM-${Date.now()}-${appId}`;
    const pdfUrl = `/receipts/${receiptNumber}.pdf`;

    const receipt = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const newReceipt = await tx.receipt.create({
          data: {
            degree_app_id: appId,
            receipt_number: receiptNumber,
            pdf_url: pdfUrl,
            collection_date: new Date(collection_date),
            generated_by: controllerId,
          },
        });

        // Automatically update degree status to degree_ready
        await tx.degreeApplication.update({
          where: { degree_app_id: appId },
          data: {
            status: 'degree_ready',
            ready_at: new Date(),
          },
        });

        await tx.activityLog.create({
          data: {
            user_id: controllerId,
            action: 'RECEIPT_GENERATED',
            entity_type: 'Receipt',
            entity_id: newReceipt.receipt_id,
            description: `Controller issued receipt #${receiptNumber} for degree app #${appId}. Collection date: ${collection_date}.`,
          },
        });

        await tx.notification.create({
          data: {
            user_id: degreeApp.student_id,
            title: 'Collection Receipt Issued',
            message: `Your degree collection receipt #${receiptNumber} is ready. Scheduled collection date: ${collection_date}.`,
          },
        });

        return newReceipt;
      })
    );

    return res.status(201).json({
      success: true,
      message: 'Collection receipt generated successfully.',
      data: receipt,
    });
  } catch (error) {
    console.error('Generate Receipt Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate collection receipt.',
      error: error.message,
    });
  }
};