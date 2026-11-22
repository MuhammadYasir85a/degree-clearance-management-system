import prisma, { withDbRetry } from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';
import { STATUTORY_DEPARTMENTS } from '../src/config/statutory-departments.js';

// ==========================================
// Neon Cold Start Retry Helper
// ==========================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(retries = 5) {
  try {
    await withDbRetry(() => prisma.$connect());
    console.log('✅ Database connected successfully.');
  } catch (error) {
    console.log(
      `⚠️ Unable to connect to database. Retries left: ${retries}`
    );

    if (retries <= 0) {
      throw error;
    }

    console.log('⏳ Waiting 5 seconds before retry...');
    await sleep(5000);

    return connectWithRetry(retries - 1);
  }
}

async function main() {
  await connectWithRetry();

  console.log('🌱 Starting database seeding...');

  // 1. Seed 8 Clearance Departments
  const departmentsData = STATUTORY_DEPARTMENTS;

  const createdDepartments = {};

  for (const dept of departmentsData) {
    const savedDept = await withDbRetry(() => prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    }));

    createdDepartments[dept.code] = savedDept.department_id;
  }

  console.log(`✅ ${departmentsData.length} statutory departments seeded.`);

  // 2. Seed generic academic programs
  const programsData = [
    // Undergraduate
    {
      name: 'BSc Computer Software Engineering',
      code: 'BSC-SE',
      level: 'Undergraduate',
    },
    {
      name: 'BSc Electrical Engineering',
      code: 'BSC-EE',
      level: 'Undergraduate',
    },
    {
      name: 'BSc Civil Engineering',
      code: 'BSC-CE',
      level: 'Undergraduate',
    },
    {
      name: 'BSc Mechanical Engineering',
      code: 'BSC-ME',
      level: 'Undergraduate',
    },
    {
      name: 'BSc Telecommunication Engineering',
      code: 'BSC-TE',
      level: 'Undergraduate',
    },
    {
      name: 'BS Computer Science',
      code: 'BS-CS',
      level: 'Undergraduate',
    },
    {
      name: 'BS Artificial Intelligence',
      code: 'BS-AI',
      level: 'Undergraduate',
    },
    {
      name: 'BS Electric Vehicle Systems and Technology',
      code: 'BS-EV',
      level: 'Undergraduate',
    },
    {
      name: 'BS English',
      code: 'BS-ENG',
      level: 'Undergraduate',
    },

    // Postgraduate
    {
      name: 'MSc Computer Software Engineering',
      code: 'MSC-SE',
      level: 'Postgraduate',
    },
    {
      name: 'MSc Electrical Engineering',
      code: 'MSC-EE',
      level: 'Postgraduate',
    },
    {
      name: 'MSc Telecommunication Engineering',
      code: 'MSC-TE',
      level: 'Postgraduate',
    },
    {
      name: 'MS Computer Science',
      code: 'MS-CS',
      level: 'Postgraduate',
    },
    {
      name: 'MS Mathematics',
      code: 'MS-MATH',
      level: 'Postgraduate',
    },

    // PhD
    {
      name: 'PhD Computer Software Engineering',
      code: 'PHD-SE',
      level: 'PhD',
    },
    {
      name: 'PhD Electrical Engineering',
      code: 'PHD-EE',
      level: 'PhD',
    },
  ];

  const createdPrograms = {};

  for (const prog of programsData) {
    const savedProg = await withDbRetry(() => prisma.academicProgram.upsert({
      where: { code: prog.code },
      update: {},
      create: prog,
    }));

    createdPrograms[prog.code] = savedProg.program_id;
  }

  console.log('✅ Academic programs seeded.');

  // Passwords
  const adminPass = await bcrypt.hash('admin123', 10);
  const controllerPass = await bcrypt.hash('controller123', 10);
  const officerPass = await bcrypt.hash('officer123', 10);
  const studentPass = await bcrypt.hash('student123', 10);

  // 3. Seed System Admin
  await withDbRetry(() => prisma.user.upsert({
    where: {
      email: 'admin@university.edu.pk',
    },
    update: {},
    create: {
      full_name: 'System Administrator',
      email: 'admin@university.edu.pk',
      password_hash: adminPass,
      role: 'admin',
    },
  }));

  // 4. Seed Controller
  await withDbRetry(() => prisma.user.upsert({
    where: {
      email: 'controller@university.edu.pk',
    },
    update: {},
    create: {
      full_name: 'Controller of Examinations',
      email: 'controller@university.edu.pk',
      password_hash: controllerPass,
      role: 'controller',
    },
  }));

  // 5. Seed Department Officers
  for (const dept of departmentsData) {
    const email = `officer.${dept.code.toLowerCase()}@university.edu.pk`;

    await withDbRetry(() => prisma.user.upsert({
      where: {
        email,
      },
      update: {},
      create: {
        full_name: dept.officerName,
        email,
        password_hash: officerPass,
        role: 'officer',
        department_id: createdDepartments[dept.code],
      },
    }));
  }

  console.log(`✅ Admin, Controller, and ${departmentsData.length} Officers seeded.`);

  // 6. Seed Sample Eligible Student
  await withDbRetry(() => prisma.eligibleStudent.upsert({
    where: {
      registration_no: '2021-SE-101',
    },
    update: {
      father_name: 'Muhammad Iqbal',
      cnic: '1560312345678',
      passing_year: 2025,
      cgpa: 3.42,
      is_registered: true,
    },
    create: {
      registration_no: '2021-SE-101',
      email: 'student@university.edu.pk',
      full_name: 'Muhammad Awais',
      father_name: 'Muhammad Iqbal',
      cnic: '1560312345678',
      program_id: createdPrograms['BSC-SE'],
      batch_year: 2021,
      passing_year: 2025,
      cgpa: 3.42,
      is_registered: true,
    },
  }));

  console.log('✅ Sample Eligible Student seeded (2021-SE-101).');

  // 7. Seed Test Student User
  await withDbRetry(() => prisma.user.upsert({
    where: { registration_no: '2021-SE-101' },
    update: {
      email: 'student@university.edu.pk',
      father_name: 'Muhammad Iqbal',
      passing_year: 2025,
      cgpa: 3.42,
    },
    create: {
      full_name: 'Muhammad Awais',
      father_name: 'Muhammad Iqbal',
      email: 'student@university.edu.pk',
      password_hash: studentPass,
      role: 'student',
      program_id: createdPrograms['BSC-SE'],
      registration_no: '2021-SE-101',
      cnic: '1560312345678',
      passing_year: 2025,
      cgpa: 3.42,
    },
  }));

  console.log(
    '✅ Test Student User seeded (student@university.edu.pk).'
  );

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await withDbRetry(() => prisma.$disconnect());
  });
