package com.myhaimi.sms.DTO.teacher;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;

public record TeacherStudentProgressRowDTO(
        int studentId,
        String admissionNo,
        String fullName,
        String classGroupName,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd") LocalDate joinedOn,
        double attendancePercentSinceJoin,
        double averageScorePercentSinceJoin,
        int marksCountSinceJoin) {}
