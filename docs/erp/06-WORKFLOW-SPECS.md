# Workflow Specs

**Audience:** Engineering, Product, QA  
**Version:** 1.0  

---

## 1. Purpose

Describe **end-to-end workflows** (actors, steps, branches, persistence touchpoints) for the academic ERP. Use for integration tests and UX acceptance.

**Notation:** `API` = REST call; `UI` = SPA screen; `SYS` = automated job/rule.

---

## 2. WF-ONB-01 — Register tenant (platform)

| Step | Actor | Action | System outcome |
|------|-------|--------|------------------|
| 1 | Platform operator | `UI` Open register school | Form |
| 2 | Operator | Enter name, code, admin email | Validation |
| 3 | Operator | `API` POST create school + admin | Tenant row, user, default subscription bootstrap |
| 4 | SYS | Assign default plan if policy | `tenant_subscriptions` row |
| 5 | Operator | Optional: open school edit | Theme, flags |

**Exit:** School code usable for login / tenant selection.

**Failure:** Duplicate `code` → 409; partial failure → rollback or compensating transaction per implementation.

---

## 3. WF-ONB-02 — School onboarding wizard (tenant)

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Leadership | Complete basic info | `school` onboarding fields persisted |
| 2 | Leadership | Create class groups (grades/sections) | `class_groups` |
| 3 | Leadership | Import or add subjects + mappings | Catalog + template rows |
| 4 | Leadership | Add staff + teachables | `staff`, `staff_teachable_subjects` |
| 5 | Leadership | Set rooms / homerooms | `rooms`, default room per class |
| 6 | Leadership | Run smart assign / manual fixes | Overrides + `assignment_meta` pattern |
| 7 | Leadership | Define recurring timetable | `timetable_*` |
| 8 | Leadership | Mark onboarding complete | Status flag |

**Branches:** CSV import failures → row-level error report; skip optional steps with warnings in checklist.

---

## 4. WF-ACAD-01 — Configure grade template + section override

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Leadership | `UI` Add subject to grade N | `class_subject_config` (template) |
| 2 | Leadership | Set default periods / default teacher / default room | Template row |
| 3 | Leadership | Open section 7-A, override periods or teacher | `subject_section_override` (or equivalent) |
| 4 | SYS | Recompute effective allocations | UI preview rows |

**Conflict:** Total periods > `slotsPerWeek` → warning badge; block save if hard validation enabled.

---

## 5. WF-STA-01 — Smart auto-assign by subject

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Leadership | Open Smart Assignment, filter subject | Demand summary visible |
| 2 | Leadership | Run Auto-assign (subject-scoped) | `runSmartTeacherAssignment(..., 'auto', subjectId)` |
| 3 | SYS | Skip locked/manual-with-teacher slots | Meta unchanged for those keys |
| 4 | SYS | Assign others; set source `auto` / `conflict` | Config + overrides + meta |
| 5 | Leadership | Review warnings (NO_ELIGIBLE_TEACHER, capacity) | Toast + row badges |

**Branch:** Severe shortage gate → block with message (product flag).

---

## 6. WF-STA-02 — Reset slot toward auto

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Leadership | Expand row, click Reset to auto | Slot meta key deleted; override `roomId` nulled for that class+subject |
| 2 | SYS | `runSmartTeacherAssignment(..., 'rebalance', subjectId)` | Teacher + meta refreshed |
| 3 | UI | Room badge not MANUAL unless user picks room again | Assert in QA |

---

## 7. WF-TT-01 — Publish recurring timetable

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Leadership | Define slots per day / recurring rules | Persisted rules |
| 2 | SYS | Generate grid / engine v2 | `timetable_entries` / version |
| 3 | Leadership | Open conflicts panel | List teacher/room/class clashes |
| 4 | Leadership | Adjust rules or locks | `timetable_locks` if used |
| 5 | Teacher | View personal timetable | Filtered by staff |

---

## 8. WF-ATT-01 — Take attendance (daily mode)

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Class teacher | Open attendance, select class + date | Roster |
| 2 | Class teacher | Start session | `attendance_session` |
| 3 | Class teacher | Mark each student PRESENT/ABSENT | Rows validated |
| 4 | Class teacher | Submit / close | Session finalized per policy |

**Branch:** Leadership may mark on behalf (service rule). Wrong class → 403.

---

## 9. WF-FEE-01 — Record payment + optional online intent

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Accountant | Open student fee / invoice | Balances |
| 2 | Accountant | Record offline payment | `fee_payment` |
| 3 | Parent | (If licensed) Start online pay | `POST …/online-intent` requires `fees.online_payments` |
| 4 | SYS | Webhook completes order | Idempotent update |

---

## 10. WF-PRT-01 — Student views week

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Student | Login with linked profile | JWT + student id |
| 2 | Student | `API` schedule / marks / attendance | Scoped to self |
| 3 | UI | Render student shell | No staff APIs |

---

## 11. WF-ANN-01 — Publish school announcement

| Step | Actor | Action | Outcome |
|------|-------|--------|---------|
| 1 | Leadership | Compose, audience = school | Draft |
| 2 | Leadership | Publish | `announcement` + targeting |
| 3 | Students | List + read | `announcement_reads` optional |

---

## 12. Swimlane summary (actors)

| Workflow | Platform | Leadership | Teacher | Accountant | Student | SYS |
|----------|----------|------------|---------|------------|---------|-----|
| WF-ONB-01 | ● | | | | | ● |
| WF-ONB-02 | | ● | ○ | ○ | | ● |
| WF-ATT-01 | | ○ | ● | | | ● |
| WF-FEE-01 | | ○ | | ● | ○ | ● |

● primary · ○ secondary

---

## 13. Traceability

Map each **WF-** to functional spec **FR-** and API **§** in `10-API-CONTRACTS.md` when stabilizing contracts.
