package com.myhaimi.sms.modules.tenant.api;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.platform.api.dto.TenantContextResponse;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tenant")
@RequiredArgsConstructor
public class TenantV1Controller {

    private final UserRepo userRepo;
    private final SchoolRepo schoolRepo;

    @GetMapping("/context")
    public ResponseEntity<TenantContextResponse> context(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepo.findFirstByEmailIgnoreCase(principal.getUsername()).orElseThrow();
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null && user.getSchool() != null) {
            tenantId = user.getSchool().getId();
        }
        if (tenantId == null) {
            return ResponseEntity.ok(new TenantContextResponse(null, null, null, principal.getUsername()));
        }
        School school = schoolRepo.findById(tenantId).orElse(null);
        if (school == null) {
            return ResponseEntity.ok(new TenantContextResponse(tenantId, null, null, principal.getUsername()));
        }
        return ResponseEntity.ok(
                new TenantContextResponse(tenantId, school.getCode(), school.getName(), principal.getUsername()));
    }
}
