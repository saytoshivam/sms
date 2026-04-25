package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.announcement.AnnouncementCreateDTO;
import com.myhaimi.sms.DTO.announcement.AnnouncementListItemDTO;
import com.myhaimi.sms.service.impl.AnnouncementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/school/announcements")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
public class SchoolAnnouncementV1Controller {

    private final AnnouncementService announcementService;

    @PostMapping
    public ResponseEntity<AnnouncementListItemDTO> create(
            @Valid @RequestBody AnnouncementCreateDTO dto, @AuthenticationPrincipal UserDetails principal) {
        AnnouncementListItemDTO created = announcementService.createSchoolWide(principal.getUsername(), dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
