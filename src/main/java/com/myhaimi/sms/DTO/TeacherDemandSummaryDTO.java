package com.myhaimi.sms.DTO;

import java.util.List;

public record TeacherDemandSummaryDTO(
        Integer schoolSlotsPerWeek,
        boolean hasSevereShortage,
        List<TeacherDemandSubjectRowDTO> subjects) {}
