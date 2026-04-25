package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.AttendanceSettingsDTO;
import com.myhaimi.sms.DTO.PlanCatalogItemDTO;
import com.myhaimi.sms.DTO.SchoolManagementOverviewDTO;
import com.myhaimi.sms.DTO.SchoolUserRowDTO;
import com.myhaimi.sms.DTO.SchoolUserRolesUpdateDTO;
import com.myhaimi.sms.DTO.TenantPlanChangeRequestDTO;
import com.myhaimi.sms.service.impl.SchoolManagementService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/school/management")
@RequiredArgsConstructor
public class SchoolManagementV1Controller {

    private final SchoolManagementService schoolManagementService;

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<SchoolManagementOverviewDTO> overview() {
        return ResponseEntity.ok(schoolManagementService.overview());
    }

    @GetMapping("/attendance-settings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<AttendanceSettingsDTO> attendanceSettings() {
        return ResponseEntity.ok(schoolManagementService.getAttendanceSettings());
    }

    @PutMapping("/attendance-settings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> updateAttendanceSettings(
            @Valid @RequestBody AttendanceSettingsDTO body,
            BindingResult result,
            Authentication authentication) {
        ResponseEntity<?> err = CommonUtil.dtoBindingResults(result);
        if (err.getStatusCode().is4xxClientError()) {
            return err;
        }
        schoolManagementService.updateAttendanceSettings(body.attendanceMode(), authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<SchoolUserRowDTO> users() {
        return schoolManagementService.listSchoolUsers();
    }

    @GetMapping("/subscription/catalog")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<PlanCatalogItemDTO> planCatalog() {
        return schoolManagementService.planCatalog();
    }

    @PostMapping("/subscription/plan-request")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<?> requestPlanChange(
            @Valid @RequestBody TenantPlanChangeRequestDTO body, BindingResult result) {
        ResponseEntity<?> err = CommonUtil.dtoBindingResults(result);
        if (err.getStatusCode().is4xxClientError()) {
            return err;
        }
        schoolManagementService.requestPlanChange(body.targetPlanCode(), body.message());
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/assignable-roles")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL')")
    public List<String> assignableRoles(Authentication authentication) {
        return schoolManagementService.assignableRolesForActor(authentication.getName());
    }

    @PutMapping("/users/{userId}/roles")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL')")
    public ResponseEntity<?> updateUserRoles(
            @PathVariable int userId,
            @Valid @RequestBody SchoolUserRolesUpdateDTO body,
            BindingResult result,
            Authentication authentication) {
        ResponseEntity<?> err = CommonUtil.dtoBindingResults(result);
        if (err.getStatusCode().is4xxClientError()) {
            return err;
        }
        schoolManagementService.updateSchoolUserRoles(userId, body.roles(), authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
