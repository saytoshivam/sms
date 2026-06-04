-- ============================================================
-- Examination Module: Hardening – add missing columns to
--   assessment_components and assessment_instances.
-- Safe to run on existing databases; all columns use ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. assessment_components: scheduling control fields
-- ──────────────────────────────────────────────────────────
ALTER TABLE assessment_components
    ADD COLUMN IF NOT EXISTS requires_scheduling  TINYINT(1)  NOT NULL DEFAULT 1
        COMMENT 'Whether this component needs a physical exam slot (false for attendance/calculated)',
    ADD COLUMN IF NOT EXISTS marks_entry_required  TINYINT(1)  NOT NULL DEFAULT 1
        COMMENT 'Whether marks must be entered for this component (enables Marks Entry tab row)',
    ADD COLUMN IF NOT EXISTS scheduling_mode       VARCHAR(16) NOT NULL DEFAULT 'CENTRALIZED'
        COMMENT 'CENTRALIZED: only admin/exam-coordinator; DELEGATED: subject teacher from published timetable; HYBRID: either';

-- ──────────────────────────────────────────────────────────
-- 2. assessment_instances: scheduling metadata fields
-- ──────────────────────────────────────────────────────────
ALTER TABLE assessment_instances
    ADD COLUMN IF NOT EXISTS schedule_group_id         VARCHAR(64)  NULL
        COMMENT 'Batch identifier linking all instances from one Generate-from-Scheme run',
    ADD COLUMN IF NOT EXISTS instructions              TEXT         NULL
        COMMENT 'Per-instance exam instructions visible to invigilators/students',
    ADD COLUMN IF NOT EXISTS assigned_teacher_staff_id INT          NULL
        COMMENT 'Staff ID of teacher assigned as scheduling owner (from published timetable at generation time; DELEGATED/HYBRID only)';

-- Index to speed up schedule-group lookups
CREATE INDEX IF NOT EXISTS idx_ai_schedule_group ON assessment_instances (schedule_group_id);

