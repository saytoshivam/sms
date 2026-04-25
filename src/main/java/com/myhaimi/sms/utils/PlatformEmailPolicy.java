package com.myhaimi.sms.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class PlatformEmailPolicy {
    /**
     * Comma-separated list of allowed email domains for MyHaimi platform operations
     * (example: "myhaimi.com,myhaimi.in").
     */
    @Value("${sms.platform.owner-email-domains:myhaimi.com}")
    private String ownerDomainsRaw;

    public void requireMyHaimiOwnerEmail(String email) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("Missing email");
        String lower = email.trim().toLowerCase(Locale.ROOT);
        int at = lower.lastIndexOf('@');
        if (at < 0 || at == lower.length() - 1) throw new IllegalArgumentException("Invalid email");

        String domain = lower.substring(at + 1);
        Set<String> allowed = Arrays.stream(ownerDomainsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        if (!allowed.contains(domain)) {
            throw new SecurityException("Only MyHaimi platform accounts can perform this action");
        }
    }
}
