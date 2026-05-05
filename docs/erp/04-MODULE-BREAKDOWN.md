# Module Breakdown

**Audience:** Engineering, Architecture, Product  
**Version:** 1.0  
**Related:** [`02-PRD.md`](./02-PRD.md), [`../SAAS_ARCHITECTURE.md`](../SAAS_ARCHITECTURE.md)

---

## 1. Purpose

Describe **logical modules**, **dependencies**, **ownership** (which package/API cluster), and **integration seams** for the modular monolith + SPA.

---

## 2. High-level architecture

```mermaid
flowchart TB
  subgraph SPA[Web SPA]
    Shell[Role shells + routes]
    State[Client state / forms]
  end
  subgraph API[Spring Boot API]
    Auth[JWT + TenantContext]
    Core[Core controllers]
    Acad[Academic / timetable]
    Sub[Subscription + features]
    Pay[Payments / webhooks]
    Ntf[Notifications / events]
  end
  subgraph DB[(PostgreSQL)]
  end
  SPA --> Auth
  Auth --> Core
  Auth --> Acad
  Sub --> Core
  Sub --> Acad
  Pay --> DB
  Core --> DB
  Acad --> DB
  Ntf --> DB
```

---

## 3. Module catalog

| ID | Module | Responsibility | Primary backend | Primary frontend |
|----|--------|----------------|-----------------|-------------------|
| M-PLT | **Platform** | Tenant CRUD, plans, feature catalog, audit, flags, payment settings, metrics | `modules/platform/*`, `AdminSchoolController` | Platform shell routes |
| M-SUB | **Subscription** | Plan ↔ features, tenant subscription, `@RequireFeature` | `modules/subscription/*` | Plans UI, tenant “my plan” |
| M-AUTH | **Auth** | Login, JWT, refresh, OAuth hooks | `modules/auth/*`, `GoogleAuthController` | Login / session |
| M-TNT | **Tenant core** | School profile, theme, management hub | `TenantV1Controller`, `SchoolManagementV1Controller`, `SchoolThemeController` | School management pages |
| M-ONB | **Onboarding** | Wizard state, basic info, academic bootstrap | `SchoolOnboardingV1Controller` + Flyway onboarding tables | Wizard steps |
| M-STD | **Students** | CRUD, guardians, performance (staff) | `StudentController`, `GuardianController`, `StudentPerformanceV1Controller` | Students, performance |
| M-STF | **Staff** | Staff directory, teachables, load | `StaffController` | Staff / user access |
| M-CG | **Class groups** | Sections, grade, capacity, class teacher | `ClassGroupController` | Class groups / modules hub |
| M-SUBJ | **Subjects** | Catalog, types, mappings | `SubjectController` | Subjects module |
| M-RM | **Rooms** | Buildings, floors, rooms | `RoomController` | Rooms module |
| M-ACAD | **Academic structure** | Templates, overrides, allocations (persisted) | Subject/allocation entities + APIs as exposed | Academic structure UI |
| M-STA | **Smart assignment** | Client-side engine + meta persistence pattern | Mostly SPA + DTOs; server persists structure | `SmartTeacherAssignmentBlock` |
| M-TT | **Timetable** | Recurring slots, grid v2, engine, locks | `TimetableSlotV1Controller`, `TimetableGridV2Controller`, `TimetableEngineController` | Timetable rules, grids |
| M-Lec | **Lectures** | One-off sessions | `LectureController` | Lectures |
| M-ATT | **Attendance** | Mode, sessions, marks | `AttendanceController`, `AttendanceService` | Attendance page |
| M-EXM | **Exams** | Academic exams API | `ExamAcademicV1Controller` | Student/staff exam UI |
| M-MRK | **Marks** | Student marks | Marks entities + performance APIs | Class progress |
| M-FEE | **Fees** | Invoices, payments, online intent | `FeeController`, `FeeV1Controller` | Fees pages |
| M-ANN | **Announcements** | School + teacher scoped | `SchoolAnnouncementV1Controller`, `TeacherAnnouncementV1Controller` | Compose + lists |
| M-STU | **Student portal** | Me/* aggregated reads | `StudentPortalV1Controller` | Student shell |
| M-RPT | **Reports** | (Phased) exports / dashboards | TBD heavy queries | Dashboards |

---

## 4. Dependency graph (logical)

- **M-ONB** → M-TNT, M-CG, M-SUBJ (ordering in wizard)  
- **M-ACAD** → M-CG, M-SUBJ, M-STF, M-RM (allocations reference all)  
- **M-STA** → M-ACAD (reads/writes template + override + meta)  
- **M-TT** → M-ACAD, M-STF, M-RM, M-CG  
- **M-ATT** → M-CG, M-STD, M-STF, M-Lec (mode-dependent)  
- **M-EXM** / **M-MRK** → M-STD, M-SUBJ, M-CG  
- **M-FEE** → M-STD, M-SUB  
- **M-STU** → M-TT, M-ATT, M-FEE, M-ANN, M-MRK (read paths)  
- **M-SUB** gates: M-EXM, M-FEE online, advanced features  

---

## 5. Cross-cutting concerns

| Concern | Owners |
|---------|--------|
| Multi-tenancy | All modules via `TenantContext` / school FK |
| Feature flags | M-PLT + M-SUB |
| Audit | M-PLT + domain events on sensitive writes |
| Notifications | Announcements + `InProcessNotificationService` pattern |
| File / theme assets | School branding |

---

## 6. Bounded context notes

- **Academic “effective row”** is a **derived view** (template + overrides + homeroom), not necessarily one table—document in `11-DATA-MODEL.md`.  
- **Smart assignment meta** may live in JSON columns or parallel structures—align implementation with Flyway.

---

## 7. Traceability

Functional specs under `05-FUNCTIONAL-SPECS/` map **FR-** IDs to modules **M-*** above.
