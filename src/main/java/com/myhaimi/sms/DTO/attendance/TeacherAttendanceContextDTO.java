package com.myhaimi.sms.DTO.attendance;

import java.util.List;

public record TeacherAttendanceContextDTO(String mode, List<TeacherDailySectionRowDTO> dailySections, List<TeacherLectureSlotRowDTO> lectureSlots) {}
