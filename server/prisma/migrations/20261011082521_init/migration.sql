-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'officer', 'controller', 'admin');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('draft', 'applied', 'in_progress', 'correction_required', 'completed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'correction_required', 'not_applicable');

-- CreateEnum
CREATE TYPE "DegreeStatus" AS ENUM ('application_started', 'documents_uploaded', 'controller_review', 'degree_processing', 'degree_ready', 'degree_collected', 'completed');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('CNIC', 'PHOTO', 'SSC_DMC', 'SSC_CERT', 'HSSC_DMC', 'HSSC_CERT', 'FEE_SLIP', 'VERIFICATION_SLIP', 'INTERNSHIP', 'CLEARANCE_CERT');

-- CreateEnum
CREATE TYPE "VerifyStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "departments" (
    "department_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "department_id" INTEGER,
    "full_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "registration_no" VARCHAR(30),
    "cnic" VARCHAR(15),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "clearance_requests" (
    "clearance_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'draft',
    "certificate_uri" TEXT,
    "certificate_generated_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "clearance_requests_pkey" PRIMARY KEY ("clearance_id")
);

-- CreateTable
CREATE TABLE "department_reviews" (
    "review_id" SERIAL NOT NULL,
    "clearance_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "officer_id" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "department_reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "degree_applications" (
    "degree_app_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "clearance_id" INTEGER NOT NULL,
    "status" "DegreeStatus" NOT NULL DEFAULT 'application_started',
    "approved_at" TIMESTAMPTZ,
    "ready_at" TIMESTAMPTZ,
    "collected_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "degree_applications_pkey" PRIMARY KEY ("degree_app_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "document_id" SERIAL NOT NULL,
    "degree_app_id" INTEGER NOT NULL,
    "document_type" "DocType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "verification_status" "VerifyStatus" NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "receipt_id" SERIAL NOT NULL,
    "degree_app_id" INTEGER NOT NULL,
    "receipt_number" VARCHAR(30) NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "collection_date" DATE NOT NULL,
    "generated_by" INTEGER NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("receipt_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "session_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "message_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "kb_id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "source_document" VARCHAR(200),
    "embedding" TEXT,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("kb_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_registration_no_key" ON "users"("registration_no");

-- CreateIndex
CREATE UNIQUE INDEX "users_cnic_key" ON "users"("cnic");

-- CreateIndex
CREATE UNIQUE INDEX "department_reviews_clearance_id_department_id_key" ON "department_reviews"("clearance_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "degree_applications_clearance_id_key" ON "degree_applications"("clearance_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_degree_app_id_key" ON "receipts"("degree_app_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_requests" ADD CONSTRAINT "clearance_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_reviews" ADD CONSTRAINT "department_reviews_clearance_id_fkey" FOREIGN KEY ("clearance_id") REFERENCES "clearance_requests"("clearance_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_reviews" ADD CONSTRAINT "department_reviews_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_reviews" ADD CONSTRAINT "department_reviews_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_applications" ADD CONSTRAINT "degree_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_applications" ADD CONSTRAINT "degree_applications_clearance_id_fkey" FOREIGN KEY ("clearance_id") REFERENCES "clearance_requests"("clearance_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_degree_app_id_fkey" FOREIGN KEY ("degree_app_id") REFERENCES "degree_applications"("degree_app_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_degree_app_id_fkey" FOREIGN KEY ("degree_app_id") REFERENCES "degree_applications"("degree_app_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
