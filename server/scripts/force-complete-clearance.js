import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Force-completing clearance for testing...\n');

  // 1. Find the student
  const student = await prisma.user.findFirst({
    where: { email: 'awais@student.uetmardan.edu.pk' },
  });

  if (!student) {
    console.log('❌ Student not found. Run seed first.');
    return;
  }

  // 2. Find their latest clearance
  const clearance = await prisma.clearanceRequest.findFirst({
    where: { student_id: student.user_id },
    orderBy: { clearance_id: 'desc' },
    include: { departmentReviews: true },
  });

  if (!clearance) {
    console.log('❌ No clearance request found. Apply for clearance first (M04).');
    return;
  }

  console.log(`Found Clearance #${clearance.clearance_id} (status: ${clearance.status})`);

  // 3. Approve ALL pending/correction reviews
  const result = await prisma.departmentReview.updateMany({
    where: {
      clearance_id: clearance.clearance_id,
      status: { in: ['pending', 'correction_required'] },
    },
    data: {
      status: 'approved',
      remarks: 'Force-approved for Milestone 05 testing',
      reviewed_at: new Date(),
    },
  });

  console.log(`✅ Approved ${result.count} remaining reviews`);

  // 4. Mark clearance completed
  await prisma.clearanceRequest.update({
    where: { clearance_id: clearance.clearance_id },
    data: {
      status: 'completed',
      completed_at: new Date(),
    },
  });

  console.log(`✅ Clearance #${clearance.clearance_id} → completed`);
  console.log('\n🎉 Done! Student can now apply for degree.\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());