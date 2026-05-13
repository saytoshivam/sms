-- ─────────────────────────────────────────────────────────────────────────────
-- Staff first-class role mapping table
--
-- Staff roles must be stored independently of the portal login account.
-- staff_role_mapping is the authoritative source; User.roles is synchronised
-- from here when a login is provisioned.
--
-- Replaces the ad-hoc staff_roles_json JSON column approach added in
-- V20260513000001 (that column is kept for backward-compat and will be removed
-- in a future cleanup migration once all records are migrated).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_role_mapping (
    id       INT          NOT NULL AUTO_INCREMENT,
    staff_id INT          NOT NULL,
    role_id  BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_staff_role (staff_id, role_id),
    CONSTRAINT fk_srm_staff FOREIGN KEY (staff_id) REFERENCES staff (id)  ON DELETE CASCADE,
    CONSTRAINT fk_srm_role  FOREIGN KEY (role_id)  REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='First-class staff role assignments. Independent of portal login.';

-- ── Seed from existing User.roles for staff that already have a linked login ──
-- This is a best-effort backfill; run IGNORE ON DUPLICATE KEY to avoid errors.
INSERT IGNORE INTO staff_role_mapping (staff_id, role_id)
SELECT u.linked_staff_id, ur.role_id
FROM   user_roles ur
JOIN   users      u  ON u.id = ur.user_id
WHERE  u.linked_staff_id IS NOT NULL;

