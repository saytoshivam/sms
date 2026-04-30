package com.myhaimi.sms.DTO.timetable.engine;

public record TimetableGenerateRequestDTO(
        Integer schoolId,
        Integer academicYearId,
        Boolean replaceExisting // default true
) {}

