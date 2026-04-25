package com.myhaimi.sms.DTO;

import com.myhaimi.sms.DTO.timetable.v2.AutoFillResultDTO;

public record OnboardingTimetableClassAutoFillItemDTO(
        int classGroupId, String classCode, AutoFillResultDTO result) {}
