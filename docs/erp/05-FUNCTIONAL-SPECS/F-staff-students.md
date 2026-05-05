# FR-ORG — Staff, Students, Guardians, Class Teacher

---

## FR-ORG-001 — Staff directory

| Block | Content |
|-------|---------|
| **Purpose** | Maintain employees linked to users where applicable. |
| **User story** | As **leadership**, I add a new teacher with contact info. |
| **Inputs** | Profile fields, roles, email. |
| **Outputs** | `staff` row; optional `users` link. |
| **Validations** | VAL-STF-*; unique email per policy. |
| **Business rules** | Soft delete preserves historical references (see migrations). |
| **Automation** | CSV import optional. |
| **UI states** | List + modal edit. |
| **Failure handling** | FK if user linked elsewhere. |

---

## FR-ORG-002 — Teachable subjects

| Block | Content |
|-------|---------|
| **Purpose** | Drive smart assign eligibility. |
| **User story** | As **leadership**, I tag Dr. Rao for Mathematics only. |
| **Inputs** | `staff_id`, `subject_id` list. |
| **Outputs** | `staff_teachable_subjects` rows. |
| **Validations** | Subject belongs to tenant; non-empty for teachers who instruct. |
| **Business rules** | Empty teachables ⇒ cannot teach any subject. |
| **Automation** | Demand summary recomputes. |
| **UI states** | Multi-select chips. |
| **Failure handling** | Optimistic UI with rollback on error. |

---

## FR-ORG-003 — Max weekly load

| Block | Content |
|-------|---------|
| **Purpose** | Cap periods for assignment scoring. |
| **User story** | As **leadership**, I set 30 max periods for a part-time teacher. |
| **Inputs** | Integer `maxWeeklyLectureLoad`. |
| **Outputs** | Updated `staff`. |
| **Validations** | Positive cap upper bound. |
| **Business rules** | Falls back to school slots or default 32 when null. |
| **Automation** | Used in BL-DEM and BL-STA. |
| **UI states** | Numeric input with hint. |
| **Failure handling** | Server clamp if out of range. |

---

## FR-ORG-004 — Students & guardians

| Block | Content |
|-------|---------|
| **Purpose** | Core learner records and family linkage. |
| **User story** | As **leadership**, I enroll a student and link two guardians. |
| **Inputs** | Student demographics, class assignment, guardian contacts. |
| **Outputs** | `students`, `guardians`, join tables. |
| **Validations** | Unique admission numbers per policy; class group FK. |
| **Business rules** | Student portal requires user↔student link separate from this. |
| **Automation** | Import CSV. |
| **UI states** | Wizard or tabbed form. |
| **Failure handling** | Partial guardian save with rollback. |

---

## FR-ORG-005 — Class teacher assignment

| Block | Content |
|-------|---------|
| **Purpose** | Pastoral + attendance authority for daily mode. |
| **User story** | As **leadership**, I assign Ms. Lee as class teacher for 8-B. |
| **Inputs** | `classGroupId`, `staffId` / user id per API contract. |
| **Outputs** | Updated `class_groups` or junction per schema. |
| **Validations** | Leadership role for `PUT …/class-teacher`. |
| **Business rules** | BL-CTA-* |
| **Automation** | Batch assign DTO for multiple sections. |
| **UI states** | Dropdown per class row. |
| **Failure handling** | Invalid staff → 400. |
