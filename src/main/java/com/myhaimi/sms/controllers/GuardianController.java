package com.myhaimi.sms.controllers;

import com.myhaimi.sms.entity.Guardian;
import com.myhaimi.sms.service.impl.GuardianService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guardians")
@RequiredArgsConstructor
public class GuardianController {
    private final GuardianService guardianService;

    @GetMapping
    public Page<Guardian> list(@RequestParam(required = false) Integer studentId, Pageable pageable) {
        return guardianService.list(studentId, pageable);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Guardian guardian) {
        Guardian created = guardianService.create(guardian);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

