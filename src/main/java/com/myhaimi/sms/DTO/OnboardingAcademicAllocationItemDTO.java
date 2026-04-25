package com.myhaimi.sms.DTO;

public record OnboardingAcademicAllocationItemDTO(
        int id, int classGroupId, int subjectId, Integer staffId, int weeklyFrequency, Integer roomId) {}
