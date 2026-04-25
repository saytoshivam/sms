package com.myhaimi.sms.DTO;

/** Read-only plan row for owners comparing tiers (actual billing changes remain platform-operated). */
public record PlanCatalogItemDTO(String planCode, String name, String description) {}
