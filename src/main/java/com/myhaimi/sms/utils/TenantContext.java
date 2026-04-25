package com.myhaimi.sms.utils;

/**
 * Request-scoped tenant (school) identifier derived from JWT.
 * <p>
 * In this codebase {@code tenantId} is the same as {@code schoolId} stored on {@code users.school_id}.
 * </p>
 */
public final class TenantContext {
    private static final ThreadLocal<Integer> TENANT_ID = new ThreadLocal<>();

    private TenantContext() {}

    /**
     * @deprecated Prefer {@link #getTenantId()} for SaaS naming.
     */
    @Deprecated
    public static Integer getSchoolId() {
        return TENANT_ID.get();
    }

    public static Integer getTenantId() {
        return TENANT_ID.get();
    }

    /**
     * @deprecated Prefer {@link #setTenantId(Integer)}.
     */
    @Deprecated
    public static void setSchoolId(Integer schoolId) {
        TENANT_ID.set(schoolId);
    }

    public static void setTenantId(Integer tenantId) {
        TENANT_ID.set(tenantId);
    }

    public static void clear() {
        TENANT_ID.remove();
    }
}
