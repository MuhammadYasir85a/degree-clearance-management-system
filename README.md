# AI-Powered Degree Issuance & Clearance Management System

A comprehensive web-based platform designed to digitize and automate the complete university degree issuance lifecycle. The system replaces manual, paper-based workflows with an online process consisting of two major phases: **Clearance Management** and **Degree Issuance Management**, supported by an AI-powered RAG (Retrieval-Augmented Generation) assistant for student queries and policy guidance.

---

# Project Overview

Many universities still rely on manual clearance and degree issuance processes, requiring students to physically visit multiple departments before receiving their degree. This creates significant inefficiencies and challenges for both students and administrative staff.

## Problems with Current Manual Process

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

- Google Gemini-powered chatbot
- Process guidance ("How do I apply for degree issuance?")
- Document questions ("Which documents are required?")
- Policy questions ("What is the verification fee?")
- Status assistance ("What is my application status?")
- Powered by pgvector for semantic search over knowledge base

---

# Core Concept

The system follows a **Single Student Lifecycle** consisting of two phases:

```
Student Login → Apply for Clearance → Parallel Department Reviews (8 Departments)
     ↓
All Departments Approved? → Generate Clearance Certificate → Apply for Degree Issuance
     ↓
Upload Required Documents → Controller Verification → Generate Collection Receipt
     ↓
Degree Processing → Degree Ready → Degree Collected → Completed
```

---

# User Roles & Permissions

## Student
- Register (via verification against university records)
- Login
- Apply for Clearance
- View Clearance Status (All 8 Departments)
- Download Clearance Certificate
- Apply for Degree Issuance
- Upload Documents (CNIC, Photo, SSC, HSSC, Fee Slips, Internship, etc.)
- Respond to Correction Requests
- Track Application Status
- Download Collection Receipt
- Use AI Assistant

## Department Officer
Each officer belongs to one of 8 departments: Admission, Accounts, Library, Hostel, Store, Transport, FYP, CLO.
- View Assigned Clearance Requests (only own department)
- Approve Clearance
- Request Corrections with Remarks
- Add Remarks for Students
- Mark Clearance as Not Applicable

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
- Import Eligible Students Master List (CSV/Excel)
- Manage University Departments
- Reset Passwords
- System Maintenance

---

# Technology Stack

## Frontend
- **React.js** (JavaScript) - UI library
- **Vite** - Build tool and dev server
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **Tailwind CSS v4** - Utility-first CSS framework
- **clsx** - Conditional className utility
- **tailwind-merge** - Smart Tailwind class merging

## Backend
- **Node.js** (v20+) - JavaScript runtime
- **Express.js** - Web framework
- **Prisma ORM** (v6.19.3) - Database ORM
- **JWT (jsonwebtoken)** - Authentication tokens
- **bcryptjs** - Password hashing
- **cors** - Cross-origin resource sharing
- **cookie-parser** - Cookie middleware
- **dotenv** - Environment variable management
- **morgan** - HTTP request logger

## Database
- **PostgreSQL** (hosted on Neon Cloud)
- **Prisma Client** for type-safe database queries

## AI (Upcoming Integration)
- **Google Gemini API** - Large Language Model
- **pgvector** - Vector embeddings for semantic search
- **RAG (Retrieval-Augmented Generation)** - Architecture

## File Storage (Upcoming Integration)
- **Cloudinary** - Document & image storage

## Development Tools
- **Concurrently** - Run frontend & backend together with one command
- **Nodemon** - Auto-restart server on file changes

---

# Project Structure

```text
degree-clearance-management-system/
│
├── .gitignore
├── package.json                 # Root scripts (concurrently)
├── package-lock.json
├── LICENSE
├── README.md
│
├── docs/                        # ER Diagrams, Use Case, Documentation
│
├── client/                      # React Frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env                     # VITE_API_URL
│   ├── eslint.config.js
│   ├── public/
│   └── src/
│       ├── assets/              # Images, logos, static files
│       ├── components/          # Reusable UI components
│       ├── layouts/             # Dashboard & shared layouts
│       ├── pages/               # Route pages (Login, Dashboard, etc.)
│       ├── context/             # React Context (AuthContext, etc.)
│       ├── api/                 # Axios config & API functions
│       ├── constants/           # App constants
│       ├── utils/               # Helper functions
│       ├── App.jsx              # Main router component
│       ├── main.jsx             # React entry point
│       └── index.css            # Tailwind CSS imports
│
└── server/                      # Express Backend
    ├── package.json
    ├── .env                     # DATABASE_URL, JWT_SECRET, etc.
    ├── prisma/
    │   ├── schema.prisma        # Database schema (12 tables)
    │   ├── seed.js              # Seed script for initial data
    │   └── migrations/          # Prisma migration history
    └── src/
        ├── index.js             # Express server entry point
        ├── config/              # Prisma client, configs
        ├── routes/              # API route definitions
        ├── controllers/         # Request handlers
        ├── middleware/          # Auth, RBAC, validators
        ├── services/            # Business logic
        └── utils/               # Helper utilities
```

---

# Database Design (12 Tables)

The database schema contains 12 interconnected tables plus 7 PostgreSQL ENUM types:

## Tables

1. **Departments** - 8 university departments (Admission, Accounts, Library, etc.)
2. **Users** - Students, Officers, Controllers, Administrators
3. **ClearanceRequests** - Student clearance applications
4. **DepartmentReviews** - Per-department reviews (composite unique: clearance_id + department_id)
5. **DegreeApplications** - Degree issuance requests (1:1 with ClearanceRequests)
6. **Documents** - Uploaded documents (CNIC, Photo, SSC, HSSC, etc.)
7. **Receipts** - Collection receipts (1:1 with DegreeApplications)
8. **Notifications** - System notifications for users
9. **ActivityLogs** - System audit trail (polymorphic entity references)
10. **ChatSessions** - AI assistant chat sessions
11. **ChatMessages** - Messages within chat sessions
12. **KnowledgeBase** - University policies, FAQs, rules for RAG system

## Enum Types

- **UserRole:** student, officer, controller, admin
- **ClearanceStatus:** draft, applied, in_progress, correction_required, completed
- **ReviewStatus:** pending, approved, rejected, correction_required, not_applicable
- **DegreeStatus:** application_started, documents_uploaded, controller_review, degree_processing, degree_ready, degree_collected, completed
- **DocType:** CNIC, PHOTO, SSC_DMC, SSC_CERT, HSSC_DMC, HSSC_CERT, FEE_SLIP, VERIFICATION_SLIP, INTERNSHIP, CLEARANCE_CERT
- **VerifyStatus:** pending, verified, rejected
- **MessageRole:** user, assistant

---

# Current Development Progress

## Environment Setup (Completed)

- [x] GitHub Repository Created (`degree-clearance-management-system`)
- [x] Repository Cloned Locally
- [x] Monorepo Structure Created (`client/` + `server/` + `docs/`)
- [x] React + Vite Setup (JavaScript, not TypeScript)
- [x] Tailwind CSS v4 Setup (with `@tailwindcss/vite` plugin)
- [x] Express.js Server Setup (ES Modules)
- [x] CORS Configuration
- [x] Morgan Request Logger
- [x] Cookie Parser Middleware
- [x] Concurrently Configuration (`npm run dev` runs both)
- [x] Health Check API (`GET /api/health`)
- [x] Environment Variables Setup (`.env` for client & server)
- [x] `.gitignore` configured (node_modules, .env, build files)
- [x] Root `package.json` with workspace scripts

## Design Phase (Completed)

- [x] Problem Statement Documented
- [x] Complete Workflow Diagram
- [x] Use Case Diagram (All 4 Actors)
- [x] PostgreSQL ER Diagram (12 Tables + Relations)
- [x] Database Architecture Finalized
- [x] User Roles & Permissions Matrix
- [x] AI Assistant RAG Architecture Planned

## Database Milestone (Completed)

- [x] Neon PostgreSQL Cloud Database Created
- [x] `DATABASE_URL` configured in `server/.env`
- [x] Prisma ORM Installed & Configured (v6.19.3)
- [x] Complete `schema.prisma` created (12 Tables + 7 Enums)
- [x] First Migration Applied (`npx prisma migrate dev --name init`)
- [x] 8 University Departments Seeded via `seed.js`
- [x] Database Verified via Prisma Studio

---

# Complete Setup Guide For Team Members

## Prerequisites

Install the following tools on your machine:

- **Node.js** (v20+ Recommended)
- **Git**
- A code editor (VS Code Recommended)

Verify installation:

```bash
node -v
npm -v
git --version
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/MuhammadYasir85a/degree-clearance-management-system.git
cd degree-clearance-management-system
```

---

## Step 2: Install Dependencies

Install packages for root, client, and server:

### Root Dependencies

```bash
npm install
```

### Frontend Dependencies

```bash
cd client
npm install
cd ..
```

### Backend Dependencies

```bash
cd server
npm install
cd ..
```

---

## Step 3: Setup Environment Variables

Environment files are not pushed to GitHub for security reasons. You must create them manually.

### Client Environment (`client/.env`)

Create a file `client/.env` and paste:

```env
VITE_API_URL=http://localhost:5000/api
```

### Server Environment (`server/.env`)

Create a file `server/.env` and paste:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Neon PostgreSQL Connection String
DATABASE_URL="postgresql://username:password@ep-xxxxxx.region.aws.neon.tech/neondb?sslmode=require"

JWT_SECRET=degree_clearance_super_secret_key_change_this_later
JWT_EXPIRES_IN=7d
```

> **Important:** Replace the `DATABASE_URL` with your actual Neon PostgreSQL connection string. Never commit real `.env` files to GitHub.

---

## Step 4: Database Setup (First Time Only)

If you are setting up the database from scratch:

```bash
cd server

# Run first migration (creates all 12 tables in Neon)
npx prisma migrate dev --name init

# Seed 8 university departments
npx prisma db seed

# (Optional) Open Prisma Studio to verify data in browser
npx prisma studio
```

Prisma Studio will open at `http://localhost:5555`.

---

## Step 5: Run the Application

From the **project root** directory:

```bash
npm run dev
```

This single command starts both frontend and backend simultaneously:

- **React Frontend:** http://localhost:5173
- **Express Backend:** http://localhost:5000

---

## Step 6: Verify Installation

### Frontend
Open in browser: http://localhost:5173  
Expected: Vite + React application running successfully.

### Backend Health Check
Open in browser: http://localhost:5000/api/health  

Expected Response:

```json
{
  "status": "ok",
  "message": "AI-Powered Degree Issuance & Clearance API is running",
  "timestamp": "2026-10-11T06:40:39.282Z"
}
```

---

# All Commands Used During Development

## Project Initialization

```bash
# Clone repository
git clone https://github.com/MuhammadYasir85a/degree-clearance-management-system.git
cd degree-clearance-management-system

# Create folder structure
mkdir docs
mkdir -p client/src/{assets,components,layouts,pages,context,api,constants,utils}
mkdir -p server/prisma
mkdir -p server/src/{config,routes,controllers,middleware,services,utils}
```

## Client Setup (React + Vite + Tailwind CSS v4)

```bash
cd client
npm create vite@latest . -- --template react
npm install
npm install react-router-dom axios lucide-react clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/vite
```

## Server Setup (Express + Prisma)

```bash
cd server
npm init -y
npm install express cors dotenv bcryptjs jsonwebtoken cookie-parser morgan @prisma/client
npm install -D nodemon prisma

# Set ES Modules in package.json
npm pkg set type="module"
npm pkg set scripts.start="node src/index.js"
npm pkg set scripts.dev="nodemon src/index.js"
```

## Root Setup (Concurrently)

```bash
cd ..
npm init -y
npm install concurrently

npm pkg set scripts.dev="concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\""
npm pkg set scripts.dev:server="npm run dev --prefix server"
npm pkg set scripts.dev:client="npm run dev --prefix client"
```

## Database Setup (Prisma + Neon)

```bash
cd server

# Initialize Prisma
npx prisma init

# Install latest stable Prisma (v6.19.3)
npm install -D prisma@latest
npm install @prisma/client@latest

# Apply first migration (creates all tables)
npx prisma migrate dev --name init

# Configure seed script
npm pkg set prisma.seed="node prisma/seed.js"

# Seed 8 Departments
npx prisma db seed

# Verify in Prisma Studio
npx prisma studio
```

## Git Workflow

```bash
# Check status
git status

# Stage all changes
git add .

# Commit
git commit -m "feat: description of changes"

# Push to GitHub
git push origin main
```

---

# API Endpoints

## Health Check

```http
GET /api/health
```

**Example:**
```text
http://localhost:5000/api/health
```

**Example Response:**
```json
{
  "status": "ok",
  "message": "AI-Powered Degree Issuance & Clearance API is running",
  "timestamp": "2026-10-11T06:40:39.282Z"
}
```

> More endpoints (Auth, Clearance, Degree, Documents, AI Chat) will be added in upcoming phases.

---

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

- Google Gemini API Integration
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

**Muhammad Yasir**  
BS Software Engineering - Final Year Project

**Project Title:**  
AI-Powered Degree Issuance & Clearance Management System

**Repository:**  
https://github.com/MuhammadYasir85a/degree-clearance-management-system

---

# Acknowledgments

- University faculty & supervisors for guidance
- Neon for providing free PostgreSQL cloud database
- Prisma for excellent ORM tooling
- Open-source community for all the amazing libraries used