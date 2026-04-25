package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.SchoolRegistrationDTO;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.platform.service.PlatformAuditService;
import com.myhaimi.sms.service.ISchoolService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin/schools")
@RequiredArgsConstructor
public class AdminSchoolController {
    private final ISchoolService schoolService;
    private final PlatformAuditService platformAuditService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody SchoolRegistrationDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String actorEmail = authentication != null ? authentication.getName() : null;

        try {
            School school = schoolService.registerSchoolForMyHaimiPlatform(dto, actorEmail);
            platformAuditService.record("SCHOOL_REGISTER", "School", String.valueOf(school.getId()), school.getCode());
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "schoolId", school.getId(),
                    "schoolCode", school.getCode()
            ));
        } catch (SecurityException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.FORBIDDEN);
        } catch (DataIntegrityViolationException e) {
            return new ResponseEntity<>("school code/username/email already exists", HttpStatus.CONFLICT);
        } catch (Exception e) {
            return new ResponseEntity<>("unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
