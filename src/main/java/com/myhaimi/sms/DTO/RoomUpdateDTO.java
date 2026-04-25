package com.myhaimi.sms.DTO;

public record RoomUpdateDTO(
        /** CLASSROOM/LAB/LIBRARY/AUDITORIUM/SPORTS_ROOM/STAFF_ROOM/OFFICE/OTHER */
        String type,
        Integer capacity,
        /** PHYSICS/CHEMISTRY/COMPUTER/OTHER - only for LAB */
        String labType,
        Boolean isSchedulable
) {}

