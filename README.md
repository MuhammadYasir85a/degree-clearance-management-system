# AI-Powered Degree Issuance & Clearance Management System

A web-based platform designed to digitize and automate the complete university degree issuance lifecycle. The system replaces manual, paper-based workflows with an online process consisting of two major phases: Clearance Management and Degree Issuance Management, supported by an AI-powered assistant.

---

# Project Overview

Many universities still rely on manual clearance and degree issuance processes, requiring students to physically visit multiple departments before receiving their degree.

Common issues include:

- Time-consuming verification processes
- Multiple university visits
- Lack of transparency
- Paper-based record management
- Lost or damaged documents
- No centralized status tracking

## Proposed Solution

### Phase 1: Clearance Management

- Student submits clearance request
- Eight departments review requests in parallel
- Digital approval workflow
- Real-time status tracking
- Automatic clearance certificate generation

### Phase 2: Degree Issuance Management

- Student uploads required documents
- Controller verifies application
- Receipt generation
- Degree processing workflow
- Collection tracking

### AI Assistant

- RAG-based AI chatbot
- Policy guidance
- Degree issuance support
- Document requirement assistance
- Student query handling

---

# Technology Stack

## Frontend

- React.js
- Vite
- React Router DOM
- Axios
- Lucide React
- Tailwind CSS v4
- clsx
- tailwind-merge

## Backend

- Node.js
- Express.js
- Prisma ORM
- JWT Authentication
- bcryptjs
- cors
- cookie-parser
- dotenv
- morgan

## Database

- PostgreSQL (Neon)

## AI

- Google Gemini API
- pgvector
- RAG Architecture

## File Storage

- Cloudinary

---

# Project Structure

```text
degree-clearance-management-system/
│
├── .gitignore
├── package.json
├── README.md
│
├── docs/
│
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── layouts/
│       ├── pages/
│       ├── context/
│       ├── api/
│       ├── constants/
│       ├── utils/
│       ├── App.jsx
│       ├── main.jsx
│       └── index.css
│
└── server/
    ├── package.json
    ├── .env.example
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── index.js
        ├── config/
        ├── routes/
        ├── controllers/
        ├── middleware/
        ├── services/
        └── utils/
```

---

# Current Development Progress

## Environment Setup

- [x] GitHub Repository Created
- [x] Repository Cloned Locally
- [x] Monorepo Structure Created
- [x] React + Vite Setup
- [x] Tailwind CSS Setup
- [x] Express Server Setup
- [x] CORS Configuration
- [x] Morgan Request Logger
- [x] Concurrently Configuration
- [x] Health Check API
- [x] Environment Variables Setup

## Design Phase

- [x] Problem Statement
- [x] Workflow Diagram
- [x] Use Case Diagram
- [x] PostgreSQL ER Diagram
- [x] Database Architecture
- [x] User Roles & Permissions
- [x] AI Assistant Architecture

---

# Setup Guide For Team Members

## Prerequisites

Install:

- Node.js (v20+ Recommended)
- Git

Verify Installation:

```bash
node -v
npm -v
git --version
```

---

## Clone Repository

```bash
git clone https://github.com/MuhammadYasir85a/degree-clearance-management-system.git

cd degree-clearance-management-system
```

---

## Install Dependencies

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

# Environment Variables

## Client

Create:

```text
client/.env
```

Add:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Server

Create:

```text
server/.env
```

Add:

```env
PORT=5000

NODE_ENV=development

CLIENT_URL=http://localhost:5173

JWT_SECRET=degree_clearance_super_secret_key_change_this_later

JWT_EXPIRES_IN=7d
```

> Note: DATABASE_URL will be added after Neon PostgreSQL setup.

---

## Alternative Setup Using Example Files

```bash
cp client/.env.example client/.env

cp server/.env.example server/.env
```

---

# Running The Project

From project root:

```bash
npm run dev
```

This command starts:

- React Frontend
- Express Backend

simultaneously.

---

# Verify Installation

## Frontend

Open:

```text
http://localhost:5173
```

Expected:

```text
Vite + React application running successfully.
```

---

## Backend

Open:

```text
http://localhost:5000/api/health
```

Expected Response:

```json
{
  "status": "ok",
  "message": "AI-Powered Degree Issuance & Clearance API is running"
}
```

---

# Health Check Endpoint

```http
GET /api/health
```

Example:

```text
http://localhost:5000/api/health
```

Example Response:

```json
{
  "status": "ok",
  "message": "AI-Powered Degree Issuance & Clearance API is running",
  "timestamp": "2026-10-11T06:40:39.282Z"
}
```

---

# Planned Database Tables

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
- Environment Setup
- Architecture Design
- Use Case Diagram
- ER Diagram

## Phase 2 - Next

- Neon PostgreSQL Setup
- Prisma Configuration
- schema.prisma Implementation
- Database Migration

## Phase 3

- Authentication System
- JWT Authorization
- Role-Based Access Control

## Phase 4

- Student Dashboard
- Officer Dashboard
- Controller Dashboard
- Admin Dashboard

## Phase 5

- Clearance Workflow
- Degree Issuance Workflow
- Document Uploads

## Phase 6

- PDF Certificate Generation
- Receipt Generation

## Phase 7

- Gemini AI Integration
- RAG Implementation
- pgvector Integration

---

# User Roles

## Student

- Login
- Apply for Clearance
- Track Clearance Status
- Download Clearance Certificate
- Apply for Degree Issuance
- Upload Documents
- Track Application Status
- Download Receipt
- Use AI Assistant

## Department Officer

- View Assigned Requests
- Approve Clearance
- Request Corrections
- Add Remarks
- Mark Not Applicable

## Controller Office

- Verify Documents
- Request Corrections
- Approve Degree Issuance
- Schedule Collection Date
- Mark Degree Ready
- Mark Degree Collected

## System Administrator

- Manage Users
- Manage Departments
- Reset Passwords
- System Maintenance

---

# Authors

**Muhammad Yasir**  
BS Software Engineering - Final Year Project  

**Project Title:**  
AI-Powered Degree Issuance & Clearance Management System