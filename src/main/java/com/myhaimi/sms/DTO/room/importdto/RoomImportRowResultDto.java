package com.myhaimi.sms.DTO.room.importdto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class RoomImportRowResultDto {

    public enum RowStatus { VALID, INVALID, DUPLICATE }

    private int       rowNumber;
    private String    building;
    private String    roomNumber;
    private String    type;
    private String    capacity;
    private RowStatus status;
    private List<String> errors = new ArrayList<>();

    public static RoomImportRowResultDto valid(RoomImportRowDto row) {
        RoomImportRowResultDto r = base(row); r.status = RowStatus.VALID; return r;
    }
    public static RoomImportRowResultDto invalid(RoomImportRowDto row, List<String> errors) {
        RoomImportRowResultDto r = base(row); r.status = RowStatus.INVALID; r.errors = new ArrayList<>(errors); return r;
    }
    public static RoomImportRowResultDto duplicate(RoomImportRowDto row, String reason) {
        RoomImportRowResultDto r = base(row); r.status = RowStatus.DUPLICATE; r.errors = List.of(reason); return r;
    }
    private static RoomImportRowResultDto base(RoomImportRowDto row) {
        RoomImportRowResultDto r = new RoomImportRowResultDto();
        r.rowNumber  = row.getRowNumber();
        r.building   = row.getBuilding();
        r.roomNumber = row.getRoomNumber();
        r.type       = row.getType();
        r.capacity   = row.getCapacity();
        return r;
    }
}

