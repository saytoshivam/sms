package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingAcademicStructureViewDTO(
        List<OnboardingAcademicSubjectItemDTO> subjects,
        List<OnboardingAcademicStaffItemDTO> staff,
        List<OnboardingAcademicClassGroupItemDTO> classGroups,
        List<OnboardingAcademicAllocationItemDTO> allocations,
        /** Grade-level templates (class = grade). */
        List<OnboardingClassSubjectConfigDTO> classSubjectConfigs,
        /** Section-level overrides (nullable values mean fallback). */
        List<OnboardingSectionSubjectOverrideDTO> sectionSubjectOverrides,
        /** Per-slot source + lock for smart teacher assign (empty if never saved). */
        List<OnboardingAcademicSlotMetaDTO> assignmentSlotMeta) {}
