package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.announcement.AnnouncementListItemDTO;
import com.myhaimi.sms.DTO.announcement.TeacherAnnouncementCreateDTO;
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
@RequestMapping("/api/v1/teacher/announcements")
@RequiredArgsConstructor
public class TeacherAnnouncementV1Controller {

    private final AnnouncementService announcementService;

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER')")
    public ResponseEntity<AnnouncementListItemDTO> create(
            @Valid @RequestBody TeacherAnnouncementCreateDTO dto, @AuthenticationPrincipal UserDetails principal) {
        AnnouncementListItemDTO created = announcementService.createForTeacherClasses(principal.getUsername(), dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
