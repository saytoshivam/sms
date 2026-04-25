package com.myhaimi.sms.modules.tenant.api.dto;

import java.util.List;

/**
 * Tenant subscription features plus role-derived permissions, and permissions after subscription gating.
 */
public record TenantCapabilitiesResponse(
        List<String> subscriptionFeatureCodes,
        List<String> permissionsGranted,
        List<String> permissionsEffective) {}
