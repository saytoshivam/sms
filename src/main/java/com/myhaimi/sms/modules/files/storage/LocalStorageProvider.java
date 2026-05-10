package com.myhaimi.sms.modules.files.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * Stores files on the local filesystem.
 * Used in development or single-node deployments.
 * Download URLs are served via {@link com.myhaimi.sms.modules.files.FileServeController}.
 */
@Slf4j
@Component
public class LocalStorageProvider implements FileStorageProvider {

    private final Path basePath;

    public LocalStorageProvider(@Value("${storage.local.base-path:uploads}") String basePathStr) {
        this.basePath = Paths.get(basePathStr).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.basePath);
            log.info("Local file storage root: {}", this.basePath);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create local storage directory: " + this.basePath, e);
        }
    }

    @Override
    public void upload(String storageKey, InputStream inputStream, String contentType, long sizeBytes) {
        Path target = resolve(storageKey);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            log.debug("Stored file locally: {}", target);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write file to local storage: " + storageKey, e);
        }
    }

    @Override
    public String generateReadUrl(String storageKey, long ttlSeconds) {
        // Local storage: serve via internal download endpoint (JWT-protected)
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/files/local/")
                .path(storageKey)
                .toUriString();
    }

    @Override
    public Resource loadAsResource(String storageKey) {
        Path file = resolve(storageKey);
        if (!Files.exists(file)) {
            throw new IllegalArgumentException("File not found in local storage: " + storageKey);
        }
        return new FileSystemResource(file);
    }

    @Override
    public void delete(String storageKey) {
        try {
            Files.deleteIfExists(resolve(storageKey));
        } catch (IOException e) {
            log.warn("Could not delete local file {}: {}", storageKey, e.getMessage());
        }
    }

    @Override
    public String providerName() {
        return "local";
    }

    /** Resolves a storage key to an absolute Path, guarding against path-traversal. */
    public Path resolve(String storageKey) {
        Path resolved = basePath.resolve(storageKey).normalize();
        if (!resolved.startsWith(basePath)) {
            throw new IllegalArgumentException("Storage key escapes base path: " + storageKey);
        }
        return resolved;
    }
}

