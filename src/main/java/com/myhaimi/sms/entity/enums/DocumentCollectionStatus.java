package com.myhaimi.sms.entity.enums;

/**
 * Tracks whether a physical document has been collected from a person (staff or student).
 * Generic replacement for the legacy {@code StudentDocumentCollectionStatus} for use by
 * StaffDocument and any future party-agnostic document entity.
 */
public enum DocumentCollectionStatus {
    /** Physical document not yet collected. */
    PENDING_COLLECTION,
    /** Physical document has been collected and received. */
    COLLECTED_PHYSICAL,
    /** Document is not required for this person. */
    NOT_REQUIRED
}

