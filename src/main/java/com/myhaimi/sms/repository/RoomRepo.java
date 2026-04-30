package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Room;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.List;

public interface RoomRepo extends JpaRepository<Room, Integer> {
    Page<Room> findBySchool_IdAndIsDeletedFalse(Integer schoolId, Pageable pageable);
    List<Room> findBySchool_IdAndIsDeletedFalse(Integer schoolId);

    Optional<Room> findByIdAndSchool_Id(Integer id, Integer schoolId);

    Optional<Room> findBySchool_IdAndBuildingIgnoreCaseAndRoomNumberIgnoreCase(
            Integer schoolId, String building, String roomNumber);

    Optional<Room> findBySchool_IdAndBuildingRef_IdAndRoomNumberIgnoreCase(Integer schoolId, Integer buildingId, String roomNumber);

    @Query("select r from Room r where r.isDeleted = true")
    List<Room> findAllSoftDeleted();
}

