package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RoleRepo extends JpaRepository<Role, Long> {
    List<Role> findByName(String name);
}

