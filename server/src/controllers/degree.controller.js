import prisma, { withDbRetry } from '../config/prisma.js';
import { pagination, positiveInteger, publicError } from '../utils/http.utils.js';
import { removeFile, resolveStoredDocument, storeValidatedDocument } from '../services/file-storage.service.js';
import { createUniversityPdf } from '../services/pdf.service.js';

const REQUIRED_DOCUMENT_TYPES = ['CNIC', 'PHOTO', 'SSC_DMC', 'SSC_CERT', 'HSSC_DMC', 'HSSC_CERT', 'FEE_SLIP', 'VERIFICATION_SLIP', 'INTERNSHIP', 'CLEARANCE_CERT'];
const NEXT_DEGREE_STATUS = {
  application_started: 'documents_uploaded',
  documents_uploaded: 'controller_review',
  controller_review: 'degree_processing',
  degree_processing: 'degree_ready',
  degree_ready: 'degree_collected',
  degree_collected: 'completed',
};
const publicDocument = (document) => ({ ...document, file_url: `/api/files/documents/${document.document_id}` });
const publicReceipt = (receipt) => receipt && ({ ...receipt, pdf_url: `/api/files/receipts/${receipt.receipt_id}` });
const maskRegistration = (value) => {
  const text = String(value || '');
  if (text.length <= 4) return text;
  return `${text.slice(0, 4)}${'•'.repeat(Math.max(3, text.length - 8))}${text.slice(-4)}`;
};
const publicDegreeApplication = (application) => ({
  ...application,
  ...(application.documents && { documents: application.documents.map(publicDocument) }),
  ...(application.receipt && { receipt: publicReceipt(application.receipt) }),
  ...(application.clearanceRequest?.certificate_uri && {
    clearanceRequest: {
      ...application.clearanceRequest,
      certificate_uri: `/api/files/clearance-certificates/${application.clearanceRequest.clearance_id}`,
    },
  }),
});

// =============================================
// ENDPOINT 1 — Student Initiates Degree Application
// POST /api/degree/apply
// =============================================
export const applyForDegree = async (req, res) => {
  try {
    const studentId = req.user.user_id;

    // 1. The newest clearance request controls eligibility. An older completed
    // request must never bypass a newer in-progress request.
    const clearance = await withDbRetry(() =>
      prisma.clearanceRequest.findFirst({
        where: { student_id: studentId },
        orderBy: { clearance_id: 'desc' },
      })
    );

    if (!clearance || clearance.status !== 'completed') {
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
        const newApp = await withDbRetry(() => tx.degreeApplication.create({
          data: {
            student_id: studentId,
            clearance_id: clearance.clearance_id,
            status: 'application_started',
          },
        }));

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: studentId,
            action: 'DEGREE_APPLICATION_STARTED',
            entity_type: 'DegreeApplication',
            entity_id: newApp.degree_app_id,
            description: `Student ${req.user.full_name} initiated degree application #${newApp.degree_app_id}.`,
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: studentId,
            title: 'Degree Application Started',
            message:
              'Your degree application has been initiated. Please upload required documents.',
          },
        }));

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

    const appId = positiveInteger(degree_app_id, 'degree_app_id');

    if (!document_type || !REQUIRED_DOCUMENT_TYPES.includes(document_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid document type. Allowed types: ${REQUIRED_DOCUMENT_TYPES.join(', ')}`,
      });
    }

    // Verify degree app belongs to student
    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findUnique({
        where: { degree_app_id: appId },
        include: { documents: true },
      })
    );

    if (!degreeApp || degreeApp.student_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this degree application.',
      });
    }

    if (!['application_started', 'controller_review'].includes(degreeApp.status)) {
      return res.status(409).json({ success: false, message: 'Documents can no longer be replaced at this application stage.' });
    }
    if (degreeApp.status === 'controller_review') {
      const currentDocument = degreeApp.documents.find((item) => item.document_type === document_type);
      if (!currentDocument || currentDocument.verification_status !== 'rejected') {
        return res.status(409).json({ success: false, message: 'Only a document rejected by the Controller can be replaced during review.' });
      }
    }
    const stored = await storeValidatedDocument(req.file);
    const fileUrl = `/private/documents/${stored.filename}`;
    let oldPath = null;
    let document;
    try {
      document = await withDbRetry(() => prisma.$transaction(async (tx) => {
        // Upsert document (replace existing if re-uploading same doc type)
        const existingDoc = await withDbRetry(() => tx.document.findFirst({
          where: { degree_app_id: appId, document_type },
        }));

        let savedDoc;
        if (existingDoc) {
          oldPath = resolveStoredDocument(existingDoc.file_url);
          savedDoc = await withDbRetry(() => tx.document.update({
            where: { document_id: existingDoc.document_id },
            data: {
              file_url: fileUrl,
              verification_status: 'pending',
              remarks: null,
              uploaded_at: new Date(),
            },
          }));
        } else {
          savedDoc = await withDbRetry(() => tx.document.create({
            data: {
              degree_app_id: appId,
              document_type,
              file_url: fileUrl,
              verification_status: 'pending',
            },
          }));
        }

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: studentId,
            action: 'DOCUMENT_UPLOADED',
            entity_type: 'Document',
            entity_id: savedDoc.document_id,
            description: `Student uploaded document '${document_type}' for degree app #${appId}.`,
          },
        }));

        return savedDoc;
      }));
    } catch (error) {
      await removeFile(stored.path);
      throw error;
    }
    await removeFile(oldPath).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Document '${document_type}' uploaded successfully.`,
      data: publicDocument(document),
    });
  } catch (error) {
    console.error('Upload Document Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload document.',
    });
  }
};

// DELETE /api/degree/documents/:document_id — remove an editable student file
export const deleteDocument = async (req, res) => {
  try {
    const documentId = positiveInteger(req.params.document_id, 'document_id');
    const document = await withDbRetry(() => prisma.document.findUnique({
      where: { document_id: documentId },
      include: { degreeApplication: true },
    }));

    if (!document || document.degreeApplication.student_id !== req.user.user_id) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    const editableDraft = document.degreeApplication.status === 'application_started';
    const rejectedCorrection = document.degreeApplication.status === 'controller_review'
      && document.verification_status === 'rejected';
    if (!editableDraft && !rejectedCorrection) {
      return res.status(409).json({ success: false, message: 'This document is locked for official review.' });
    }

    const storedPath = resolveStoredDocument(document.file_url);
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.document.delete({ where: { document_id: documentId } }));
      await withDbRetry(() => tx.activityLog.create({ data: {
        user_id: req.user.user_id,
        action: 'DOCUMENT_DELETED',
        entity_type: 'Document',
        entity_id: documentId,
        description: `Student removed '${document.document_type}' from degree app #${document.degree_app_id}.`,
      } }));
    }));
    await removeFile(storedPath).catch(() => {});
    return res.status(200).json({ success: true, message: 'Document removed successfully.' });
  } catch (error) {
    return publicError(res, error, 'Failed to remove document.');
  }
};

// POST /api/degree/submit/:degree_app_id — student locks a complete draft for review
export const submitDegreeApplication = async (req, res) => {
  try {
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const application = await withDbRetry(() => prisma.degreeApplication.findUnique({
      where: { degree_app_id: appId },
      include: { documents: true },
    }));
    if (!application || application.student_id !== req.user.user_id) {
      return res.status(404).json({ success: false, message: 'Degree application not found.' });
    }
    if (['documents_uploaded', 'controller_review'].includes(application.status)) {
      return res.status(200).json({ success: true, message: 'Application is already submitted for controller review.' });
    }
    if (application.status !== 'application_started') {
      return res.status(409).json({ success: false, message: 'This application cannot be submitted at its current stage.' });
    }
    const presentTypes = new Set(application.documents.map(({ document_type }) => document_type));
    const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !presentTypes.has(type));
    if (missing.length) {
      return res.status(409).json({ success: false, message: `Upload all required documents before submission. Missing: ${missing.join(', ')}` });
    }
    if (!application.fee_slip_number || !application.verification_slip_number || !application.deposit_date) {
      return res.status(409).json({ success: false, message: 'Complete the Bank of Khyber fee slip numbers and deposit date before submission.' });
    }

    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.degreeApplication.update({
        where: { degree_app_id: appId }, data: { status: 'documents_uploaded' },
      }));
      await withDbRetry(() => tx.activityLog.create({ data: {
        user_id: req.user.user_id,
        action: 'DEGREE_APPLICATION_SUBMITTED',
        entity_type: 'DegreeApplication',
        entity_id: appId,
        description: `Student submitted degree app #${appId} for controller review.`,
      } }));
      await withDbRetry(() => tx.notification.create({ data: {
        user_id: req.user.user_id,
        title: 'Degree Application Submitted',
        message: 'Your documents are now locked and queued for Controller review.',
      } }));
    }));
    return res.status(200).json({ success: true, message: 'Degree application submitted for controller review.' });
  } catch (error) {
    return publicError(res, error, 'Failed to submit degree application.');
  }
};

// PUT /api/degree/:degree_app_id/particulars — save official form draft fields
export const updateDegreeParticulars = async (req, res) => {
  try {
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const application = await withDbRetry(() => prisma.degreeApplication.findUnique({ where: { degree_app_id: appId } }));
    if (!application || application.student_id !== req.user.user_id) return res.status(404).json({ success: false, message: 'Degree application not found.' });
    if (application.status !== 'application_started') return res.status(409).json({ success: false, message: 'Official form particulars are locked after submission.' });
    const clean = (value, field) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw Object.assign(new Error(`${field} must be at most 80 characters.`), { status: 400 });
      return value.trim();
    };
    const feeSlip = clean(req.body?.fee_slip_number, 'Degree fee slip number');
    const verificationSlip = clean(req.body?.verification_slip_number, 'Verification fee slip number');
    let depositDate = null;
    if (req.body?.deposit_date) {
      if (typeof req.body.deposit_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(req.body.deposit_date)) return res.status(400).json({ success: false, message: 'Deposit date must use YYYY-MM-DD.' });
      depositDate = new Date(`${req.body.deposit_date}T00:00:00.000Z`);
      if (Number.isNaN(depositDate.getTime()) || depositDate.toISOString().slice(0, 10) !== req.body.deposit_date) return res.status(400).json({ success: false, message: 'Deposit date is invalid.' });
    }
    const updated = await withDbRetry(() => prisma.degreeApplication.update({ where: { degree_app_id: appId }, data: { fee_slip_number: feeSlip, verification_slip_number: verificationSlip, deposit_date: depositDate } }));
    return res.status(200).json({ success: true, message: 'Degree application particulars saved.', data: updated });
  } catch (error) {
    return publicError(res, error, 'Failed to save degree application particulars.');
  }
};

// =============================================
// ENDPOINT 3 — Student Views Degree Application Status
// GET /api/degree/my-application
// =============================================
export const getMyDegreeApplication = async (req, res) => {
  try {
    const studentId = req.user.user_id;

    const latestClearance = await withDbRetry(() =>
      prisma.clearanceRequest.findFirst({
        where: { student_id: studentId },
        orderBy: { clearance_id: 'desc' },
        select: { clearance_id: true },
      })
    );

    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findFirst({
        where: {
          student_id: studentId,
          ...(latestClearance ? { clearance_id: latestClearance.clearance_id } : {}),
        },
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
      data: publicDegreeApplication(degreeApp),
    });
  } catch (error) {
    console.error('Get My Degree Application Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch degree application.',
    });
  }
};

// Deliberately public authenticity check with a minimal, non-sensitive response.
export const verifyPublicReceipt = async (req, res) => {
  try {
    const receiptNumber = String(req.params.receipt_number || '').trim().toUpperCase();
    if (!/^RCT-(?:GRADFLOW|UETM)-\d{10,16}-\d{1,10}$/.test(receiptNumber)) {
      return res.status(400).json({ success: false, message: 'Enter a valid GradFlow receipt number.' });
    }
    const receipt = await withDbRetry(() => prisma.receipt.findUnique({
      where: { receipt_number: receiptNumber },
      select: {
        receipt_number: true,
        collection_date: true,
        generated_at: true,
        degreeApplication: {
          select: {
            status: true,
            student: {
              select: {
                full_name: true,
                registration_no: true,
                program: { select: { name: true } },
              },
            },
          },
        },
      },
    }));
    if (!receipt) return res.status(404).json({ success: false, message: 'No authentic university receipt matches this reference.' });
    return res.status(200).json({
      success: true,
      data: {
        authentic: true,
        institution: 'GradFlow Academic Operations Platform',
        receipt_number: receipt.receipt_number,
        student_name: receipt.degreeApplication.student.full_name,
        registration_no: maskRegistration(receipt.degreeApplication.student.registration_no),
        programme: receipt.degreeApplication.student.program?.name || 'University programme',
        collection_date: receipt.collection_date,
        issued_at: receipt.generated_at,
        status: receipt.degreeApplication.status,
      },
    });
  } catch (error) {
    return publicError(res, error, 'Receipt verification is temporarily unavailable.');
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
    const { status, search, program_id } = req.query;
    const { page, limit: take, skip } = pagination(req.query);

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (program_id) whereClause.student = { program_id: positiveInteger(program_id, 'program_id') };
    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      const appId = /^\d+$/.test(term) ? Number(term) : null;
      whereClause.OR = [
        ...(appId ? [{ degree_app_id: appId }] : []),
        { student: { full_name: { contains: term, mode: 'insensitive' } } },
        { student: { registration_no: { contains: term, mode: 'insensitive' } } },
        { student: { cnic: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, applications] = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const total = await withDbRetry(() => tx.degreeApplication.count({ where: whereClause }));
        const applications = await withDbRetry(() => tx.degreeApplication.findMany({
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
                father_name: true,
                passing_year: true,
                cgpa: true,
                program: { select: { name: true, code: true } },
              },
            },
            documents: true,
            receipt: true,
          },
        }));
        return [total, applications];
      })
    );

    const [stageCounts, programs] = await Promise.all([
      withDbRetry(() => prisma.degreeApplication.groupBy({ by: ['status'], _count: { degree_app_id: true } })),
      withDbRetry(() => prisma.academicProgram.findMany({ where: { is_active: true }, select: { program_id: true, name: true, code: true }, orderBy: { name: 'asc' } })),
    ]);
    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      data: applications.map(publicDegreeApplication),
      stage_counts: Object.fromEntries(stageCounts.map((item) => [item.status, item._count.degree_app_id])),
      programs,
    });
  } catch (error) {
    console.error('Controller Queue Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch controller degree queue.',
    });
  }
};

// GET /api/degree/controller/applications/:degree_app_id
export const getControllerDegreeApplication = async (req, res) => {
  try {
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const application = await withDbRetry(() => prisma.degreeApplication.findUnique({
      where: { degree_app_id: appId },
      include: {
        student: { select: { user_id: true, full_name: true, father_name: true, registration_no: true, email: true, cnic: true, phone: true, cgpa: true, passing_year: true, program: true } },
        clearanceRequest: { include: { departmentReviews: { include: { department: { select: { name: true, code: true } } } } } },
        documents: { orderBy: { document_type: 'asc' } }, receipt: true,
      },
    }));
    if (!application) return res.status(404).json({ success: false, message: 'Degree application not found.' });
    return res.status(200).json({ success: true, data: publicDegreeApplication(application), required_document_types: REQUIRED_DOCUMENT_TYPES });
  } catch (error) { return publicError(res, error, 'Failed to load degree verification workspace.'); }
};

// PUT /api/degree/controller/verify-all/:degree_app_id
export const verifyAllDocuments = async (req, res) => {
  try {
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const application = await withDbRetry(() => prisma.degreeApplication.findUnique({ where: { degree_app_id: appId }, include: { documents: true } }));
    if (!application) return res.status(404).json({ success: false, message: 'Degree application not found.' });
    if (application.status !== 'controller_review') return res.status(409).json({ success: false, message: 'Documents can only be verified during Controller review.' });
    const present = new Set(application.documents.map((item) => item.document_type));
    if (REQUIRED_DOCUMENT_TYPES.some((type) => !present.has(type))) return res.status(409).json({ success: false, message: 'All required documents must be uploaded before bulk verification.' });
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.document.updateMany({ where: { degree_app_id: appId }, data: { verification_status: 'verified', remarks: null } }));
      await withDbRetry(() => tx.activityLog.create({ data: { user_id: req.user.user_id, action: 'ALL_DOCUMENTS_VERIFIED', entity_type: 'DegreeApplication', entity_id: appId, description: `Controller ${req.user.full_name} verified all required documents for degree app #${appId}.` } }));
      await withDbRetry(() => tx.notification.create({ data: { user_id: application.student_id, title: 'Documents Verified', message: 'All required degree documents have been verified by the Controller of Examinations.' } }));
    }));
    return res.status(200).json({ success: true, message: 'All required documents have been verified.' });
  } catch (error) { return publicError(res, error, 'Failed to verify all documents.'); }
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
    const documentId = positiveInteger(req.params.document_id, 'document_id');
    const { verification_status, remarks } = req.body;

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
            select: { degree_app_id: true, student_id: true, status: true },
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
    if (doc.degreeApplication.status !== 'controller_review') {
      return res.status(409).json({ success: false, message: 'Documents can only be verified during Controller review.' });
    }

    const studentId = doc.degreeApplication.student_id;

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await withDbRetry(() => tx.document.update({
          where: { document_id: documentId },
          data: {
            verification_status,
            remarks: remarks || null,
          },
        }));

        const statusText = verification_status.toUpperCase();

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: controllerId,
            action: `DOCUMENT_${statusText}`,
            entity_type: 'Document',
            entity_id: documentId,
            description: `Controller ${req.user.full_name} set document '${doc.document_type}' status to ${verification_status}.`,
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: studentId,
            title: `Document ${verification_status === 'verified' ? 'Verified' : 'Rejected'}`,
            message: `Your uploaded document '${doc.document_type}' was ${verification_status}.${remarks ? ` Remarks: ${remarks}` : ''}`,
          },
        }));
      })
    );

    return res.status(200).json({
      success: true,
      message: `Document status updated to '${verification_status}'.`,
    });
  } catch (error) {
    return publicError(res, error, 'Failed to verify document.');
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
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const { status } = req.body;

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
        include: { documents: true, receipt: true },
      })
    );

    if (!degreeApp) {
      return res.status(404).json({
        success: false,
        message: 'Degree application not found.',
      });
    }

    if (status === degreeApp.status) {
      return res.status(200).json({ success: true, message: `Degree application is already '${status}'.` });
    }
    if (NEXT_DEGREE_STATUS[degreeApp.status] !== status) {
      return res.status(409).json({
        success: false,
        message: `Invalid workflow transition from '${degreeApp.status}' to '${status}'. Expected '${NEXT_DEGREE_STATUS[degreeApp.status] || 'no further transition'}'.`,
      });
    }
    const presentTypes = new Set(degreeApp.documents.map(({ document_type }) => document_type));
    if (status === 'controller_review' && REQUIRED_DOCUMENT_TYPES.some((type) => !presentTypes.has(type))) {
      return res.status(409).json({ success: false, message: 'All required document types must be uploaded before controller review.' });
    }
    if (status === 'degree_processing' && (degreeApp.documents.length < REQUIRED_DOCUMENT_TYPES.length || degreeApp.documents.some(({ verification_status }) => verification_status !== 'verified'))) {
      return res.status(400).json({ success: false, message: 'All documents must be verified before moving to degree processing.' });
    }
    if (status === 'degree_ready') {
      return res.status(409).json({ success: false, message: 'Generate the collection receipt to mark the degree ready.' });
    }
    if (['degree_collected', 'completed'].includes(status)) {
      return res.status(409).json({ success: false, message: 'Use the physical handover desk and complete all identity checks before collection.' });
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
        await withDbRetry(() => tx.degreeApplication.update({
          where: { degree_app_id: appId },
          data: updateData,
        }));

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: controllerId,
            action: 'DEGREE_STATUS_UPDATED',
            entity_type: 'DegreeApplication',
            entity_id: appId,
            description: `Controller updated degree app #${appId} status to '${status}'.`,
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: degreeApp.student_id,
            title: 'Degree Status Updated',
            message: `Your degree application status has been updated to '${status.replace(/_/g, ' ').toUpperCase()}'.`,
          },
        }));
      })
    );

    return res.status(200).json({
      success: true,
      message: `Degree application status updated to '${status}'.`,
    });
  } catch (error) {
    return publicError(res, error, 'Failed to update degree status.');
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
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const { collection_date } = req.body;

    if (typeof collection_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(collection_date)) {
      return res.status(400).json({
        success: false,
        message: 'Collection date is required (YYYY-MM-DD).',
      });
    }

    const degreeApp = await withDbRetry(() =>
      prisma.degreeApplication.findUnique({
        where: { degree_app_id: appId },
        include: { receipt: true, documents: true, student: { select: { full_name: true, father_name: true, registration_no: true, program: { select: { name: true } } } } },
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

    if (degreeApp.status !== 'degree_processing') {
      return res.status(409).json({ success: false, message: "Receipt can only be generated while status is 'degree_processing'." });
    }
    if (degreeApp.documents.length < REQUIRED_DOCUMENT_TYPES.length
      || degreeApp.documents.some(({ verification_status }) => verification_status !== 'verified')) {
      return res.status(409).json({ success: false, message: 'All required documents must be verified before issuing a receipt.' });
    }
    const collectionDate = new Date(`${collection_date}T00:00:00.000Z`);
    if (Number.isNaN(collectionDate.getTime()) || collectionDate.toISOString().slice(0, 10) !== collection_date) {
      return res.status(400).json({ success: false, message: 'Collection date must be a valid YYYY-MM-DD date.' });
    }
    const todayPakistan = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
    if (collection_date < todayPakistan) return res.status(400).json({ success: false, message: 'Collection date cannot be in the past.' });

    const receiptNumber = `RCT-GRADFLOW-${Date.now()}-${appId}`;
    const verificationUrl = `${process.env.CLIENT_URL?.trim() || 'http://localhost:5173'}/verify/${encodeURIComponent(receiptNumber)}`;
    const generated = await createUniversityPdf({
      kind: 'receipt', reference: receiptNumber, title: 'Degree Collection Receipt',
      fields: [['Student', degreeApp.student.full_name], ['Father Name', degreeApp.student.father_name], ['Program', degreeApp.student.program?.name], ['Registration No.', degreeApp.student.registration_no], ['Fee Challan No.', degreeApp.fee_slip_number], ['Degree Application', appId], ['Collection Date', collection_date], ['Collection Office', 'Controller of Examinations, Main Administration Building']],
      qrText: verificationUrl,
    });
    let receipt;
    try {
      receipt = await withDbRetry(() => prisma.$transaction(async (tx) => {
        const newReceipt = await withDbRetry(() => tx.receipt.create({
          data: {
            degree_app_id: appId,
            receipt_number: receiptNumber,
            pdf_url: generated.uri,
            collection_date: collectionDate,
            generated_by: controllerId,
          },
        }));

        // Automatically update degree status to degree_ready
        await withDbRetry(() => tx.degreeApplication.update({
          where: { degree_app_id: appId },
          data: {
            status: 'degree_ready',
            ready_at: new Date(),
          },
        }));

        await withDbRetry(() => tx.activityLog.create({
          data: {
            user_id: controllerId,
            action: 'RECEIPT_GENERATED',
            entity_type: 'Receipt',
            entity_id: newReceipt.receipt_id,
            description: `Controller issued receipt #${receiptNumber} for degree app #${appId}. Collection date: ${collection_date}.`,
          },
        }));

        await withDbRetry(() => tx.notification.create({
          data: {
            user_id: degreeApp.student_id,
            title: 'Collection Receipt Issued',
            message: `Your degree collection receipt #${receiptNumber} is ready. Scheduled collection date: ${collection_date}.`,
          },
        }));

        return newReceipt;
      }));
    } catch (error) {
      await removeFile(generated.path);
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: 'Collection receipt generated successfully.',
      data: publicReceipt(receipt),
    });
  } catch (error) {
    return publicError(res, error, 'Failed to generate collection receipt.');
  }
};

// GET /api/degree/controller/handover/lookup?search=receipt-or-registration
export const lookupDegreeHandover = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (!search) return res.status(400).json({ success: false, message: 'Enter a receipt number or student registration number.' });
    const application = await withDbRetry(() => prisma.degreeApplication.findFirst({
      where: { OR: [{ receipt: { receipt_number: { equals: search, mode: 'insensitive' } } }, { student: { registration_no: { equals: search, mode: 'insensitive' } } }] },
      include: { student: { select: { full_name: true, father_name: true, registration_no: true, cnic: true, program: true } }, receipt: true },
      orderBy: { degree_app_id: 'desc' },
    }));
    if (!application) return res.status(404).json({ success: false, message: 'No degree collection record matches that reference.' });
    return res.status(200).json({ success: true, data: publicDegreeApplication(application) });
  } catch (error) { return publicError(res, error, 'Failed to find degree collection record.'); }
};

// POST /api/degree/controller/handover/:degree_app_id
export const confirmDegreeHandover = async (req, res) => {
  try {
    const appId = positiveInteger(req.params.degree_app_id, 'degree_app_id');
    const checks = req.body?.verification;
    const requiredChecks = ['original_cnic', 'student_id', 'printed_receipt', 'degree_sealed'];
    if (!checks || requiredChecks.some((key) => checks[key] !== true)) return res.status(400).json({ success: false, message: 'Complete every physical handover verification check before confirmation.' });
    const application = await withDbRetry(() => prisma.degreeApplication.findUnique({ where: { degree_app_id: appId }, include: { receipt: true } }));
    if (!application) return res.status(404).json({ success: false, message: 'Degree application not found.' });
    if (application.status !== 'degree_ready' || !application.receipt) return res.status(409).json({ success: false, message: 'Only a degree marked ready with a valid receipt can be handed over.' });
    const now = new Date();
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await withDbRetry(() => tx.degreeApplication.update({ where: { degree_app_id: appId }, data: { status: 'degree_collected', collected_at: now } }));
      await withDbRetry(() => tx.degreeApplication.update({ where: { degree_app_id: appId }, data: { status: 'completed' } }));
      await withDbRetry(() => tx.activityLog.create({ data: { user_id: req.user.user_id, action: 'DEGREE_PHYSICAL_HANDOVER_CONFIRMED', entity_type: 'DegreeApplication', entity_id: appId, description: `Controller ${req.user.full_name} confirmed physical degree handover for application #${appId}.`, ip_address: req.ip || null, details: { ...checks, receipt_number: application.receipt.receipt_number, handover_at: now.toISOString(), intermediate_status: 'degree_collected', final_status: 'completed' } } }));
      await withDbRetry(() => tx.notification.create({ data: { user_id: application.student_id, title: 'Degree Collected', message: 'Congratulations. Your physical degree handover has been completed and the application is now archived.' } }));
    }, { maxWait: 10000, timeout: 60000 }));
    return res.status(200).json({ success: true, message: 'Physical degree handover confirmed and application completed.' });
  } catch (error) { return publicError(res, error, 'Failed to confirm degree handover.'); }
};
