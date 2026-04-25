package com.myhaimi.sms.modules.auth.api;

import com.myhaimi.sms.DTO.LoginDTO;
import com.myhaimi.sms.modules.auth.service.AuthApplicationService;
import com.myhaimi.sms.modules.platform.api.dto.AuthTokenResponse;
import com.myhaimi.sms.modules.platform.api.dto.PasswordResetRequest;
import com.myhaimi.sms.modules.platform.api.dto.RefreshTokenRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthV1Controller {

    private final AuthApplicationService authApplicationService;

    /**
     * Versioned login returning access + refresh tokens (opaque refresh).
     */
    @PostMapping("/login")
    public ResponseEntity<AuthTokenResponse> login(@Valid @RequestBody LoginDTO body) {
        return ResponseEntity.ok(authApplicationService.login(body));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest body) {
        return authApplicationService
                .refresh(body.refreshToken())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest body) {
        authApplicationService.logout(body.refreshToken());
        return ResponseEntity.noContent().build();
    }

    /**
     * Accepts reset requests; in production enqueue to Notification service (Kafka).
     */
    @PostMapping("/password-reset/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestPasswordReset(@Valid @RequestBody PasswordResetRequest body) {
        // Intentionally no-op / async hook — extend InProcessNotificationService for email/SMS when needed.
    }
}
