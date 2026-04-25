package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.platform.api.dto.PlatformOperatorNotificationDTO;
import com.myhaimi.sms.modules.platform.service.PlatformOperatorNotificationService;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/operator-notifications")
@RequiredArgsConstructor
public class PlatformOperatorNotificationsV1Controller {

    private final PlatformOperatorNotificationService platformOperatorNotificationService;
    private final UserRepo userRepo;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Page<PlatformOperatorNotificationDTO> list(
            @PageableDefault(size = 30) Pageable pageable, Authentication authentication) {
        User u = resolveActor(authentication);
        return platformOperatorNotificationService.listForUser(pageable, u.getId());
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UnreadCountResponse> unreadCount(Authentication authentication) {
        User u = resolveActor(authentication);
        long n = platformOperatorNotificationService.unreadCountForUser(u.getId());
        return ResponseEntity.ok(new UnreadCountResponse(n));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> markRead(@PathVariable long id, Authentication authentication) {
        User u = resolveActor(authentication);
        platformOperatorNotificationService.markRead(id, u.getId());
        return ResponseEntity.noContent().build();
    }

    private User resolveActor(Authentication authentication) {
        String name = authentication.getName();
        return userRepo
                .findFirstByUsernameIgnoreCaseOrEmailIgnoreCase(name, name)
                .orElseThrow(() -> new IllegalStateException("User not found: " + name));
    }

    public record UnreadCountResponse(long count) {}
}
