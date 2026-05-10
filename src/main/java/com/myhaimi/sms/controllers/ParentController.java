package com.myhaimi.sms.controllers;

import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.service.impl.ParentLoginService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parents")
@RequiredArgsConstructor
public class ParentController {

    private final ParentLoginService parentLoginService;

    /**
     * GET /api/parents/{parentUserId}/linked-students
     * Returns all students accessible by this parent user.
     */
    @GetMapping("/{parentUserId}/linked-students")
    public ResponseEntity<?> linkedStudents(@PathVariable Integer parentUserId) {
        try {
            List<Student> students = parentLoginService.getLinkedStudents(parentUserId);
            return ResponseEntity.ok(students);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}

