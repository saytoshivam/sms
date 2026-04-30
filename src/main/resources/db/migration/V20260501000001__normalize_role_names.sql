-- Normalize the `roles` table to canonical UPPERCASE_SNAKE_CASE names.
-- Background: early dev seeders inserted mixed-case names ("Teacher", "Super Admin", …) while
-- newer code uses canonical names from RoleNames (TEACHER, SUPER_ADMIN, …). The frontend and
-- @PreAuthorize checks compare against the canonical names, so any user mapped to a legacy row
-- silently fails role checks (e.g. "Assign subjects" disabled despite the staff being a teacher).
--
-- Strategy:
--  1. For legacy rows that already have a canonical sibling, re-point user_roles to the canonical
--     row (INSERT IGNORE handles users that hold both), then drop the legacy row.
--  2. For legacy rows without a canonical sibling, rename in place (the unique index uses a
--     case-insensitive collation and we’re free of duplicates after step 1).
--
-- "Admin" (id 1) is intentionally left untouched — it isn’t in the canonical RoleNames catalog
-- and isn’t referenced by any user_roles row in current dev databases.

-- ------------------------------------------------------------------
-- 1) Merge legacy rows with canonical siblings.
-- ------------------------------------------------------------------

-- (a) "Super Admin" -> SUPER_ADMIN
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, c.id
FROM user_roles ur
JOIN roles l ON l.id = ur.role_id AND l.name = 'Super Admin'
JOIN roles c ON c.name = 'SUPER_ADMIN';
DELETE ur FROM user_roles ur JOIN roles l ON l.id = ur.role_id AND l.name = 'Super Admin';
DELETE FROM roles WHERE name = 'Super Admin';

-- (b) "Hostel Warden" -> HOSTEL_WARDEN
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, c.id
FROM user_roles ur
JOIN roles l ON l.id = ur.role_id AND l.name = 'Hostel Warden'
JOIN roles c ON c.name = 'HOSTEL_WARDEN';
DELETE ur FROM user_roles ur JOIN roles l ON l.id = ur.role_id AND l.name = 'Hostel Warden';
DELETE FROM roles WHERE name = 'Hostel Warden';

-- (c) "Exam Coordinator" -> EXAM_COORDINATOR
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, c.id
FROM user_roles ur
JOIN roles l ON l.id = ur.role_id AND l.name = 'Exam Coordinator'
JOIN roles c ON c.name = 'EXAM_COORDINATOR';
DELETE ur FROM user_roles ur JOIN roles l ON l.id = ur.role_id AND l.name = 'Exam Coordinator';
DELETE FROM roles WHERE name = 'Exam Coordinator';

-- (d) "IT Support" -> IT_SUPPORT
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, c.id
FROM user_roles ur
JOIN roles l ON l.id = ur.role_id AND l.name = 'IT Support'
JOIN roles c ON c.name = 'IT_SUPPORT';
DELETE ur FROM user_roles ur JOIN roles l ON l.id = ur.role_id AND l.name = 'IT Support';
DELETE FROM roles WHERE name = 'IT Support';

-- (e) "Transport Manager" -> TRANSPORT_MANAGER
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, c.id
FROM user_roles ur
JOIN roles l ON l.id = ur.role_id AND l.name = 'Transport Manager'
JOIN roles c ON c.name = 'TRANSPORT_MANAGER';
DELETE ur FROM user_roles ur JOIN roles l ON l.id = ur.role_id AND l.name = 'Transport Manager';
DELETE FROM roles WHERE name = 'Transport Manager';

-- ------------------------------------------------------------------
-- 2) Direct renames for legacy rows without a canonical sibling.
--    The unique index on roles.name is case-insensitive (utf8mb4_0900_ai_ci),
--    so updating "Teacher" -> "TEACHER" is a no-op for the index.
-- ------------------------------------------------------------------

UPDATE roles SET name = 'TEACHER'      WHERE name = 'Teacher';
UPDATE roles SET name = 'PRINCIPAL'    WHERE name = 'Principal';
UPDATE roles SET name = 'STUDENT'      WHERE name = 'Student';
UPDATE roles SET name = 'PARENT'       WHERE name = 'Parent';
UPDATE roles SET name = 'ACCOUNTANT'   WHERE name = 'Accountant';
UPDATE roles SET name = 'COUNSELOR'    WHERE name = 'Counselor';
UPDATE roles SET name = 'LIBRARIAN'    WHERE name = 'Librarian';
UPDATE roles SET name = 'RECEPTIONIST' WHERE name = 'Receptionist';
