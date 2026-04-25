package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.DTO.timetable.TimetableSlotCreateDTO;
import com.myhaimi.sms.DTO.timetable.TimetableSlotViewDTO;
import com.myhaimi.sms.service.impl.TimetableSlotService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/timetable")
@RequiredArgsConstructor
public class TimetableSlotV1Controller {

    private final TimetableSlotService timetableSlotService;

    @GetMapping("/slots")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimetableSlotViewDTO> listSlots() {
        return timetableSlotService.listSlotViews();
    }

    @PostMapping("/slots")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> createSlot(@Valid @RequestBody TimetableSlotCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) {
            return res;
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableSlotService.create(dto));
    }

    @DeleteMapping("/slots/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<Void> deleteSlot(@PathVariable int id) {
        timetableSlotService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Full-school calendar (optional {@code staffId} narrows to one teacher). */
    @GetMapping("/calendar")
    @PreAuthorize("hasAnyRole('TEACHER','CLASS_TEACHER','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<TimetableOccurrenceDTO> calendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer staffId) {
        return timetableSlotService.calendar(from, to, staffId);
    }
}
