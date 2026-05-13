package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StaffRoleMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StaffRoleMappingRepository extends JpaRepository<StaffRoleMapping, Integer> {

    /** All role mappings for a single staff member. */
    List<StaffRoleMapping> findByStaff_Id(Integer staffId);

    /** All role mappings for every staff member in a school (bulk load — avoids N+1). */
    @Query("SELECT srm FROM StaffRoleMapping srm " +
           "JOIN FETCH srm.role " +
           "WHERE srm.staff.school.id = :schoolId")
    List<StaffRoleMapping> findByStaff_School_Id(@Param("schoolId") Integer schoolId);

    /** Remove all role mappings for a staff member. Used before a full role replace. */
    @Modifying
    @Query("DELETE FROM StaffRoleMapping srm WHERE srm.staff.id = :staffId")
    void deleteByStaff_Id(@Param("staffId") Integer staffId);
}

