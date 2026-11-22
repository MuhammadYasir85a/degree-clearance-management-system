# PROJECT CONTEXT: GradFlow AI Degree & Clearance Management System

## 1. Project Overview & Tech Stack
- **System**: AI-Powered Degree Issuance & Clearance Management System for GradFlow (FYP).
- **Backend**: Node.js (ES Modules, `"type": "module"`), Express.js, Prisma ORM v6.19.3.
- **Database**: Neon Serverless PostgreSQL with pgvector extension.
- **Frontend**: React + Vite + Tailwind CSS v4.
- **Authentication**: JWT Bearer tokens + bcryptjs (Salt rounds: 10) + RBAC (`student`, `officer`, `controller`, `admin`).
- **Private Files**: Multer memory ingestion with signature validation; documents and generated PDFs are stored under ignored `server/private-uploads/` and served only by authenticated, owner-scoped routes.
- **AI Engine (M06 implemented; provider verification pending)**: Groq (`groq-sdk`, `GROQ_MODEL=llama-3.1-8b-instant`) + Hugging Face hosted `sentence-transformers/all-MiniLM-L6-v2` embeddings (384 dimensions) + pgvector search over `KnowledgeBase`. No local embedding model is loaded. See `../docs/MILESTONE_06.md` for setup and verification.

---

## 2. STRICT FROZEN CODING RULES (NON-NEGOTIABLE)

1. **Neon Cold Start Rule (Mandatory DB Retry)**:
   - EVERY single Prisma query must be wrapped in `withDbRetry(() => prisma.model.action({...}))`.
   - Applies to `$transaction`, `findMany`, `findUnique`, `findFirst`, `create`, `update`, `delete`, `createMany`.
   - Import: `import prisma, { withDbRetry } from '../config/prisma.js';`

2. **Dynamic Departments Rule**:
   - NEVER hardcode department IDs or codes.
   - Always query active departments: `where: { is_active: true }`.

3. **Correction Locking Rule**:
   - When a department officer sets `status = 'correction_required'`, previously `approved` departments remain **LOCKED** (they are not re-triggered).
   - Only the rejecting department re-reviews after the student addresses the issue.

4. **Officer Write-Lock Rule**:
   - An already `approved` department review cannot be modified by an officer (must return 403 Forbidden).

5. **Auth & RBAC Middleware**:
   - Authentication check: `protect` middleware from `../middleware/auth.middleware.js` (populates `req.user`).
   - Authorization check: `authorize('role1', 'role2')` middleware from `../middleware/auth.middleware.js`.

6. **Activity Logs & Notifications**:
   - Every clearance/degree status mutation MUST create an `ActivityLog` record and a `Notification` record for the student/officer.

7. **Production Code Only**:
   - Write full, complete, production-ready files with error handling. No placeholders or incomplete snippets.

---

## 3. Database Models & Schema Summary (Prisma)

- **User**: identity, father name, email, CNIC, phone, academic program, passing year, CGPA, role and activation fields.
- **Department**: `department_id`, `name`, `code` (ADM, ACC, LIB, HST, STR, TRN, FYP, CLO), `is_active`.
- **AcademicProgram**: `program_id`, `name`, `code`, `degree_title`, `duration_years`.
- **EligibleStudent**: `eligible_id`, `registration_no`, `full_name`, `cnic`, `program_id`, `cgpa`, `passing_year`, `is_registered`.
- **RegistrationRequest**: `request_id`, `full_name`, `email`, `registration_no`, `cnic`, `otp_code`, `otp_expires_at`, `is_verified`.
- **ClearanceRequest**: `clearance_id`, `student_id`, `status` (draft | applied | in_progress | correction_required | completed), `certificate_url`, `completed_at`.
- **DepartmentReview**: departmental status, officer remarks, student correction response, resubmission timestamp and write-lock metadata. Composite unique: `[clearance_id, department_id]`.
- **DegreeApplication**: unique clearance relation, seven-stage status, Bank of Khyber fee/verification slip numbers, deposit date and processing timestamps.
- **Document**: `document_id`, `degree_app_id`, `document_type` (CNIC, PHOTO, SSC_DMC, SSC_CERT, HSSC_DMC, HSSC_CERT, FEE_SLIP, VERIFICATION_SLIP, INTERNSHIP, CLEARANCE_CERT), `file_url`, `file_name`, `verification_status` (pending | verified | rejected), `remarks`.
- **Receipt**: `receipt_id`, `degree_app_id` (Unique 1:1), `receipt_number`, `collection_date`, `qr_code_data`.
- **Notification**: `notification_id`, `user_id`, `title`, `message`, `type`, `is_read`.
- **ActivityLog**: `log_id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`.
- **KnowledgeBase**: `kb_id`, `title`, `content` (Text), `category`, `embedding` (String/Text for vector), `is_active`.
- **ChatSession** & **ChatMessage**: `session_id`, `user_id`, `role` (user | assistant), `content`.

---

## 4. Current Milestone Status

- [x] **Milestone 01**: ERD & Architecture Design
- [x] **Milestone 02**: Database Setup (Neon PostgreSQL + Prisma Schema + Seeding)
- [x] **Milestone 03**: Student Eligibility, OTP Registration & RBAC Authentication
- [x] **Milestone 04A**: Clearance Workflow Engine (Dynamic multi-department parallel routing & auto-completion)
- [x] **Milestone 04B**: Clearance Oversight, Analytics, Audit Logging & Certificate Generation
- [x] **Milestone 05**: Degree Application Pipeline, Multer Uploads, Controller Review & Collection Receipts
- [x] **Milestone 06**: AI RAG Chatbot (Groq + local 384-dimensional MiniLM embeddings + pgvector search over `KnowledgeBase`)
- [x] **Milestone 07**: React Frontend Dashboards (Vite + Tailwind CSS v4), student flexibility workflows and role portals
- [ ] **Milestone 08 (CURRENT TARGET)**: End-to-End Integration, Testing & Final FYP Defense Documentation

---

## 5. File Structure
```
server/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── config/
│   │   └── prisma.js          # Exports prisma (default) + withDbRetry
│   ├── middleware/
│   │   ├── auth.middleware.js   # protect, authorize
│   │   └── upload.middleware.js # Multer configuration
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── clearance.controller.js
│   │   ├── degree.controller.js
│   │   └── notification.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── clearance.routes.js
│   │   ├── degree.routes.js
│   │   └── notification.routes.js
│   ├── scripts/
│   │   └── force-complete-clearance.js
│   └── index.js
├── private-uploads/           # Ignored private documents and generated PDFs
└── package.json
```
