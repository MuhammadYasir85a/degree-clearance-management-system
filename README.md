# AI-Powered Degree Issuance & Clearance Management System

A comprehensive full-stack platform designed to digitize and automate the complete university degree issuance lifecycle for **UET Mardan**. The system replaces manual, paper-based workflows with an online process consisting of two major operational phases — **Clearance Management** and **Degree Issuance Management** — supported by an upcoming AI-powered RAG assistant for student policy and workflow guidance.

---

<<<<<<< HEAD
## 📌 Project Overview
=======
# Milestone 06 implementation

The chatbot backend now uses Groq generation, Hugging Face hosted MiniLM embeddings, pgvector retrieval, live student status, and persisted conversations. It includes keyword/semantic domain checks and a strict university-only system prompt. See [Milestone 06 setup and verification](docs/MILESTONE_06.md) for configuration, provider availability, tests, and Postman requests. Live provider access is still required before claiming end-to-end readiness.

# Project Overview
>>>>>>> 13155f7 (feat(ai): complete Milestone 06 AI RAG Chatbot with official UET Mardan data)

Many universities still rely on manual clearance and degree issuance workflows. Students must physically visit multiple departments, stand in long queues, and repeatedly return to campus to check their application status. This causes significant operational bottlenecks, lost records, and delays for both students and university administration.

### Problems with Current Manual Process
- **8 Mandatory Department Visits:** Students must physically visit Admission, Accounts, Library, Hostel, Central Store, Transport, FYP Coordinator, and Career Liaison Office (CLO).
- **Sequential Delays:** Departments process requests independently without real-time central visibility.
- **Lack of Transparency:** Students cannot easily check which specific officer or department is holding up their clearance.
- **Paper-Based Vulnerability:** Relying on paper clearance slips leads to misplaced documents, damaged records, and manual errors.
- **Repeated Campus Visits:** Students travel back and forth for status updates, document corrections, and receipt collection.

<<<<<<< HEAD
### Proposed Solution
- **Phase 1: Clearance Management:** Student submits a single online request. All 8 departments review in parallel. Approved departments stay locked if another department requests a correction.
- **Phase 2: Degree Issuance Management:** Gated strictly behind a completed clearance. Allows secure document uploads, Controller document verification, 7-stage status tracking, and collection receipt generation.
- **Phase 3: AI Assistant (Upcoming):** Google Gemini RAG-powered chatbot to answer policy, fee, document, and workflow queries dynamically.
=======
- **Manual Clearance Process:** Students must physically visit Admission Office, Accounts Office, Library, Hostel Office, Store, Transport Section, FYP Coordinator, and Career Liaison Office (CLO)
- **Time Consuming Process:** Every department works separately and often sequentially, causing delays
- **Lack of Transparency:** Students cannot easily determine which department approved their clearance or which is causing delays
- **Paper-Based Workflow:** Reliance on physical forms and signatures leading to lost documents, damaged records, and human errors
- **Multiple University Visits:** Students repeatedly visit to check status, submit documents, resolve issues, and collect receipts
- **No Automated Assistance:** No support mechanism to answer common student questions about documents, fees, or application status

## Proposed Solution

### Phase 1: Clearance Management

- Student submits a single clearance request
- Eight departments review requests **in parallel** (not sequential)
- Digital approval workflow with real-time status tracking
- Correction handling: only the department requesting correction re-reviews; others stay locked
- Automatic Clearance Certificate (PDF) generation when all departments approve

### Phase 2: Degree Issuance Management

- Student uploads required documents (academic, identity, financial, additional)
- Controller Office verifies all documents and clearance certificate
- Correction request handling for incorrect documents
- Automated Collection Receipt (PDF) generation after approval
- Full degree processing workflow: Processing → Ready → Collected

### AI Assistant (RAG-Based)

- Groq-powered chatbot with Hugging Face hosted embeddings
- Process guidance ("How do I apply for degree issuance?")
- Document questions ("Which documents are required?")
- Policy questions ("What is the verification fee?")
- Status assistance ("What is my application status?")
- Powered by pgvector for semantic search over knowledge base
>>>>>>> 13155f7 (feat(ai): complete Milestone 06 AI RAG Chatbot with official UET Mardan data)

---

## 🔄 Core Student Lifecycle

```text
Student Login
     │
     ▼
Apply for Clearance ──► Parallel Reviews (8 Active Departments)
     │
     ├─► Correction Requested? ──► Only rejecting department re-reviews (Others stay LOCKED)
     │
     ▼
All Departments Approved ──► Clearance Status: COMPLETED ──► Digital Clearance Certificate
     │
     ▼
Apply for Degree Issuance (Gated behind Completed Clearance)
     │
     ▼
Upload Required Documents (CNIC, Photo, DMCs, Fee Slips, etc.)
     │
     ▼
Controller Verification ──► Verify / Reject Documents
     │
     ▼
Advance Degree Pipeline (Processing ──► Ready)
     │
     ▼
Issue Collection Receipt (Receipt #, Date, PDF URL)
     │
     ▼
Degree Collected ──► Application Status: COMPLETED 🎓
```

---

## 👥 User Roles & Permissions

| User Role | Key System Responsibilities |
| :--- | :--- |
| **Student** | Register, Verify OTP, Apply for Clearance, Track 8-Department Status, Download Clearance Certificate, Apply for Degree, Upload Documents, Respond to Corrections, Download Collection Receipt, Use AI Chatbot |
| **Department Officer** | Belong to 1 of 8 departments; View assigned department queue only; Approve, Request Correction, or set Not Applicable with mandatory remarks |
| **Controller of Examinations** | Global degree queue oversight; Verify/Reject submitted documents; Advance degree pipeline status; Issue digital collection receipts |
| **System Administrator** | Manage user accounts & role assignments, Import eligible students list, Manage university departments, Monitor system audit logs & analytics |

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** React.js (v18+) with Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router DOM
- **HTTP Client:** Axios
- **Icons & Utilities:** Lucide React, clsx, tailwind-merge

### Backend
- **Runtime:** Node.js (v20+) with ES Modules
- **Framework:** Express.js
- **Database ORM:** Prisma ORM (v6+)
- **Database Engine:** PostgreSQL (Hosted on Neon Cloud)
- **Authentication:** JWT (JSON Web Tokens) with Cookies & Bearer Tokens
- **Security:** bcryptjs (Password Hashing), CORS, Cookie Parser
- **File Uploads:** Multer (Disk storage with 5MB limit and MIME filters)

<<<<<<< HEAD
### AI Architecture (Milestone 06 - Upcoming)
- **LLM:** Google Gemini API
- **Embedding / Vector Search:** pgvector on PostgreSQL
- **Pattern:** Retrieval-Augmented Generation (RAG) over `KnowledgeBase`
=======
## Database
- **PostgreSQL** (hosted on Neon Cloud)
- **Prisma Client** for type-safe database queries

## AI (Upcoming Integration)
- **Groq API** - Text generation (`llama-3.1-8b-instant`, configurable)
- **Hugging Face Inference** - Hosted MiniLM embeddings (384 dimensions)
- **pgvector** - Cosine similarity search
- **RAG (Retrieval-Augmented Generation)** - Architecture

## File Storage (Upcoming Integration)
- **Cloudinary** - Document & image storage

## Development Tools
- **Concurrently** - Run frontend & backend together with one command
- **Nodemon** - Auto-restart server on file changes
>>>>>>> 13155f7 (feat(ai): complete Milestone 06 AI RAG Chatbot with official UET Mardan data)

---

## 📁 Project Structure

```text
degree-clearance-management-system/
│
├── package.json                 # Monorepo root scripts (concurrently)
├── LICENSE
├── README.md
│
├── docs/                        # Architecture & Workflow Diagrams
│
├── client/                      # React Frontend (Vite + Tailwind v4)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env                     # VITE_API_URL
│   └── src/
│       ├── assets/              # Logos and static graphics
│       ├── components/          # Reusable UI components
│       ├── layouts/             # Dashboard and shared layouts
│       ├── pages/               # Route pages
│       ├── context/             # React AuthContext
│       ├── api/                 # Axios API instances
│       └── utils/               # Helper utilities
│
└── server/                      # Express Backend
    ├── package.json
    ├── .env                     # DATABASE_URL, JWT_SECRET, PORT
    ├── uploads/                 # Static storage for uploaded student documents
    ├── scripts/                 # Maintenance and database scripts
    ├── prisma/
    │   ├── schema.prisma        # Database schema (15 models + 7 enums)
    │   └── seed.js              # Seed script (Departments, Programs, Users)
    └── src/
        ├── index.js             # Express entry point
        ├── config/              # Prisma client & withDbRetry wrapper
        ├── controllers/         # Auth, Clearance, Degree, Notification
        ├── middleware/          # Auth, RBAC, Multer File Upload
        ├── routes/              # Express API route modules
        └── utils/               # Auth and system helpers
```

---

## 🗄️ Database Schema (15 Models + 7 Enums)

The system runs on PostgreSQL hosted on Neon Cloud, managed using Prisma ORM.

### Database Models
1. **`Department`** — 8 University Clearance Departments
2. **`AcademicProgram`** — University academic degree programs
3. **`EligibleStudent`** — University master list of graduating students
4. **`RegistrationRequest`** — Student account registration queue with OTP
5. **`User`** — Core user accounts (Students, Officers, Controllers, Admins)
6. **`ClearanceRequest`** — Student clearance applications
7. **`DepartmentReview`** — Per-department reviews (`clearance_id` + `department_id` unique composite)
8. **`DegreeApplication`** — Degree requests linked 1:1 with completed clearance
9. **`Document`** — Uploaded verification files (CNIC, Fee Slips, DMCs, etc.)
10. **`Receipt`** — Collection receipts issued by Controller
11. **`Notification`** — User notification log
12. **`ActivityLog`** — Comprehensive system audit trail
13. **`ChatSession`** — AI Assistant user conversation sessions
14. **`ChatMessage`** — Individual messages within AI sessions
15. **`KnowledgeBase`** — RAG policy documents & embedding vectors

---

## 📈 Development Roadmap & Status

| Milestone | Description | Status |
| :--- | :--- | :---: |
| **Milestone 01** | System Analysis, Requirements, Workflow & ER Diagrams | ✅ Completed |
| **Milestone 02** | Neon PostgreSQL Cloud DB, Prisma Schema, Initial Migrations | ✅ Completed |
| **Milestone 03** | Auth, OTP Verification, Registration Requests, Admin Approval, JWT + RBAC | ✅ Completed |
| **Milestone 04A** | Core Clearance Engine (Dynamic Departments, Parallel Reviews, Correction Locking) | ✅ Completed |
| **Milestone 04B** | Oversight Dashboard, Bottleneck Analytics, Audit Trail, Notifications | ✅ Completed |
| **Milestone 05** | Degree Application, Multer Document Storage, Controller Pipeline, Collection Receipts | ✅ Completed |
| **Milestone 06** | AI RAG Chatbot Integration (Google Gemini + pgvector) | 🔄 Next Up |
| **Milestone 07** | React Frontend Portal (Student, Officer, Controller, Admin Dashboards) | ⏳ Pending |
| **Milestone 08** | End-to-End Testing, Final Documentation, FYP Presentation | ⏳ Pending |

---

## 🔌 API Reference (Implemented)

### Authentication Module (`/api/auth`)
- `POST /api/auth/register-request` — Student submits registration request
- `POST /api/auth/verify-otp` — Verifies OTP sent to student
- `POST /api/auth/login` — Login for all roles (Returns JWT Token & sets Cookie)
- `GET  /api/auth/me` — Fetches current logged-in user profile

### Clearance Module (`/api/clearance`)
- `POST /api/clearance/apply` — Student initiates clearance request
- `GET  /api/clearance/my-status` — Student views clearance progress & department statuses
- `GET  /api/clearance/officer/pending` — Officer views department queue
- `PUT  /api/clearance/officer/review/:review_id` — Officer approves / requests correction
- `GET  /api/clearance/admin/all` — Admin/Controller views all clearance applications
- `GET  /api/clearance/analytics` — Admin/Controller views bottleneck analytics
- `GET  /api/clearance/:clearance_id` — Fetches detailed clearance audit trail
- `POST /api/clearance/:clearance_id/generate-certificate` — Issues digital clearance certificate

### Degree Application Module (`/api/degree`)
- `POST /api/degree/apply` — Student initiates degree application (requires clearance completed)
- `POST /api/degree/documents/upload` — Student uploads document file (Multipart/form-data)
- `GET  /api/degree/my-application` — Student tracks degree application pipeline
- `GET  /api/degree/controller/queue` — Controller views degree application queue
- `PUT  /api/degree/controller/verify-document/:document_id` — Controller approves/rejects document
- `PUT  /api/degree/controller/update-status/:degree_app_id` — Controller advances pipeline status
- `POST /api/degree/controller/generate-receipt/:degree_app_id` — Controller generates collection receipt

### Notification Module (`/api/notifications`)
- `GET  /api/notifications` — Fetches user notifications
- `PUT  /api/notifications/:notification_id/read` — Marks single notification as read
- `PUT  /api/notifications/read-all` — Marks all notifications as read

---

## 🛠️ Complete Setup & Execution Guide

### Prerequisites
- Node.js (v20+ Recommended)
- Git
- VS Code or preferred IDE

### 1. Clone the Repository
```bash
git clone https://github.com/MuhammadYasir85a/degree-clearance-management-system.git
cd degree-clearance-management-system
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Install server dependencies
cd server && npm install && cd ..
```

### 3. Environment Setup

Create **`client/.env`**:
```env
VITE_API_URL=http://localhost:5000/api
```

Create **`server/.env`**:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Neon PostgreSQL Database Connection
DATABASE_URL="postgresql://username:password@ep-xxxxxx.region.aws.neon.tech/neondb?sslmode=require"

# Authentication
JWT_SECRET="degree_clearance_super_secret_key_uet_mardan"
JWT_EXPIRES_IN="7d"
```

### 4. Database Initialization & Seeding
```bash
cd server

# Run Prisma migration
npx prisma migrate dev --name init

# Seed database with initial departments, academic programs, and test users
npx prisma db seed
```

### 5. Running the Application
From the root directory, start both frontend and backend concurrently:
```bash
npm run dev
```
- **React Frontend:** http://localhost:5173
- **Express Backend:** http://localhost:5000
- **Health Check API:** http://localhost:5000/api/health

---

## 🔑 Default Test Accounts (After Seeding)

| Role | Email | Password | Assigned Department / Program |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@university.edu.pk` | `admin123` | All System Modules |
| **Controller** | `controller@university.edu.pk` | `controller123` | Examination Office |
| **Student** | `awais@student.uetmardan.edu.pk` | `student123` | BSc Computer Software Engineering |
| **Officer (Library)** | `officer.lib@university.edu.pk` | `officer123` | University Library |
| **Officer (Accounts)** | `officer.acc@university.edu.pk` | `officer123` | Accounts Office |
| **Officer (Hostel)** | `officer.hst@university.edu.pk` | `officer123` | Hostel Office |

---

## 🔒 Implemented System Design Rules

1. **Neon DB Cold Start Wrapper:** Every database query is wrapped in `withDbRetry()` to seamlessly recover from cloud database connection drops.
2. **Dynamic Department Architecture:** Departments are queried with `is_active: true`. Zero department IDs are hardcoded.
3. **Correction Locking Rule:** When one department requests a correction, previously approved department reviews stay locked and are not re-triggered.
4. **Officer Write-Lock:** Once an officer sets a review status to `approved`, it becomes read-only and cannot be altered.
5. **Clearance Gate for Degree Application:** The system strictly blocks degree application creation unless `ClearanceRequest.status == 'completed'`.
6. **Audit Trail & Notifications:** Every major system action writes an automated entry to `ActivityLog` and creates a target `Notification`.

---

## 📄 License

This project is developed for educational and academic assessment purposes as a Final Year Project at **UET Mardan**.

---

<<<<<<< HEAD
## 👨‍💻 Author
=======
# Database Tables Created

- Users
- Departments
- ClearanceRequests
- DepartmentReviews
- DegreeApplications
- Documents
- Receipts
- Notifications
- ActivityLogs
- ChatSessions
- ChatMessages
- KnowledgeBase

---

# Development Roadmap

## Phase 1 - Completed

- Project Initialization
- GitHub Repository Setup
- Monorepo Structure
- Environment Setup (React + Vite + Tailwind, Express + Node)
- Architecture Design
- Use Case Diagram
- ER Diagram

## Phase 2 - Completed

- Neon PostgreSQL Setup
- Prisma ORM Configuration
- `schema.prisma` Implementation (12 Tables + Enums)
- First Database Migration
- 8 University Departments Seeded
- Database Verified via Prisma Studio

## Phase 3 - Next (Authentication System)

- Student Registration & Verification (OTP via email)
- JWT-Based Login/Logout
- Password Hashing with bcryptjs
- Role-Based Access Control (RBAC) Middleware
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/me` endpoints

## Phase 4 - Dashboards

- Student Dashboard
- Department Officer Dashboard
- Controller Dashboard
- Admin Dashboard
- Protected Routes & Role-Based Rendering

## Phase 5 - Workflows

- Phase 1 Clearance Workflow (Parallel Department Verification)
- Phase 2 Degree Issuance Workflow
- Document Uploads (Cloudinary Integration)
- Correction Request Handling
- Real-Time Status Tracking

## Phase 6 - PDF Generation

- Clearance Certificate PDF Generator
- Collection Receipt PDF Generator
- Digital Signatures / QR Codes

## Phase 7 - AI Assistant

- Groq + Hugging Face API Integration
- RAG (Retrieval-Augmented Generation) Implementation
- pgvector Integration for Semantic Search
- Knowledge Base Population
- Chat UI for Students

## Phase 8 - Final Integration

- Notifications System
- Activity Logs & Audit Trail
- Admin Analytics Dashboard
- Testing & Bug Fixing
- Deployment (Optional)

---

# Workflow Diagram

```text
Student Login
      ↓
Apply for Clearance
      ↓
Parallel Department Reviews:
   Admission | Accounts | Library | Hostel
   Store     | Transport| FYP     | CLO
      ↓
All Departments Approved?
      ↓
Generate Clearance Certificate (PDF)
      ↓
Apply for Degree Issuance (Phase 2)
      ↓
Upload Required Documents
      ↓
Controller Verification
      ↓
Correction Required?  →  Student Reuploads
      ↓
Generate Collection Receipt (PDF)
      ↓
Degree Processing
      ↓
Degree Ready → Student Visits University
      ↓
Degree Collected → Status: Completed
```

---

# Required Documents (Phase 2)

## Academic Documents
- SSC Certificate
- SSC DMC
- HSSC Certificate
- HSSC DMC

## Identity Documents
- CNIC Copy
- Passport Size Photograph

## Financial Documents
- Degree Fee Slip
- Degree Verification Fee Slip

## Additional Documents
- Internship Certificate

## Auto-Attached by System
- Clearance Certificate (from Phase 1)

---

# Automated System Services

The system automatically performs the following tasks:

- Generate Clearance Certificate PDF (when all 8 departments approve)
- Generate Collection Receipt PDF (after controller approval)
- Send Notifications & Real-Time Status Alerts
- Update Application Status at Each Stage
- Lock Approved Department Reviews (prevent re-review)
- Audit Logging for Every Action

---

# User Roles Summary

## Student
- Register / Verification
- Login
- Apply for Clearance
- Track Clearance Status (8 Departments)
- Download Clearance Certificate
- Apply for Degree Issuance
- Upload Documents
- Respond to Correction Requests
- Track Application Status
- Download Collection Receipt
- Use AI Assistant

## Department Officer
- View Assigned Clearance Requests (own department only)
- Approve Clearance
- Request Corrections with Remarks
- Add Remarks
- Mark Not Applicable

## Controller Office
- Verify Documents & Clearance Certificate
- Request Document Corrections
- Approve Degree Issuance
- Schedule Collection Date
- Mark Degree as Processing
- Mark Degree as Ready
- Mark Degree as Collected

## System Administrator
- Manage User Accounts & Roles
- Import Eligible Students (CSV/Excel)
- Manage University Departments
- Reset Passwords
- System Maintenance

---

# Project Architecture Notes

- **Monorepo Structure:** Single Git repo with separate `client/` and `server/` folders
- **ES Modules:** Backend uses `"type": "module"` in `package.json` for modern `import`/`export` syntax
- **Prisma Singleton:** Single Prisma Client instance exported from `config/prisma.js`
- **Role-Based Access Control (RBAC):** Middleware enforces role permissions on protected routes
- **Parallel Reviews:** Composite UNIQUE key `(clearance_id, department_id)` ensures exactly one review per department per clearance
- **Polymorphic ActivityLogs:** `entity_type` + `entity_id` references any table (no strict FK)
- **JWT Authentication:** Stateless auth with cookies + Bearer tokens
- **Cloud-First Database:** Neon PostgreSQL means teammates don't need local database setup

---

# Troubleshooting

## Issue: `npm error EJSONPARSE` while installing in `server/`
**Solution:** Delete empty `package.json` and re-run `npm init -y`:
```bash
rm package.json
npm init -y
```

## Issue: Prisma says `No command registered for migrate`
**Solution:** You have an experimental Prisma version. Install stable:
```bash
npm install -D prisma@latest
npm install @prisma/client@latest
```

## Issue: `.env` file not loaded
**Solution:** Ensure `dotenv.config()` is called at the top of `server/src/index.js`.

## Issue: CORS error between frontend and backend
**Solution:** Ensure `CLIENT_URL=http://localhost:5173` in `server/.env` matches your frontend URL.

---

# License

This project is licensed under the terms specified in the LICENSE file.

---

# Authors
>>>>>>> 13155f7 (feat(ai): complete Milestone 06 AI RAG Chatbot with official UET Mardan data)

**Muhammad Yasir**  
BS Software Engineering — Final Year Project  
**UET Mardan**

**Repository:** [https://github.com/MuhammadYasir85a/degree-clearance-management-system](https://github.com/MuhammadYasir85a/degree-clearance-management-system)
