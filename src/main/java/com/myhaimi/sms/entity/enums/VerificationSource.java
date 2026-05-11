package com.myhaimi.sms.entity.enums;

/**
 * How a student document was verified.
 */
public enum VerificationSource {
    /** Admin physically inspected the original document (no upload required). */
    PHYSICAL_ORIGINAL,
    /** Verification was done against an uploaded scanned copy. */
    UPLOADED_COPY
}

