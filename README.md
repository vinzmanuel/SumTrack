<div align="center">

# SumTrack

### *An Integrated Loan Management and Employee Performance System for Sum Finance Services Corp.*

**Status:** In Development
**Type:** Capstone Project
**Scope:** Multi-Branch Loan Management, Collections, and Employee Operations

</div>

---

## Overview

**SumTrack** is a web-based system designed to support the day-to-day lending and operational workflows of **Sum Finance Services Corp.** It is intended to centralize borrower management, employee assignments, loan creation, collection recording, and branch-level monitoring into one structured platform.

Rather than relying on fragmented manual processes, SumTrack is intended to provide a more organized, traceable, and scalable way to manage financial operations across the company.

---

## Current Status

This project is **currently in active development** and is being built as a **capstone system**.

At its current stage, the repository reflects an evolving implementation and is **not yet finalized for production deployment**. Features, workflows, schema, and UI may still change as the system continues to be refined.

---

## Tech Stack

| Layer          | Technology               |
| -------------- | ------------------------ |
| Frontend / App | **Next.js (App Router)** |
| Language       | **TypeScript**           |
| Styling        | **Tailwind CSS**         |
| UI Components  | **shadcn/ui**            |
| Authentication | **Supabase Auth**        |
| Database       | **Supabase Postgres**    |
| ORM / DB Layer | **Drizzle ORM**          |
| File Storage   | **Supabase Storage**     |
| Hosting Target | **Vercel**               |

---

## Architecture Notes

The project currently follows this structure:

* **Supabase Auth** handles login, session management, and auth user provisioning
* **Supabase Storage** is reserved for file storage and document uploads
* **Supabase Postgres** is the live database
* **Drizzle ORM** is used as the application database layer
* **Next.js server actions and route handlers** act as the backend logic layer
* **internal UUIDs** remain the true system identifiers
* **human-facing business IDs/codes** are stored separately for operational use

---

## Roadmap

- [x] Integrate Drizzle ORM
- [x] Implement area-aware borrower and collector logic
- [x] Add company ID generation
- [x] Add loan code generation
- [x] Add collection code generation
- [x] Expenses module
- [x] Incentives module
- [ ] Reports and analytics
- [x] Branch-level restricted workflows
- [x] File/document handling improvements
- [ ] UI polish and production hardening

---

## Development Notes

This repository is currently intended for:

* development
* testing
* prototyping
* academic/capstone presentation

It should be treated as an **active work-in-progress** rather than a finished production system.

---

## Disclaimer

This project is currently under active development and may contain incomplete features, changing schema decisions, temporary logic, or unfinished workflows. It is being developed for academic and system prototyping purposes and is **not yet finalized for production use**.

No public reuse, redistribution, or production deployment assumptions should be made based solely on the current state of this repository.

---

<div align="center">

**SumTrack**
*Built as a capstone project for a real-world multi-branch finance workflow.*

</div>
