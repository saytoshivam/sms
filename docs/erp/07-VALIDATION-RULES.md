# Validation Rules

**Audience:** Engineering, QA  
**Version:** 1.0  
**Related:** [`08-BUSINESS-LOGIC-RULES.md`](./08-BUSINESS-LOGIC-RULES.md), `05-FUNCTIONAL-SPECS/*`

---

## 1. Purpose

Field- and aggregate-level **validation** rules: **client** (UX fast feedback) and **server** (authoritative). **Server rules win.**

---

## 2. Conventions

| Severity | Behavior |
|----------|----------|
| **HARD** | Reject request (400) / block save |
| **SOFT** | Allow save with warning flag returned in DTO |
| **INFO** | UI-only hint |

All IDs must belong to **same tenant** as JWT (HARD).

---

## 3. Tenant & auth

| ID | Rule | Layer | Severity |
|----|------|-------|----------|
| VAL-AUTH-01 | JWT subject must match user row | Server | HARD |
| VAL-TNT-01 | Mutations include implicit or explicit `schoolId` resolved from context only—never trust client tenant id for isolation | Server | HARD |
| VAL-TNT-02 | `SUPER_ADMIN` platform writes must target `schoolId` path param validated | Server | HARD |

---

## 4. School / onboarding

| ID | Field / aggregate | Rule | Severity |
|----|-------------------|------|----------|
| VAL-SCH-01 | `school.code` | Unique platform-wide; `^[a-z0-9-]{1,64}$` (align with DB) | HARD |
| VAL-SCH-02 | `name` | Non-empty, max length per column | HARD |
| VAL-SCH-03 | Theme colors | Valid hex `#RRGGBB` | HARD |

---

## 5. Class groups

| ID | Rule | Severity |
|----|------|----------|
| VAL-CG-01 | `gradeLevel` numeric within institution policy (e.g. 1–12) | HARD |
| VAL-CG-02 | `section` / `code` uniqueness per school policy | HARD or SOFT |
| VAL-CG-03 | `capacity` ≥ 1 if present | HARD |

---

## 6. Subjects & catalog

| ID | Rule | Severity |
|----|------|----------|
| VAL-SUB-01 | Subject name non-empty | HARD |
| VAL-SUB-02 | Code unique per tenant where unique constraint exists | HARD |
| VAL-SUB-03 | Weekly frequency > 0 for active allocation rows | HARD |
| VAL-SUB-04 | `periodsPerWeek` ≤ `school.slotsPerWeek` when latter set | SOFT (warn) or HARD (config) |

---

## 7. Staff

| ID | Rule | Severity |
|----|------|----------|
| VAL-STF-01 | Email unique per tenant (if enforced) | HARD |
| VAL-STF-02 | `maxWeeklyLectureLoad` > 0 when set, ≤ reasonable cap (e.g. 60) | HARD |
| VAL-STF-03 | `teachableSubjectIds` each id must exist in tenant subject catalog | HARD |

---

## 8. Rooms

| ID | Rule | Severity |
|----|------|----------|
| VAL-RM-01 | Room belongs to tenant’s building | HARD |
| VAL-RM-02 | `schedulable` / floor fields per schema nullable rules | HARD |

---

## 9. Academic overrides

| ID | Rule | Severity |
|----|------|----------|
| VAL-OVR-01 | `(classGroupId, subjectId)` FKs valid | HARD |
| VAL-OVR-02 | `teacherId` null or staff with TEACHER capability + teachable includes subject | HARD |
| VAL-OVR-03 | `roomId` null or room in tenant | HARD |

---

## 10. Smart assignment (client + server persist)

| ID | Rule | Severity |
|----|------|----------|
| VAL-STA-01 | Payload keys `classGroupId:subjectId` must exist | HARD on save |
| VAL-STA-02 | `assignmentMeta` JSON schema versioned—unknown keys ignored forward-compatible | SOFT |

---

## 11. Timetable

| ID | Rule | Severity |
|----|------|----------|
| VAL-TT-01 | Slot `dayOfWeek` in 0–6 or 1–7 per contract | HARD |
| VAL-TT-02 | `startTime` < `endTime` | HARD |
| VAL-TT-03 | Same resource not double-booked on publish (policy-dependent) | HARD or SOFT |

---

## 12. Attendance

| ID | Rule | Severity |
|----|------|----------|
| VAL-ATT-01 | Mark enum ∈ {`PRESENT`,`ABSENT`} | HARD |
| VAL-ATT-02 | Student in session’s class group | HARD |
| VAL-ATT-03 | Session date not in future beyond grace window (if policy) | HARD |

---

## 13. Fees

| ID | Rule | Severity |
|----|------|----------|
| VAL-FEE-01 | Amounts `BigDecimal` scale ≤ 2 | HARD |
| VAL-FEE-02 | Currency matches tenant default | HARD |
| VAL-FEE-03 | Payment webhook idempotency key dedup | HARD |

---

## 14. Announcements

| ID | Rule | Severity |
|----|------|----------|
| VAL-ANN-01 | Title/body max lengths | HARD |
| VAL-ANN-02 | Target class IDs ⊆ tenant | HARD |

---

## 15. Student portal

| ID | Rule | Severity |
|----|------|----------|
| VAL-STU-01 | `studentId` in path must equal linked student | HARD |
| VAL-STU-02 | No cross-student query params | HARD |

---

## 16. API error shape (recommended)

```json
{
  "error": "VALIDATION_FAILED",
  "message": "Human readable summary",
  "fieldErrors": [{ "field": "code", "code": "DUPLICATE" }]
}
```

Align with existing `ErrorResponse` / controller advice in codebase.
