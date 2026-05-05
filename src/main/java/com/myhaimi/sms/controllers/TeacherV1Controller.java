package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.announcement.ClassGroupRefDTO;
import com.myhaimi.sms.DTO.timetable.PublishedTeacherWeeklyTimetableDTO;
import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.DTO.teacher.TeacherStudentProgressRowDTO;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.impl.AnnouncementService;
import com.myhaimi.sms.service.impl.PublishedTimetableCalendarService;
import com.myhaimi.sms.service.impl.TeacherProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.myhaimi.sms.utils.TenantContext;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/teacher")
@RequiredArgsConstructor
public class TeacherV1Controller {

    private final TeacherProgressService teacherProgressService;
    private final PublishedTimetableCalendarService publishedTimetableCalendarService;
    private final UserRepo userRepo;
    private final AnnouncementService announcementService;

    @GetMapping("/students/progress")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<List<TeacherStudentProgressRowDTO>> studentProgressSinceEnrollment() {
        return ResponseEntity.ok(teacherProgressService.studentProgressSinceEnrollment());
    }

    /**
     * Calendar from the school's <strong>published</strong> timetable only (recurring engine v2 entries).
     * When the user has a {@link User#getLinkedStaff()} profile, occurrences are limited to that teacher; school
     * leaders without a staff link see every section's published assignments in the range.
     */
    @GetMapping("/timetable")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<List<TimetableOccurrenceDTO>> myTimetable(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal UserDetails principal) {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        User user = userRepo.findFirstByEmailIgnoreCase(principal.getUsername()).orElseThrow();
        Integer staffId = user.getLinkedStaff() != null ? user.getLinkedStaff().getId() : null;
        return ResponseEntity.ok(publishedTimetableCalendarService.calendar(schoolId, staffId, from, to));
    }

    /**
     * Weekly period × day grid for the signed-in teacher's published assignments (plus break / free cells).
     */
    @GetMapping("/timetable/weekly-published")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER')")
    public PublishedTeacherWeeklyTimetableDTO weeklyPublished(@AuthenticationPrincipal UserDetails principal) {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        User user = userRepo.findFirstByEmailIgnoreCase(principal.getUsername()).orElseThrow();
        if (user.getLinkedStaff() == null) {
            throw new IllegalStateException("Your account is not linked to a staff profile.");
        }
        return publishedTimetableCalendarService.teacherWeeklyGrid(schoolId, user.getLinkedStaff().getId());
    }

    /** Class groups this teacher appears on in the weekly timetable (for class-scoped announcements). */
    @GetMapping("/my-class-groups")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER')")
    public ResponseEntity<List<ClassGroupRefDTO>> myClassGroups(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(announcementService.teachableClassGroupsForStaff(principal.getUsername()));
    }
}
