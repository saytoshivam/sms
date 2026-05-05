package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.timetable.engine.*;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableVersionViewDTO;
import com.myhaimi.sms.service.impl.TimetableEngineService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/timetable")
@RequiredArgsConstructor
@Slf4j
public class TimetableEngineController {

    private final TimetableEngineService timetableEngineService;

    @GetMapping("/setup")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableSetupDTO setupForTenant() {
        return timetableEngineService.setup(null);
    }

    @GetMapping("/setup/{schoolId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableSetupDTO setup(@PathVariable Integer schoolId) {
        return timetableEngineService.setup(schoolId);
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableGenerateResponseDTO generate(@Valid @RequestBody TimetableGenerateRequestDTO req) {
        try {
            return timetableEngineService.generate(req);
        } catch (Exception ex) {
            log.error("Timetable generate failed", ex);
            String msg = ex.getMessage();
            if (msg == null || msg.isBlank()) {
                msg = ex.getClass().getSimpleName();
            }
            throw new IllegalStateException("Timetable generate failed: " + msg);
        }
    }

    @PostMapping("/auto-fix")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableGenerateResponseDTO autoFix(@Valid @RequestBody TimetableGenerateRequestDTO req) {
        // Current strategy: regenerate respecting locks (bounded backtracking already tries to avoid conflicts).
        return timetableEngineService.generate(req);
    }

    @PostMapping("/save-draft")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableVersionViewDTO saveDraft(@RequestParam Integer timetableVersionId) {
        return timetableEngineService.saveDraft(timetableVersionId);
    }

    @PostMapping("/publish")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public TimetableVersionViewDTO publish(@RequestParam Integer timetableVersionId) {
        return timetableEngineService.publish(timetableVersionId);
    }

    @PostMapping("/archive")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableVersionViewDTO archive(@RequestParam Integer timetableVersionId) {
        return timetableEngineService.archive(timetableVersionId);
    }

    @PutMapping("/cell")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TimetableEntryViewDTO updateCell(@Valid @RequestBody TimetableCellUpdateDTO dto) {
        return timetableEngineService.updateCell(dto);
    }

    @GetMapping("/entries")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimetableEntryViewDTO> entries(@RequestParam Integer timetableVersionId) {
        return timetableEngineService.listEntries(timetableVersionId);
    }

    @GetMapping("/locks")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimetableCellKeyDTO> locks(@RequestParam Integer timetableVersionId) {
        return timetableEngineService.listLocks(timetableVersionId);
    }
}

