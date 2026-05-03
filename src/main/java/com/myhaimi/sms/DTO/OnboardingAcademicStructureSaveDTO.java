package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingAcademicStructureSaveDTO(
        /**
         * Back-compat: section-level effective allocations.
         * Prefer {@code classSubjectConfigs} + {@code sectionSubjectOverrides} for new flows.
         */
        List<OnboardingAcademicAllocationInputDTO> allocations,
        /** Grade-level templates (class = grade). */
        List<OnboardingClassSubjectConfigDTO> classSubjectConfigs,
        /** Section-level overrides (nullable values mean fallback). */
        List<OnboardingSectionSubjectOverrideDTO> sectionSubjectOverrides,
        /** When present, overwrites per-class default (homeroom) rooms; omitted entries clear default room. */
        List<OnboardingClassDefaultRoomItemDTO> defaultRooms,
        /** When present, assigns class teachers on class groups for this school. */
        List<OnboardingClassTeacherItemDTO> classTeachers,
        /** Replaces the whole list when present; null or empty clears stored meta. */
        List<OnboardingAcademicSlotMetaDTO> assignmentSlotMeta) {}
