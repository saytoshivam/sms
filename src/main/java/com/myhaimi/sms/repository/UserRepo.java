package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepo extends JpaRepository<User, Integer> {
    Optional<User> findFirstByUsernameIgnoreCase(String username);
    Optional<User> findFirstByEmailIgnoreCase(String email);
    Optional<User> findFirstByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.school WHERE LOWER(u.username) = LOWER(:q) OR LOWER(u.email) = LOWER(:q)")
    Optional<User> findFirstWithSchoolByUsernameOrEmail(@Param("q") String usernameOrEmail);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.school WHERE u.id = :id")
    Optional<User> findByIdWithSchool(@Param("id") Integer id);

    List<User> findBySchool_IdOrderByEmailAsc(Integer schoolId);

    @Query(
            "SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.linkedStaff LEFT JOIN FETCH u.linkedStudent "
                    + "LEFT JOIN FETCH u.roles WHERE u.school.id = :schoolId ORDER BY LOWER(u.email)")
    List<User> findBySchool_IdWithProfilesOrderByEmailAsc(@Param("schoolId") Integer schoolId);

    @Query(
            "SELECT COUNT(u) FROM User u JOIN u.roles r WHERE u.school.id = :schoolId AND r.name = :roleName AND u.id <> :excludeUserId")
    long countBySchoolIdAndRoleNameExcludingUser(
            @Param("schoolId") Integer schoolId,
            @Param("roleName") String roleName,
            @Param("excludeUserId") int excludeUserId);

    Optional<User> findFirstBySchool_IdAndLinkedStaff_Id(Integer schoolId, Integer staffId);

    Optional<User> findFirstByLinkedGuardian_Id(Integer guardianId);

    Optional<User> findFirstBySchool_IdAndLinkedGuardian_Id(Integer schoolId, Integer guardianId);
}
