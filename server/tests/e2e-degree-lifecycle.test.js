import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma, { withDbRetry } from '../src/config/prisma.js';
import { removeFile, resolveStoredDocument } from '../src/services/file-storage.service.js';
import { resolveGeneratedPdf } from '../src/services/pdf.service.js';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000/api';
const suffix = process.env.E2E_SUFFIX || `${Date.now()}`.slice(-8);
const identity = {
  registration_no: `E2E-${suffix}`,
  email: `e2e.${suffix}@student.invalid`,
  cnic: `16101-${suffix.slice(-7)}-9`,
  cnicDigits: `16101${suffix.slice(-7)}9`,
  password: `E2ePass${suffix}!`,
  otp: '654321',
};
const documentTypes = ['CNIC', 'PHOTO', 'SSC_DMC', 'SSC_CERT', 'HSSC_DMC', 'HSSC_CERT', 'FEE_SLIP', 'VERIFICATION_SLIP', 'INTERNSHIP', 'CLEARANCE_CERT'];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const created = { officerIds: [], storedPaths: [], generatedPaths: [] };

function stage(number, message) { console.log(`[STAGE ${number}] ${message}`); }
function pass(message) { console.log(`[PASS] ${message}`); }
async function request(path, { method = 'GET', token, body, form, expected = [200] } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(!form && body !== undefined && { 'Content-Type': 'application/json' }) }, body: form || (body === undefined ? undefined : JSON.stringify(body)) });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  if (!expected.includes(response.status)) throw new Error(`${method} ${path} returned ${response.status}: ${Buffer.isBuffer(payload) ? 'binary response' : payload.message || JSON.stringify(payload)}`);
  return { response, payload };
}
async function login(email, password) {
  const { payload } = await request('/auth/login', { method: 'POST', body: { email, password } });
  assert.ok(payload.token); return payload.token;
}

async function cleanup() {
  console.log('[AUDIT] Starting exact-identity E2E teardown.');
  const fixtureOfficers = await withDbRetry(() => prisma.user.findMany({
    where: { email: { endsWith: `.${suffix}@officer.invalid` }, role: 'officer' },
    select: { user_id: true },
  }));
  created.officerIds = [...new Set([...created.officerIds, ...fixtureOfficers.map(({ user_id }) => user_id)])];
  const student = await withDbRetry(() => prisma.user.findUnique({ where: { registration_no: identity.registration_no } }));
  const eligible = await withDbRetry(() => prisma.eligibleStudent.findUnique({ where: { registration_no: identity.registration_no } }));
  const clearances = student ? await withDbRetry(() => prisma.clearanceRequest.findMany({ where: { student_id: student.user_id }, include: { departmentReviews: true, degreeApplication: { include: { documents: true, receipt: true } } } })) : [];
  for (const clearance of clearances) {
    if (clearance.certificate_uri) created.generatedPaths.push(resolveGeneratedPdf(clearance.certificate_uri));
    for (const document of clearance.degreeApplication?.documents || []) created.storedPaths.push(resolveStoredDocument(document.file_url));
    if (clearance.degreeApplication?.receipt?.pdf_url) created.generatedPaths.push(resolveGeneratedPdf(clearance.degreeApplication.receipt.pdf_url));
  }
  const clearanceIds = clearances.map(({ clearance_id }) => clearance_id);
  const reviewIds = clearances.flatMap(({ departmentReviews }) => departmentReviews.map(({ review_id }) => review_id));
  const degreeIds = clearances.flatMap(({ degreeApplication }) => degreeApplication ? [degreeApplication.degree_app_id] : []);
  const documentIds = clearances.flatMap(({ degreeApplication }) => degreeApplication?.documents.map(({ document_id }) => document_id) || []);
  const receiptIds = clearances.flatMap(({ degreeApplication }) => degreeApplication?.receipt ? [degreeApplication.receipt.receipt_id] : []);
  const userIds = [...created.officerIds, ...(student ? [student.user_id] : [])];
  const entityFilters = [
    ...(clearanceIds.length ? [{ entity_type: 'ClearanceRequest', entity_id: { in: clearanceIds } }] : []),
    ...(reviewIds.length ? [{ entity_type: 'DepartmentReview', entity_id: { in: reviewIds } }] : []),
    ...(degreeIds.length ? [{ entity_type: 'DegreeApplication', entity_id: { in: degreeIds } }] : []),
    ...(documentIds.length ? [{ entity_type: 'Document', entity_id: { in: documentIds } }] : []),
    ...(receiptIds.length ? [{ entity_type: 'Receipt', entity_id: { in: receiptIds } }] : []),
    ...(eligible ? [{ entity_type: 'EligibleStudent', entity_id: eligible.eligible_id }] : []),
    ...(userIds.length ? [{ user_id: { in: userIds } }] : []),
  ];
  if (entityFilters.length) await withDbRetry(() => prisma.activityLog.deleteMany({ where: { OR: entityFilters } }));
  await withDbRetry(() => prisma.notification.deleteMany({ where: { OR: [...(student ? [{ user_id: student.user_id }] : []), { message: { contains: identity.registration_no } }] } }));
  if (student) await withDbRetry(() => prisma.chatSession.deleteMany({ where: { user_id: student.user_id } }));
  if (receiptIds.length) await withDbRetry(() => prisma.receipt.deleteMany({ where: { receipt_id: { in: receiptIds } } }));
  if (degreeIds.length) await withDbRetry(() => prisma.degreeApplication.deleteMany({ where: { degree_app_id: { in: degreeIds } } }));
  if (clearanceIds.length) await withDbRetry(() => prisma.clearanceRequest.deleteMany({ where: { clearance_id: { in: clearanceIds } } }));
  if (student) await withDbRetry(() => prisma.user.delete({ where: { user_id: student.user_id } }));
  if (created.officerIds.length) await withDbRetry(() => prisma.user.deleteMany({ where: { user_id: { in: created.officerIds } } }));
  if (eligible) await withDbRetry(() => prisma.eligibleStudent.delete({ where: { eligible_id: eligible.eligible_id } }));
  for (const path of new Set([...created.storedPaths, ...created.generatedPaths].filter(Boolean))) await removeFile(path);
  const leftovers = await withDbRetry(() => prisma.user.count({ where: { OR: [{ registration_no: identity.registration_no }, { user_id: { in: created.officerIds.length ? created.officerIds : [-1] } }] } }));
  assert.equal(leftovers, 0); pass('E2E records and private files were removed cleanly.');
}

async function main() {
  let adminToken; let studentToken; let controllerToken; let clearanceId; let degreeAppId; let studentId;
  try {
    stage(1, 'Eligible roster ingestion and OTP onboarding');
    adminToken = await login('admin@university.edu.pk', 'admin123');
    const program = await withDbRetry(() => prisma.academicProgram.findFirst({ where: { code: 'BSC-SE', is_active: true } })); assert.ok(program);
    await request('/admin/eligible-students', { method: 'POST', token: adminToken, expected: [201], body: { registration_no: identity.registration_no, full_name: 'E2E Lifecycle Student', father_name: 'E2E Father Name', email: identity.email, cnic: identity.cnic, program_code: program.code, cgpa: 3.55, passing_year: 2026, batch_year: 2021 } });
    const eligibility = await request('/auth/verify-student', { method: 'POST', body: { registration_no: identity.registration_no, cnic: identity.cnic } }); assert.equal(eligibility.payload.success, true);
    await request('/auth/register-request', { method: 'POST', expected: [201], body: { registration_no: identity.registration_no, email: identity.email, password: identity.password, cnic: identity.cnic, phone: '03001234567' } });
    const eligible = await withDbRetry(() => prisma.eligibleStudent.findUnique({ where: { registration_no: identity.registration_no } }));
    const otpHash = createHmac('sha256', process.env.JWT_SECRET).update(identity.otp).digest('hex');
    await withDbRetry(() => prisma.registrationRequest.update({ where: { eligible_id: eligible.eligible_id }, data: { otp_code: otpHash, otp_expires_at: new Date(Date.now() + 600_000) } }));
    await request('/auth/verify-otp', { method: 'POST', body: { registration_no: identity.registration_no, email: identity.email, otp: identity.otp } });
    const activatedStudent = await withDbRetry(() => prisma.user.findUnique({ where: { registration_no: identity.registration_no } }));
    assert.ok(activatedStudent);
    studentId = activatedStudent.user_id;
    studentToken = await login(identity.email, identity.password); pass('Roster, eligibility, OTP activation, and student JWT verified.');

    const activeDepartments = await withDbRetry(() => prisma.department.findMany({ where: { is_active: true }, orderBy: { code: 'asc' } })); assert.equal(activeDepartments.length, 13);
    const officerPassword = `Officer${suffix}!`; const officerHash = await bcrypt.hash(officerPassword, 10); const officerTokens = new Map();
    for (const department of activeDepartments) {
      const officer = await withDbRetry(() => prisma.user.create({ data: { full_name: `E2E ${department.code} Officer`, email: `e2e.${department.code.toLowerCase()}.${suffix}@officer.invalid`, password_hash: officerHash, role: 'officer', department_id: department.department_id } }));
      created.officerIds.push(officer.user_id); officerTokens.set(department.code, await login(officer.email, officerPassword));
    }

    stage(2, 'Dynamic 13-department clearance initiation');
    const applied = await request('/clearance/apply', { method: 'POST', token: studentToken, expected: [201] }); clearanceId = applied.payload.data.clearance_id; assert.equal(applied.payload.data.departments_count, 13);
    let status = (await request('/clearance/my-status', { token: studentToken })).payload.data; assert.equal(status.progress.total, 13); assert.equal(status.progress.completed, 0); assert.equal(status.progress.percentage, 0); pass('Exactly 13 pending reviews created with 0% initial progress.');

    stage(3, 'Department approvals, write lock, correction and resubmission');
    for (const review of status.reviews.filter(({ department }) => department.code !== 'LIB')) await request(`/clearance/reviews/${review.review_id}`, { method: 'PUT', token: officerTokens.get(review.department.code), body: { status: 'approved', remarks: `E2E ${review.department.code} obligations verified.` } });
    const lockedReview = status.reviews.find(({ department }) => department.code === 'ADM');
    const locked = await request(`/clearance/reviews/${lockedReview.review_id}`, { method: 'PUT', token: officerTokens.get('ADM'), expected: [403], body: { status: 'correction_required', remarks: 'This must be rejected by the permanent write lock.' } }); assert.match(locked.payload.message, /locked/i);
    const library = status.reviews.find(({ department }) => department.code === 'LIB');
    await request(`/clearance/reviews/${library.review_id}`, { method: 'PUT', token: officerTokens.get('LIB'), body: { status: 'correction_required', remarks: 'Return Algorithms textbook to Central Library.' } });
    status = (await request('/clearance/my-status', { token: studentToken })).payload.data; assert.equal(status.reviews.filter(({ status: value }) => value === 'approved').length, 12); assert.equal(status.reviews.find(({ department }) => department.code === 'LIB').status, 'correction_required');
    await request(`/clearance/reviews/${library.review_id}/resubmit`, { method: 'PUT', token: studentToken, body: { response: 'Returned book to counter on 15 March, slip attached.' } });
    const libraryQueue = await request(`/clearance/officer/queue?tab=action_required&search=${encodeURIComponent(identity.registration_no)}`, { token: officerTokens.get('LIB') }); assert.equal(libraryQueue.payload.data[0].resubmitted_at !== null, true);
    await request(`/clearance/reviews/${library.review_id}`, { method: 'PUT', token: officerTokens.get('LIB'), body: { status: 'approved', remarks: 'Returned library item verified.' } });
    status = (await request('/clearance/my-status', { token: studentToken })).payload.data; assert.equal(status.progress.completed, 13); assert.equal(status.progress.percentage, 100); assert.equal(status.status, 'completed'); pass('Correction isolation, resubmission, 13 approvals, completion, and HTTP 403 write lock verified.');

    stage(4, 'Tamper-evident A4 clearance certificate');
    await request(`/clearance/${clearanceId}/generate-certificate`, { method: 'POST', token: studentToken });
    const certificate = await request(`/files/clearance-certificates/${clearanceId}`, { token: studentToken }); assert.match(certificate.response.headers.get('content-type') || '', /application\/pdf/); assert.equal(certificate.payload.subarray(0, 5).toString(), '%PDF-'); assert.ok(certificate.payload.length > 1000); pass('Authenticated clearance certificate is a non-empty PDF.');

    stage(5, 'Degree application and ten private document uploads');
    const degree = await request('/degree/apply', { method: 'POST', token: studentToken, expected: [201] }); degreeAppId = degree.payload.data.degree_app_id; assert.equal(degree.payload.data.status, 'application_started');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
    await request(`/degree/${degreeAppId}/particulars`, { method: 'PUT', token: studentToken, body: { fee_slip_number: `BOK-DEG-${suffix}`, verification_slip_number: `BOK-VER-${suffix}`, deposit_date: today } });
    for (const type of documentTypes) { const form = new FormData(); form.append('degree_app_id', String(degreeAppId)); form.append('document_type', type); form.append('file', new Blob([png], { type: 'image/png' }), `${type.toLowerCase()}.png`); await request('/degree/documents/upload', { method: 'POST', token: studentToken, form }); }
    await request(`/degree/submit/${degreeAppId}`, { method: 'POST', token: studentToken }); let degreeState = (await request('/degree/my-application', { token: studentToken })).payload.data; assert.equal(degreeState.status, 'documents_uploaded'); assert.equal(degreeState.documents.length, 10); pass('All ten genuine private documents uploaded and submission locked.');

    stage(6, 'Controller verification guard, processing and receipt issuance');
    controllerToken = await login('controller@university.edu.pk', 'controller123');
    await request(`/degree/controller/update-status/${degreeAppId}`, { method: 'PUT', token: controllerToken, body: { status: 'controller_review' } });
    const guard = await request(`/degree/controller/update-status/${degreeAppId}`, { method: 'PUT', token: controllerToken, expected: [400], body: { status: 'degree_processing' } }); assert.match(guard.payload.message, /All documents must be verified/);
    await request(`/degree/controller/verify-all/${degreeAppId}`, { method: 'PUT', token: controllerToken });
    await request(`/degree/controller/update-status/${degreeAppId}`, { method: 'PUT', token: controllerToken, body: { status: 'degree_processing' } });
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const receiptResult = await request(`/degree/controller/generate-receipt/${degreeAppId}`, { method: 'POST', token: controllerToken, expected: [201], body: { collection_date: tomorrow } }); assert.match(receiptResult.payload.data.receipt_number, /^RCT-GRADFLOW-\d+-\d+$/);
    const publicVerification = await request(`/degree/verify-receipt/${encodeURIComponent(receiptResult.payload.data.receipt_number)}`);
    assert.equal(publicVerification.payload.data.authentic, true);
    assert.match(publicVerification.payload.data.registration_no, /•/);
    assert.equal('cnic' in publicVerification.payload.data, false);
    assert.equal('email' in publicVerification.payload.data, false);
    degreeState = (await request('/degree/my-application', { token: studentToken })).payload.data; assert.equal(degreeState.status, 'degree_ready'); assert.equal(degreeState.fee_slip_number, `BOK-DEG-${suffix}`); const receiptPdf = await request(degreeState.receipt.pdf_url.replace('/api', ''), { token: studentToken }); assert.equal(receiptPdf.payload.subarray(0, 5).toString(), '%PDF-'); pass('Strict verification guard, 10/10 verification, processing, QR receipt, and ready status verified.');

    stage(7, 'Physical handover checklist and immutable dispatch audit');
    const lookup = await request(`/degree/controller/handover/lookup?search=${encodeURIComponent(identity.registration_no)}`, { token: controllerToken }); assert.equal(lookup.payload.data.status, 'degree_ready');
    await request(`/degree/controller/handover/${degreeAppId}`, { method: 'POST', token: controllerToken, expected: [400], body: { verification: { original_cnic: true, student_id: false, printed_receipt: true, degree_sealed: true } } });
    await request(`/degree/controller/handover/${degreeAppId}`, { method: 'POST', token: controllerToken, body: { verification: { original_cnic: true, student_id: true, printed_receipt: true, degree_sealed: true, remarks: 'Degree collected in person by candidate.' } } });
    degreeState = (await request('/degree/my-application', { token: studentToken })).payload.data; assert.equal(degreeState.status, 'completed');
    const handoverLog = await withDbRetry(() => prisma.activityLog.findFirst({ where: { action: 'DEGREE_PHYSICAL_HANDOVER_CONFIRMED', entity_type: 'DegreeApplication', entity_id: degreeAppId } })); assert.equal(handoverLog.user_id > 0, true); assert.ok(handoverLog.details?.handover_at); assert.ok(handoverLog.ip_address);
    const finalNotice = await withDbRetry(() => prisma.notification.findFirst({ where: { user_id: studentId, title: 'Degree Collected' } })); assert.ok(finalNotice); pass('Incomplete checklist rejected; complete handover archived with audit and notification.');

    stage(8, 'AI RAG live student context');
    const chat = await request('/chat/message', { method: 'POST', token: studentToken, body: { message: 'What is my degree collection status?' } }); assert.match(chat.payload.data.content, /collected|completed|collection/i); pass('Grounded AI response reflected the completed degree lifecycle.');

    stage(9, 'Email OTP password recovery and session invalidation');
    await request('/auth/forgot-password', { method: 'POST', body: { email: identity.email } });
    const recoveryOtp = '782413';
    await withDbRetry(() => prisma.passwordResetRequest.update({ where: { user_id: studentId }, data: { otp_hash: createHmac('sha256', process.env.JWT_SECRET).update(recoveryOtp).digest('hex'), otp_expires_at: new Date(Date.now() + 600_000) } }));
    const verifiedReset = await request('/auth/forgot-password/verify', { method: 'POST', body: { email: identity.email, otp: recoveryOtp } });
    const recoveredPassword = `Recovered${suffix}!`;
    await request('/auth/forgot-password/reset', { method: 'POST', body: { reset_token: verifiedReset.payload.data.reset_token, password: recoveredPassword } });
    await request('/auth/me', { token: studentToken, expected: [401] });
    const recoveredToken = await login(identity.email, recoveredPassword);
    const recoveredProfile = await request('/auth/me', { token: recoveredToken });
    assert.equal(recoveredProfile.payload.user.registration_no, identity.registration_no);
    pass('OTP recovery, one-time reset token, new password login, and old-session invalidation verified.');
    console.log('[PASS] MASTER E2E DEGREE LIFECYCLE COMPLETED SUCCESSFULLY');
  } finally { await cleanup(); await withDbRetry(() => prisma.$disconnect()); }
}

const run = process.env.E2E_CLEANUP_ONLY === '1'
  ? async () => { await cleanup(); await withDbRetry(() => prisma.$disconnect()); }
  : main;

run().catch((error) => { console.error(`[FAIL] ${error.stack || error.message}`); process.exitCode = 1; });
