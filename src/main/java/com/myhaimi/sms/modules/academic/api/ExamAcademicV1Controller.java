package com.myhaimi.sms.modules.academic.api;

import com.myhaimi.sms.modules.platform.security.RequireFeature;
import com.myhaimi.sms.modules.subscription.SubscriptionFeatureCodes;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Example module endpoint guarded by subscription feature flags.
 */
@RestController
@RequestMapping("/api/v1/academics/exams")
public class ExamAcademicV1Controller {

    @GetMapping("/health")
    @RequireFeature(SubscriptionFeatureCodes.ACADEMICS_EXAMS)
    public Map<String, String> health() {
        return Map.of("status", "ok", "module", "exams");
    }
}
