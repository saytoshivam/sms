package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.SubjectDeleteInfoDTO;
import com.myhaimi.sms.DTO.SubjectUpdateDTO;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.service.impl.SubjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
@RequiredArgsConstructor
public class SubjectController {
    private final SubjectService subjectService;

    @GetMapping
    public Page<Subject> list(Pageable pageable) {
        return subjectService.list(pageable);
    }

    @GetMapping("/for-class-group")
    public List<Subject> listForClassGroup(@RequestParam Integer classGroupId) {
        return subjectService.listForClassGroup(classGroupId);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Subject subject) {
        Subject created = subjectService.create(subject);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public Subject update(@PathVariable Integer id, @Valid @RequestBody SubjectUpdateDTO body) {
        return subjectService.update(id, body);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        subjectService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/delete-all")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> deleteAll() {
        subjectService.deleteAllForSchool();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/delete-info")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public SubjectDeleteInfoDTO deleteInfo(@PathVariable Integer id) {
        return subjectService.deleteInfo(id);
    }
}

