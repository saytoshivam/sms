package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.StudentCreateDTO;
import com.myhaimi.sms.DTO.StudentViewDTO;
import com.myhaimi.sms.service.impl.StudentService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {
    private final StudentService studentService;

    @GetMapping
    public Page<StudentViewDTO> list(Pageable pageable) {
        return studentService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody StudentCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        StudentViewDTO created = studentService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

