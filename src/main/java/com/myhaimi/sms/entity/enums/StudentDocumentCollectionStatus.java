package com.myhaimi.sms.entity.enums;

/**
 * Tracks whether a physical document has been collected from the student/guardian.
 */
public enum StudentDocumentCollectionStatus {
    /** Physical document not yet collected from student/guardian. */
    PENDING_COLLECTION,
    /** Physical document has been collected and received. */
    COLLECTED_PHYSICAL,
    /** Document is not required for this student. */
    NOT_REQUIRED
}
