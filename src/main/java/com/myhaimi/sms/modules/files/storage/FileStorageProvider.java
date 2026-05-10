package com.myhaimi.sms.modules.files.storage;

import org.springframework.core.io.Resource;

import java.io.InputStream;

/**
 * Abstraction over any binary object store (local disk, S3, R2, B2…).
 * Implementations must be thread-safe.
 */
public interface FileStorageProvider {

    /**
     * Upload bytes from the given stream under the given storage key.
     *
     * @param storageKey  Full path key (e.g. schools/1/PROFILE_PHOTO/…/uuid-file.jpg)
     * @param inputStream Raw byte stream; caller is responsible for closing it after this returns.
     * @param contentType MIME type
     * @param sizeBytes   Known file size, or -1 if unknown (some providers require it).
     */
    void upload(String storageKey, InputStream inputStream, String contentType, long sizeBytes);

    /**
     * Generate a time-limited read URL.
     * For local storage this is a backend-proxied URL; for S3 it is a presigned URL.
     *
     * @param storageKey Full path key
     * @param ttlSeconds URL lifetime in seconds (1 hour = 3600)
     * @return Absolute URL
     */
    String generateReadUrl(String storageKey, long ttlSeconds);

    /**
     * Load the stored object as a Spring {@link Resource} for authenticated streaming.
     * The returned stream must be closed by the caller (Spring MVC does this automatically
     * when used with ResponseEntity&lt;Resource&gt;).
     *
     * @param storageKey Full path key
     * @return Resource ready for streaming
     * @throws IllegalArgumentException if the key does not exist or fails path validation
     */
    Resource loadAsResource(String storageKey);

    /**
     * Permanently delete the stored object.
     * Callers should soft-delete the {@link com.myhaimi.sms.entity.FileObject} DB row first,
     * then call this to remove the physical bytes.
     */
    void delete(String storageKey);

    /** Provider name token, e.g. "local" or "s3". Stored in FileObject.storageProvider. */
    String providerName();
}

