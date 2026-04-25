package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.performance.StudentPerformanceDashboardDTO;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.impl.StudentPerformanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/students")
@RequiredArgsConstructor
public class StudentPerformanceV1Controller {

    private final StudentPerformanceService studentPerformanceService;
    private final UserRepo userRepo;

    @GetMapping("/{studentId}/performance")
    @PreAuthorize("!hasRole('STUDENT')")
    public ResponseEntity<StudentPerformanceDashboardDTO> performance(
            @PathVariable int studentId, @RequestParam(defaultValue = "false") boolean sinceJoin) {
        return ResponseEntity.ok(studentPerformanceService.dashboard(studentId, sinceJoin));
    }

    @GetMapping("/me/performance")
    public ResponseEntity<StudentPerformanceDashboardDTO> myPerformance(
            @AuthenticationPrincipal UserDetails principal, @RequestParam(defaultValue = "false") boolean sinceJoin) {
        User user = userRepo.findFirstByEmailIgnoreCase(principal.getUsername()).orElseThrow();
        if (user.getLinkedStudent() == null) {
            throw new IllegalStateException("No linked student profile for this account");
        }
        return ResponseEntity.ok(studentPerformanceService.dashboard(user.getLinkedStudent().getId(), sinceJoin));
    }
}
