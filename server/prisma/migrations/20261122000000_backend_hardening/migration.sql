-- Security, concurrency and common-query indexes for backend hardening.
ALTER TABLE "registration_requests"
  ALTER COLUMN "otp_code" TYPE VARCHAR(64),
  ADD COLUMN "otp_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "otp_locked_until" TIMESTAMPTZ(6);

-- One logical document per application/type makes replacement race-safe.
CREATE UNIQUE INDEX "documents_degree_app_id_document_type_key"
  ON "documents"("degree_app_id", "document_type");

-- A student may retain historical completed requests but only one active flow.
CREATE UNIQUE INDEX "clearance_requests_one_active_per_student_idx"
  ON "clearance_requests"("student_id")
  WHERE "status" IN ('draft', 'applied', 'in_progress', 'correction_required');

CREATE INDEX "clearance_requests_student_id_status_idx"
  ON "clearance_requests"("student_id", "status");
CREATE INDEX "department_reviews_department_id_status_idx"
  ON "department_reviews"("department_id", "status");
CREATE INDEX "degree_applications_student_id_degree_app_id_idx"
  ON "degree_applications"("student_id", "degree_app_id");
CREATE INDEX "degree_applications_status_degree_app_id_idx"
  ON "degree_applications"("status", "degree_app_id");
CREATE INDEX "notifications_user_id_is_read_created_at_idx"
  ON "notifications"("user_id", "is_read", "created_at");
