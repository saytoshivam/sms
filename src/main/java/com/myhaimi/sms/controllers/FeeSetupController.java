package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.fee.*;
import com.myhaimi.sms.service.impl.FeeDemandService;
import com.myhaimi.sms.service.impl.FeeSetupService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * REST controller for fee setup (fee heads, plans, plan items, installments)
 * and demand generation / listing.
 */
@RestController
@RequestMapping("/api/fees")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
public class FeeSetupController {

    private final FeeSetupService feeSetupService;
    private final FeeDemandService feeDemandService;

    // ─── Fee Heads ────────────────────────────────────────────────────────────

    @GetMapping("/heads")
    public Page<FeeHeadDTO> listFeeHeads(Pageable pageable) {
        // Idempotently seeds standard default fee heads the first time a school accesses fee management.
        feeSetupService.seedDefaultFeeHeadsIfMissing();
        return feeSetupService.listFeeHeads(pageable);
    }

    @PostMapping("/heads")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> createFeeHead(
            @Valid @RequestBody FeeHeadCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.status(HttpStatus.CREATED).body(feeSetupService.createFeeHead(dto));
    }

    @PutMapping("/heads/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> updateFeeHead(
            @PathVariable Integer id,
            @Valid @RequestBody FeeHeadCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.ok(feeSetupService.updateFeeHead(id, dto));
    }

    @PostMapping("/heads/{id}/deactivate")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<FeeHeadDTO> deactivateFeeHead(@PathVariable Integer id) {
        return ResponseEntity.ok(feeSetupService.deactivateFeeHead(id));
    }

    // ─── Fee Plans ────────────────────────────────────────────────────────────

    @GetMapping("/plans")
    public Page<FeePlanDTO> listFeePlans(Pageable pageable) {
        return feeSetupService.listFeePlans(pageable);
    }

    @PostMapping("/plans")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> createFeePlan(
            @Valid @RequestBody FeePlanCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.status(HttpStatus.CREATED).body(feeSetupService.createFeePlan(dto));
    }

    @GetMapping("/plans/{id}")
    public ResponseEntity<FeePlanDetailDTO> getFeePlan(@PathVariable Integer id) {
        return ResponseEntity.ok(feeSetupService.getFeePlanDetails(id));
    }

    @PutMapping("/plans/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> updateFeePlan(
            @PathVariable Integer id,
            @Valid @RequestBody FeePlanCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.ok(feeSetupService.updateFeePlan(id, dto));
    }

    @PostMapping("/plans/{id}/publish")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<FeePlanDTO> publishFeePlan(@PathVariable Integer id) {
        return ResponseEntity.ok(feeSetupService.publishFeePlan(id));
    }

    @PostMapping("/plans/{id}/archive")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<FeePlanDTO> archiveFeePlan(@PathVariable Integer id) {
        return ResponseEntity.ok(feeSetupService.archiveFeePlan(id));
    }

    // ─── Demand Generation ────────────────────────────────────────────────────

    /**
     * Generate (or preview) student fee demands from a published fee plan.
     *
     * <p>When {@code dryRun=true} the response contains counts but no records
     * are persisted.  Call again with {@code dryRun=false} to actually create
     * demands.</p>
     */
    @PostMapping("/plans/{planId}/generate-demands")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<DemandGenerationResultDTO> generateDemands(
            @PathVariable Integer planId,
            @RequestBody(required = false) DemandGenerationRequestDTO req) {

        boolean dryRun = req != null && req.isDryRun();
        DemandGenerationResultDTO result = dryRun
                ? feeDemandService.previewDemandGeneration(planId)
                : feeDemandService.generateDemands(planId);
        return ResponseEntity.ok(result);
    }

    // ─── Demand Listing ───────────────────────────────────────────────────────

    /**
     * List demands for the current school with optional filters.
     *
     * <p>Query params: {@code studentId}, {@code classGroupId}, {@code academicYearId},
     * {@code feePlanId}, {@code status}, {@code dueFrom} (yyyy-MM-dd), {@code dueTo}.</p>
     */
    @GetMapping("/demands")
    public ResponseEntity<List<StudentFeeDemandDTO>> listDemands(
            @RequestParam(required = false) Integer studentId,
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) Integer academicYearId,
            @RequestParam(required = false) Integer feePlanId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo) {

        List<StudentFeeDemandDTO> demands = feeDemandService.listDemands(
                studentId, classGroupId, academicYearId, feePlanId, status, dueFrom, dueTo);
        return ResponseEntity.ok(demands);
    }

    // ─── Fee Plan Items ───────────────────────────────────────────────────────

    @PostMapping("/plans/{planId}/items")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> addFeePlanItem(
            @PathVariable Integer planId,
            @Valid @RequestBody FeePlanItemCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.status(HttpStatus.CREATED).body(feeSetupService.addFeePlanItem(planId, dto));
    }

    @PutMapping("/plans/{planId}/items/{itemId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> updateFeePlanItem(
            @PathVariable Integer planId,
            @PathVariable Integer itemId,
            @Valid @RequestBody FeePlanItemCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        return ResponseEntity.ok(feeSetupService.updateFeePlanItem(planId, itemId, dto));
    }

    @DeleteMapping("/plans/{planId}/items/{itemId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<Void> deleteFeePlanItem(
            @PathVariable Integer planId,
            @PathVariable Integer itemId) {
        feeSetupService.deleteFeePlanItem(planId, itemId);
        return ResponseEntity.noContent().build();
    }

    // ─── Installments ─────────────────────────────────────────────────────────

    @PostMapping("/plans/{planId}/items/{itemId}/installments")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> addInstallments(
            @PathVariable Integer planId,
            @PathVariable Integer itemId,
            @Valid @RequestBody FeeInstallmentCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        List<FeeInstallmentDTO> saved = feeSetupService.addInstallments(planId, itemId, dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}

