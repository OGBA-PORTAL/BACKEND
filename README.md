# Royal Ambassadors Examination Portal – Backend API

## Overview

This repository contains the backend API for the Royal Ambassadors Examination & Management Portal for Ogbomoso Goshen Baptist Association (OGBA).

The backend is the single source of truth for:

- Authentication & authorization
- RA identity & rank enforcement
- Exam eligibility and grading
- Promotion logic
- Data integrity
- Security & audit logging

⚠️ **No business rules must live in the frontend.**  
If a rule matters, it belongs here.

---

## Core Philosophy

- Backend decides, frontend displays
- Discipline over convenience
- Data integrity > speed
- No silent overrides
- Everything auditable

This system represents an official Christian organization.  
**Integrity is non-negotiable.**

---

## Tech Stack

- **Runtime**: Node.js (LTS)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma (or equivalent strict ORM)
- **Authentication**: HTTP-only cookies + JWT
- **Password Hashing**: bcrypt / argon2
- **Validation**: Zod / Joi
- **Logging**: Winston / Pino
- **Hosting**: Linux-based cloud infrastructure

---

## System Roles (Backend-Authoritative)

Roles are enforced here, not inferred.

**Roles:**

- `RA`
- `CHURCH_ADMIN`
- `ASSOCIATION_OFFICER`
- `SYSTEM_ADMIN`

Every protected endpoint must check:

- Authentication
- Role
- Church scope (where applicable)

---

## High-Level Architecture

```
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── churches/
│   │   ├── ranks/
│   │   ├── exams/
│   │   ├── attempts/
│   │   ├── promotions/
│   │   ├── announcements/
│   │   ├── materials/
│   │   └── audit/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   └── types/
├── prisma/
│   └── schema.prisma
├── tests/
└── README.md
```

---

## Identity & RA Number System

### RA Number Format (Permanent)

```
RA/OGBA/CCC/YYYY/NNNN
```

**Where:**

- `RA` → Royal Ambassadors
- `OGBA` → Association code
- `CCC` → Church code (3 letters)
- `YYYY` → Entry year
- `NNNN` → Sequential number (per church, per year)

### RA Number Generation Algorithm

Executed only on backend, inside a transaction:

1. Retrieve association code
2. Retrieve church code
3. Determine current year
4. Fetch last sequence number for church + year
5. Increment sequence
6. Zero-pad to 4 digits
7. Construct RA number
8. Persist and lock permanently

❌ No edits  
❌ No reuse  
❌ No manual overrides

---

## Authentication System

### Login

- RA Number + Password
- Passwords are hashed
- Failed attempts are rate-limited
- Secure HTTP-only cookies set on success

### Account Activation

- RA Number + one-time activation code
- Password set once
- Account status becomes `ACTIVE`

### Account States

- `PENDING_ACTIVATION`
- `ACTIVE`
- `SUSPENDED`

Suspended accounts cannot authenticate.

---

## Authorization (RBAC)

Authorization is mandatory on every protected route.

**Examples:**

- RA cannot access admin routes
- Church Admin can only manage their church
- Association Officers can manage all churches
- System Admin cannot manipulate exams or ranks

Authorization failures return **403**, not silent ignores.

---

## User Management Rules

### RA (Student)

- Read-only identity
- Can attempt eligible exams
- Can view own results

### Church Admin

- Register RAs for own church
- Activate / suspend members
- Cannot edit ranks
- Cannot create exams

### Association Officer

- Create & manage exams
- Approve promotions
- Manage churches & admins
- Publish announcements

---

## Rank System

- Ranks are predefined and ordered
- Rank progression is linear
- No skipping ranks
- Rank change happens only through promotion logic

**Backend enforces:**

- Exam eligibility
- Rank visibility
- Promotion eligibility

---

## Examination Engine (Critical Module)

### Exam Rules

- Exam is tied to exactly one rank
- Exam has:
  - Duration
  - Pass mark
  - Availability window
- Only one active attempt per RA per exam

### Exam Flow

1. RA requests exam start
2. Backend validates eligibility
3. Attempt record created
4. Timer enforced server-side
5. Answers submitted
6. Auto-grading occurs
7. Result stored as immutable record

**Frontend never controls:**

- Time
- Scoring
- Eligibility

---

## Promotion Logic

Promotion requires:

- Passed exam
- No existing promotion for that rank
- Association Officer approval (configurable)

**Promotion updates:**

- `current_rank`
- Promotion history
- Unlocks next exam set

All promotions are logged.

---

## Content Management

### Announcements

- Time-bound
- Role / rank / church targeted
- Read-only to RAs

### Materials

- Rank-restricted visibility
- Versioned
- No deletion without audit trail

---

## Audit Logging (Non-Negotiable)

Every sensitive action logs:

- Actor ID
- Role
- Action
- Target
- Timestamp

**Examples:**

- Exam submission
- Rank promotion
- Account suspension
- Exam creation

Logs are immutable.

---

## Database Design Principles

- Strict foreign keys
- No cascading deletes on critical data
- Soft deletes where necessary
- Transactional writes for exams & promotions

### Core Tables

- `users`
- `churches`
- `associations`
- `ranks`
- `exams`
- `questions`
- `exam_attempts`
- `promotions`
- `announcements`
- `materials`
- `audit_logs`

---

## API Design Rules

Endpoints represent state, not commands.

**Good:**

```
GET /me
GET /exams/available
POST /exams/:id/start
```

**Bad:**

```
/promote-user
/force-pass-exam
```

Backend decides outcomes.

---

## Validation & Error Handling

- All inputs validated
- No trust in client payloads
- Clear error messages
- No stack traces in production

---

## Security Requirements

**Mandatory:**

- Password hashing
- Rate limiting
- SQL injection protection
- CSRF protection
- Secure cookies
- HTTPS only
- Environment-based secrets

---

## Environment Variables

```
DATABASE_URL=<postgres-connection-string>
JWT_SECRET=<strong-secret>
COOKIE_SECRET=<strong-secret>
NODE_ENV=<development|production>
```

Secrets are never committed.

---

## Development Setup

```bash
git clone https://github.com/<org>/ra-portal-backend.git
cd ra-portal-backend
npm install
npm run dev
```

---

## Testing Expectations

- Unit tests for business logic
- Integration tests for exams
- Auth & permission tests mandatory
- No untested promotion logic

---

## Deployment Rules

- Migrations reviewed before deploy
- Logs enabled
- Backups scheduled
- No direct DB manipulation in production

---

## Governance & Ownership

This backend is an official system of:

- Ogbomoso Goshen Baptist Association (OGBA)
- Royal Ambassadors Leadership

Unauthorized modifications are prohibited.

---

## Final Warning (Read This Twice)

This backend is not a CRUD app.  
**It is an authority system.**

If a rule is bypassed here,  
the entire organization is compromised.

**Build with fear, discipline, and clarity.**
