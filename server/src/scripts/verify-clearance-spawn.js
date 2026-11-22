import { randomUUID } from 'node:crypto';
import prisma, { withDbRetry } from '../config/prisma.js';

const rollback = new Error('EXPECTED_ROLLBACK');
async function verify() {
  const active = await withDbRetry(() => prisma.department.findMany({ where: { is_active: true }, select: { department_id: true, code: true } }));
  const program = await withDbRetry(() => prisma.academicProgram.findFirst({ where: { is_active: true }, select: { program_id: true } }));
  if (active.length !== 13 || !program) throw new Error(`Expected 13 active departments and an academic program; found ${active.length}.`);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `dynamic-test-${suffix}@invalid.local`;
  try {
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      const student = await withDbRetry(() => tx.user.create({ data: { full_name: 'Rollback Integration Student', email, password_hash: 'not-a-usable-password-hash', role: 'student', registration_no: `TEST-${suffix}`, cnic: `T${suffix}`, program_id: program.program_id } }));
      const clearance = await withDbRetry(() => tx.clearanceRequest.create({ data: { student_id: student.user_id, status: 'in_progress', submitted_at: new Date(), departmentReviews: { create: active.map(({ department_id }) => ({ department_id, status: 'pending' })) } }, include: { departmentReviews: true } }));
      if (clearance.departmentReviews.length !== active.length || clearance.departmentReviews.some(({ status }) => status !== 'pending')) throw new Error('Dynamic clearance review spawning failed.');
      throw rollback;
    }));
  } catch (error) { if (error !== rollback) throw error; }
  const persisted = await withDbRetry(() => prisma.user.count({ where: { email } }));
  if (persisted !== 0) throw new Error('Rollback integration record unexpectedly persisted.');
  console.log(`Verified dynamic creation of ${active.length} pending department reviews; transaction rolled back cleanly.`);
}

verify().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
