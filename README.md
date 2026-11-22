# GradFlow

## AI-Powered Degree Issuance and Clearance Management System

GradFlow is a production-oriented full-stack academic operations platform that digitizes the complete journey from student eligibility and institutional clearance to document verification, degree processing, and physical handover. It replaces disconnected paper forms and repeated office visits with one secure, auditable, role-based workflow.

The platform provides dedicated workspaces for students, departmental officers, the Controller of Examinations, and administrators. It also includes a retrieval-augmented AI assistant that answers institutional process questions and explains an authenticated student's live application status.

> **Status:** All planned milestones, including the AI RAG assistant, are implemented. Automated backend, integration, and complete lifecycle tests are included.

---

## Contents

- [Why GradFlow](#why-gradflow)
- [Core workflow](#core-workflow)
- [Major capabilities](#major-capabilities)
- [Role-based workspaces](#role-based-workspaces)
- [AI RAG assistant](#ai-rag-assistant)
- [Architecture and technology](#architecture-and-technology)
- [Data model](#data-model)
- [Security and privacy](#security-and-privacy)
- [Project structure](#project-structure)
- [Installation and configuration](#installation-and-configuration)
- [Database setup and seeding](#database-setup-and-seeding)
- [Running the application](#running-the-application)
- [Development accounts](#development-accounts)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Why GradFlow

Traditional degree-clearance processes are slow because students must visit multiple offices, departments work in isolation, paper records can be lost, and applicants have little visibility into delays. GradFlow addresses those problems with:

- one online application instead of repeated departmental visits;
- parallel review by every active statutory department;
- live, stage-accurate progress instead of static indicators;
- focused correction and resubmission without resetting prior approvals;
- authenticated document upload, preview, verification, and replacement;
- immutable operational history and searchable audit records;
- generated PDF certificates and QR-verifiable collection receipts;
- an AI assistant grounded in institutional knowledge and live student status;
- responsive, accessible interfaces for desktop, tablet, and mobile.

The product is institution-neutral. Branding, account domains, knowledge articles, and seeded records use generic university terminology so it can be adapted to different institutions.

---

## Core workflow

```text
Official eligibility roster
          |
          v
Student verifies registration number and CNIC
          |
          v
Email OTP registration and secure login
          |
          v
Clearance preview -> one clearance application
          |
          v
All active departments review in parallel
          |
          +---- correction requested ----> student responds
          |                                  |
          |                                  v
          |                         requesting office re-reviews
          |                         previous approvals stay locked
          v
All departments approved / not applicable
          |
          v
Clearance completed -> PDF clearance certificate
          |
          v
Degree application and 10 required document uploads
          |
          v
Controller verification -> processing -> degree ready
          |
          v
QR-enabled collection receipt
          |
          v
Physical identity checklist and permanent handover record
```

### Workflow rules

- Reviews are generated dynamically from every active department; no fixed department count is assumed.
- Departments review the same application in parallel.
- An approved officer decision is final and locked.
- A correction affects only the requesting department; other approvals stay valid.
- Degree issuance remains locked until clearance is complete.
- Degree submission requires all documents and deposit particulars.
- Receipt generation requires verified documents.
- Physical handover is an explicit, permanent action protected by a checklist.

---

## Major capabilities

### Identity and account management

- Eligibility-first registration using registration number and CNIC.
- Email OTP verification before account activation.
- Role-aware login for students, officers, controllers, and administrators.
- Secure profile updates and logout.
- Complete password recovery: request OTP, verify OTP, receive a short-lived reset token, set a compliant password, and invalidate previous sessions.
- Administrative account creation, suspension/reactivation, and password reset.
- Anti-enumeration recovery responses.

### Clearance management

- Read-only eligibility preview before submission.
- One application that creates reviews for all active departments.
- Live approved, pending, and correction-required progress.
- Officer queues with search, filters, sorting, and pagination.
- Department-specific review checklists and correction guidance.
- Student resubmission with complete review history.
- Safe withdrawal while every review remains pending.
- Bulk approval and CSV export for officers.
- Automatic PDF clearance certificate after completion.

### Degree issuance

- Degree application unlocked only after clearance completion.
- Draft deposit particulars with explicit save and submit stages.
- Upload, replace, delete, and protected preview for ten credentials:
  1. degree fee deposit slip;
  2. degree verification deposit slip;
  3. attested passport photograph;
  4. practical training or internship certificate;
  5. CNIC copy;
  6. SSC marks certificate;
  7. SSC certificate;
  8. HSSC marks certificate;
  9. HSSC certificate;
  10. institutional clearance certificate.
- PDF, JPEG, and PNG support with a 5 MB per-file limit.
- Individual and bulk controller verification, rejection remarks, and replacement handling.
- Accurate stage tracking from application start through collection.
- PDF collection receipt with QR verification.
- Privacy-limited public receipt verification.
- Controller handover search, identity checklist, and permanent completion record.

### Administration and governance

- Institution-wide dashboard and operational metrics.
- Eligible-student roster CRUD plus CSV/XLSX import and template download.
- Dynamic department creation and activation control.
- Staff account and access management.
- Clearance oversight with complete departmental review trails.
- Knowledge-base management and RAG testing console.
- Human-readable forensic audit inspector, search, pagination, and export.
- User notifications for material events.

### User experience and accessibility

- Responsive role-specific navigation and layouts.
- Light, dark, eye-comfort, and high-contrast display modes.
- Readable base typography and contrast in every theme.
- Reduced-motion preference and presentation privacy mode.
- Keyboard-accessible command palette (`Ctrl/Cmd + K`).
- Professional Lucide icons rather than decorative emoji.
- Skeletons, empty states, progress summaries, status badges, and actionable errors.
- Persisted appearance preferences.

---

## Role-based workspaces

| Role | Responsibilities |
|---|---|
| **Student** | Register from the approved roster, apply for clearance, resolve corrections, download the certificate, upload degree documents, track stages, obtain the receipt, and use the AI assistant. |
| **Department officer** | Work only in the assigned department, inspect candidate records, approve and lock reviews, request corrections, process resubmissions, bulk approve, and export records. |
| **Controller** | Search degree cases, inspect secure documents, manage processing stages, issue receipts, confirm handover, and access permitted oversight views. |
| **Administrator** | Manage eligibility, departments, users, registration requests, clearance oversight, knowledge content, audit logs, and institutional metrics. |

Authorization is enforced by both React route protection and Express middleware. Hidden interface elements are never treated as a security boundary.

---

## AI RAG assistant

GradFlow contains a complete retrieval-augmented generation pipeline rather than a generic chatbot.

1. Institutional articles are normalized and embedded locally.
2. `Xenova/all-MiniLM-L6-v2` produces 384-dimensional vectors.
3. PostgreSQL stores and searches them with `pgvector`.
4. Each user message is embedded and matched to active articles.
5. Status questions receive a minimal live workflow context for the authenticated student.
6. Retrieved evidence and safe status data are sent to Groq.
7. `llama-3.1-8b-instant` produces a concise grounded response with references.
8. Conversations are persisted as sessions and messages.

### AI safeguards

- All chat and knowledge routes require authentication.
- The assistant remains within clearance, degree, documents, fees, collection, and authenticated-status topics.
- Live context excludes passwords, CNIC, email, phone, file paths, and unrelated personal data.
- Unknown or off-domain questions are declined instead of answered speculatively.
- Semantic and keyword checks reduce prompt misuse.
- Rate limiting protects generation.
- Only administrators can mutate knowledge articles.
- Embeddings run locally; no Hugging Face inference token is required.

Set `GROQ_API_KEY` for live answers. The embedding model downloads on first use and can subsequently run from the local cache in offline mode.

---

## Architecture and technology

```text
React 19 + Vite 8 + Tailwind CSS 4
                |
                | HTTPS / JSON / protected file responses
                v
Express 5 REST API (Node.js ES Modules)
   |            |             |             |
   |            |             |             +-- Nodemailer SMTP
   |            |             +---------------- Groq API
   |            +------------------------------ Private file/PDF storage
   v
Prisma ORM 6.19.3
   |
   v
Neon PostgreSQL + pgvector
```

### Frontend

React 19, React Router 7, Vite 8, Tailwind CSS 4, Axios, Lucide React, and a custom responsive accessibility-aware design system.

### Backend

Node.js ES Modules, Express 5, Prisma 6.19.3, JWT HTTP-only cookie authentication, bcrypt, Multer, PDFKit, QRCode, Nodemailer, Helmet, CORS, ExcelJS, CSV parsing, rate limits, and structured error handling.

### Data and AI

Neon PostgreSQL, `pgvector`, `@xenova/transformers`, Groq SDK, and PGlite with pgvector for isolated integration tests.

### Reliability conventions

- Every Prisma operation is invoked through `withDbRetry(() => prisma.model.action(...))` or its transaction-client equivalent.
- Transient Neon `P1001` failures use bounded exponential retry.
- Transactions have explicit wait and execution timeouts.
- State transitions are checked server-side and critical multi-write operations are transactional.

---

## Data model

The Prisma schema contains 16 models and 7 workflow enums.

| Model | Purpose |
|---|---|
| `Department` | Configurable review department and activation state. |
| `AcademicProgram` | Programme metadata. |
| `EligibleStudent` | Official pre-registration roster. |
| `User` | Identity, role, programme, department, and authorization version. |
| `PasswordResetRequest` | Hashed recovery OTP/token state and expiry. |
| `RegistrationRequest` | Registration approval and OTP state. |
| `ClearanceRequest` | Clearance application and certificate metadata. |
| `DepartmentReview` | Per-department decision, remarks, and resubmission state. |
| `DegreeApplication` | Degree particulars and processing state. |
| `Document` | Private credential metadata and verification decision. |
| `Receipt` | Collection schedule, PDF, QR, and handover data. |
| `Notification` | User workflow notification. |
| `ActivityLog` | Append-only operational audit event. |
| `ChatSession` | AI conversation owned by a user. |
| `ChatMessage` | Conversation message and knowledge references. |
| `KnowledgeBase` | Institutional article and vector embedding. |

Enums: `UserRole`, `ClearanceStatus`, `ReviewStatus`, `DegreeStatus`, `DocType`, `VerifyStatus`, and `MessageRole`.

---

## Security and privacy

- bcrypt password hashing; plaintext passwords are never stored.
- HTTP-only JWT cookies containing an authorization version.
- Old-session invalidation after password reset.
- Hashed, expiring OTPs and reset tokens with attempt controls.
- `protect` and role-specific `authorize(...)` middleware.
- Ownership checks for records, documents, PDFs, and chat sessions.
- Private credentials stored outside public static directories and streamed only through authorized endpoints.
- Declared MIME type and detected file-signature validation.
- 100 KB JSON/form body limits and 5 MB upload limits.
- Helmet headers, explicit CORS origin, and disabled Express disclosure.
- Dedicated rate limits for login, registration, recovery, and chat.
- Auditing of important administrative and workflow actions.
- Minimal disclosure by public receipt verification.
- Production rejection of development-only `DEMO_OTP`.

Never commit `.env`, production credentials, API keys, SMTP passwords, private uploads, or generated student documents.

---

## Project structure

```text
degree-clearance-management-system/
├── client/
│   ├── src/
│   │   ├── components/       shared layout, navigation, UI, assistant
│   │   ├── context/          authentication and appearance preferences
│   │   ├── pages/            public, student, officer, controller, admin
│   │   ├── services/         API client and helpers
│   │   ├── App.jsx           routing and role protection
│   │   └── index.css         design system, themes, responsive rules
│   └── vite.config.js
├── server/
│   ├── prisma/
│   │   ├── migrations/       versioned PostgreSQL migrations
│   │   ├── schema.prisma     relational source of truth
│   │   ├── seed.js           core development data
│   │   └── seed-remaining-departments.js
│   ├── private-uploads/      protected runtime documents and PDFs
│   ├── src/
│   │   ├── config/           environment and Prisma retry configuration
│   │   ├── controllers/      HTTP workflow handlers
│   │   ├── middleware/       auth, authorization, limits, uploads
│   │   ├── routes/           REST API definitions
│   │   ├── scripts/          ingestion and verification tools
│   │   └── services/         AI, email, PDF, and workflow services
│   ├── test/                 unit and integration tests
│   ├── tests/                complete lifecycle E2E test
│   └── .env.example
├── docs/                     implementation documentation
├── postman/                  collections, environments, flows, specs
├── CODEX_CONTEXT.md          engineering context
└── README.md
```

---

## Installation and configuration

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL with the `vector` extension; Neon is recommended
- Groq API key for live AI generation
- SMTP account for registration and recovery email delivery

### Install

```bash
git clone https://github.com/MuhammadYasir85a/degree-clearance-management-system.git
cd degree-clearance-management-system
npm install
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
```

### Backend environment

Configure `server/.env`:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
JWT_EXPIRES_IN=7d

# Development only; remove in production.
DEMO_OTP=

GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

TRANSFORMERS_CACHE=.cache/transformers
TRANSFORMERS_OFFLINE=false
```

`DATABASE_URL` and a `JWT_SECRET` of at least 32 characters are mandatory. SMTP is required for real OTP delivery; Groq is required for live generated AI answers. No client environment file is required locally because Vite proxies `/api` to `http://localhost:5000`.

---

## Database setup and seeding

```bash
cd server
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

The migrations create the relational schema, password recovery, AI tables, and pgvector support.

### Additional statutory departments

```bash
npm run seed:departments
npm run verify:departments
```

This brings development configuration to 13 dynamic departments. Newly provisioned statutory officers receive randomized unusable bootstrap passwords; set their initial passwords through **Admin > Users & staff**.

### Knowledge-base embeddings

```bash
npm run seed:kb
```

The first run may download MiniLM. Keep `TRANSFORMERS_OFFLINE=false` until it succeeds. Knowledge articles contain general process guidance only; private student data is not embedded.

---

## Running the application

From the repository root:

```bash
npm run dev
```

Or run each service independently:

```bash
npm run dev:server
npm run dev:client
```

| Service | URL |
|---|---|
| React application | `http://localhost:5173` |
| API index | `http://localhost:5000/api` |
| Health check | `http://localhost:5000/api/health` |
| Public receipt verification | `http://localhost:5173/verify` |

Opening port 5000 at `/` redirects to the client. A JSON response at `/api` or `/api/health` confirms the backend works; the API port is not the user interface.

### Production

```bash
npm run build --prefix client
NODE_ENV=production npm start --prefix server
```

Serve `client/dist` using a static host or reverse proxy and route `/api` to Express.

---

## Development accounts

Created by `server/prisma/seed.js` for local demonstration only:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@university.edu.pk` | `admin123` |
| Controller | `controller@university.edu.pk` | `controller123` |
| Student | `student@university.edu.pk` | `student123` |
| Core officers | `officer.<department-code>@university.edu.pk` | `officer123` |

Core examples: `officer.adm@university.edu.pk`, `officer.acc@university.edu.pk`, `officer.lib@university.edu.pk`, `officer.hst@university.edu.pk`, `officer.str@university.edu.pk`, `officer.trn@university.edu.pk`, `officer.fyp@university.edu.pk`, and `officer.clo@university.edu.pk`.

Change these passwords before shared or deployed use. Additional accounts from `seed:departments` do not use `officer123` and require an administrator-assigned password.

---

## API reference

All endpoints begin with `/api`. Protected requests use the HTTP-only cookie returned by login. Full request assets are available in `postman/`.

### Authentication — `/api/auth`

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/verify-student` | Public, limited | Check roster eligibility. |
| POST | `/register-request` | Public, limited | Create an OTP registration request. |
| POST | `/verify-otp` | Public, limited | Activate the account. |
| POST | `/login` | Public, limited | Authenticate and set the cookie. |
| POST | `/forgot-password` | Public, limited | Request recovery OTP. |
| POST | `/forgot-password/verify` | Public, limited | Exchange OTP for reset token. |
| POST | `/forgot-password/reset` | Public, limited | Set password and revoke old sessions. |
| GET/PUT | `/me` | Authenticated | Read or update the profile. |
| POST | `/logout` | Authenticated | Clear authentication. |

### Clearance — `/api/clearance`

| Method and route | Access | Purpose |
|---|---|---|
| GET `/preview` | Student | Preview identity and active departments. |
| POST `/apply` | Student | Submit parallel clearance. |
| GET `/my-status` | Student | Get reviews, remarks, and progress. |
| DELETE `/withdraw/:clearance_id` | Student | Withdraw an untouched request. |
| PUT `/reviews/:review_id/resubmit` | Student | Respond to a correction. |
| GET `/officer/queue` | Officer | Search assigned-department work. |
| PUT `/officer/review/:review_id` | Officer | Approve or request correction. |
| POST `/officer/bulk-approve` | Officer | Approve selected eligible records. |
| GET `/officer/export` | Officer | Export departmental register. |
| GET `/admin/all` | Admin, controller | Institution-wide register. |
| GET `/analytics` | Admin, controller | Clearance metrics. |
| GET `/:clearance_id` | Authorized | Detailed review and audit view. |
| POST `/:clearance_id/generate-certificate` | Authorized | Generate/retrieve the certificate. |

### Degree — `/api/degree`

| Method and route | Access | Purpose |
|---|---|---|
| GET `/verify-receipt/:receipt_number` | Public | Verify authenticity. |
| POST `/apply` | Student | Create gated degree application. |
| PUT `/:degree_app_id/particulars` | Student | Save deposit particulars. |
| POST `/documents/upload` | Student | Upload or replace a credential. |
| DELETE `/documents/:document_id` | Student | Delete editable owned document. |
| POST `/submit/:degree_app_id` | Student | Submit and lock the application. |
| GET `/my-application` | Student | Get documents, stages, and receipt. |
| GET `/controller/queue` | Controller, admin | Search cases. |
| GET `/controller/applications/:degree_app_id` | Controller, admin | Open verification workspace. |
| PUT `/controller/verify-document/:document_id` | Controller, admin | Verify or reject a document. |
| PUT `/controller/verify-all/:degree_app_id` | Controller, admin | Verify complete checklist. |
| PUT `/controller/update-status/:degree_app_id` | Controller, admin | Advance valid processing state. |
| POST `/controller/generate-receipt/:degree_app_id` | Controller, admin | Generate receipt. |
| GET `/controller/handover/lookup` | Controller, admin | Find collection record. |
| POST `/controller/handover/:degree_app_id` | Controller, admin | Confirm permanent handover. |

### Administration — `/api/admin`

The admin API covers dashboard metrics; registration approvals; eligible-student CRUD, template, and import; department creation/status; user creation/status/password reset; and audit-log listing/export.

### AI — `/api/chat`

| Method and route | Access | Purpose |
|---|---|---|
| POST `/message` | Authenticated, limited | Send a grounded question. |
| GET `/sessions` | Authenticated | List owned conversations. |
| GET/DELETE `/sessions/:session_id` | Owner | Read or delete a session. |
| POST `/admin/kb` | Admin | Create and embed article. |
| GET `/admin/kb` | Admin, controller | List articles. |
| PUT/DELETE `/admin/kb/:kb_id` | Admin | Update or remove article. |
| POST `/admin/test-rag` | Admin | Inspect retrieval and answer. |

### Files and notifications

- `/api/files/documents/:document_id` streams an authorized private credential.
- `/api/files/clearance-certificates/:clearance_id` downloads a certificate.
- `/api/files/receipts/:receipt_id` downloads a receipt.
- `/api/notifications` lists personal notifications.
- `/api/notifications/read-all` and `/:notification_id/read` update read state.

---

## Testing

### Backend unit and integration suite

```bash
npm test --prefix server
```

Coverage includes AI services and guardrails, chat controllers, rate limiting, pgvector retrieval, ingestion, dynamic departments, database retry, private-file authorization, workflow hardening, and password recovery.

### Complete degree lifecycle

```bash
npm run test:e2e --prefix server
```

This exercises eligibility and registration, parallel clearance, certificate issuance, ten uploads, controller verification, receipt generation, public verification, and physical handover.

### Frontend checks

```bash
npm run lint --prefix client
npm run build --prefix client
```

### Operational verification

```bash
npm run verify:departments --prefix server
npm run verify:clearance-spawn --prefix server
```

`verify:clearance-spawn` intentionally checks transaction rollback and should run only against development/test data.

### Other scripts

| Command | Purpose |
|---|---|
| `npm run seed:kb --prefix server` | Embed and upsert knowledge. |
| `npm run seed:departments --prefix server` | Provision additional departments/officers. |
| `npm run backfill:pdfs --prefix server` | Rebuild missing generated PDF files referenced by data. |
| `npm run test:e2e --prefix server` | Run full lifecycle acceptance. |

---

## Deployment

### Required checklist

- Use a dedicated production database and least-privilege role.
- Set `NODE_ENV=production`, an exact `CLIENT_URL`, and a strong random `JWT_SECRET`.
- Configure verified SMTP and store `GROQ_API_KEY` in a secret manager.
- Remove `DEMO_OTP` completely.
- Run `npx prisma migrate deploy` and `npx prisma generate` during release.
- Confirm the PostgreSQL `vector` extension and persistent transformer cache.
- Serve all traffic through HTTPS.
- Keep `server/private-uploads` on persistent encrypted storage, or use a private object-store adapter.
- Never expose private uploads as static files.
- Change/remove all development accounts and passwords.
- Monitor failed login/recovery, upload failures, AI provider failures, and database retries.
- Run backend tests, client lint/build, and the E2E lifecycle before release.

---

## Troubleshooting

### `API route not found` at port 5000

The interface is at `http://localhost:5173`. The API uses `/api/*`. Use `/api/health` to verify the backend.

### Missing environment variables

Copy `server/.env.example` to `server/.env`. `DATABASE_URL` and a 32+ character `JWT_SECRET` are required.

### Neon `P1001`

Confirm the connection string, `sslmode=require`, project state, credentials, and network access. GradFlow retries transient wake-up failures, but cannot repair invalid credentials.

### Knowledge seeding does not run

Use `npm run seed:kb --prefix server`, keep `TRANSFORMERS_OFFLINE=false` on the first run, and ensure `server/.cache/transformers` is writable. Enable offline mode only after the model is cached.

### AI retrieves knowledge but cannot answer

Set a valid `GROQ_API_KEY`, confirm `GROQ_MODEL=llama-3.1-8b-instant`, and check provider quota/connectivity. Embedding and generation are separate stages.

### Recovery email does not arrive

Check every `SMTP_*` value. A controlled `DEMO_OTP` may be used locally but is rejected in production.

### Upload rejected

Only genuine PDF, JPEG, and PNG files up to 5 MB are accepted. Renaming an unsupported extension cannot bypass signature validation.

---

## Engineering principles

- ES Modules throughout the backend.
- Every Prisma call protected by `withDbRetry`.
- Server-authoritative roles and state transitions.
- Dynamic departments instead of fixed assumptions.
- Privacy-preserving authenticated file delivery.
- Transactional writes and append-only audit evidence.
- Generic institutional branding.
- Accessible typography, professional icons, and responsive layouts.
- Displayed progress always derived from persisted state.

---

## License

Licensed under the ISC License as declared in `package.json`.

---

**GradFlow — secure, transparent, and intelligent academic clearance and degree issuance.**
