package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.DTO.RoomDeleteInfoDTO;
import com.myhaimi.sms.DTO.RoomUpdateDTO;
import com.myhaimi.sms.entity.LabType;
import com.myhaimi.sms.entity.RoomType;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.ClassSubjectConfigRepo;
import com.myhaimi.sms.repository.RoomRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.SubjectSectionOverrideRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepo roomRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final ClassSubjectConfigRepo classSubjectConfigRepo;
    private final SubjectSectionOverrideRepo subjectSectionOverrideRepo;

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    public Page<Room> list(Pageable pageable) {
        return roomRepo.findBySchool_IdAndIsDeletedFalse(requireSchoolId(), pageable);
    }

    public Room create(Room room) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        room.setId(null);
        room.setSchool(school);
        if (room.getBuilding() != null) room.setBuilding(room.getBuilding().trim());
        if (room.getRoomNumber() != null) room.setRoomNumber(room.getRoomNumber().trim());
        return roomRepo.save(room);
    }

    private String actorEmailOrSystem() {
        try {
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            String name = a == null ? null : a.getName();
            if (name == null || name.isBlank()) return "system";
            return name.trim();
        } catch (Exception ignored) {
            return "system";
        }
    }

    @Transactional(readOnly = true)
    public RoomDeleteInfoDTO deleteInfo(Integer roomId) {
        Integer schoolId = requireSchoolId();
        Room r = roomRepo.findByIdAndSchool_Id(roomId, schoolId).orElseThrow();

        List<String> reasons = new ArrayList<>();
        long defaultUse = classGroupRepo.countBySchool_IdAndDefaultRoom_Id(schoolId, roomId);
        if (defaultUse > 0) reasons.add("Assigned as default room for " + defaultUse + " class(es) (will be cleared).");

        long timetableUse = timetableEntryRepo.countBySchool_IdAndRoom_Id(schoolId, roomId);
        if (timetableUse > 0) reasons.add("Used in timetable (" + timetableUse + " entry/entries) (will be cleared).");

        // We can safely delete after clearing references (same behavior as delete-all).
        boolean canDelete = true;
        return new RoomDeleteInfoDTO(canDelete, reasons);
    }

    @Transactional
    public void delete(Integer roomId) {
        Integer schoolId = requireSchoolId();
        Room r = roomRepo.findByIdAndSchool_Id(roomId, schoolId).orElseThrow();

        // Clear FK references first so room soft-delete never leaves stale mappings.
        classGroupRepo.clearDefaultRoomBySchool_IdAndRoom_Id(schoolId, roomId);
        classSubjectConfigRepo.clearRoomsBySchool_IdAndRoom_Id(schoolId, roomId);
        subjectSectionOverrideRepo.clearRoomsBySchool_IdAndRoom_Id(schoolId, roomId);
        timetableEntryRepo.clearRoomsBySchool_IdAndRoom_Id(schoolId, roomId);

        r.setDeleted(true);
        r.setUpdatedBy(actorEmailOrSystem());
        roomRepo.save(r);
    }

    @Transactional
    public void deleteAllForSchool() {
        Integer schoolId = requireSchoolId();
        String actor = actorEmailOrSystem();

        // Clear FK references first so room soft-delete never violates constraints.
        classGroupRepo.clearDefaultRoomsBySchool_Id(schoolId);
        classSubjectConfigRepo.clearRoomsBySchool_Id(schoolId);
        subjectSectionOverrideRepo.clearRoomsBySchool_Id(schoolId);
        timetableEntryRepo.clearRoomsBySchool_Id(schoolId);

        List<Room> rooms = roomRepo.findBySchool_IdAndIsDeletedFalse(schoolId, org.springframework.data.domain.Pageable.unpaged()).getContent();
        for (Room r : rooms) {
            r.setDeleted(true);
            r.setUpdatedBy(actor);
            roomRepo.save(r);
        }
    }

    @Transactional
    public Room update(Integer roomId, RoomUpdateDTO body) {
        Integer schoolId = requireSchoolId();
        Room r = roomRepo.findByIdAndSchool_Id(roomId, schoolId).orElseThrow();

        RoomType type;
        try {
            type = RoomType.valueOf((body == null || body.type() == null ? r.getType().name() : body.type().trim().toUpperCase()));
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid room type: " + (body == null ? null : body.type()));
        }
        r.setType(type);

        if (type == RoomType.LAB) {
            String raw = body == null ? null : body.labType();
            if (raw == null || raw.isBlank()) {
                r.setLabType(LabType.OTHER);
            } else {
                try {
                    r.setLabType(LabType.valueOf(raw.trim().toUpperCase()));
                } catch (Exception ignored) {
                    r.setLabType(LabType.OTHER);
                }
            }
        } else {
            r.setLabType(null);
        }

        Integer cap = body == null ? null : body.capacity();
        if (cap != null && cap <= 0) cap = null;
        r.setCapacity(cap);

        if (body != null && body.isSchedulable() != null) {
            r.setSchedulable(body.isSchedulable());
        }

        r.setUpdatedBy(actorEmailOrSystem());
        return roomRepo.save(r);
    }
}

