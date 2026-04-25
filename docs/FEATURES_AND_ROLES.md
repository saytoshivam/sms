# Features & role access

This document inventories **product features** in the SMS app, **which roles** they are aimed at, and how access is enforced (**UI navigation**, **Spring Security**, **subscription features**, and **service rules**).

**Code references:** roles are defined in `com.myhaimi.sms.security.RoleNames`; frontend grouping uses `frontend/src/lib/roleGroups.ts` (`SCHOOL_LEADERSHIP_ROLES`, `TEACHING_ROLES`). The shell layout is in `frontend/src/pages/AppLayout.tsx`.

---

## Security model (how to read this doc)

1. **Authentication:** Most `/api/**` routes require a valid **JWT** (except `/public/**`, OAuth callbacks, health, Swagger, and a few auth endpoints). `SUPER_ADMIN` may have no school in the token; school users get `schoolId` / tenant id in JWT and `TenantContext`.
2. **URL prefix:** `GET/POST … /admin/**` (platform admin REST) requires role **`SUPER_ADMIN`** (`SpringSecurity.java`).
3. **Method security:** Controllers may use `@PreAuthorize("hasRole…")` / `hasAnyRole(…)`.
4. **Plan entitlements:** Some endpoints use `@RequireFeature(…)` (`SubscriptionFeatureCodes`). Missing feature → `403` with `FEATURE_NOT_LICENSED` (`FeatureAccessDeniedException`).
5. **UI vs API:** The SPA shows different **side navs** by role, but **routes are not hard-blocked in React** for every role. Unauthorized actions still fail at the API. Always enforce permissions on the server (as done here).

---

## Canonical roles

| Role | Typical use |
|------|-------------|
| `SUPER_ADMIN` | Platform operator: onboard schools, plans, global catalog, audit, flags |
| `SCHOOL_ADMIN` | School owner / top admin for the tenant |
| `PRINCIPAL` | School head |
| `VICE_PRINCIPAL` | Deputy head |
| `HOD` | Head of department |
| `TEACHER` | Instructional staff |
| `CLASS_TEACHER` | Homeroom / class-in-charge (also instructional) |
| `STUDENT` | Student portal |
| `PARENT` | Parent portal (future-focused in UI) |
| `LIBRARIAN` | Library (nav placeholder) |
| `ACCOUNTANT` | Fees / finance entry |
| `RECEPTIONIST`, `TRANSPORT_MANAGER`, `IT_SUPPORT` | Operational placeholders in nav |
| `COUNSELOR`, `EXAM_COORDINATOR`, `HOSTEL_WARDEN` | Seeded roles for assignment; limited dedicated UI today |

**School leadership (frontend helper):** `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD`.

**Teaching (frontend helper):** `TEACHER`, `CLASS_TEACHER`.

---

## UI shells & navigation (who sees what)

The app picks **one shell** from `AppLayout` (first match wins):

| Shell | Condition (simplified) | Main navigation groups |
|--------|---------------------------|-------------------------|
| **Platform** | `SUPER_ADMIN` and not student-portal mode | Onboard school, payment integrations, platform announcements, audit, plans & entitlements, feature catalog, runtime flags, school theme preview |
| **School leadership** | Has school leadership role, not `SUPER_ADMIN`, not student with linked profile | Dashboard, user access & students, academics (class groups, lectures, timetable, recurring slots), attendance, class progress, fees, school management, school-wide + (optional) class announcements, theme |
| **Teacher-only** | Has teaching role, **not** school leadership, not student portal | Dashboard, students, lectures, timetable, recurring slots, attendance, class progress, class announcements |
| **Student** | `STUDENT` and `linkedStudentId` set | Bottom nav + student routes (schedule, marks, attendance, fees, announcements, etc.) — see student routes below |
| **Parent** | `PARENT` and not matched above | Minimal nav; “coming soon” style messaging for parent features |
| **Fallback staff** | Other school staff (e.g. `ACCOUNTANT`, `LIBRARIAN`, …) | Role-specific shortcuts only (e.g. fees for accountant) |
| **Generic** | No match | Simple outlet only |

**Priority note:** If a user has both **leadership** and **teaching** roles, they get the **school leadership** shell (broader menu).

---

## Frontend routes (`/app/…`)

All routes below require login unless noted. **Any authenticated user** can open a URL directly; the API must authorize the action.

### Platform (`SUPER_ADMIN` menu)

| Route | Feature |
|-------|---------|
| `/app` | Dashboard (platform KPIs) |
| `/app/admin/register-school` | Register / onboard a school |
| `/app/admin/plans-features` | Plans & entitlements |
| `/app/admin/feature-catalog` | Global feature catalog |
| `/app/admin/announcements` | Platform-wide announcements |
| `/app/admin/audit` | Audit log |
| `/app/admin/integrations` | Payment / integration settings |
| `/app/admin/flags` | Runtime feature flags |
| `/app/admin/schools/:schoolId` | Edit a tenant school |
| `/app/school-theme` | School theme preview (also available to school leaders) |

### School staff (leadership or teacher shells — see table above)

| Route | Feature |
|-------|---------|
| `/app` | School dashboard (KPIs) |
| `/app/user-access` | Role & access management (UI; API enforces assigner rules) |
| `/app/students` | Student list / create |
| `/app/class-groups` | Class groups (sections) |
| `/app/lectures` | One-off lectures scheduling |
| `/app/teacher/timetable` | Teacher timetable view |
| `/app/timetable/rules` | Recurring timetable slots |
| `/app/attendance` | Attendance sessions & marking |
| `/app/teacher/class-progress` | Class progress & marks |
| `/app/fees` | Fees & invoices (school finance) |
| `/app/school/management` | School management (overview, attendance mode, users, plan requests) — **leadership shell** |
| `/app/school/announcements/new` | Compose **school-wide** announcement |
| `/app/teacher/announcements/new` | Compose **class-scoped** announcement |
| `/app/students/:studentId/performance` | Staff view of student performance |

### Student portal (`STUDENT` + linked student)

| Route | Feature |
|-------|---------|
| `/app/student/schedule` | Schedule |
| `/app/student/marks` | Marks |
| `/app/student/attendance` | Term attendance summary |
| `/app/student/results`, `/app/student/results/:termSlug` | Results / TGPA |
| `/app/student/exams` | Exams |
| `/app/student/announcements` | Announcements list |
| `/app/student/announcements/:id` | Announcement detail |
| `/app/student/fees` | Fee statement |
| `/app/students/me/performance` | Own performance charts |
| `/app/student/academics` | Academics hub |

### Shared / other

| Route | Feature |
|-------|---------|
| `/app/school-theme` | Branding & theme for school (API allows leadership + `SUPER_ADMIN`) |

---

## Backend API — explicit role restrictions

These are **additional** to “authenticated + tenant context”. Endpoints **without** `@PreAuthorize` still require authentication and rely on **tenant-scoped services** (and sometimes **per-resource** checks inside services).

### Platform admin (`SUPER_ADMIN`)

- `/admin/schools/**` — `AdminSchoolController` (via `SpringSecurity` `/admin/**`).
- Multiple `/api/v1/...` platform controllers: metrics, platform schools, plan CRUD, feature catalog admin, announcement admin, audit, feature flags, payment settings (all `@PreAuthorize("hasRole('SUPER_ADMIN')")` where annotated).

### School management (`/api/v1/school/management`)

| Endpoint area | Roles |
|---------------|--------|
| `GET /overview`, `GET /attendance-settings`, `GET /users`, `GET /subscription/catalog` | `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD` |
| `PUT /attendance-settings` | `SCHOOL_ADMIN`, `PRINCIPAL` |
| `POST /subscription/plan-request` | `SCHOOL_ADMIN` |
| `GET /assignable-roles`, `PUT /users/{id}/roles` | `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL` |

### Announcements

| Controller | Roles |
|------------|--------|
| `SchoolAnnouncementV1Controller` `/api/v1/school/announcements` | Class: `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD` |
| `TeacherAnnouncementV1Controller` `/api/v1/teacher/announcements` | `TEACHER`, `CLASS_TEACHER` |

### Timetable & teacher APIs

| Controller | Roles |
|------------|--------|
| `TimetableSlotV1Controller` `/api/v1/timetable` | `TEACHER`, `CLASS_TEACHER`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD` |
| `TeacherV1Controller` `/api/v1/teacher` (most methods) | Same broad set; **teacher-only** subpaths: `TEACHER`, `CLASS_TEACHER` |

### Class groups

| Method | Roles |
|--------|--------|
| `GET /api/class-groups`, `POST /api/class-groups` | Authenticated tenant users (no class-level `@PreAuthorize`) |
| `PUT /api/class-groups/{id}/class-teacher` | `SCHOOL_ADMIN`, `PRINCIPAL` |

### School theme

- `SchoolThemeController`: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD`.

### Student portal API

- `StudentPortalV1Controller` `/api/v1/student/me/**`: class-level `@PreAuthorize("hasRole('STUDENT')")`.

### Staff / performance

- `StudentPerformanceV1Controller` `/api/v1/students/**`: `@PreAuthorize("!hasRole('STUDENT')")` (students cannot call staff performance APIs).

### Subscription feature gates (`@RequireFeature`)

| Location | Feature code | Effect |
|----------|----------------|--------|
| `FeeV1Controller` `POST …/online-intent` | `fees.online_payments` | Online payment intent |
| `ExamAcademicV1Controller` | `academics.exams` | Exam academic API module |

Other permissions are modeled in `PermissionFeatureGates` / subscription for **future** fine-grained enforcement; not every route uses `@RequireFeature` yet.

---

## Subscription feature codes (plan entitlements)

Defined in `SubscriptionFeatureCodes`:

| Code | Area |
|------|------|
| `core.students` | Core student records |
| `core.attendance` | Attendance |
| `academics.subjects` | Subjects |
| `academics.timetable` | Timetable |
| `academics.exams` | Exams |
| `academics.report_cards_pdf` | Report cards PDF |
| `fees.billing` | Fees / billing |
| `fees.online_payments` | Online fee payments |
| `notifications.email_sms` | Notifications |
| `parent.portal` | Parent portal |
| `analytics.advanced` | Advanced analytics |

Tenant-enabled features are exposed under `GET /api/v1/tenant/features` (see `TenantFeaturesV1Controller`).

---

## Attendance (service-level rules)

Even with API access, **`AttendanceService`** enforces:

- **Daily mode:** class teacher **or** school leadership (`SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `HOD`) for that class.
- **Lecture-wise mode:** lecturer for that slot (staff match or teacher name match) **or** school leadership.
- Marks must be **`PRESENT`** or **`ABSENT`**; student must belong to the session’s class group.

---

## Role assignment (who can assign what)

Configured in `RoleNames`:

| Actor | Can assign |
|-------|------------|
| `SCHOOL_ADMIN` | Full tenant set (`ASSIGNABLE_BY_SCHOOL_OWNER`) including other owners, principals, teachers, students, parents, support roles |
| `PRINCIPAL` | `ASSIGNABLE_BY_PRINCIPAL` (no school owner / principal / student / parent via product rules in service) |
| `VICE_PRINCIPAL` | Typically `TEACHER`, `CLASS_TEACHER` (`ASSIGNABLE_BY_VICE_PRINCIPAL`) |

`SchoolManagementService.updateSchoolUserRoles` enforces **authority level** (cannot modify users at your level or above).

---

## Related docs

- `docs/SAAS_ARCHITECTURE.md` — multi-tenant topology, subscriptions, payments overview.

---

*Generated from repository state; when adding routes or `@PreAuthorize`, update this file.*
