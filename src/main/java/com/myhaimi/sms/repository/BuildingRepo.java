package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Building;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BuildingRepo extends JpaRepository<Building, Integer> {
    List<Building> findBySchool_IdOrderByNameAsc(Integer schoolId);
    Optional<Building> findBySchool_IdAndNameIgnoreCase(Integer schoolId, String name);
}

