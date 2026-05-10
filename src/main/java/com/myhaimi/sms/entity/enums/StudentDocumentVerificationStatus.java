package com.myhaimi.sms.entity.enums;

/**
 * Tracks the verification status of an uploaded document.
 */
public enum StudentDocumentVerificationStatus {
    /** Document has not been verified yet. */
    NOT_VERIFIED,
    /** Document has been verified and approved. */
    VERIFIED,
    /** Document has been rejected. */
    REJECTED
}
