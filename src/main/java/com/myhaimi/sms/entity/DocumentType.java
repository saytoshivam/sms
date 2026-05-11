package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.DocumentTargetType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "document_types",
       uniqueConstraints = @UniqueConstraint(columnNames = {"code", "target_type"}))
public class DocumentType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 512)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 32)
    private DocumentTargetType targetType;

    @Column(name = "is_system_defined", nullable = false)
    private boolean systemDefined = false;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 100;
}

