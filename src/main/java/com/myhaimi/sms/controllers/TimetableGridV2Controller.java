package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.timetable.v2.TimeSlotCreateDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimeSlotViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.AutoFillRequestDTO;
import com.myhaimi.sms.DTO.timetable.v2.AutoFillResultDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryUpsertDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableVersionViewDTO;
import com.myhaimi.sms.service.impl.TimetableGridV2Service;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/timetable")
@RequiredArgsConstructor
public class TimetableGridV2Controller {

    private final TimetableGridV2Service timetableGridV2Service;

    @GetMapping("/time-slots")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimeSlotViewDTO> listTimeSlots() {
        return timetableGridV2Service.listTimeSlots();
    }

    @PostMapping("/time-slots")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> createTimeSlot(@Valid @RequestBody TimeSlotCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableGridV2Service.createTimeSlot(dto));
    }

    @PutMapping("/time-slots/{timeSlotId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> updateTimeSlot(
            @PathVariable Integer timeSlotId,
            @Valid @RequestBody TimeSlotCreateDTO dto,
            BindingResult result
    ) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.ok(timetableGridV2Service.updateTimeSlot(timeSlotId, dto));
    }

    @DeleteMapping("/time-slots")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> clearTimeSlots() {
        timetableGridV2Service.clearTimeSlots();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/time-slots/generate-from-onboarding")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public List<TimeSlotViewDTO> generateSlotsFromOnboarding() {
        return timetableGridV2Service.generateSlotsFromOnboarding();
    }

    @PostMapping("/versions/draft")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableVersionViewDTO ensureDraft() {
        return timetableGridV2Service.ensureDraftVersion();
    }

    @PostMapping("/versions/workspace")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableVersionViewDTO workspaceVersion() {
        return timetableGridV2Service.currentWorkspaceVersion();
    }

    @GetMapping("/versions")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimetableVersionViewDTO> listVersions() {
        return timetableGridV2Service.listVersions();
    }

    @PostMapping("/versions/{timetableVersionId}/clear")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public TimetableGridV2Service.ClearVersionResultDTO clearVersion(@PathVariable Integer timetableVersionId) {
        return timetableGridV2Service.clearVersion(timetableVersionId);
    }

    @GetMapping("/entries")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimetableEntryViewDTO> listEntries(
            @RequestParam Integer timetableVersionId,
            @RequestParam Integer classGroupId
    ) {
        return timetableGridV2Service.listEntries(timetableVersionId, classGroupId);
    }

    @PutMapping("/entries")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableEntryViewDTO upsert(@Valid @RequestBody TimetableEntryUpsertDTO dto) {
        return timetableGridV2Service.upsertEntry(dto);
    }

    @PostMapping("/entries/auto-fill")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public AutoFillResultDTO autoFill(@Valid @RequestBody AutoFillRequestDTO dto) {
        return timetableGridV2Service.autoFill(dto);
    }

    @DeleteMapping("/entries")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> clearEntry(
            @RequestParam Integer timetableVersionId,
            @RequestParam Integer classGroupId,
            @RequestParam String dayOfWeek,
            @RequestParam Integer timeSlotId
    ) {
        timetableGridV2Service.clearEntry(timetableVersionId, classGroupId, dayOfWeek, timeSlotId);
        return ResponseEntity.noContent().build();
    }
}

