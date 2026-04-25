package com.myhaimi.sms.modules.auth.service;

import com.myhaimi.sms.DTO.LoginDTO;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.platform.api.dto.AuthTokenResponse;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthApplicationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepo userRepo;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;

    @Value("${app.jwt.expiration-ms:3600000}")
    private long accessTokenExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms:1209600000}")
    private long refreshTokenExpirationMs;

    @Transactional
    public AuthTokenResponse login(LoginDTO credentials) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(credentials.getUsername(), credentials.getPassword()));
        User user = userRepo
                .findFirstWithSchoolByUsernameOrEmail(credentials.getUsername())
                .orElseThrow();
        String principal = user.getEmail();
        Integer tenantId = user.getSchool() != null ? user.getSchool().getId() : null;
        String accessToken = jwtUtil.generateToken(principal, tenantId);
        String refreshToken = refreshTokenService.issueOpaqueToken(user.getId(), Duration.ofMillis(refreshTokenExpirationMs));
        return new AuthTokenResponse(accessToken, refreshToken, accessTokenExpirationMs, "Bearer");
    }

    @Transactional(readOnly = true)
    public Optional<AuthTokenResponse> refresh(String rawRefreshToken) {
        return refreshTokenService
                .issueNewAccessToken(rawRefreshToken)
                .map(at -> new AuthTokenResponse(at, null, accessTokenExpirationMs, "Bearer"));
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenService.revoke(rawRefreshToken);
    }
}
