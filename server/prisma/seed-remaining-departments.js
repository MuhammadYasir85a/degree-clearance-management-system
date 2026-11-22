import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import prisma, { withDbRetry } from '../src/config/prisma.js';
import { REMAINING_STATUTORY_CODES, STATUTORY_DEPARTMENTS } from '../src/config/statutory-departments.js';

export async function provisionRemainingDepartments() {
  const departments = STATUTORY_DEPARTMENTS.filter(({ code }) => REMAINING_STATUTORY_CODES.includes(code));
  const provisioned = [];
  for (const definition of departments) {
    // Every newly created officer receives a unique, unexposed bootstrap secret.
    // Administrators set the usable temporary password through the protected UI.
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 10);
    const result = await withDbRetry(() => prisma.$transaction(async (tx) => {
      const department = await withDbRetry(() => tx.department.upsert({
        where: { code: definition.code },
        update: { name: definition.name, is_active: true },
        create: { name: definition.name, code: definition.code, is_active: true },
      }));
      const email = `officer.${definition.code.toLowerCase()}@university.edu.pk`;
      const officer = await withDbRetry(() => tx.user.upsert({
        where: { email },
        update: { full_name: definition.officerName, role: 'officer', department_id: department.department_id, is_active: true },
        create: { full_name: definition.officerName, email, password_hash: passwordHash, role: 'officer', department_id: department.department_id },
        select: { user_id: true, email: true, full_name: true },
      }));
      return { department, officer };
    }));
    provisioned.push(result);
  }
  return provisioned;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  provisionRemainingDepartments()
    .then((rows) => console.log(`Provisioned ${rows.length} statutory departments and officer accounts. Set initial officer passwords through Admin > Users & staff.`))
    .catch((error) => { console.error('Statutory department provisioning failed.', error?.code || error?.name); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
