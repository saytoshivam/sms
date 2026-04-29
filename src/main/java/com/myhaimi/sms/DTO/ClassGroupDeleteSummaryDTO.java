package com.myhaimi.sms.DTO;

public record ClassGroupDeleteSummaryDTO(
        int classGroupsDeleted,
        int studentsDeleted,
        int subjectAllocationsDeleted,
        int classSubjectConfigsDeleted,
        int subjectSectionOverridesDeleted,
        int subjectClassMappingsDeleted,
        int timetableEntriesDeleted,
        int attendanceSessionsDeleted,
        int lecturesDeleted,
        int announcementTargetsDeleted
) {}

