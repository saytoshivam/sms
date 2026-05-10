package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.modules.files.storage.FileStorageProvider;
import com.myhaimi.sms.modules.files.storage.LocalStorageProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Configures the active {@link FileStorageProvider} bean.
 * The local provider is always wired; S3 replaces it when storage.provider=s3.
 */
@Configuration
public class FileStorageConfig {

    /**
     * Default storage provider when storage.provider is "local" or not set at all.
     * The S3StorageProvider (created via @ConditionalOnProperty) overrides this when active.
     */
    @Bean
    @Primary
    @ConditionalOnProperty(name = "storage.provider", havingValue = "local", matchIfMissing = true)
    public FileStorageProvider localFileStorageProvider(
            @Value("${storage.local.base-path:uploads}") String basePath) {
        return new LocalStorageProvider(basePath);
    }
}

