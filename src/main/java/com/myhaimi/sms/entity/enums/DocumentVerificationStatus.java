package com.myhaimi.sms.entity.enums;

/**
 * Tracks the verification status of a document.
 * Generic replacement for the legacy {@code StudentDocumentVerificationStatus}.
 */
public enum DocumentVerificationStatus {
    /** Document has not been reviewed yet. */
    NOT_VERIFIED,
    /** Document has been verified and approved. */
    VERIFIED,
    /** Document has been rejected — see remarks for reason. */
    REJECTED
}

