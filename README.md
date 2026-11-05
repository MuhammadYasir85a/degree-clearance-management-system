# AI-Powered Degree Issuance & Clearance Management System

A comprehensive full-stack platform designed to digitize and automate the complete university degree issuance lifecycle for **UET Mardan**. The system replaces manual, paper-based workflows with an online process consisting of two major operational phases — **Clearance Management** and **Degree Issuance Management** — supported by an upcoming AI-powered RAG assistant for student policy and workflow guidance.

---

## 📌 Project Overview

Many universities still rely on manual clearance and degree issuance workflows. Students must physically visit multiple departments, stand in long queues, and repeatedly return to campus to check their application status. This causes significant operational bottlenecks, lost records, and delays for both students and university administration.

### Problems with Current Manual Process
- **8 Mandatory Department Visits:** Students must physically visit Admission, Accounts, Library, Hostel, Central Store, Transport, FYP Coordinator, and Career Liaison Office (CLO).
- **Sequential Delays:** Departments process requests independently without real-time central visibility.
- **Lack of Transparency:** Students cannot easily check which specific officer or department is holding up their clearance.
- **Paper-Based Vulnerability:** Relying on paper clearance slips leads to misplaced documents, damaged records, and manual errors.
- **Repeated Campus Visits:** Students travel back and forth for status updates, document corrections, and receipt collection.

### Proposed Solution
- **Phase 1: Clearance Management:** Student submits a single online request. All 8 departments review in parallel. Approved departments stay locked if another department requests a correction.
- **Phase 2: Degree Issuance Management:** Gated strictly behind a completed clearance. Allows secure document uploads, Controller document verification, 7-stage status tracking, and collection receipt generation.
- **Phase 3: AI Assistant (Upcoming):** Google Gemini RAG-powered chatbot to answer policy, fee, document, and workflow queries dynamically.

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

### AI Architecture (Milestone 06 - Upcoming)
- **LLM:** Google Gemini API
- **Embedding / Vector Search:** pgvector on PostgreSQL
- **Pattern:** Retrieval-Augmented Generation (RAG) over `KnowledgeBase`

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

## 👨‍💻 Author

**Muhammad Yasir**  
BS Software Engineering — Final Year Project  
**UET Mardan**

**Repository:** [https://github.com/MuhammadYasir85a/degree-clearance-management-system](https://github.com/MuhammadYasir85a/degree-clearance-management-system)
