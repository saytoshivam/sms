package com.myhaimi.sms.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.StaffRoleMapping;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StaffRoleMappingRepository;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Startup-safe idempotent backfill: migrates legacy staff roles into
 * {@link StaffRoleMapping} (the authoritative source) for staff records
 * that were created before the {@code staff_role_mapping} table existed.
 *
 * <p>Fallback priority for staff without any StaffRoleMapping rows:</p>
 * <ol>
 *   <li>Deprecated {@code staffRolesJson} column on {@link Staff}.</li>
 *   <li>Linked {@link User#getRoles()} — pre-migration records where roles were only
 *       stored on the portal login account.</li>
 * </ol>
 *
 * <p>This service is idempotent: it only processes staff that have zero
 * StaffRoleMapping entries.  After the first successful boot post-migration all
 * staff will have StaffRoleMapping entries and this service becomes a no-op.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaffRoleBackfillService {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final SchoolRepo                 schoolRepo;
    private final StaffRepo                  staffRepo;
    private final UserRepo                   userRepo;
    private final RoleRepo                   roleRepo;
    private final StaffRoleMappingRepository staffRoleMappingRepository;
    private final ObjectMapper               objectMapper;

    /**
     * Runs once after the application context is fully started.
     * Each school is processed in its own transaction.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void runBackfill() {
        log.info("[StaffRoleBackfill] Starting staff role backfill …");
        int totalMigrated = 0;
        for (School school : schoolRepo.findAll()) {
            try {
                int count = backfillSchool(school.getId());
                if (count > 0) {
                    log.info("[StaffRoleBackfill] School {} ({}): backfilled {} StaffRoleMapping row(s).",
                            school.getId(), school.getCode(), count);
                }
                totalMigrated += count;
            } catch (Exception ex) {
                log.warn("[StaffRoleBackfill] School {} failed — skipping. Cause: {}",
                        school.getId(), ex.getMessage());
            }
        }
        if (totalMigrated == 0) {
            log.info("[StaffRoleBackfill] All staff already have StaffRoleMapping entries — nothing to do.");
        } else {
            log.info("[StaffRoleBackfill] Backfill complete. Total rows inserted: {}.", totalMigrated);
        }
    }

    /**
     * Backfill one school in its own transaction.
     */
    @Transactional
    public int backfillSchool(Integer schoolId) {
        List<Staff> allStaff = staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId);

        // Staff IDs that already have StaffRoleMapping rows — skip these
        Set<Integer> alreadyMapped = staffRoleMappingRepository
                .findByStaff_School_Id(schoolId)
                .stream()
                .map(m -> m.getStaff().getId())
                .collect(Collectors.toSet());

        // Pre-build userByStaffId map to avoid N+1 per staff
        Map<Integer, User> userByStaffId = userRepo
                .findBySchool_IdWithProfilesOrderByEmailAsc(schoolId)
                .stream()
                .filter(u -> u.getLinkedStaff() != null)
                .collect(Collectors.toMap(u -> u.getLinkedStaff().getId(), u -> u,
                        (a, b) -> a)); // keep first in case of duplicates

        // Pre-build role name → Role entity map to avoid N+1 per role name
        Map<String, Role> roleByName = roleRepo.findAll().stream()
                .collect(Collectors.toMap(Role::getName, r -> r, (a, b) -> a));

        int insertedCount = 0;

        for (Staff staff : allStaff) {
            if (alreadyMapped.contains(staff.getId())) continue;

            List<String> roleNames = resolveRoleNames(staff, userByStaffId);
            if (roleNames.isEmpty()) continue;

            for (String roleName : roleNames) {
                Role role = roleByName.get(roleName.toUpperCase());
                if (role == null) {
                    // Try case-insensitive lookup as fallback
                    role = roleByName.entrySet().stream()
                            .filter(e -> e.getKey().equalsIgnoreCase(roleName))
                            .map(Map.Entry::getValue)
                            .findFirst()
                            .orElse(null);
                }
                if (role == null) {
                    log.warn("[StaffRoleBackfill] Role '{}' not found — skipping for staff {}.",
                            roleName, staff.getId());
                    continue;
                }
                staffRoleMappingRepository.save(new StaffRoleMapping(staff, role));
                insertedCount++;
            }
        }
        return insertedCount;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Resolve role names for a staff member who has no StaffRoleMapping entries.
     * Priority: staffRolesJson (deprecated) → linked User.roles.
     */
    private List<String> resolveRoleNames(Staff staff, Map<Integer, User> userByStaffId) {
        // 1. staffRolesJson (deprecated column — old interim approach)
        List<String> fromJson = parseStringList(staff.getStaffRolesJson());
        if (!fromJson.isEmpty()) return fromJson;

        // 2. Linked User.roles
        User user = userByStaffId.get(staff.getId());
        if (user != null && user.getRoles() != null && !user.getRoles().isEmpty()) {
            return user.getRoles().stream()
                    .map(Role::getName)
                    .collect(Collectors.toList());
        }

        return List.of();
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception e) {
            return List.of();
        }
    }
}
