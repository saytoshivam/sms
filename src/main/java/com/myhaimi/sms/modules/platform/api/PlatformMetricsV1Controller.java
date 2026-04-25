package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PlatformMetricsResponse;
import com.myhaimi.sms.modules.platform.service.PlatformMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/metrics")
@RequiredArgsConstructor
public class PlatformMetricsV1Controller {

    private final PlatformMetricsService platformMetricsService;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlatformMetricsResponse metrics() {
        return platformMetricsService.metrics();
    }
}
