package com.myhaimi.sms.modules.auth.service;

import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.auth.domain.RefreshToken;
import com.myhaimi.sms.modules.auth.repository.RefreshTokenRepository;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepo userRepo;
    private final JwtUtil jwtUtil;

    @Transactional
    public String issueOpaqueToken(int userId, Duration ttl) {
        byte[] rnd = new byte[48];
        SECURE_RANDOM.nextBytes(rnd);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(rnd);
        String hash = sha256Hex(raw);
        RefreshToken entity = new RefreshToken();
        entity.setUserId(userId);
        entity.setTokenHash(hash);
        entity.setExpiresAt(Instant.now().plus(ttl));
        refreshTokenRepository.save(entity);
        return raw;
    }

    @Transactional
    public Optional<String> issueNewAccessToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return Optional.empty();
        }
        String hash = sha256Hex(rawRefreshToken);
        Optional<RefreshToken> hit = refreshTokenRepository.findByTokenHash(hash);
        if (hit.isEmpty()) {
            return Optional.empty();
        }
        RefreshToken rt = hit.get();
        if (rt.isRevoked() || rt.getExpiresAt().isBefore(Instant.now())) {
            return Optional.empty();
        }
        User user = userRepo.findByIdWithSchool(rt.getUserId()).orElse(null);
        if (user == null) {
            return Optional.empty();
        }
        if (user.getSchool() != null && user.getSchool().isArchived()) {
            return Optional.empty();
        }
        String principal = user.getEmail();
        Integer tenantId = user.getSchool() != null ? user.getSchool().getId() : null;
        return Optional.of(jwtUtil.generateToken(principal, tenantId));
    }

    @Transactional
    public void revoke(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository
                .findByTokenHash(sha256Hex(rawRefreshToken))
                .ifPresent(rt -> {
                    rt.setRevokedAt(Instant.now());
                    refreshTokenRepository.save(rt);
                });
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
