package com.myhaimi.sms.DTO.room.importdto;

import lombok.Data;

/** Raw parsed row from the rooms CSV. */
@Data
public class RoomImportRowDto {
    private int    rowNumber;
    private String building;
    private String roomNumber;
    private String type;          // STANDARD_CLASSROOM | SCIENCE_LAB | COMPUTER_LAB | ...
    private String capacity;
    private String floorNumber;
    private String floorName;
    private String isSchedulable; // true | false (default true)
}

