package com.myhaimi.sms.config;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Clears failed rows in {@code flyway_schema_history} (e.g. after a crashed migration) before applying pending
 * migrations. Without this, Flyway refuses to {@code migrate()} when a version is marked failed.
 */
@Configuration
public class FlywayRepairBeforeMigrateConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
