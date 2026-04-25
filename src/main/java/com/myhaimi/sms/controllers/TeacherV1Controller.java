package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.announcement.ClassGroupRefDTO;
import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.DTO.teacher.TeacherStudentProgressRowDTO;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.impl.AnnouncementService;
import com.myhaimi.sms.service.impl.TeacherProgressService;
import com.myhaimi.sms.service.impl.TimetableSlotService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/teacher")
@RequiredArgsConstructor
public class TeacherV1Controller {

    private final TeacherProgressService teacherProgressService;
    private final TimetableSlotService timetableSlotService;
    private final UserRepo userRepo;
    private final AnnouncementService announcementService;

    @GetMapping("/students/progress")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<List<TeacherStudentProgressRowDTO>> studentProgressSinceEnrollment() {
        return ResponseEntity.ok(teacherProgressService.studentProgressSinceEnrollment());
    }

    /**
     * Merged calendar: recurring weekly slots plus ad-hoc {@code Lecture} rows. When the signed-in user has a
     * {@link User#getLinkedStaff()} profile, results are filtered to that teacher.
     */
    @GetMapping("/timetable")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<List<TimetableOccurrenceDTO>> myTimetable(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepo.findFirstByEmailIgnoreCase(principal.getUsername()).orElseThrow();
        Integer staffId = user.getLinkedStaff() != null ? user.getLinkedStaff().getId() : null;
        return ResponseEntity.ok(timetableSlotService.calendar(from, to, staffId));
    }

    /** Class groups this teacher appears on in the weekly timetable (for class-scoped announcements). */
    @GetMapping("/my-class-groups")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER')")
    public ResponseEntity<List<ClassGroupRefDTO>> myClassGroups(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(announcementService.teachableClassGroupsForStaff(principal.getUsername()));
    }
}
