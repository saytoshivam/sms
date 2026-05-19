package com.myhaimi.sms.entity.enums;

/**
 * Logical document-sequence namespaces scoped per school.
 * Each (school_id, sequence_type) pair owns its own monotone counter.
 */
public enum SequenceType {
    FEE_DEMAND,
    FEE_RECEIPT
}

