<div align="center">

# SumTrack

### *An Integrated Loan Management and Employee Performance System for Sum Finance Services Corp.*

**Capstone Project**  
**Type:** Internal Multi-Branch Loan Operations System  
**Status:** Active Development / Late-Stage Feature Completion  

</div>

---

## Overview

**SumTrack** is a web-based internal system built for **Sum Finance Services Corp.** to centralize and streamline daily lending and branch operations.

It brings together:

- borrower management
- loan creation and lifecycle tracking
- collection recording and passbook history
- branch- and role-scoped workflows
- employee/account administration
- reports and monthly system-generated summaries
- operational activity logging
- AI-assisted borrower risk assessment

The goal of the system is to replace fragmented manual workflows with a more structured, traceable, and scalable operational platform for a multi-branch finance environment.

---

## Current System Scope

SumTrack currently covers the following major areas:

### Core Operations
- Loans
- Borrowers
- Collections
- Branches
- Collectors
- Documents

### Finance and Monitoring
- Incentives
- Expenses
- Reports
- Recent Activity

### Admin and Role-Based Workflow
- Manage User Accounts
- Branch-scoped access control
- Role-specific dashboards and navigation
- Staff and borrower account flows

### Decision Support
- AI-assisted borrower reapproval risk assessment based on missed-payment notes and payment behavior

---

## Key Features

### Loan Management
- Loan creation with generated loan codes
- Loan lifecycle tracking with persistent statuses:
  - `active`
  - `overdue`
  - `completed`
  - `archived`
  - `abandoned`
- Automatic loan status persistence based on payment progress and daily reconciliation
- Loan detail pages with:
  - loan summary
  - digital passbook
  - reports & receipts
  - documents

### Collections and Passbook
- Collection recording with generated collection codes
- Business-date-based passbook entries
- Missed-payment support using zero-amount collection entries with required notes
- Borrower-facing loan history visibility
- Status updates triggered by collection events

### Reports and Analytics
- Manual report generation
- Report library with saved snapshots
- Snapshot-based viewing, export, and printing
- CSV / PDF export support
- Automated **monthly system-generated reports**
- Role- and branch-scoped report visibility
- Duplicate prevention for scheduled monthly system reports

### AI-Assisted Borrower Risk Assessment
- Borrower-level reapproval risk assessment
- Uses missed-payment notes and payment behavior
- App-owned scoring with AI-assisted note analysis
- Final labels:
  - **Okay**
  - **Warning**
  - **Risky**
- Advisory only; not the final approval decision

### Recent Activity
- Operational activity feed for creation-based events
- Tracks real system actions such as:
  - account creation
  - loan creation
  - collection recording
  - report generation
  - document uploads
  - expenses and incentive rule creation

### Role and Branch Scoping
- Admin: global scope
- Auditor: assigned branches
- Branch Manager: managed branch
- Secretary: branch-restricted operational access
- Collector: self-service performance and assigned work
- Borrower: self-service overview and loan visibility

---

## Role Model

### Admin
Full global operational visibility and control across all branches.

### Auditor
Assigned-branch oversight with report visibility and monitoring-focused access.

### Branch Manager
Single-branch management and oversight for local operations.

### Secretary
Branch-level operational work such as borrower handling and collections support.

### Collector
Self-service access to assigned loans, collections, and performance.

### Borrower
Self-service access to personal overview and loan records.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App Framework | **Next.js (App Router)** |
| Language | **TypeScript** |
| Styling | **Tailwind CSS** |
| UI Components | **shadcn/ui** |
| Charts | **Tremor / Recharts** |
| Authentication | **Supabase Auth** |
| Database | **Supabase Postgres** |
| ORM | **Drizzle ORM** |
| File Storage | **Supabase Storage** |
| Hosting | **Vercel** |
| AI Integration | **Google Gemini API** |
| Scheduled Automation | **Supabase Cron / pg_cron** |

---

## Architecture Notes

SumTrack uses a server-first, role-scoped architecture built around Supabase and Next.js.

### Core Architecture Principles
- **Supabase Postgres** is the primary system database
- **Drizzle ORM** is used for schema and query management
- **Supabase Auth** handles authentication and session management
- **Supabase Storage** is used for internal operational document uploads
- **Next.js route handlers and server actions** act as the backend logic layer
- **branch scoping and role restrictions** are enforced across modules
- **saved report snapshots** are treated as canonical report output for viewing/export

### Important Implementation Patterns
- database-driven filtering and pagination where practical
- server-side access control for protected operations
- persistent loan status updates through:
  - collection-triggered reconciliation
  - scheduled daily reconciliation
- monthly scheduled report generation through Supabase Cron

---

## Current Feature State

### Implemented / Working
- Loan module
- Borrowers module
- Collections module
- Expenses module
- Incentives module
- Branch management
- Role-based access and branch scoping
- Reports module
- Automated monthly system-generated reports
- Recent Activity
- AI-assisted borrower risk assessment
- Loan lifecycle/status persistence
- Performance optimization and deployment hardening

### Still Being Polished
- incentives UI
- expenses UI
- create user accounts UI
- collector leaderboard / search / collector profile performance
- collection analytics page
- overall dashboard cleanup
- final frontend polish / system visual refinement
- borrower-to-collector contact convenience flow

---

## Operational Notes

### Reports
Reports are snapshot-based. Exports and viewing should use the **saved snapshot**, not freshly recomputed values, to preserve consistency and auditability.

### Loan Status Truth
Loan status is persisted in the database and reconciled through:
- collection-triggered status updates
- scheduled daily status reconciliation

### Documents
Documents are internal operational records. Borrowers do **not** manage or access document workflows.

### AI Feature Disclaimer
The borrower risk assessment is an **AI-assisted advisory tool** only. It is intended to support decision-making, not replace staff judgment or formal approval policy.

---

## Development Notes

This repository is still an actively evolving capstone/project codebase. While major modules are implemented, the system should still be treated as **in active refinement**, not as a finalized public production product.

It is currently best understood as:

- a real-world operational system in active development
- a capstone project with live business-oriented workflows
- a structured internal tool rather than a public-facing platform

---

## Roadmap (Remaining)

- [ ] Borrower-to-collector contact flow
- [ ] Incentives UI cleanup
- [ ] Expenses UI cleanup
- [ ] Create User Accounts UI cleanup
- [ ] Collector leaderboard / search / collector profile polish
- [ ] Collection analytics page polish
- [ ] Dashboard cleanup and finalization
- [ ] Final frontend/system visual refinement

---

## Disclaimer

SumTrack is being developed as an academic capstone project aligned with a real operational workflow. The repository reflects a working internal system under continued refinement and may still contain evolving schema, business rules, UI adjustments, and implementation details.

It should not be treated as a public, generalized, or fully finalized off-the-shelf product.

---

<div align="center">

**SumTrack**  
*Built for structured multi-branch loan operations, reporting, and internal decision support.*

</div>