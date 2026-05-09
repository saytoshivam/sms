package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.announcement.AnnouncementDetailDTO;
import com.myhaimi.sms.DTO.announcement.AnnouncementListItemDTO;
import com.myhaimi.sms.DTO.studentportal.FeeStatementDTO;
import com.myhaimi.sms.DTO.studentportal.UnreadCountDTO;
import com.myhaimi.sms.DTO.studentportal.StudentExamCardDTO;
import com.myhaimi.sms.DTO.studentportal.StudentMarkRowDTO;
import com.myhaimi.sms.DTO.studentportal.StudentDailyAttendanceRowDTO;
import com.myhaimi.sms.DTO.studentportal.StudentSubjectAttendanceDTO;
import com.myhaimi.sms.DTO.timetable.PublishedStudentWeeklyTimetableDTO;
import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.entity.AnnouncementCategory;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.impl.AnnouncementService;
import com.myhaimi.sms.service.impl.StudentPortalService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/student/me")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentPortalV1Controller {

    private final UserRepo userRepo;
    private final StudentPortalService studentPortalService;
    private final AnnouncementService announcementService;

    @GetMapping("/schedule")
    public ResponseEntity<List<TimetableOccurrenceDTO>> schedule(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(studentPortalService.mySchedule(studentId, from, to));
    }

    /** Today’s classes only (recurring + one-off) for the dashboard. */
    @GetMapping("/schedule/today")
    public ResponseEntity<List<TimetableOccurrenceDTO>> scheduleToday(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        LocalDate t = LocalDate.now();
        return ResponseEntity.ok(studentPortalService.mySchedule(studentId, t, t));
    }

    /** Published class timetable: period × day grid for the student's section. */
    @GetMapping("/timetable/weekly-published")
    public PublishedStudentWeeklyTimetableDTO weeklyPublishedTimetable(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        return studentPortalService.myWeeklyTimetable(studentId);
    }

    @GetMapping("/marks")
    public ResponseEntity<List<StudentMarkRowDTO>> marks(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(studentPortalService.myMarks(studentId));
    }

    /** Upcoming exams (hall-ticket style cards); demo schedule for Greenwood demo school. */
    @GetMapping("/exams")
    public ResponseEntity<List<StudentExamCardDTO>> exams(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(studentPortalService.myExamCards(studentId));
    }

    @GetMapping("/subject-attendance")
    public ResponseEntity<List<StudentSubjectAttendanceDTO>> subjectAttendance(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(studentPortalService.mySubjectAttendance(studentId));
    }

    /** Day-level roll when the school uses {@code DAILY} attendance; empty for lecture-wise schools. */
    @GetMapping("/daily-attendance")
    public ResponseEntity<List<StudentDailyAttendanceRowDTO>> dailyAttendance(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(studentPortalService.myDailyAttendance(studentId));
    }

    @GetMapping("/announcements")
    public ResponseEntity<List<AnnouncementListItemDTO>> announcements(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String category) {
        int studentId = linkedStudentId(principal);
        AnnouncementCategory cat = parseCategory(category);
        return ResponseEntity.ok(announcementService.listForStudent(studentId, cat));
    }

    /** Must be registered before {@code /announcements/{id}} so "unread-count" is not parsed as an id. */
    @GetMapping("/announcements/unread-count")
    public ResponseEntity<UnreadCountDTO> unreadAnnouncementCount(@AuthenticationPrincipal UserDetails principal) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(new UnreadCountDTO(announcementService.countUnreadAnnouncements(studentId)));
    }

    @PostMapping("/announcements/{id}/read")
    public ResponseEntity<Void> markAnnouncementRead(
            @AuthenticationPrincipal UserDetails principal, @PathVariable int id) {
        int studentId = linkedStudentId(principal);
        announcementService.markAnnouncementRead(studentId, id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @GetMapping("/announcements/{id}")
    public ResponseEntity<AnnouncementDetailDTO> announcement(
            @AuthenticationPrincipal UserDetails principal, @PathVariable int id) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(announcementService.getForStudent(studentId, id));
    }

    /** Ledger fee statement (DR charges, CR payments) with optional India FY filter {@code 2025-2026}. */
    @GetMapping("/fee-statement")
    public ResponseEntity<FeeStatementDTO> feeStatement(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String financialYear) {
        int studentId = linkedStudentId(principal);
        return ResponseEntity.ok(studentPortalService.myFeeStatement(studentId, financialYear));
    }

    private static AnnouncementCategory parseCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        try {
            return AnnouncementCategory.valueOf(category.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown category: use ACADEMIC, PLACEMENT, EXAMINATION, or GENERAL");
        }
    }

    private int linkedStudentId(UserDetails principal) {
        User user = userRepo.findFirstByEmailIgnoreCase(principal.getUsername()).orElseThrow();
        if (user.getLinkedStudent() == null) {
            throw new IllegalStateException("No linked student profile for this account");
        }
        return user.getLinkedStudent().getId();
    }
}
