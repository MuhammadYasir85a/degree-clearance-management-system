-- Reconcile the original 12-table migration with the registration/program
-- models already used by Milestones 01-05. Existing equivalent structures are
-- preserved. No data, column, or existing table is dropped or rewritten.
-- Do not mark this migration applied manually without checking equivalence.

CREATE TABLE IF NOT EXISTS "academic_programs" (
    "program_id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "level" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "academic_programs_pkey" PRIMARY KEY ("program_id")
);

CREATE TABLE IF NOT EXISTS "eligible_students" (
    "eligible_id" SERIAL NOT NULL,
    "registration_no" VARCHAR(30) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "program_id" INTEGER NOT NULL,
    "batch_year" INTEGER,
    "is_registered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eligible_students_pkey" PRIMARY KEY ("eligible_id")
);

CREATE TABLE IF NOT EXISTS "registration_requests" (
    "request_id" SERIAL NOT NULL,
    "eligible_id" INTEGER NOT NULL,
    "cnic" VARCHAR(15) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "is_otp_verified" BOOLEAN NOT NULL DEFAULT false,
    "otp_code" VARCHAR(6),
    "otp_expires_at" TIMESTAMPTZ(6),
    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("request_id")
);

-- Existing users have no inferred program assignment: this FK stays nullable.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "program_id" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "academic_programs_code_key"
  ON "academic_programs"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "eligible_students_registration_no_key"
  ON "eligible_students"("registration_no");
CREATE UNIQUE INDEX IF NOT EXISTS "eligible_students_email_key"
  ON "eligible_students"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "registration_requests_eligible_id_key"
  ON "registration_requests"("eligible_id");

-- Check both the referencing and referenced column arrays, so differently
-- named equivalent constraints are not duplicated on existing databases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'users'::regclass
      AND confrelid = 'academic_programs'::regclass
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'users'::regclass AND attname = 'program_id')]::smallint[]
      AND confkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'academic_programs'::regclass AND attname = 'program_id')]::smallint[]
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_program_id_fkey"
      FOREIGN KEY ("program_id") REFERENCES "academic_programs"("program_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'eligible_students'::regclass
      AND confrelid = 'academic_programs'::regclass
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'eligible_students'::regclass AND attname = 'program_id')]::smallint[]
      AND confkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'academic_programs'::regclass AND attname = 'program_id')]::smallint[]
  ) THEN
    ALTER TABLE "eligible_students" ADD CONSTRAINT "eligible_students_program_id_fkey"
      FOREIGN KEY ("program_id") REFERENCES "academic_programs"("program_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'registration_requests'::regclass
      AND confrelid = 'eligible_students'::regclass
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'registration_requests'::regclass AND attname = 'eligible_id')]::smallint[]
      AND confkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'eligible_students'::regclass AND attname = 'eligible_id')]::smallint[]
  ) THEN
    ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_eligible_id_fkey"
      FOREIGN KEY ("eligible_id") REFERENCES "eligible_students"("eligible_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
