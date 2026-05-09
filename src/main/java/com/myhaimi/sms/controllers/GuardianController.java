package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.student.GuardianStandaloneCreateDTO;
import com.myhaimi.sms.entity.Guardian;
import com.myhaimi.sms.service.impl.GuardianService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
    public ResponseEntity<?> create(@Valid @RequestBody GuardianStandaloneCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            guardianService.create(dto);
            return ResponseEntity.status(HttpStatus.CREATED).build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
