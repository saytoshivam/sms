package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;

@Data
@Entity
@Table(
        name = "rooms",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"school_id", "building", "room_number"}),
                @UniqueConstraint(columnNames = {"building_id", "room_number"})
        })
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(nullable = false, length = 64)
    private String building;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id")
    private Building buildingRef;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id")
    private Floor floorRef;

    @Column(name = "room_number", nullable = false, length = 64)
    private String roomNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RoomType type = RoomType.CLASSROOM;

    @Enumerated(EnumType.STRING)
    @Column(name = "lab_type", length = 16)
    private LabType labType;

    private Integer capacity;

    @Column(name = "floor_number")
    private Integer floorNumber;

    @Column(name = "floor_name", length = 64)
    private String floorName;

    @Column(name = "is_schedulable", nullable = false)
    private boolean schedulable = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    public void setDeleted(boolean deleted) {
        this.isDeleted = deleted;
    }

    @JsonProperty("buildingName")
    public String getBuildingName() {
        if (buildingRef != null) return buildingRef.getName();
        return building;
    }

    @JsonProperty("floorName")
    public String getFloorName() {
        String nm = floorName == null ? "" : floorName.trim();
        Integer n = floorNumber;
        if (n != null || !nm.isBlank()) {
            if (n != null && (n == 0 || nm.equalsIgnoreCase("ground"))) {
                return "Ground Floor";
            }
            if (n != null && !nm.isBlank()) return "Floor " + n + " (" + nm + ")";
            if (n != null) return "Floor " + n;
            return nm;
        }
        return floorRef == null ? null : floorRef.getName();
    }

    @JsonProperty("rawFloorNumber")
    public Integer getRawFloorNumber() {
        return floorNumber;
    }

    @JsonProperty("rawFloorName")
    public String getRawFloorName() {
        return floorName;
    }

    @JsonProperty("isSchedulable")
    public boolean getIsSchedulable() {
        return schedulable;
    }

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}

