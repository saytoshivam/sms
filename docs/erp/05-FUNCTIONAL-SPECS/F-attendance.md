# FR-ATT — Attendance

---

## FR-ATT-001 — School attendance mode

| Block | Content |
|-------|---------|
| **Purpose** | Configure daily vs lecture-wise marking policy. |
| **User story** | As **SCHOOL_ADMIN**, I switch to lecture-wise when periods drive accountability. |
| **Inputs** | Enum `AttendanceMode` via management API. |
| **Outputs** | Persisted on school or settings table per migration. |
| **Validations** | Leadership write roles per FEATURES_AND_ROLES. |
| **Business rules** | BL-ATT-01 |
| **Automation** | None. |
| **UI states** | Radio + save confirmation. |
| **Failure handling** | 403 for vice principal if not allowed. |

---

## FR-ATT-002 — Open attendance session

| Block | Content |
|-------|---------|
| **Purpose** | Capture roster context for a date/class or lecture. |
| **User story** | As **class teacher**, I open today’s session for 9-A. |
| **Inputs** | `classGroupId`, date, optional `lectureId`. |
| **Outputs** | `attendance_sessions` row in draft/open state. |
| **Validations** | Authorization BL-ATT-02 |
| **Business rules** | One active session policy per class+date if product requires. |
| **Automation** | None. |
| **UI states** | Roster loading skeleton. |
| **Failure handling** | EC-ATT-02 concurrent open. |

---

## FR-ATT-003 — Mark and submit

| Block | Content |
|-------|---------|
| **Purpose** | Persist per-student marks. |
| **User story** | As **class teacher**, I mark everyone present except two absent. |
| **Inputs** | List of `{studentId, status}`. |
| **Outputs** | `student_attendance` rows; session finalized. |
| **Validations** | VAL-ATT-* |
| **Business rules** | BL-ATT-03 |
| **Automation** | Optional digest notification (feature gated). |
| **UI states** | Toggle cells; submit disabled until dirty resolved. |
| **Failure handling** | Partial save error → highlight failed rows. |

---

## FR-ATT-004 — Leadership override

| Block | Content |
|-------|---------|
| **Purpose** | Allow heads to mark on behalf when teacher absent. |
| **User story** | As **principal**, I complete attendance for a substitute day. |
| **Inputs** | Same as FR-ATT-003 with leadership JWT. |
| **Outputs** | Same rows; audit who marked. |
| **Validations** | Service-level role check. |
| **Business rules** | Audit trail recommended. |
| **Automation** | None. |
| **UI states** | Banner “Acting as leadership”. |
| **Failure handling** | Same as FR-ATT-003. |
