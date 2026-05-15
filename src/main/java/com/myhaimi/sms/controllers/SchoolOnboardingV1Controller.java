package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.OnboardingBasicInfoDTO;
import com.myhaimi.sms.DTO.OnboardingClassesSetupDTO;
import com.myhaimi.sms.DTO.OnboardingClassesSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingProgressDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectClassMappingDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectClassMappingsResultDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectCreateDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectsSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingRoomCreateDTO;
import com.myhaimi.sms.DTO.OnboardingRoomsSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingClassDefaultRoomItemDTO;
import com.myhaimi.sms.DTO.OnboardingClassDefaultRoomViewDTO;
import com.myhaimi.sms.DTO.OnboardingFeesSetupDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStructureSaveDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStructureViewDTO;
import com.myhaimi.sms.DTO.OnboardingTimetableAutoGenerateViewDTO;
import com.myhaimi.sms.DTO.TeacherDemandSummaryDTO;
import com.myhaimi.sms.DTO.OnboardingStudentCreateDTO;
import com.myhaimi.sms.DTO.OnboardingStudentsSetupResultDTO;
import com.myhaimi.sms.service.impl.SchoolOnboardingService;
import com.myhaimi.sms.service.impl.TeacherDemandAnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/onboarding")
@RequiredArgsConstructor
public class SchoolOnboardingV1Controller {

    private final SchoolOnboardingService schoolOnboardingService;
    private final TeacherDemandAnalysisService teacherDemandAnalysisService;

    @GetMapping("/progress")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public OnboardingProgressDTO progress() {
        return schoolOnboardingService.progress();
    }

    @GetMapping("/basic-info")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> basicInfo() {
        OnboardingBasicInfoDTO dto = schoolOnboardingService.basicInfo();
        return dto == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(dto);
    }

    @PutMapping("/basic-info")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> saveBasicInfo(@Valid @RequestBody OnboardingBasicInfoDTO body) {
        schoolOnboardingService.saveBasicInfo(body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/basic-info")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> saveBasicInfoPost(@Valid @RequestBody OnboardingBasicInfoDTO body) {
        // Alias for clients that submit POST from onboarding wizard.
        schoolOnboardingService.saveBasicInfo(body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/classes/generate")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<OnboardingClassesSetupResultDTO> generateClasses(@Valid @RequestBody OnboardingClassesSetupDTO body) {
        return ResponseEntity.ok(schoolOnboardingService.generateClasses(body));
    }

    @PostMapping("/subjects")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<OnboardingSubjectsSetupResultDTO> createSubjects(@Valid @RequestBody List<OnboardingSubjectCreateDTO> body) {
        return ResponseEntity.ok(schoolOnboardingService.createSubjects(body));
    }

    @GetMapping("/subject-class-mappings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<OnboardingSubjectClassMappingDTO> subjectClassMappings() {
        return schoolOnboardingService.listSubjectClassMappings();
    }

    @PostMapping("/subject-class-mappings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<OnboardingSubjectClassMappingsResultDTO> saveSubjectClassMappings(
            @Valid @RequestBody List<OnboardingSubjectClassMappingDTO> body) {
        return ResponseEntity.ok(schoolOnboardingService.saveSubjectClassMappings(body));
    }

    @PostMapping("/rooms")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<OnboardingRoomsSetupResultDTO> createRooms(@Valid @RequestBody List<OnboardingRoomCreateDTO> body) {
        return ResponseEntity.ok(schoolOnboardingService.createRooms(body));
    }

    @PostMapping("/rooms/skip")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> skipRooms() {
        schoolOnboardingService.skipRoomsOnboarding();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/class-default-rooms")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public List<OnboardingClassDefaultRoomViewDTO> classDefaultRooms() {
        return schoolOnboardingService.listClassDefaultRooms();
    }

    @PutMapping("/class-default-rooms")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> saveClassDefaultRooms(@Valid @RequestBody List<OnboardingClassDefaultRoomItemDTO> body) {
        schoolOnboardingService.saveClassDefaultRooms(body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/roles/complete")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> completeRoles() {
        schoolOnboardingService.completeRolesStep();
        return ResponseEntity.noContent().build();
    }

    // All staff/teacher endpoints have been moved to StaffController at /api/staff/...
    // GET  /api/staff                - staff directory
    // GET  /api/staff/{id}           - staff profile
    // GET  /api/staff/{id}/profile   - staff profile (alias)
    // POST /api/staff/onboard        - create staff (structured)
    // PUT  /api/staff/{id}/onboard   - update staff (structured)
    // GET  /api/staff/{id}/delete-info
    // DELETE /api/staff/{id}
    // POST /api/staff/{id}/reset-password

    @GetMapping("/fees")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD','ACCOUNTANT')")
    public ResponseEntity<?> fees() {
        OnboardingFeesSetupDTO dto = schoolOnboardingService.fees();
        return dto == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(dto);
    }

    @PutMapping("/fees")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','ACCOUNTANT')")
    public ResponseEntity<?> saveFees(@Valid @RequestBody OnboardingFeesSetupDTO body) {
        schoolOnboardingService.saveFees(body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/students")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<OnboardingStudentsSetupResultDTO> createStudents(
            @Valid @RequestBody java.util.List<OnboardingStudentCreateDTO> body) {
        return ResponseEntity.ok(schoolOnboardingService.createStudents(body));
    }

    @GetMapping("/academic-structure")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public OnboardingAcademicStructureViewDTO academicStructure() {
        return schoolOnboardingService.listAcademicStructure();
    }

    /** Same actors as GET — leadership edits mappings from Operations Hub / Academic module. */
    @PutMapping("/academic-structure")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> saveAcademicStructure(@Valid @RequestBody OnboardingAcademicStructureSaveDTO body) {
        schoolOnboardingService.saveAcademicStructure(body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/teacher-demand-summary")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public TeacherDemandSummaryDTO teacherDemandSummary() {
        return teacherDemandAnalysisService.summarize();
    }

    @PostMapping("/timetable/auto-generate")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<OnboardingTimetableAutoGenerateViewDTO> autoGenerateTimetable() {
        return ResponseEntity.ok(schoolOnboardingService.autoGenerateTimetableDraft());
    }

    @PostMapping("/timetable/complete")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> completeTimetable() {
        schoolOnboardingService.completeTimetableOnboarding();
        return ResponseEntity.noContent().build();
    }
}

