package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.ClassGroupDTO;
import com.myhaimi.sms.DTO.ClassGroupSectionSummaryDTO;
import com.myhaimi.sms.DTO.ClassTeacherBatchAssignDTO;
import com.myhaimi.sms.DTO.ClassTeacherAssignDTO;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.service.impl.ClassGroupService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/class-groups")
@RequiredArgsConstructor
public class ClassGroupController {
    private final ClassGroupService classGroupService;

    @GetMapping
    public Page<ClassGroup> list(Pageable pageable) {
        return classGroupService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ClassGroupDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        ClassGroup created = classGroupService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}/class-teacher")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> assignClassTeacher(
            @PathVariable int id,
            @Valid @RequestBody ClassTeacherAssignDTO body,
            BindingResult result,
            Authentication authentication) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        String email = authentication != null ? authentication.getName() : "";
        ClassGroup updated = classGroupService.assignClassTeacher(id, body.staffId(), email);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/sections-summary")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<ClassGroupSectionSummaryDTO> sectionsSummary() {
        return classGroupService.listSectionsSummary();
    }

    @PostMapping("/class-teachers/batch")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> assignClassTeacherBatch(
            @Valid @RequestBody ClassTeacherBatchAssignDTO body,
            BindingResult result,
            Authentication authentication
    ) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        String email = authentication != null ? authentication.getName() : "";
        classGroupService.assignClassTeachersBatch(body, email);
        return ResponseEntity.noContent().build();
    }
}

