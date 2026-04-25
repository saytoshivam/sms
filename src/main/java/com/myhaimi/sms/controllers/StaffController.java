package com.myhaimi.sms.controllers;

import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.service.impl.StaffService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {
    private final StaffService staffService;

    @GetMapping
    public Page<Staff> list(Pageable pageable) {
        return staffService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Staff staff) {
        Staff created = staffService.create(staff);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

