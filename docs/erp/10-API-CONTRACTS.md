# API Contracts (High Level)

**Audience:** Engineering, integrators  
**Version:** 1.0  
**Convention:** Base paths below are **relative** to the API host. Unless noted, requests require `Authorization: Bearer <access_token>`.

---

## 1. Global behaviors

| Topic | Contract |
|-------|----------|
| **Auth** | JWT bearer; refresh via `/api/v1/auth/refresh` |
| **Errors** | JSON body with message; feature gate → stable `FEATURE_NOT_LICENSED` (or project-standard code) |
| **Tenant** | School-scoped users: tenant inferred from token—**do not** accept `schoolId` from body for isolation |
| **Pagination** | Spring `Pageable` query params where `Page` return type (`page`, `size`, `sort`) |
| **Idempotency** | `Idempotency-Key` header supported on selected writes (e.g. fee online intent) |

---

## 2. Auth (`/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Email/password → access + refresh tokens |
| POST | `/refresh` | Rotate access using opaque refresh |
| POST | `/logout` | Invalidate refresh |
| POST | `/password-reset/request` | If implemented |

---

## 3. Platform admin (`/admin/**` and `/api/v1/...` platform modules)

**Prefix:** `/admin/schools/**` and modules under `com.myhaimi.sms.modules.platform.api` (e.g. plans, feature catalog, audit, flags, payment settings, metrics).

| Role | `SUPER_ADMIN` |
|------|---------------|

**Representative:**

| Method | Path pattern | Description |
|--------|--------------|-------------|
| * | `/admin/schools/**` | School CRUD / registration |
| GET/PUT | `/api/v1/platform/plans*` | Plan management |
| GET | `/api/v1/platform/audit*` | Audit log |

*(Full inventory: grep `@RequestMapping` under `modules/platform` and `AdminSchoolController`.)*

---

## 4. Tenant — school management

| Method | Path | Roles (typical) |
|--------|------|-----------------|
| GET | `/api/v1/school/management/overview` | Leadership |
| GET/PUT | `/api/v1/school/management/attendance-settings` | Read: leadership; Write: `SCHOOL_ADMIN`, `PRINCIPAL` |
| GET | `/api/v1/school/management/users` | Leadership |
| PUT | `/api/v1/school/management/users/{id}/roles` | `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL` |

---

## 5. Onboarding

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/v1/onboarding/**` | Wizard persistence, basic info, steps |

---

## 6. Class groups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/class-groups` | Paginated list |
| POST | `/api/class-groups` | Create |
| PUT | `/api/class-groups/{id}` | Update |
| PUT | `/api/class-groups/{id}/class-teacher` | Assign class teacher (leadership) |
| POST | `/api/class-groups/class-teachers/batch` | Batch assign (DTO exists) |

---

## 7. Students & guardians

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/students/**` | CRUD (see `StudentController`) |
| * | `/api/guardians/**` | Guardian linkage |

---

## 8. Staff

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/staff/**` | Directory, teachables, load |

---

## 9. Subjects & rooms

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/subjects/**` | Catalog |
| * | `/api/rooms/**` | Buildings / floors / rooms |

---

## 10. Timetable & teacher

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/v1/timetable/**` | Recurring slots, views |
| * | `/api/v1/teacher/**` | Teacher-specific aggregates |
| * | `/api/timetable-engine/**` | Engine v2 |
| * | `/api/timetable-grid/**` | Grid v2 |

---

## 11. Lectures

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/lectures/**` | One-off lectures |

---

## 12. Attendance

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/attendance/**` | Sessions, marks, settings |

---

## 13. Fees

| Method | Path | Feature gate |
|--------|------|--------------|
| * | `/api/fees/**` or legacy fee controller paths | Billing |
| POST | `/api/v1/fees/invoices/{invoiceId}/online-intent` | `@RequireFeature(FEES_ONLINE_PAYMENTS)` |

**Headers:** `Idempotency-Key` optional on online intent.

---

## 14. Exams (academic)

| Method | Path | Feature gate |
|--------|------|--------------|
| * | `/api/v1/academics/exams/**` (see `ExamAcademicV1Controller`) | `@RequireFeature(ACADEMICS_EXAMS)` |

---

## 15. Student portal

**Base:** `/api/v1/student/me`

| Method | Path |
|--------|------|
| GET | `/schedule`, `/schedule/today` |
| GET | `/marks`, `/exams`, `/subject-attendance` |
| GET | `/announcements`, `/announcements/unread-count`, `/announcements/{id}` |
| POST | `/announcements/{id}/read` |
| GET | `/fee-statement` |

**Role:** `STUDENT` class-level `@PreAuthorize`.

---

## 16. Announcements

| Method | Path | Scope |
|--------|------|-------|
| * | `/api/v1/school/announcements/**` | School-wide (leadership) |
| * | `/api/v1/teacher/announcements/**` | Class-scoped (teachers) |

---

## 17. Performance (staff)

| Method | Path | Note |
|--------|------|------|
| * | `/api/v1/students/**` | `StudentPerformanceV1Controller` — students **blocked** |

---

## 18. Tenant subscription & features

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tenant/subscription/me` | Current plan |
| GET | `/api/v1/tenant/features` | Enabled feature codes |

---

## 19. School theme & branding

| Method | Path | Roles |
|--------|------|-------|
| GET/PUT | `/api/school-theme/**` | Leadership + `SUPER_ADMIN` where allowed |

---

## 20. Payments webhook

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/integrations/payments/webhook` | Provider-specific secret / signature |

---

## 21. DTO stability

- **Public DTOs** used by SPA are part of contract—avoid breaking field renames without version bump.  
- Additive fields OK; removals require deprecation window.

---

## 22. Traceability

Implement OpenAPI/Swagger generation task (if not already) and link from this doc. Update **FEATURES_AND_ROLES** when `@PreAuthorize` changes.
