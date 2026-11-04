import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==========================================
// Neon Cold Start Retry Helper
// ==========================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(retries = 5) {
  try {
    await prisma.$connect();
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
  const departmentsData = [
    { name: 'Admission Office', code: 'ADM' },
    { name: 'Accounts Office', code: 'ACC' },
    { name: 'University Library', code: 'LIB' },
    { name: 'Hostel Office', code: 'HST' },
    { name: 'Central Store', code: 'STR' },
    { name: 'Transport Section', code: 'TRN' },
    { name: 'FYP Coordinator', code: 'FYP' },
    { name: 'Career Liaison Office', code: 'CLO' },
  ];

  const createdDepartments = {};

  for (const dept of departmentsData) {
    const savedDept = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });

    createdDepartments[dept.code] = savedDept.department_id;
  }

  console.log('✅ 8 Departments seeded.');

  // 2. Seed UET Mardan Academic Programs
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
    const savedProg = await prisma.academicProgram.upsert({
      where: { code: prog.code },
      update: {},
      create: prog,
    });

    createdPrograms[prog.code] = savedProg.program_id;
  }

  console.log('✅ UET Mardan Academic Programs seeded.');

  // Passwords
  const adminPass = await bcrypt.hash('admin123', 10);
  const controllerPass = await bcrypt.hash('controller123', 10);
  const officerPass = await bcrypt.hash('officer123', 10);
  const studentPass = await bcrypt.hash('student123', 10);

  // 3. Seed System Admin
  await prisma.user.upsert({
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
  });

  // 4. Seed Controller
  await prisma.user.upsert({
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
  });

  // 5. Seed Department Officers
  for (const dept of departmentsData) {
    const email = `officer.${dept.code.toLowerCase()}@university.edu.pk`;

    await prisma.user.upsert({
      where: {
        email,
      },
      update: {},
      create: {
        full_name: `${dept.name} Officer`,
        email,
        password_hash: officerPass,
        role: 'officer',
        department_id: createdDepartments[dept.code],
      },
    });
  }

  console.log('✅ Admin, Controller, and 8 Officers seeded.');

  // 6. Seed Sample Eligible Student
  await prisma.eligibleStudent.upsert({
    where: {
      registration_no: '2021-SE-101',
    },
    update: {},
    create: {
      registration_no: '2021-SE-101',
      email: 'student@university.edu.pk',
      full_name: 'Muhammad Awais',
      program_id: createdPrograms['BSC-SE'],
      batch_year: 2021,
    },
  });

  console.log('✅ Sample Eligible Student seeded (2021-SE-101).');

  // 7. Seed Test Student User
  await prisma.user.upsert({
    where: {
      email: 'awais@student.uetmardan.edu.pk',
    },
    update: {},
    create: {
      full_name: 'Muhammad Awais',
      email: 'awais@student.uetmardan.edu.pk',
      password_hash: studentPass,
      role: 'student',
      program_id: createdPrograms['BSC-SE'],
      registration_no: '2021-SE-101',
      cnic: '1560312345678',
    },
  });

  console.log(
    '✅ Test Student User seeded (awais@student.uetmardan.edu.pk).'
  );

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });