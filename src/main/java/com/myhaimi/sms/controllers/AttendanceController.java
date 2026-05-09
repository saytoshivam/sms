package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.AttendanceMarkDTO;
import com.myhaimi.sms.DTO.AttendanceSessionCreateDTO;
import com.myhaimi.sms.DTO.AttendanceSessionSheetDTO;
import com.myhaimi.sms.DTO.attendance.AdminDailyAttendanceBoardDTO;
import com.myhaimi.sms.DTO.attendance.AdminLectureGapRowDTO;
import com.myhaimi.sms.DTO.attendance.TeacherAttendanceContextDTO;
import com.myhaimi.sms.entity.AttendanceSession;
import com.myhaimi.sms.entity.StudentAttendance;
import com.myhaimi.sms.service.impl.AttendanceService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {
    private final AttendanceService attendanceService;

    @GetMapping("/sessions")
    public Page<AttendanceSession> listSessions(
            Pageable pageable,
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return attendanceService.listSessions(pageable, classGroupId, date);
    }

    @GetMapping("/sessions/{sessionId}/sheet")
    public AttendanceSessionSheetDTO getSessionSheet(
            @PathVariable Integer sessionId, Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "";
        return attendanceService.getSessionSheet(sessionId, email);
    }

    @PostMapping("/sessions")
    public ResponseEntity<?> createSession(
            @Valid @RequestBody AttendanceSessionCreateDTO dto,
            BindingResult result,
            Authentication authentication) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        String email = authentication != null ? authentication.getName() : "";
        AttendanceSession session = attendanceService.createSession(dto, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @GetMapping("/sessions/{sessionId}/marks")
    public List<StudentAttendance> listMarks(
            @PathVariable Integer sessionId, Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "";
        return attendanceService.listMarks(sessionId, email);
    }

    @PostMapping("/sessions/{sessionId}/marks")
    public ResponseEntity<?> mark(
            @PathVariable Integer sessionId,
            @Valid @RequestBody List<AttendanceMarkDTO> marks,
            @RequestParam(required = false) String editReason,
            Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "";
        attendanceService.mark(sessionId, marks, email, editReason);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sessions/{sessionId}/submit")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<Void> submit(@PathVariable Integer sessionId, Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "";
        attendanceService.submit(sessionId, email);
        return ResponseEntity.noContent().build();
    }

    /** Teacher dashboard tiles: pending homeroom sections or today’s lecture slots from the published timetable. */
    @GetMapping("/teacher/context")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TeacherAttendanceContextDTO teacherContext(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication authentication) {
        LocalDate d = date != null ? date : LocalDate.now();
        String email = authentication != null ? authentication.getName() : "";
        return attendanceService.teacherContext(d, email);
    }

    @GetMapping("/admin/daily-board")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public AdminDailyAttendanceBoardDTO adminDailyBoard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication authentication) {
        LocalDate d = date != null ? date : LocalDate.now();
        String email = authentication != null ? authentication.getName() : "";
        return attendanceService.adminDailyBoard(d, email);
    }

    @GetMapping("/admin/lecture-gaps")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<AdminLectureGapRowDTO> adminLectureGaps(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication authentication) {
        LocalDate d = date != null ? date : LocalDate.now();
        String email = authentication != null ? authentication.getName() : "";
        return attendanceService.adminLectureGaps(d, email);
    }
}
