package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.LectureCreateDTO;
import com.myhaimi.sms.DTO.LectureDayRowDTO;
import com.myhaimi.sms.entity.Lecture;
import com.myhaimi.sms.service.impl.LectureService;
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

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/lectures")
@RequiredArgsConstructor
public class LectureController {
    private final LectureService lectureService;

    @GetMapping
    public Page<Lecture> list(Pageable pageable) {
        return lectureService.list(pageable);
    }

    /** Lectures for one class on one calendar day (for scheduling UI / conflict preview). */
    @GetMapping("/by-class-date")
    public List<LectureDayRowDTO> listByClassAndDate(
            @RequestParam Integer classGroupId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return lectureService.listByClassAndDate(classGroupId, date);
    }

    @PostMapping
    public ResponseEntity<?> create(
            @Valid @RequestBody LectureCreateDTO dto,
            BindingResult result,
            Authentication authentication) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        String email = authentication != null ? authentication.getName() : "";
        Lecture created = lectureService.create(dto, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

