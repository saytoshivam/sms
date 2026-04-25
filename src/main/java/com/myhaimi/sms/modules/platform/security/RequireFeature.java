package com.myhaimi.sms.modules.platform.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * API-level feature gate evaluated against the active {@link com.myhaimi.sms.modules.subscription.domain.TenantSubscription}.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireFeature {
    /**
     * Feature code, e.g. {@code academics.exams}.
     */
    String value();
}
