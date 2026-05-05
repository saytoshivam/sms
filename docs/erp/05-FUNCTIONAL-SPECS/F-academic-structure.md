# FR-ACAD — Academic Structure & Smart Assignment

---

## FR-ACAD-001 — Class groups (sections)

| Block | Content |
|-------|---------|
| **Purpose** | Represent each teaching section with grade, identifiers, capacity, homeroom. |
| **User story** | As **leadership**, I add “Class 7 A” with homeroom room for defaults. |
| **Inputs** | Grade, section/code, capacity, `defaultRoomId`, optional class teacher. |
| **Outputs** | `class_groups` row; appears in allocation builders. |
| **Validations** | VAL-CG-*; FK to room. |
| **Business rules** | Homeroom drives default teaching room resolution. |
| **Automation** | Optional CSV import (edge cases in EC-IMP). |
| **UI states** | Table + drawer create/edit. |
| **Failure handling** | Unique constraint on section naming policy. |

---

## FR-ACAD-002 — Grade subject templates

| Block | Content |
|-------|---------|
| **Purpose** | Default subject offering per grade. |
| **User story** | As **leadership**, I enable Science for all grade 7 sections with 5 periods/week. |
| **Inputs** | `school_id`, `grade_level`, `subject_id`, `defaultPeriodsPerWeek`, optional default teacher/room. |
| **Outputs** | `class_subject_configs` row. |
| **Validations** | Unique `(school_id, grade_level, subject_id)`; periods > 0. |
| **Business rules** | Template feeds all sections unless overridden. |
| **Automation** | None. |
| **UI states** | Matrix or list by grade. |
| **Failure handling** | 409 duplicate template. |

---

## FR-ACAD-003 — Section overrides

| Block | Content |
|-------|---------|
| **Purpose** | Per-section deviation without cloning templates. |
| **User story** | As **leadership**, I set 7-B Science to 4 periods while 7-A stays 5. |
| **Inputs** | `class_group_id`, `subject_id`, optional `periodsPerWeek`, `teacherId`, `roomId`. |
| **Outputs** | `subject_section_overrides` upsert. |
| **Validations** | VAL-OVR-*; teacher teachable check. |
| **Business rules** | Effective row resolution BL-ACAD. |
| **Automation** | None. |
| **UI states** | Override badge on row. |
| **Failure handling** | FK errors if subject/class deleted. |

---

## FR-ACAD-004 — Teacher demand summary

| Block | Content |
|-------|---------|
| **Purpose** | Surface staffing sufficiency before timetable stress. |
| **User story** | As **leadership**, I see required periods vs qualified teacher capacity per subject. |
| **Inputs** | Effective allocations, staff teachables, `slotsPerWeek`. |
| **Outputs** | Rows: required, qualified count, capacity, teachers needed, status text. |
| **Validations** | Client recompute on dependency change. |
| **Business rules** | BL-DEM-* |
| **Automation** | Recompute in `useMemo` / equivalent. |
| **UI states** | Sortable headers; color by status. |
| **Failure handling** | Empty staff → CRITICAL rows. |

---

## FR-ACAD-005 — Smart teacher assignment

| Block | Content |
|-------|---------|
| **Purpose** | Auto/rebalance teachers with explainable provenance. |
| **User story** | As **leadership**, I rebalance English teachers across 7-A/7-B for load fairness. |
| **Inputs** | Class groups, staff, subjects, configs, overrides, `assignmentMeta`, mode, optional subject filter. |
| **Outputs** | Updated configs/overrides/meta + warnings. |
| **Validations** | Severe shortage block on auto when enabled. |
| **Business rules** | BL-STA-*; merge meta rules for room provenance. |
| **Automation** | `runSmartTeacherAssignment` modes: `auto`, `rebalance`, `reset`. |
| **UI states** | Healthy vs needs attention; expanded slot; locks; toasts. |
| **Failure handling** | Partial assign + warnings; conflict badges. |

---

## FR-ACAD-006 — Reset slot toward auto

| Block | Content |
|-------|---------|
| **Purpose** | Undo algorithm “stickiness” for one slot including manual room. |
| **User story** | As **leadership**, I reset so room is no longer MANUAL after experiment. |
| **Inputs** | Row key `classGroupId:subjectId`. |
| **Outputs** | Deleted meta key; override `roomId` null; rebalance result. |
| **Validations** | Subject filter matches row. |
| **Business rules** | BL-STA-07 |
| **Automation** | Client orchestrates then persists via existing save APIs. |
| **UI states** | Toast “Slot reset toward auto”. |
| **Failure handling** | If save fails, refetch server state to avoid drift. |

---

## FR-ACAD-007 — Homeroom & default room bulk

| Block | Content |
|-------|---------|
| **Purpose** | Apply homeroom to teaching slots in bulk. |
| **User story** | As **leadership**, I apply homeroom to all non-locked slots for Monday setup. |
| **Inputs** | Homeroom map, lock/meta predicates. |
| **Outputs** | Updated overrides/meta. |
| **Validations** | Room exists. |
| **Business rules** | BL-HRA-* |
| **Automation** | Bulk action in SPA + persist. |
| **UI states** | Preview count of affected rows. |
| **Failure handling** | List slots skipped due to lock. |
