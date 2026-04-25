package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.SchoolBrandingDTO;
import com.myhaimi.sms.service.ISchoolService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/public/schools")
@RequiredArgsConstructor
public class SchoolBrandingPublicController {
    private final ISchoolService schoolService;

    @GetMapping("/{schoolCode}/branding")
    public ResponseEntity<SchoolBrandingDTO> branding(@PathVariable String schoolCode) {
        return ResponseEntity.ok(schoolService.getBrandingByCode(schoolCode));
    }
}
