package com.myhaimi.sms.DTO;

/**
 * Section-level row used by the Classes & Sections management UI.
 *
 * <p>In the current data model, a "section" is a {@code ClassGroup} with {@code gradeLevel + section}.</p>
 */
public record ClassGroupSectionSummaryDTO(
        Integer id,
        String code,
        String displayName,
        Integer gradeLevel,
        String section,
        Integer classTeacherStaffId,
        String classTeacherDisplayName,
        long studentCount
) {}

