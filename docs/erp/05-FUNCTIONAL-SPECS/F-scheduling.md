# FR-SCH — Timetable, Lectures, Rooms

---

## FR-SCH-001 — Room catalog

| Block | Content |
|-------|---------|
| **Purpose** | Buildings → floors → rooms for allocation and timetable. |
| **User story** | As **leadership**, I add “Lab L2” as schedulable. |
| **Inputs** | Building, floor, room number, type, schedulable flag. |
| **Outputs** | `rooms` hierarchy rows. |
| **Validations** | VAL-RM-* |
| **Business rules** | Non-schedulable rooms excluded from certain pickers. |
| **Automation** | None. |
| **UI states** | Tree or grouped table. |
| **Failure handling** | Cannot delete room referenced by active timetable without policy. |

---

## FR-SCH-002 — Recurring timetable slots

| Block | Content |
|-------|---------|
| **Purpose** | Define repeating structure of the week. |
| **User story** | As **leadership**, I define Period 1 Mon–Fri 08:00–08:45. |
| **Inputs** | Day, start/end, labels, school scope. |
| **Outputs** | `timetable_slots` / `school_time_slots` per implementation. |
| **Validations** | VAL-TT-* |
| **Business rules** | Versioning may create new `timetable_versions` on publish. |
| **Automation** | Engine generates `timetable_entries`. |
| **UI states** | Rules editor + preview grid. |
| **Failure handling** | Conflict panel lists collisions. |

---

## FR-SCH-003 — Timetable grid v2 / engine

| Block | Content |
|-------|---------|
| **Purpose** | Place subject/staff/room into cells; detect conflicts. |
| **User story** | As **leadership**, I generate draft grid and fix double-booked teachers. |
| **Inputs** | Allocations, staff availability, room capacity rules. |
| **Outputs** | Grid DTO + conflict collection. |
| **Validations** | Tenant scope; optional hard publish gate. |
| **Business rules** | Locks (`timetable_locks`) prevent auto-moves. |
| **Automation** | `TimetableEngineController` algorithms. |
| **UI states** | Drag-drop or cell editor; conflict badges. |
| **Failure handling** | Engine timeout → async job (roadmap) with job id. |

---

## FR-SCH-004 — Teacher timetable view

| Block | Content |
|-------|---------|
| **Purpose** | Personal schedule for instructional staff. |
| **User story** | As **teacher**, I see my week filtered to my assignments. |
| **Inputs** | JWT staff identity. |
| **Outputs** | Aggregated entries from `/api/v1/teacher` / timetable APIs. |
| **Validations** | Teaching role. |
| **Business rules** | No other teachers’ private notes. |
| **Automation** | None. |
| **UI states** | Week strip; empty slots. |
| **Failure handling** | 403 if role revoked mid-session. |

---

## FR-SCH-005 — One-off lectures

| Block | Content |
|-------|---------|
| **Purpose** | Ad-hoc sessions (guest speaker, extra lab). |
| **User story** | As **teacher**, I schedule a lecture for my section next Tuesday. |
| **Inputs** | Datetime, class group, subject, room, staff. |
| **Outputs** | `lectures` row; may surface in attendance lecture-wise mode. |
| **Validations** | No overlap with locked recurring slots if policy requires. |
| **Business rules** | Attendance mode determines marking workflow. |
| **Automation** | Optional notification on create. |
| **UI states** | Create form + list. |
| **Failure handling** | Room conflict soft warning. |
