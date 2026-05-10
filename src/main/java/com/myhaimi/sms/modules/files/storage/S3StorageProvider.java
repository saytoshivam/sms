package com.myhaimi.sms.modules.files.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

/**
 * S3-compatible object storage provider.
 * Works with AWS S3, Cloudflare R2, and Backblaze B2 (all S3-compatible).
 * Activated when {@code storage.provider=s3}.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "storage.provider", havingValue = "s3")
public class S3StorageProvider implements FileStorageProvider {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;

    public S3StorageProvider(
            @Value("${storage.s3.bucket}")       String bucket,
            @Value("${storage.s3.region}")        String region,
            @Value("${storage.s3.access-key}")    String accessKey,
            @Value("${storage.s3.secret-key}")    String secretKey,
            @Value("${storage.s3.endpoint:}")     String endpoint) {

        this.bucket = bucket;

        var credentials = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey));

        var clientBuilder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials);

        var presignerBuilder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials);

        if (endpoint != null && !endpoint.isBlank()) {
            URI endpointUri = URI.create(endpoint);
            clientBuilder.endpointOverride(endpointUri).forcePathStyle(true);
            presignerBuilder.endpointOverride(endpointUri);
        }

        this.s3 = clientBuilder.build();
        this.presigner = presignerBuilder.build();
        log.info("S3 storage provider initialised — bucket={}, region={}", bucket, region);
    }

    @Override
    public void upload(String storageKey, InputStream inputStream, String contentType, long sizeBytes) {
        try {
            byte[] bytes = inputStream.readAllBytes();
            s3.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(storageKey)
                            .contentType(contentType)
                            .contentLength((long) bytes.length)
                            .build(),
                    RequestBody.fromBytes(bytes)
            );
            log.debug("Uploaded to S3: {}/{}", bucket, storageKey);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read upload stream: " + storageKey, e);
        }
    }

    @Override
    public String generateReadUrl(String storageKey, long ttlSeconds) {
        var presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(ttlSeconds))
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(storageKey)
                        .build())
                .build();
        return presigner.presignGetObject(presignRequest).url().toString();
    }

    @Override
    public void delete(String storageKey) {
        s3.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(storageKey)
                .build());
        log.debug("Deleted from S3: {}/{}", bucket, storageKey);
    }

    @Override
    public String providerName() {
        return "s3";
    }
}

