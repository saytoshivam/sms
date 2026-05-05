# Product Requirements Document (PRD)

**Product:** School / College Management System — Multi-Tenant Academic ERP  
**Document type:** PRD (implementation-oriented)  
**Primary audience:** Engineering, Product, QA, Solutions Architecture  
**Version:** 1.0  
**Status:** Draft for build alignment  

**Related:** [`01-PRODUCT-VISION.md`](./01-PRODUCT-VISION.md), [`../SAAS_ARCHITECTURE.md`](../SAAS_ARCHITECTURE.md), [`../FEATURES_AND_ROLES.md`](../FEATURES_AND_ROLES.md)

---

## Document control

| Field | Value |
|--------|--------|
| Requirement ID prefix | `REQ-{MODULE}-{NNN}` |
| Modules | ONB, ACAD, TCH, SUB, STA, CTA, HRA, TT, ATT, EXM, FEE, PRT, RPT, NTF, PLT |
| Change process | PRD amend via PR; breaking API/data changes require version note + migration story |

---

## 1. Executive summary

This PRD defines **what** the academic ERP must deliver for **multi-tenant** schools and colleges: **onboarding**, **academic setup**, **staff and subject mapping**, **automation** for teacher/class teacher/homeroom assignment and **timetable generation**, plus **attendance**, **exams**, **fees**, **portals**, **reports**, and **notifications**. Requirements are **testable**, **tenant-scoped**, and **server-enforced** unless explicitly UI-only.

---

## 2. Product goals

| ID | Goal |
|----|------|
| G-01 | **Single tenant truth** for students, staff, classes, subjects, rooms, schedules, attendance, fees, and assessments. |
| G-02 | **Role- and plan-aware** access: no feature without entitlement; no cross-tenant data paths. |
| G-03 | **Guided onboarding** reducing time-to-value with validation at each gate. |
| G-04 | **Operational automation** for staffing fit (smart teacher assignment, demand summary), homerooms, class teachers, and recurring timetable scaffolding. |
| G-05 | **Family transparency**: portals expose authoritative schedules, fees, attendance, results. |
| G-06 | **Observable failures**: shortages, conflicts, and permission denials are **explicit** (codes, copy, recovery). |

---

## 3. Scope

### 3.1 In scope (core modules)

1. School onboarding  
2. Academic setup (structure, allocations, rooms, catalogs)  
3. Teacher management (staff, teachables, load)  
4. Subject mapping (grade/section templates, overrides)  
5. Smart teacher assignment (+ demand analysis)  
6. Class teacher auto-assignment  
7. Homeroom auto-assignment  
8. Timetable generation (rules, recurring slots, conflict surfacing)  
9. Attendance  
10. Exams  
11. Fees  
12. Parent / student portals  
13. Reports  
14. Notifications  

### 3.2 Out of scope (this PRD cycle)

- Third-party LMS deep integration (export hooks acceptable later).  
- Full accounting GL (fee **operations** in scope; **ledger** depth TBD per phase).  
- Native mobile apps (responsive web in scope).  

### 3.3 Assumptions

- **Authentication:** JWT-based; tenant id in token for school users.  
- **Deployment:** Modular monolith + SPA; REST primary sync API.  
- **Entitlements:** Subscription plan → feature catalog; missing feature → HTTP 403 with stable error code.  

---

## 4. Personas

| Persona | Needs | Primary surfaces |
|---------|--------|-------------------|
| **Platform operator** | Register schools, plans, audits, global config | Platform admin shell |
| **School leadership** | Structure, policy, staffing fit, fees oversight, announcements | School leadership shell |
| **Teacher** | Roster context, timetable, attendance, marks | Teacher shell |
| **Class teacher** | Section identity, homeroom, parent-facing coherence | Leadership or teacher (role combo) |
| **Accountant** | Fees, invoices, collections | Fees + management |
| **Student** | Schedule, marks, attendance, fees, announcements | Student portal |
| **Parent** | Linked children, fees, comms | Parent portal (phased) |

---

## 5. Cross-cutting requirements

### 5.1 Multi-tenancy & security

| ID | Requirement |
|----|----------------|
| REQ-PLT-001 | Every mutating API **must** resolve tenant from trusted auth context; queries **must** filter by tenant (or school id where that is the tenant key). |
| REQ-PLT-002 | **SUPER_ADMIN** platform routes **must not** expose tenant A data when acting on tenant B. |
| REQ-PLT-003 | **Authorization** duplicated in UI for UX only; **server is authoritative** (`@PreAuthorize`, service checks). |
| REQ-PLT-004 | **Subscription feature** gates return stable machine-readable errors for client handling. |

**Failure handling:** 401 unauthenticated; 403 forbidden / feature not licensed; 404 tenant-safe (no existence leak).  

### 5.2 Audit & compliance

| ID | Requirement |
|----|----------------|
| REQ-PLT-010 | Financial and role-assignment mutations **should** emit domain events / audit log entries (minimum: who, when, tenant, entity id). |
| REQ-PLT-011 | PII export/deletion flows **align** with tenant DPA (phased; document in legal appendix). |

### 5.3 Notifications

| ID | Requirement |
|----|----------------|
| REQ-NTF-001 | System supports **school-wide** and **class-scoped** announcements with audience resolution on server. |
| REQ-NTF-002 | Notification pipeline supports **in-process** delivery today with **provider abstraction** for email/SMS later. |
| REQ-NTF-003 | Failures in external channels **must not** roll back core domain transaction unless business rule requires it (prefer async retry). |

**UI states:** draft → published; delivery pending / sent / failed (per channel when added).  

---

## 6. Module requirements

Each subsection follows a common pattern: **Purpose**, **User stories**, **Inputs / Outputs**, **Validations**, **Business rules**, **Automation**, **UI states**, **Failure handling**.

---

### 6.1 School onboarding (`ONB`)

**Purpose:** Create and activate a **tenant school** with baseline catalog, admin user, plan, and guided steps to academic readiness.

**User stories**

- As a **platform operator**, I can register a school with legal/name attributes and initial admin so the tenant can log in.  
- As **school leadership**, I can complete onboarding wizard steps (basic info, structure, staff import) with **clear completion** criteria.

**Inputs:** Organization details, branding/theme preferences, initial users, optional CSV imports.  
**Outputs:** Tenant record, subscription assignment, seeded roles, onboarding checklist state.

**Validations:** Unique school codes/slugs per platform rules; email formats; plan exists.  
**Business rules:** Every school **must** receive a default subscription row if platform policy requires (bootstrap).  
**Automation:** Default feature set from plan; optional demo payment completion in non-prod.  
**UI states:** Step incomplete / complete / blocked (dependency); save pending / success / error.  
**Failure handling:** Partial wizard save with retry; transactional create for tenant + owner where applicable.

| ID | Requirement |
|----|----------------|
| REQ-ONB-001 | Onboarding **checklist** reflects dependencies (e.g. class groups before section subjects). |
| REQ-ONB-002 | **Platform** school edit surfaces are tenant-scoped and auditable. |

---

### 6.2 Academic setup (`ACAD`)

**Purpose:** Define **grades, sections (class groups), subjects, weekly frequencies, default teachers, rooms, homerooms**, and section overrides—source data for timetable and staffing.

**User stories**

- As **leadership**, I configure which subjects run in which grades with default periods/week.  
- As **leadership**, I set **section overrides** (periods, teacher, room) without breaking siblings unintentionally when “uniform” operations apply.

**Inputs:** Catalog subjects, class groups, template rows (`grade × subject`), override rows (`class group × subject`).  
**Outputs:** Effective allocation rows for UI + smart assign; validation warnings (over capacity, missing teacher).

**Validations:** Periods ≤ school weekly slots where configured; positive integers; referenced ids belong to tenant.  
**Business rules:** Effective teacher = override ?? template; effective room = override ?? class default ?? homeroom (per implemented resolution chain).  
**Automation:** Optional bulk homeroom for teaching slots; demand summary block.  
**UI states:** Healthy vs needs-attention rows; expanded slot detail; locks (teacher lock, room lock) visible.  
**Failure handling:** Optimistic UI with server reconciliation; conflict messages for illegal references.

| ID | Requirement |
|----|----------------|
| REQ-ACAD-001 | **Effective allocations** are deterministic from template + overrides + homeroom map. |
| REQ-ACAD-002 | **Teacher demand summary** aggregates required periods per subject vs qualified staff capacity. |
| REQ-ACAD-003 | **Smart teacher assignment** respects locks, manual sources, teachable tags, and capacity scoring. |

---

### 6.3 Teacher management (`TCH`)

**Purpose:** Maintain **staff** as instructional and non-instructional users with **roles**, **teachable subjects**, and **load limits**.

**User stories**

- As **leadership**, I tag teachers with subjects they can teach for eligibility in assignment algorithms.  
- As **leadership**, I set max weekly lecture load where policy requires.

**Inputs:** Staff profile, role assignments, teachable subject ids, optional preferred sections.  
**Outputs:** Staff roster usable by smart assign and demand summary.

**Validations:** TEACHER role required for teachable-driven eligibility (see smart assign parity).  
**Business rules:** Empty teachables ⇒ cannot teach any subject (explicit).  
**Automation:** None mandatory; optional import.  
**UI states:** Directory list, detail edit, validation chips.  
**Failure handling:** Role assignment API errors surfaced; cannot delete staff with blocking FKs without cascade policy.

| ID | Requirement |
|----|----------------|
| REQ-TCH-001 | Staff changes **invalidate** cached assignment previews client-side; server remains source of truth. |

---

### 6.4 Subject mapping (`SUB`)

**Purpose:** Bind **catalog subjects** to **grade templates** and **section availability** with correct naming/codes for reports and UI.

**User stories**

- As **leadership**, I enable/disable subjects per grade and set default periods.  
- As **leadership**, I add section-only subjects when template does not include them.

**Inputs:** Subject catalog, grade template rows, section-only override rows.  
**Outputs:** Rows feeding allocations and exams.

**Validations:** No duplicate template keys per tenant grade+subject; soft-delete behavior consistent in lists.  
**Business rules:** Disabled catalog subjects **must not** appear in new picks (existing rows policy per migration).  
**Automation:** N/A.  
**UI states:** Catalog pickers, disabled badges.  
**Failure handling:** 409 on duplicate keys; graceful downgrade if catalog entry removed.

| ID | Requirement |
|----|----------------|
| REQ-SUB-001 | Subject code/name appear consistently in **demand** and **assignment** UIs. |

---

### 6.5 Smart teacher assignment (`STA`)

**Purpose:** Algorithmically assign or **rebalance** teachers to sections **per subject** with explainable status (auto / manual / rebalanced / conflict) and **workload / cohesion** scoring.

**User stories**

- As **leadership**, I run auto-assign for a subject grade bucket and see **overload** and **no eligible teacher** states.  
- As **leadership**, I **lock** a slot, **clear** teacher, or **reset toward auto** with predictable effects on **both** teacher and room metadata where product specifies.

**Inputs:** Class groups, staff (with teachables), allocations, `assignmentMeta`, optional `slotsPerWeek`, homeroom map.  
**Outputs:** Updated configs/overrides/meta + warnings array.

**Validations:** Block catastrophic assign when **severe shortage** per product rules; respect locks and manual non-empty assignments.  
**Business rules:** Rebalance pass may move non-manual rows; merge meta must not unintentionally resurrect cleared room provenance after reset-to-auto (see product fix spec).  
**Automation:** Two-pass rebalance for overload; teacher demand blocking gate when configured.  
**UI states:** Collapsed strip + expanded detail; badges (MANUAL, REBALANCED, locks); toast on actions.  
**Failure handling:** Warnings array drives banners; partial assignment states visible.

| ID | Requirement |
|----|----------------|
| REQ-STA-001 | **Reset toward auto** for a slot clears **teacher algorithm locks** and returns **room** to inherited resolution unless user re-applies manual room. |
| REQ-STA-002 | **Teacher demand summary** explains capacity vs required per subject for leadership decisions. |

---

### 6.6 Class teacher auto-assignment (`CTA`)

**Purpose:** Assign **class teacher / section owner** for operational and pastoral context.

**User stories**

- As **leadership**, I auto-assign class teachers from rules (e.g. staff tagged to section) with manual override.

**Inputs:** Class groups, staff pool, ruleset (product-defined), current manual selections.  
**Outputs:** `classTeacherByClassId` (or equivalent) + source metadata (auto/manual).

**Validations:** Assigned user must be eligible staff in tenant; one primary class teacher per section unless policy allows job-share (default: one).  
**Business rules:** Manual assignment wins over auto until cleared.  
**Automation:** Idempotent bulk assign endpoint or client orchestration (document in API spec).  
**UI states:** Auto vs manual source badge.  
**Failure handling:** Empty pool → surfaced warning, no silent no-op.

| ID | Requirement |
|----|----------------|
| REQ-CTA-001 | Class teacher changes **audit** who changed assignment when audit module enabled. |

---

### 6.7 Homeroom auto-assignment (`HRA`)

**Purpose:** Bind each section to a **homeroom room** for defaults and bulk teaching-slot room fill.

**User stories**

- As **leadership**, I set homeroom per class group and run **bulk auto** for teaching slots that are not room-locked.

**Inputs:** Room catalog, class groups, per-section homeroom id, teaching slot meta.  
**Outputs:** Homeroom map + optional bulk-updated overrides/meta.

**Validations:** Room belongs to tenant; suitable room type if type system exists.  
**Business rules:** **Room lock** and **manual room source** must exclude slot from destructive bulk resets.  
**Automation:** Bulk assign homeroom to eligible slots.  
**UI states:** Manual vs auto homeroom source per section.  
**Failure handling:** Partial failures listed per section.

| ID | Requirement |
|----|----------------|
| REQ-HRA-001 | Clearing auto homeroom assignments **must** respect **room locks** on slots. |

---

### 6.8 Timetable generation (`TT`)

**Purpose:** Define **recurring slots**, teacher/room/class constraints, and surface **conflicts** for resolution.

**User stories**

- As **leadership**, I define weekly recurring timetable rules.  
- As a **teacher**, I view my personal timetable.  
- As a **student**, I view my section schedule.

**Inputs:** Recurring rules, lectures/one-offs where implemented, calendars.  
**Outputs:** Grid views + conflict list (teacher double-book, room double-book, etc.).

**Validations:** No overlapping immutable slots per resource ruleset; tenant scope.  
**Business rules:** Conflicts are **warnings** vs **hard blocks** per phase (document per endpoint).  
**Automation:** Conflict detection engine (client and/or server per implementation).  
**UI states:** Empty / partial / valid; conflict panel expand/collapse.  
**Failure handling:** Explain which dimension conflicts (teacher, room, class).

| ID | Requirement |
|----|----------------|
| REQ-TT-001 | Student and teacher timetable views **must** only include authorized sections/courses. |

---

### 6.9 Attendance (`ATT`)

**Purpose:** Record **daily or session-based attendance** per institutional mode with teacher workflows.

**User stories**

- As a **teacher**, I start a session and mark students present/absent/late with excuse where required.  
- As **leadership**, I configure attendance **mode** at school level where product supports it.

**Inputs:** Session metadata, student roster for section, marks.  
**Outputs:** Persisted attendance rows, summaries for portals.

**Validations:** Roster frozen per session policy; cannot mark students not in section.  
**Business rules:** Attendance mode drives available statuses and locks.  
**Automation:** Optional reminders (notification module).  
**UI states:** Open session / submitted / read-only after lock.  
**Failure handling:** Retry on stale roster; concurrent teacher edits resolved per last-write or row lock policy (specify in TT/ATT technical spec).

| ID | Requirement |
|----|----------------|
| REQ-ATT-001 | Student portal attendance **read** reflects server aggregates only. |

---

### 6.10 Exams (`EXM`)

**Purpose:** Plan exams, rooms, seating, and surface **results** to staff and students per entitlement.

**User stories**

- As **leadership**, I schedule an exam with scope and rooms.  
- As a **student**, I see my exam timetable when feature licensed.

**Inputs:** Exam definitions, classes, rooms, seating rules.  
**Outputs:** Exam sessions, student-facing lists.

**Validations:** Feature gate; tenant dates; capacity.  
**Business rules:** Published exams immutable without supervisor role (configurable).  
**Automation:** Seat assignment algorithm (phase-dependent).  
**UI states:** Draft / published / completed.  
**Failure handling:** 403 when feature not in plan.

| ID | Requirement |
|----|----------------|
| REQ-EXM-001 | Exam endpoints **must** use `@RequireFeature` (or equivalent) consistently with UI. |

---

### 6.11 Fees (`FEE`)

**Purpose:** Manage **fee structures**, **invoices**, **payments** (including online order flow where implemented), and **statements**.

**User stories**

- As **accountant**, I record charges and payments per student.  
- As a **parent/student**, I view statement and pay online when gateway enabled.

**Inputs:** Fee heads, amounts, due dates, payment webhooks.  
**Outputs:** Ledger-like rows suitable for statement PDF/UI; payment status.

**Validations:** Positive money rules; currency; tenant on every transaction.  
**Business rules:** Webhook idempotency keys; no double-post on replay.  
**Automation:** Demo auto-complete in non-prod (config flag).  
**UI states:** Due / partial / paid / overdue.  
**Failure handling:** Payment pending vs failed; staff-visible reconciliation tools.

| ID | Requirement |
|----|----------------|
| REQ-FEE-001 | All fee mutations **tenant-scoped**; financial audit events recommended. |

---

### 6.12 Parent / student portals (`PRT`)

**Purpose:** **Read-mostly** (and limited self-service where allowed) experiences for learners and guardians.

**User stories**

- As a **student**, I see schedule, marks, attendance summary, fees, announcements.  
- As a **parent**, I see linked children and (phased) consolidated comms/fees.

**Inputs:** JWT with linked student/parent identity.  
**Outputs:** Aggregated DTOs per surface.

**Validations:** Linked profile required for student deep routes; parent-child linkage enforced server-side.  
**Business rules:** Students never read other students’ PII.  
**Automation:** N/A.  
**UI states:** Linked vs unlink pending; empty states with next steps.  
**Failure handling:** Gentle empty states; 403 for wrong role.

| ID | Requirement |
|----|----------------|
| REQ-PRT-001 | Portal shells **must** differ from staff shells; route depth blocked at API if user navigates manually. |

---

### 6.13 Reports (`RPT`)

**Purpose:** **Exportable** and on-screen aggregates for compliance and operations.

**User stories**

- As **leadership**, I export attendance and fee summaries per date range (phase-dependent).

**Inputs:** Filters (date range, section, subject).  
**Outputs:** CSV/PDF or HTML tables per phase.

**Validations:** Max range limits to protect DB.  
**Business rules:** Async for heavy reports (recommended).  
**Automation:** Scheduled reports (roadmap).  
**UI states:** Running / ready / failed.  
**Failure handling:** Timeout with job id when async.

| ID | Requirement |
|----|----------------|
| REQ-RPT-001 | Report queries **must** include tenant predicates. |

---

## 7. Non-functional requirements

| ID | Category | Requirement |
|----|----------|----------------|
| REQ-NFR-001 | Performance | p95 read APIs for portal dashboards < **500 ms** at reference load (define in perf test doc). |
| REQ-NFR-002 | Performance | Bulk academic writes batched or paginated; avoid O(n²) naive loops on large rosters. |
| REQ-NFR-003 | Security | OWASP ASVS alignment for auth, injection, SSRF on webhooks (webhook URL allowlist where applicable). |
| REQ-NFR-004 | Reliability | Health checks for load balancers; DB migration backward-compatible N-1 where possible. |
| REQ-NFR-005 | Observability | Structured logs with **tenant id** and **correlation id** on requests. |
| REQ-NFR-006 | Accessibility | Staff primary flows keyboard-navigable; WCAG AA target for student portal. |

---

## 8. Dependencies & integrations

| Dependency | Usage |
|------------|--------|
| **SMTP / SMS provider** | Future notifications |
| **Payment gateway** | Online fees; webhook ingestion |
| **Object storage** | Optional document uploads (reports, attachments) |

---

## 9. Acceptance criteria (global)

- All **REQ-PLT-*** items verifiable via security tests and static scan for missing tenant filters.  
- All **REQ-EXM-001**, **REQ-FEE-001** verifiable via contract tests for 403 paths.  
- **Smart assignment:** integration-style tests for lock/manual/rebalance/reset flows per `REQ-STA-*`.  

---

## 10. Release phasing (recommended)

| Phase | Contents |
|-------|----------|
| **P0** | Tenancy, auth, onboarding shell, class groups, basic academics, staff, attendance MVP, fees MVP. |
| **P1** | Smart assign + demand summary, homeroom/class teacher automation, timetable rules + conflicts, student portal polish. |
| **P2** | Exams depth, parent portal, reports/async, external notifications. |

---

## 11. Open questions (for PM/engineering triage)

1. **Concurrent editing** on same section subject row: OT vs last-write vs optimistic locking?  
2. **Academic year** as first-class entity vs inferred from dates?  
3. **Multi-campus** within one tenant: single vs multiple timetables?  

---

## 12. Traceability — specification suite

| This PRD area | Detail in |
|---------------|-----------|
| Roles matrix | [`03-USER-ROLES-AND-PERMISSIONS.md`](./03-USER-ROLES-AND-PERMISSIONS.md) |
| Module boundaries & dependencies | [`04-MODULE-BREAKDOWN.md`](./04-MODULE-BREAKDOWN.md) |
| Per-feature FRDs | [`05-FUNCTIONAL-SPECS/README.md`](./05-FUNCTIONAL-SPECS/README.md) |
| Swimlanes | [`06-WORKFLOW-SPECS.md`](./06-WORKFLOW-SPECS.md) |
| Field-level validation | [`07-VALIDATION-RULES.md`](./07-VALIDATION-RULES.md) |
| Algorithm & scoring | [`08-BUSINESS-LOGIC-RULES.md`](./08-BUSINESS-LOGIC-RULES.md) |
| Negative paths | [`09-EDGE-CASES.md`](./09-EDGE-CASES.md) |
| REST DTOs & errors | [`10-API-CONTRACTS.md`](./10-API-CONTRACTS.md) |
| Tables & relations | [`11-DATA-MODEL.md`](./11-DATA-MODEL.md) |
| Screens & states | [`12-UI-BEHAVIOR-SPECS.md`](./12-UI-BEHAVIOR-SPECS.md) |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Tenant** | School/college account boundary (`school_id` / tenant id in token). |
| **Class group** | Section (e.g. “7 A”). |
| **Template** | Grade-level default subject row. |
| **Override** | Section-specific deviation (periods, teacher, room). |
| **Assignment meta** | Per-slot UX/source/lock state for smart assignment. |
| **Entitlement** | Subscription feature flag gating module APIs. |
