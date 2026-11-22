ALTER TABLE "eligible_students"
  ADD COLUMN "father_name" VARCHAR(100),
  ADD COLUMN "cnic" VARCHAR(15),
  ADD COLUMN "passing_year" INTEGER,
  ADD COLUMN "cgpa" DECIMAL(3,2);

CREATE UNIQUE INDEX "eligible_students_cnic_key" ON "eligible_students"("cnic");

ALTER TABLE "users"
  ADD COLUMN "father_name" VARCHAR(100),
  ADD COLUMN "passing_year" INTEGER,
  ADD COLUMN "cgpa" DECIMAL(3,2);

ALTER TABLE "department_reviews"
  ADD COLUMN "student_response" TEXT,
  ADD COLUMN "resubmitted_at" TIMESTAMPTZ(6);

ALTER TABLE "degree_applications"
  ADD COLUMN "fee_slip_number" VARCHAR(80),
  ADD COLUMN "verification_slip_number" VARCHAR(80),
  ADD COLUMN "deposit_date" DATE;
