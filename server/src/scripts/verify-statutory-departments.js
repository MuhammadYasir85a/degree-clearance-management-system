import prisma, { withDbRetry } from '../config/prisma.js';
import { STATUTORY_DEPARTMENTS } from '../config/statutory-departments.js';

async function verify() {
  const codes = STATUTORY_DEPARTMENTS.map(({ code }) => code);
  const departments = await withDbRetry(() => prisma.department.findMany({ where: { code: { in: codes }, is_active: true }, include: { users: { where: { role: 'officer', is_active: true }, select: { email: true } } } }));
  const failures = [];
  for (const definition of STATUTORY_DEPARTMENTS) {
    const department = departments.find(({ code }) => code === definition.code);
    const expectedEmail = `officer.${definition.code.toLowerCase()}@university.edu.pk`;
    if (!department) failures.push(`${definition.code}: missing or inactive`);
    else if (!department.users.some(({ email }) => email === expectedEmail)) failures.push(`${definition.code}: active officer ${expectedEmail} missing`);
  }
  if (failures.length) throw new Error(`Statutory verification failed: ${failures.join('; ')}`);
  console.log(`Verified ${departments.length} active statutory departments with assigned officer accounts.`);
}

verify().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
