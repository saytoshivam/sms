package com.myhaimi.sms.controllers;

import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.DTO.RoomDeleteInfoDTO;
import com.myhaimi.sms.DTO.RoomUpdateDTO;
import com.myhaimi.sms.service.impl.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    public Page<Room> list(Pageable pageable) {
        return roomService.list(pageable);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Room> create(@RequestBody Room room) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roomService.create(room));
    }

    @GetMapping("/{id}/delete-info")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<RoomDeleteInfoDTO> deleteInfo(@PathVariable Integer id) {
        return ResponseEntity.ok(roomService.deleteInfo(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        roomService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/delete-all")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Void> deleteAll() {
        roomService.deleteAllForSchool();
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Room> update(@PathVariable Integer id, @RequestBody RoomUpdateDTO body) {
        return ResponseEntity.ok(roomService.update(id, body));
    }
}

