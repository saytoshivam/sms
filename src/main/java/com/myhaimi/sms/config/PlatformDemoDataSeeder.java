package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.platform.domain.PlatformAnnouncement;
import com.myhaimi.sms.modules.platform.repository.PlatformAnnouncementRepository;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sample rows for platform-owner features (global feed). Idempotent: keyed by stable titles.
 * When adding new platform features with user-visible data, extend this seeder (or add a sibling runner)
 * so local/demo environments always have something to click through.
 */
@Component
@Order(6100)
@RequiredArgsConstructor
@Slf4j
public class PlatformDemoDataSeeder implements CommandLineRunner {

    private final PlatformAnnouncementRepository platformAnnouncementRepository;
    private final UserRepo userRepo;

    @Value("${sms.seed.superadmin.email:superadmin@myhaimi.com}")
    private String superAdminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        var author = userRepo.findFirstByEmailIgnoreCase(superAdminEmail).orElse(null);

        ensurePlatformAnnouncement(
                author,
                "[Demo] Welcome to MyHaimi",
                "This is sample platform-wide content for the authenticated announcement feed "
                        + "(GET /api/v1/feed/platform-announcements). Replace with real notices in production.");

        ensurePlatformAnnouncement(
                author,
                "[Demo] Platform admin console",
                "Super admins can manage tenants, plans, global feature switches, audit logs, payment webhooks, "
                        + "and runtime flags from the web UI under /app when logged in as SUPER_ADMIN.");
    }

    private void ensurePlatformAnnouncement(User author, String title, String body) {
        if (platformAnnouncementRepository.existsByTitle(title)) {
            return;
        }
        PlatformAnnouncement a = new PlatformAnnouncement();
        a.setTitle(title);
        a.setBody(body);
        a.setPublished(true);
        a.setAuthor(author);
        platformAnnouncementRepository.save(a);
        log.info("Seeded platform announcement: {}", title);
    }
}
