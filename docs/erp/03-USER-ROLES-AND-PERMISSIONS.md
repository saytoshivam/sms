# User Roles & Permissions

**Audience:** Engineering, Security, Product, QA  
**Version:** 1.0  
**Related:** [`../FEATURES_AND_ROLES.md`](../FEATURES_AND_ROLES.md), [`02-PRD.md`](./02-PRD.md), `PermissionFeatureGates`, `RoleNames`, `SpringSecurity`

---

## 1. Purpose

Define **who can do what** across platform and tenant scopes: **authentication**, **role-based access control (RBAC)**, **subscription feature entitlements**, and **service-level rules** where controllers do not fully express policy.

---

## 2. Security layers (apply in order)

| Layer | Mechanism | Failure |
|-------|-----------|---------|
| **L1** | JWT required for `/api/**` (except documented public routes) | 401 |
| **L2** | `TenantContext` / `schoolId` on school users; platform operator may have null tenant | Tenant mismatch → 403 or empty safe results |
| **L3** | `@PreAuthorize` on controller/method | 403 |
| **L4** | `@RequireFeature(code)` subscription gate | 403 `FEATURE_NOT_LICENSED` |
| **L5** | Permission matrix (`PermissionFeatureGates`) for fine-grained capability codes | Future: unified enforcement |
| **L6** | Service rules (e.g. `AttendanceService` who may mark) | 403 / 400 with message |

**Rule:** UI shell selection is **not** a security boundary. **Always** enforce L2–L6 on server.

---

## 3. Canonical roles

Stored as `roles.name` (see `RoleNames.java`).

| Role code | Typical persona |
|-----------|-----------------|
| `SUPER_ADMIN` | Platform operator |
| `SCHOOL_ADMIN` | School owner / top tenant admin |
| `PRINCIPAL` | Head of school |
| `VICE_PRINCIPAL` | Deputy |
| `HOD` | Head of department |
| `TEACHER` | Instructional staff |
| `CLASS_TEACHER` | Section/class in charge |
| `STUDENT` | Learner portal |
| `PARENT` | Guardian portal |
| `ACCOUNTANT` | Fees |
| `LIBRARIAN`, `RECEPTIONIST`, `TRANSPORT_MANAGER`, `IT_SUPPORT` | Operations |
| `COUNSELOR`, `EXAM_COORDINATOR`, `HOSTEL_WARDEN` | Specialist (often limited dedicated UI) |

**Frontend groupings (UX only):** School leadership = `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD`. Teaching = `TEACHER`, `CLASS_TEACHER`. Leadership shell wins if user has both leadership and teaching.

---

## 4. Platform vs tenant API surface

| Prefix / controller | Who |
|---------------------|-----|
| `/admin/**` REST (e.g. `AdminSchoolController`) | `SUPER_ADMIN` |
| `/api/v1/...` platform modules (plans, feature catalog, audit, flags, payment settings, metrics) | `SUPER_ADMIN` (per-method annotations) |
| `/api/v1/school/**`, `/api/v1/teacher/**`, `/api/class-groups`, etc. | Authenticated tenant users; further restricted per endpoint |

---

## 5. Endpoint-level matrix (summary)

> **Full route table:** maintain alongside [`../FEATURES_AND_ROLES.md`](../FEATURES_AND_ROLES.md) when adding controllers.

| Area | Roles (typical) | Notes |
|------|-----------------|-------|
| **School management** `/api/v1/school/management/*` | Leadership: overview, attendance settings **read**; `SCHOOL_ADMIN`+ for some writes; role assignment: `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL` | See FEATURES_AND_ROLES table |
| **School announcements** `/api/v1/school/announcements` | `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD` | School-wide |
| **Teacher announcements** `/api/v1/teacher/announcements` | `TEACHER`, `CLASS_TEACHER` | Class-scoped |
| **Timetable** `/api/v1/timetable` | Teaching + leadership | |
| **Teacher APIs** `/api/v1/teacher` | Broad; teacher-only subpaths restricted | |
| **Class groups** `GET/POST /api/class-groups` | Authenticated tenant | `PUT …/class-teacher` leadership |
| **School theme** | `SUPER_ADMIN` + leadership | |
| **Student portal** `/api/v1/student/me/**` | `STUDENT` only | Linked student profile |
| **Staff performance** `/api/v1/students/**` (performance) | `!STUDENT` | Students blocked |

---

## 6. Subscription feature codes

Canonical strings (`SubscriptionFeatureCodes` = DB seed alignment):

| Code | Product area |
|------|----------------|
| `core.students` | Student records / portal profile |
| `core.attendance` | Attendance |
| `academics.subjects` | Subjects & academic structure |
| `academics.timetable` | Timetable |
| `academics.exams` | Exams (controller gated) |
| `academics.report_cards_pdf` | Report cards PDF |
| `fees.billing` | Fees / billing |
| `fees.online_payments` | Online payment intent (`FeeV1Controller`) |
| `notifications.email_sms` | External notifications |
| `parent.portal` | Parent portal capabilities |
| `analytics.advanced` | Advanced reporting |

**Tenant resolution:** `GET /api/v1/tenant/features` exposes enabled set for SPA.

---

## 7. Role assignment authority

| Actor | May assign roles (subset) |
|-------|---------------------------|
| `SCHOOL_ADMIN` | `ASSIGNABLE_BY_SCHOOL_OWNER` (excludes `SUPER_ADMIN`) |
| `PRINCIPAL` | `ASSIGNABLE_BY_PRINCIPAL` (no owner/principal/student/parent per product rules) |
| `VICE_PRINCIPAL` | `ASSIGNABLE_BY_VICE_PRINCIPAL` (typically teachers/class teachers) |

`SchoolManagementService.updateSchoolUserRoles`: cannot modify users at **same or higher** authority level than actor.

---

## 8. Attendance service rules (representative L6)

| Mode | Who may mark |
|------|----------------|
| **Daily** | Class teacher **or** school leadership for that class |
| **Lecture-wise** | Lecturer for slot (staff match) **or** school leadership |

**Marks:** `PRESENT` or `ABSENT` only (enforced in service). Student must belong to session’s class group.

---

## 9. Permission codes (future / matrix)

`PermissionCodes` + `PermissionFeatureGates` map **capability** → **subscription feature**. Use when building unified policy engine or ABAC. Not every API checks permission codes today—**close gaps** by aligning new endpoints with gates.

---

## 10. Student / parent linkage

| Role | Requirement |
|------|-------------|
| `STUDENT` | `linkedStudentId` (or equivalent) for deep portal routes |
| `PARENT` | Child linkage enforced server-side for child-scoped reads |

---

## 11. Failure & audit expectations

| Event | Response |
|-------|----------|
| Missing JWT | 401 |
| Wrong role | 403 |
| Missing feature on plan | 403 + stable error code for SPA |
| Tenant isolation violation attempt | 403 + log (never return other tenant payload) |

Sensitive mutations (roles, fees, payments) → domain events / audit rows where implemented.

---

## 12. Traceability

| PRD | This doc |
|-----|----------|
| REQ-PLT-001–004 | §2, §5, §11 |
| REQ-ATT-001 | §8 |
| REQ-EXM-001, REQ-FEE-001 | §6 |
