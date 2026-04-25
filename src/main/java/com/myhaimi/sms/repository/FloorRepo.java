package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Floor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FloorRepo extends JpaRepository<Floor, Integer> {
    List<Floor> findByBuilding_IdOrderByNameAsc(Integer buildingId);
    Optional<Floor> findByBuilding_IdAndNameIgnoreCase(Integer buildingId, String name);
}

