# FR-COM — Announcements & Portals

---

## FR-COM-001 — School-wide announcements

| Block | Content |
|-------|---------|
| **Purpose** | Broadcast to all or filtered audiences in tenant. |
| **User story** | As **principal**, I publish a holiday notice visible in student feeds. |
| **Inputs** | Title, body, category, audience rules, publishAt. |
| **Outputs** | `announcements` + targeting rows. |
| **Validations** | VAL-ANN-* |
| **Business rules** | Leadership roles per controller. |
| **Automation** | Optional scheduled publish (if implemented). |
| **UI states** | Draft / scheduled / published. |
| **Failure handling** | Target class deleted → EC-ANN-01 |

---

## FR-COM-002 — Class-scoped teacher announcements

| Block | Content |
|-------|---------|
| **Purpose** | Teacher-to-class comms without full school blast. |
| **User story** | As **teacher**, I notify my homeroom about tomorrow’s field trip. |
| **Inputs** | Class group ids, message body. |
| **Outputs** | `TeacherAnnouncement` domain equivalent. |
| **Validations** | Teacher must teach or own class per policy. |
| **Business rules** | Narrower audience than school announcements. |
| **Automation** | None. |
| **UI states** | Compose with class picker. |
| **Failure handling** | 403 if not assigned to class. |

---

## FR-COM-003 — Student portal schedule

| Block | Content |
|-------|---------|
| **Purpose** | Authoritative week view from timetable + lectures. |
| **User story** | As **student**, I open `/app/student/schedule`. |
| **Inputs** | JWT + linked student. |
| **Outputs** | Combined events DTO. |
| **Validations** | `STUDENT` role; student id match. |
| **Business rules** | Feature `academics.timetable` for rich views if gated. |
| **Automation** | Cache optional. |
| **UI states** | Today highlight; empty state. |
| **Failure handling** | EC-PRT-01 unlink |

---

## FR-COM-004 — Student announcements inbox

| Block | Content |
|-------|---------|
| **Purpose** | Unified feed with read state. |
| **User story** | As **student**, I mark an announcement as read. |
| **Inputs** | `GET` list, `POST …/read`. |
| **Outputs** | `announcement_reads` optional row. |
| **Validations** | Announcement in audience for student. |
| **Business rules** | Unread count endpoint. |
| **Automation** | None. |
| **UI states** | Badge on nav. |
| **Failure handling** | Stale id → 404 safe body. |

---

## FR-COM-005 — Parent shell (phased)

| Block | Content |
|-------|---------|
| **Purpose** | Guardian-centric experience for fees and messaging. |
| **User story** | As **parent**, I view consolidated dues when `parent.portal` enabled. |
| **Inputs** | Linked children ids. |
| **Outputs** | Aggregates per child. |
| **Validations** | PermissionFeatureGates map for future parity. |
| **Business rules** | No cross-family leakage. |
| **Automation** | Notifications when `notifications.email_sms` licensed. |
| **UI states** | Child switcher tabs. |
| **Failure handling** | Placeholder routes until MVP shipped. |
