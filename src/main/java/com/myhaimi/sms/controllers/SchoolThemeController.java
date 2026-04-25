package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.SchoolThemeUpdateDTO;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.service.ISchoolService;
import com.myhaimi.sms.service.impl.SchoolService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/school")
@RequiredArgsConstructor
public class SchoolThemeController {
    private final ISchoolService schoolService;

    @PutMapping("/theme")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> updateTheme(@Valid @RequestBody SchoolThemeUpdateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        boolean superAdmin = SchoolService.isSuperAdmin();
        School updated = schoolService.updateTheme(dto, superAdmin);
        return ResponseEntity.ok(updated);
    }
}
