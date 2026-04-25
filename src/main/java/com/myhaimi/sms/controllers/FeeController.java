package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.FeeInvoiceCreateDTO;
import com.myhaimi.sms.DTO.FeePaymentCreateDTO;
import com.myhaimi.sms.DTO.FeeSchoolSummaryDTO;
import com.myhaimi.sms.entity.FeeInvoice;
import com.myhaimi.sms.entity.FeePayment;
import com.myhaimi.sms.service.impl.FeeService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fees")
@RequiredArgsConstructor
public class FeeController {
    private final FeeService feeService;

    @GetMapping("/summary")
    public FeeSchoolSummaryDTO schoolSummary() {
        return feeService.getSchoolSummary();
    }

    @GetMapping("/invoices")
    public Page<FeeInvoice> listInvoices(Pageable pageable) {
        return feeService.listInvoices(pageable);
    }

    @PostMapping("/invoices")
    public ResponseEntity<?> createInvoice(@Valid @RequestBody FeeInvoiceCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        FeeInvoice created = feeService.createInvoice(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/invoices/{invoiceId}/payments")
    public List<FeePayment> listPayments(@PathVariable Integer invoiceId) {
        return feeService.listPayments(invoiceId);
    }

    @PostMapping("/invoices/{invoiceId}/payments")
    public ResponseEntity<?> addPayment(
            @PathVariable Integer invoiceId,
            @Valid @RequestBody FeePaymentCreateDTO dto,
            BindingResult result
    ) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        FeePayment created = feeService.addPayment(invoiceId, dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

