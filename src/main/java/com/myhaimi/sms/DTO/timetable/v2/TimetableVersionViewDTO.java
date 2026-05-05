package com.myhaimi.sms.DTO.timetable.v2;

import com.myhaimi.sms.entity.TimetableVersion;

import java.time.Instant;

public record TimetableVersionViewDTO(
        Integer id,
        String status,
        Integer version,
        Instant generatedAt,
        Instant publishedAt
) {
    public static TimetableVersionViewDTO from(TimetableVersion v) {
        return new TimetableVersionViewDTO(
                v.getId(),
                v.getStatus().name(),
                v.getVersion(),
                v.getGeneratedAt(),
                v.getPublishedAt());
    }
}

