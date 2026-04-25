package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingTimetableAutoGenerateViewDTO(
        int timetableVersionId, String status, int version, List<OnboardingTimetableClassAutoFillItemDTO> perClass) {}
