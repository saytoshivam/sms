package com.myhaimi.sms.modules.subscription.bootstrap;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionFeature;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlanFeature;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionFeatureRepository;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanFeatureRepository;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds the default subscription catalog (plans + features + plan→feature mappings) when the
 * tables are empty. Mirrors {@code V20260418000002__seed_subscription_catalog.sql} so the app
 * works on a fresh dev DB without Flyway being enabled.
 *
 * Runs before {@link TenantSubscriptionBootstrap} (order 5000) so BASIC is guaranteed to exist
 * when tenant subscriptions are auto-created.
 */
@Component
@Order(4500)
@RequiredArgsConstructor
@Slf4j
public class SubscriptionCatalogBootstrap implements CommandLineRunner {

    private final SubscriptionPlanRepository planRepo;
    private final SubscriptionFeatureRepository featureRepo;
    private final SubscriptionPlanFeatureRepository planFeatureRepo;

    private static final List<PlanSeed> PLANS = List.of(
            new PlanSeed("BASIC", "Basic", "Core student and attendance workflows"),
            new PlanSeed("PREMIUM", "Premium", "Adds exams, timetable, and parent portal"),
            new PlanSeed(
                    "ENTERPRISE",
                    "Enterprise",
                    "Adds PDF report cards, online payments, and advanced analytics"));

    private static final Map<String, String> FEATURES = featuresInOrder();

    private static final List<String> BASIC_FEATURES = List.of(
            "core.students", "core.attendance", "academics.subjects", "fees.billing");

    private static final List<String> PREMIUM_FEATURES = List.of(
            "core.students",
            "core.attendance",
            "academics.subjects",
            "academics.timetable",
            "academics.exams",
            "fees.billing",
            "notifications.email_sms",
            "parent.portal");

    @Override
    @Transactional
    public void run(String... args) {
        for (PlanSeed seed : PLANS) {
            planRepo.findByPlanCodeIgnoreCase(seed.code).orElseGet(() -> {
                SubscriptionPlan p = new SubscriptionPlan();
                p.setPlanCode(seed.code);
                p.setName(seed.name);
                p.setDescription(seed.description);
                p.setActive(true);
                log.info("Seeding subscription plan {}", seed.code);
                return planRepo.save(p);
            });
        }

        for (Map.Entry<String, String> entry : FEATURES.entrySet()) {
            String code = entry.getKey();
            String[] parts = entry.getValue().split("\\|", 2);
            String name = parts[0];
            String description = parts.length > 1 ? parts[1] : null;
            featureRepo.findByFeatureCode(code).orElseGet(() -> {
                SubscriptionFeature f = new SubscriptionFeature();
                f.setFeatureCode(code);
                f.setName(name);
                f.setDescription(description);
                f.setGloballyEnabled(true);
                log.info("Seeding subscription feature {}", code);
                return featureRepo.save(f);
            });
        }

        seedPlanFeatures("BASIC", BASIC_FEATURES);
        seedPlanFeatures("PREMIUM", PREMIUM_FEATURES);
        seedPlanFeatures("ENTERPRISE", List.copyOf(FEATURES.keySet()));
    }

    private void seedPlanFeatures(String planCode, List<String> featureCodes) {
        SubscriptionPlan plan = planRepo.findByPlanCodeIgnoreCase(planCode).orElse(null);
        if (plan == null) return;
        for (String code : featureCodes) {
            SubscriptionFeature feature = featureRepo.findByFeatureCode(code).orElse(null);
            if (feature == null) continue;
            SubscriptionPlanFeature.PlanFeatureKey key =
                    new SubscriptionPlanFeature.PlanFeatureKey(plan.getId(), feature.getId());
            if (planFeatureRepo.existsById(key)) continue;
            SubscriptionPlanFeature pf = new SubscriptionPlanFeature();
            pf.setPlanId(plan.getId());
            pf.setFeatureId(feature.getId());
            pf.setEnabled(true);
            planFeatureRepo.save(pf);
        }
    }

    private static Map<String, String> featuresInOrder() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("core.students", "Students|Student profiles and admissions");
        m.put("core.attendance", "Attendance|Daily attendance and reports");
        m.put("academics.subjects", "Subjects|Subjects catalog");
        m.put("academics.timetable", "Timetable|Class timetable");
        m.put("academics.exams", "Exams|Exam scheduling and marks");
        m.put("academics.report_cards_pdf", "Report cards (PDF)|Generated report cards");
        m.put("fees.billing", "Fee billing|Invoices and fee structures");
        m.put("fees.online_payments", "Online payments|Integrates with payment service");
        m.put("notifications.email_sms", "Notifications|Email/SMS via notification service");
        m.put("parent.portal", "Parent portal|Parent dashboards and messaging");
        m.put("analytics.advanced", "Advanced analytics|Cross-school analytics (enterprise)");
        return m;
    }

    private record PlanSeed(String code, String name, String description) {}
}
