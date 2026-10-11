import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const initialDepartments = [
  { name: 'Admission Office', code: 'ADM' },
  { name: 'Accounts Office', code: 'ACC' },
  { name: 'University Library', code: 'LIB' },
  { name: 'Hostel Office', code: 'HST' },
  { name: 'Central Store', code: 'STR' },
  { name: 'Transport Section', code: 'TRN' },
  { name: 'FYP Coordinator', code: 'FYP' },
  { name: 'Career Liaison Office', code: 'CLO' },
];

async function main() {
  console.log('🌱 Seeding departments...');
  for (const dept of initialDepartments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log('✅ 8 Departments seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
