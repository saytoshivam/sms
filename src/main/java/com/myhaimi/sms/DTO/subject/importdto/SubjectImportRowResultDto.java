package com.myhaimi.sms.DTO.subject.importdto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

/** Per-row result for the subjects import preview. */
@Data
public class SubjectImportRowResultDto {

    public enum RowStatus { VALID, INVALID, DUPLICATE }

    private int       rowNumber;
    private String    name;
    private String    code;
    private String    type;
    private String    weeklyFrequency;
    private String    allocationVenueRequirement;
    private RowStatus status;
    private List<String> errors = new ArrayList<>();

    public static SubjectImportRowResultDto valid(SubjectImportRowDto row) {
        SubjectImportRowResultDto r = base(row);
        r.status = RowStatus.VALID;
        return r;
    }

    public static SubjectImportRowResultDto invalid(SubjectImportRowDto row, List<String> errors) {
        SubjectImportRowResultDto r = base(row);
        r.status = RowStatus.INVALID;
        r.errors = new ArrayList<>(errors);
        return r;
    }

    public static SubjectImportRowResultDto duplicate(SubjectImportRowDto row, String reason) {
        SubjectImportRowResultDto r = base(row);
        r.status = RowStatus.DUPLICATE;
        r.errors = List.of(reason);
        return r;
    }

    private static SubjectImportRowResultDto base(SubjectImportRowDto row) {
        SubjectImportRowResultDto r = new SubjectImportRowResultDto();
        r.rowNumber  = row.getRowNumber();
        r.name       = row.getName();
        r.code       = row.getCode();
        r.type       = row.getType();
        r.weeklyFrequency = row.getWeeklyFrequency();
        r.allocationVenueRequirement = row.getAllocationVenueRequirement();
        return r;
    }
}

