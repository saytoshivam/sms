package com.myhaimi.sms.entity.enums;

/**
 * @deprecated Use {@link DocumentVerificationStatus} instead.
 * Retained for backward compatibility with existing test code.
 */
@Deprecated
public enum StudentDocumentVerificationStatus {
    /** Document has not been verified yet. */
    NOT_VERIFIED,
    /** Document has been verified and approved. */
    VERIFIED,
    /** Document has been rejected. */
    REJECTED
}