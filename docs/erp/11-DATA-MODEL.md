# Database Entity Definitions

**Audience:** Engineering, DBAs  
**Version:** 1.0  
**Source of truth:** Flyway migrations under `src/main/resources/db/migration/` + JPA entities under `com.myhaimi.sms.entity`.

---

## 1. Purpose

Summarize **tables/entities**, **keys**, and **relationships** for onboarding engineers. Column-level detail: read Flyway for exact nullability and indexes.

---

## 2. Tenancy model

| Pattern | Description |
|---------|-------------|
| **School FK** | Most business tables reference `schools.id` (tenant boundary). |
| **User** | `users.school_id` nullable for platform users. |
| **Future** | Optional `tenant_id` normalization on all rows (see `SAAS_ARCHITECTURE.md`). |

---

## 3. Core identity & access

| Table | Entity | Notes |
|-------|--------|-------|
| `schools` | `School` | Tenant root; `code` unique; theme colors |
| `users` | `User` | Auth identity; `email` unique |
| `roles` | `Role` | Role catalog |
| *user_roles / join* | *(see migration)* | Many-to-many user ↔ role |

**Subscription (platform):**

| Area | Tables (representative) |
|------|-------------------------|
| Plans | `subscription_plans`, `subscription_features`, `subscription_plan_features` |
| Tenant sub | `tenant_subscriptions` |

---

## 4. People

| Table | Entity | Notes |
|-------|--------|-------|
| `students` | `Student` | Belongs to school; link to user optional |
| `guardians` | `Guardian` | Parent/guardian records |
| `staff` | `Staff` | Employee; teachables via join |
| `staff_teachable_subjects` | `StaffTeachableSubject` | M:N staff ↔ subject |

---

## 5. Academic catalog & structure

| Table | Entity | Notes |
|-------|--------|-------|
| `subjects` | `Subject` | Catalog per school |
| `class_groups` | `ClassGroup` | Section; grade, capacity, default room |
| `class_subject_configs` | `ClassSubjectConfig` | **Grade template** `(school_id, grade_level, subject_id)` unique |
| `subject_section_overrides` | `SubjectSectionOverride` | **Section override** `(subject_id, class_group_id)` unique |
| `subject_class_mappings` | `SubjectClassMapping` | Legacy/alternate mapping (see migrations) |
| `subject_allocations` | `SubjectAllocation` | Allocation rows as modeled |
| `subject_class_groups` | `SubjectClassGroup` | Join / section enablement |

**Onboarding metadata:** tables from `V20260420000002__school_onboarding_basic_info.sql` etc.

---

## 6. Rooms & buildings

| Table | Entity |
|-------|--------|
| `buildings` | `Building` |
| `floors` | `Floor` |
| `rooms` | `Room` |

---

## 7. Timetable

| Table | Entity | Notes |
|-------|--------|-------|
| `timetable_slots` | `TimetableSlot` | Recurring definition |
| `timetable_entries` | `TimetableEntry` | Cell placement |
| `timetable_versions` | `TimetableVersion` | Versioning |
| `timetable_locks` | `TimetableLock` | Manual locks |
| `school_time_slots` | `SchoolTimeSlot` | Master grid windows |
| `lectures` | `Lecture` | One-off |

---

## 8. Attendance

| Table | Entity |
|-------|--------|
| `attendance_sessions` | `AttendanceSession` |
| `student_attendance` | `StudentAttendance` |

**Enums:** `AttendanceMode` (school setting).

---

## 9. Assessment

| Table | Entity |
|-------|--------|
| `student_marks` | `StudentMark` | Unique `(school_id, student_id, subject_code, assessment_key)` |

---

## 10. Fees

| Table | Entity |
|-------|--------|
| `fee_invoices` | `FeeInvoice` |
| `fee_payments` | `FeePayment` |

**Online orders:** see payment-related migrations (`payments`, webhooks).

---

## 11. Communications

| Table | Entity |
|-------|--------|
| `announcements` | `Announcement` |
| `announcement_reads` | `AnnouncementRead` |
| `announcement_target_classes` | `AnnouncementTargetClass` |

---

## 12. Soft delete & audit

Migrations reference **soft delete** and **audit** columns on master data (`V20260425000001__audit_and_soft_delete_master_data.sql`, `staff_audit…`). Pattern: `deleted_at`, `updated_by`, etc.—confirm per table in Flyway.

---

## 13. ER diagram (conceptual)

```
schools 1──* users
schools 1──* students
schools 1──* staff
schools 1──* subjects
schools 1──* class_groups

class_groups 1──* subject_section_overrides
subjects     1──* subject_section_overrides

schools 1──* class_subject_configs
subjects 1──* class_subject_configs

class_groups *──* timetable_entries (via slots/versions)
staff *──* timetable_entries
rooms *──* timetable_entries
```

---

## 14. JSON / document columns

**Assignment meta / academic JSON** (if present): version schema in functional spec for smart assign; validate on write.

---

## 15. Migration discipline

- Forward-only Flyway.  
- Backfill scripts for new NOT NULL columns.  
- Large tables: index `(school_id, …)` for list APIs.

---

## 16. Traceability

Entity change → update this doc + `10-API-CONTRACTS.md` if DTO surface changes.
