package com.myhaimi.sms.DTO.classgroup.importdto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class ClassGroupImportRowResultDto {
    public enum RowStatus { VALID, INVALID, DUPLICATE }

    private int       rowNumber;
    private String    code;
    private String    displayName;
    private String    gradeLevel;
    private String    section;
    private RowStatus status;
    private List<String> errors = new ArrayList<>();

    public static ClassGroupImportRowResultDto valid(ClassGroupImportRowDto row) {
        ClassGroupImportRowResultDto r = base(row); r.status = RowStatus.VALID; return r;
    }
    public static ClassGroupImportRowResultDto invalid(ClassGroupImportRowDto row, List<String> errors) {
        ClassGroupImportRowResultDto r = base(row); r.status = RowStatus.INVALID; r.errors = new ArrayList<>(errors); return r;
    }
    public static ClassGroupImportRowResultDto duplicate(ClassGroupImportRowDto row, String reason) {
        ClassGroupImportRowResultDto r = base(row); r.status = RowStatus.DUPLICATE; r.errors = List.of(reason); return r;
    }
    private static ClassGroupImportRowResultDto base(ClassGroupImportRowDto row) {
        ClassGroupImportRowResultDto r = new ClassGroupImportRowResultDto();
        r.rowNumber = row.getRowNumber(); r.code = row.getCode();
        r.displayName = row.getDisplayName(); r.gradeLevel = row.getGradeLevel(); r.section = row.getSection();
        return r;
    }
}

