package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PlatformAnnouncementResponse;
import com.myhaimi.sms.modules.platform.service.PlatformAnnouncementAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/feed/platform-announcements")
@RequiredArgsConstructor
public class PlatformAnnouncementFeedV1Controller {

    private final PlatformAnnouncementAdminService announcementAdminService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<PlatformAnnouncementResponse> published() {
        return announcementAdminService.listPublishedFeed();
    }
}
