package com.myhaimi.sms.entity.enums;

/**
 * @deprecated Use {@link DocumentCollectionStatus} instead.
 * This enum is retained only for backward compatibility with existing test code.
 * It will be removed in a future cleanup. All new production code must use {@link DocumentCollectionStatus}.
 */
@Deprecated
public enum StudentDocumentCollectionStatus {
    /** Physical document not yet collected from student/guardian. */
    PENDING_COLLECTION,
    /** Physical document has been collected and received. */
    COLLECTED_PHYSICAL,
    /** Document is not required for this student. */
    NOT_REQUIRED
}