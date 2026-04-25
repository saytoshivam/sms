package com.myhaimi.sms.modules.subscription.api;

import com.myhaimi.sms.modules.platform.api.dto.PlatformSchoolListItem;
import com.myhaimi.sms.modules.subscription.service.PlatformSchoolAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/platform")
@RequiredArgsConstructor
public class PlatformSchoolV1Controller {

    private final PlatformSchoolAdminService platformSchoolAdminService;

    @GetMapping("/schools")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<PlatformSchoolListItem> listSchools() {
        return platformSchoolAdminService.listAllSchoolsWithSubscriptions();
    }
}
