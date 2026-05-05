# Business Logic Rules

**Audience:** Engineering, Product  
**Version:** 1.0  
**Related:** `frontend/src/lib/academicStructureSmartAssign.ts`, `teacherDemandAnalysis.ts`, `AttendanceService`, PRD §6

---

## 1. Purpose

Normative **business rules** (not just validation): how the system **computes**, **prioritizes**, and **mutates** state.

---

## 2. Effective academic allocation (BL-ACAD)

**Rule BL-ACAD-01 (effective teacher):**  
For class group `G` and subject `S`:

`effectiveTeacher = override.teacherId ?? template.defaultTeacherId`

**Rule BL-ACAD-02 (effective room):**  
`effectiveRoom = override.roomId ?? template.defaultRoomId ?? homeroom(G)`

Use `??` so explicit `null` in override clears to lower layers (implementation must match).

**Rule BL-ACAD-03 (effective periods):**  
`effectivePeriods = override.periodsPerWeek ?? template.defaultPeriodsPerWeek`  
If either missing or zero, row may be excluded from “on timetable” set.

**Rule BL-ACAD-04 (section-only subject):**  
If no template row for `(grade(G), S)` but override exists with positive periods, row still appears in effective set (section-only addition).

---

## 3. Teacher demand summary (BL-DEM)

**Source:** `computeTeacherDemandSummary`.

**Rule BL-DEM-01:** `requiredPeriods(subject) = Σ weeklyFrequency` over all effective allocation rows for that `subjectId` (freq > 0).

**Rule BL-DEM-02:** Staff counts as **qualified** iff: `TEACHER` ∈ `roleNames` AND `teachableSubjectIds` non-empty AND contains `subjectId`.

**Rule BL-DEM-03:** `availableCapacity = Σ effectiveMaxLoad(staff)` for qualified staff.  
`effectiveMaxLoad` = `maxWeeklyLectureLoad` if positive; else `slotsPerWeek` if positive; else default **32**.

**Rule BL-DEM-04:** `teachersNeeded = ceil(required / avgCap)` where `avgCap = capacity / qualified` when `qualified > 0`.

**Rule BL-DEM-05 (status):**  
- `required ≤ 0` → OK / “No weekly demand”  
- `qualified == 0` && `required > 0` → CRITICAL  
- `capacity >= required` → OK / “Capacity meets demand”  
- `capacity >= 0.9 * required` → WARN / “Near capacity”  
- else CRITICAL with shortfall messaging  

**Rule BL-DEM-06 (smart assign block):** `shouldBlockSmartAutoAssign` when severe shortage flag true—blocks **auto** mode only (see implementation).

---

## 4. Smart teacher assignment (BL-STA)

**Eligibility (mirror demand):** TEACHER role + non-empty teachables + subject in list.

**Rule BL-STA-01 (skip slot in auto/rebalance):**  
Skip assignment if `meta.locked && staffId != null` OR `meta.source === 'manual' && staffId != null`.

**Rule BL-STA-02 (demand bucket):** Group by `(grade, subjectId)` for cohesion scoring.

**Rule BL-STA-03 (single teacher preference):** If one qualified teacher can cover total periods of all demands in grade×subject bucket, assign same teacher to all sections.

**Rule BL-STA-04 (scoring):** Load ratio, overload penalty, continuity same grade+subject, grade distance, preferred sections—weights in `teacherScore()`.

**Rule BL-STA-05 (rebalance pass 2):** Only move rows that are not manual-protected and not locked with assigned teacher; prefer reducing overload.

**Rule BL-STA-06 (merge meta):** `mergeAssignmentSlotMeta` carries forward `roomSource`/`roomLocked` from **prev** when **next** omits them—so **deleting** meta key is required to clear room provenance on reset-to-auto; then rebalance writes fresh teacher source without room fields.

**Rule BL-STA-07 (reset toward auto):** Remove slot meta key; null `roomId` on section override for that pair; run `rebalance` for subject—clears MANUAL room badge until user sets room again.

**Rule BL-STA-08 (reset mode whole-school):** `mode === 'reset'` clears non-protected teachers and preserves room meta only when lock/source flags exist—different from single-slot reset (see code).

---

## 5. Homeroom bulk automation (BL-HRA)

**Rule BL-HRA-01:** Slots with `roomLocked` or explicit manual room policy must **not** be overwritten by bulk homeroom assign.

**Rule BL-HRA-02:** Homeroom source `auto` vs `manual` per class group drives badge when room equals homeroom.

---

## 6. Class teacher (BL-CTA)

**Rule BL-CTA-01:** At most one **primary** class teacher per section unless product enables job-share (default one).

**Rule BL-CTA-02:** Assigned user must be staff member in tenant.

---

## 7. Attendance (BL-ATT)

**Rule BL-ATT-01 (mode):** School `attendanceMode` determines whether daily class-session or lecture-session marking applies.

**Rule BL-ATT-02 (authorization):** Daily → class teacher or leadership; Lecture-wise → assigned lecturer or leadership.

**Rule BL-ATT-03 (marks):** Only `PRESENT` / `ABSENT` stored.

---

## 8. Subscription (BL-SUB)

**Rule BL-SUB-01:** If tenant plan lacks feature code, annotated controller methods return **403** with stable error type for client.

**Rule BL-SUB-02:** `SUPER_ADMIN` without tenant may bypass feature gate for platform operations (documented exception).

---

## 9. Fees & payments (BL-FEE)

**Rule BL-FEE-01:** Online intent creation requires `fees.online_payments` + valid student/invoice linkage.

**Rule BL-FEE-02:** Webhook processing **idempotent** on provider payment id or internal idempotency key.

---

## 10. Marks & performance (BL-MRK)

**Rule BL-MRK-01:** Students cannot call staff performance endpoints (`@PreAuthorize("!hasRole('STUDENT')")` pattern).

**Rule BL-MRK-02:** Marks writes scoped to class/staff teaching relationship (enforce in service layer beyond controller).

---

## 11. Change control

When altering scoring weights or effective-row resolution, update:

- This document  
- `teacherDemandAnalysis` / `academicStructureSmartAssign` unit tests  
- Golden fixtures for smart assign snapshots  
