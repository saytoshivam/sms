package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.announcement.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.AnnouncementReadRepo;
import com.myhaimi.sms.repository.AnnouncementRepo;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.repository.TimetableSlotRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementRepo announcementRepo;
    private final AnnouncementReadRepo announcementReadRepo;
    private final UserRepo userRepo;
    private final StudentRepo studentRepo;
    private final ClassGroupRepo classGroupRepo;
    private final TimetableSlotRepo timetableSlotRepo;
    private final TimetableSlotService timetableSlotService;

    private Integer requireTenant() {
        Integer id = TenantContext.getTenantId();
        if (id == null) {
            throw new IllegalStateException("Tenant context required");
        }
        return id;
    }

    @Transactional(readOnly = true)
    public List<ClassGroupRefDTO> teachableClassGroupsForStaff(String authorEmail) {
        Integer schoolId = requireTenant();
        User user = userRepo.findFirstByEmailIgnoreCase(authorEmail).orElseThrow();
        if (user.getLinkedStaff() == null) {
            throw new IllegalStateException("No linked staff profile");
        }
        int staffId = user.getLinkedStaff().getId();
        return timetableSlotService.distinctClassGroupsStaffTeaches(schoolId, staffId);
    }

    @Transactional(readOnly = true)
    public List<AnnouncementListItemDTO> listForStudent(int studentId, AnnouncementCategory categoryFilter) {
        return visibleAnnouncementsForStudent(studentId, categoryFilter).stream()
                .map(a -> new AnnouncementListItemDTO(
                        a.getId(),
                        a.getTitle(),
                        a.getCategory(),
                        a.getReferenceCode(),
                        a.getCreatedAt(),
                        a.getAudience()))
                .toList();
    }

    private List<Announcement> visibleAnnouncementsForStudent(int studentId, AnnouncementCategory categoryFilter) {
        Integer schoolId = requireTenant();
        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        Integer classGroupId = student.getClassGroup() != null ? student.getClassGroup().getId() : null;

        List<Announcement> wide =
                announcementRepo.findBySchool_IdAndAudienceOrderByCreatedAtDesc(schoolId, AnnouncementAudience.SCHOOL_WIDE);
        List<Announcement> targeted = classGroupId == null
                ? List.of()
                : announcementRepo.findClassTargetedForStudent(
                        schoolId, classGroupId, AnnouncementAudience.CLASS_TARGETS);

        Stream<Announcement> stream = Stream.concat(wide.stream(), targeted.stream()).distinct();
        if (categoryFilter != null) {
            stream = stream.filter(a -> a.getCategory() == categoryFilter);
        }
        return stream.sorted(Comparator.comparing(Announcement::getCreatedAt).reversed()).toList();
    }

    @Transactional(readOnly = true)
    public long countUnreadAnnouncements(int studentId) {
        List<Announcement> visible = visibleAnnouncementsForStudent(studentId, null);
        long n = 0;
        for (Announcement a : visible) {
            if (!announcementReadRepo.existsByStudent_IdAndAnnouncement_Id(studentId, a.getId())) {
                n++;
            }
        }
        return n;
    }

    @Transactional
    public void markAnnouncementRead(int studentId, int announcementId) {
        Integer schoolId = requireTenant();
        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        Integer classGroupId = student.getClassGroup() != null ? student.getClassGroup().getId() : null;

        Announcement a = announcementRepo
                .findByIdAndSchool_IdWithGraph(announcementId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Announcement not found"));
        if (!isVisibleToStudent(a, classGroupId)) {
            throw new NoSuchElementException("Announcement not found");
        }
        if (announcementReadRepo.existsByStudent_IdAndAnnouncement_Id(studentId, announcementId)) {
            return;
        }
        AnnouncementRead read = new AnnouncementRead();
        read.setStudent(studentRepo.getReferenceById(studentId));
        read.setAnnouncement(announcementRepo.getReferenceById(announcementId));
        announcementReadRepo.save(read);
    }

    @Transactional(readOnly = true)
    public AnnouncementDetailDTO getForStudent(int studentId, int announcementId) {
        Integer schoolId = requireTenant();
        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        Integer classGroupId = student.getClassGroup() != null ? student.getClassGroup().getId() : null;

        Announcement a = announcementRepo
                .findByIdAndSchool_IdWithGraph(announcementId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Announcement not found"));

        if (!isVisibleToStudent(a, classGroupId)) {
            throw new NoSuchElementException("Announcement not found");
        }

        return toDetail(a);
    }

    private boolean isVisibleToStudent(Announcement a, Integer classGroupId) {
        if (a.getAudience() == AnnouncementAudience.SCHOOL_WIDE) {
            return true;
        }
        if (classGroupId == null) {
            return false;
        }
        return a.getTargetClasses().stream().anyMatch(t -> t.getClassGroup().getId().equals(classGroupId));
    }

    private AnnouncementDetailDTO toDetail(Announcement a) {
        List<String> labels = a.getTargetClasses().stream()
                .map(t -> t.getClassGroup().getDisplayName() + " (" + t.getClassGroup().getCode() + ")")
                .sorted()
                .toList();
        String author = a.getAuthor() != null ? a.getAuthor().getUsername() : "";
        return new AnnouncementDetailDTO(
                a.getId(),
                a.getTitle(),
                a.getCategory(),
                a.getReferenceCode(),
                a.getCreatedAt(),
                a.getBody(),
                a.getAudience(),
                author,
                labels);
    }

    @Transactional
    public AnnouncementListItemDTO createSchoolWide(String authorEmail, AnnouncementCreateDTO dto) {
        Integer schoolId = requireTenant();
        User author = userRepo.findFirstByEmailIgnoreCase(authorEmail).orElseThrow();
        boolean allowed = author.getRoles().stream().map(Role::getName).anyMatch(RoleNames::isSchoolLeadership);
        if (!allowed) {
            throw new IllegalArgumentException("Only school leadership can post school-wide announcements");
        }
        if (author.getSchool() == null || !author.getSchool().getId().equals(schoolId)) {
            throw new IllegalArgumentException("User school does not match tenant");
        }

        Announcement a = new Announcement();
        a.setSchool(author.getSchool());
        a.setAuthor(author);
        a.setCategory(dto.getCategory());
        a.setTitle(dto.getTitle().trim());
        a.setBody(dto.getBody().trim());
        a.setAudience(AnnouncementAudience.SCHOOL_WIDE);
        a.setReferenceCode("(pending)");
        a = announcementRepo.save(a);
        a.setReferenceCode(buildReferenceCode(author.getSchool(), a.getId()));
        announcementRepo.save(a);

        return new AnnouncementListItemDTO(
                a.getId(), a.getTitle(), a.getCategory(), a.getReferenceCode(), a.getCreatedAt(), a.getAudience());
    }

    @Transactional
    public AnnouncementListItemDTO createForTeacherClasses(String authorEmail, TeacherAnnouncementCreateDTO dto) {
        Integer schoolId = requireTenant();
        User author = userRepo.findFirstByEmailIgnoreCase(authorEmail).orElseThrow();
        boolean isTeacher = author.getRoles().stream().map(Role::getName).anyMatch(RoleNames::isTeaching);
        if (!isTeacher || author.getLinkedStaff() == null) {
            throw new IllegalArgumentException("Only teachers with a staff profile can post class announcements");
        }
        if (author.getSchool() == null || !author.getSchool().getId().equals(schoolId)) {
            throw new IllegalArgumentException("User school does not match tenant");
        }
        int staffId = author.getLinkedStaff().getId();

        Set<Integer> unique = new LinkedHashSet<>(dto.getClassGroupIds());
        if (unique.isEmpty()) {
            throw new IllegalArgumentException("Select at least one class");
        }
        List<ClassGroup> groups = new ArrayList<>();
        for (Integer cgId : unique) {
            ClassGroup cg = classGroupRepo
                    .findByIdAndSchool_Id(cgId, schoolId)
                    .orElseThrow(() -> new NoSuchElementException("Invalid class group"));
            if (!timetableSlotRepo.existsBySchool_IdAndStaff_IdAndClassGroup_IdAndActiveIsTrue(schoolId, staffId, cg.getId())) {
                throw new IllegalArgumentException(
                        "You can only announce to classes you teach on the timetable: " + cg.getCode());
            }
            groups.add(cg);
        }

        Announcement a = new Announcement();
        a.setSchool(author.getSchool());
        a.setAuthor(author);
        a.setCategory(dto.getCategory());
        a.setTitle(dto.getTitle().trim());
        a.setBody(dto.getBody().trim());
        a.setAudience(AnnouncementAudience.CLASS_TARGETS);
        a.setReferenceCode("(pending)");
        a = announcementRepo.save(a);

        for (ClassGroup cg : groups) {
            AnnouncementTargetClass t = new AnnouncementTargetClass();
            t.setAnnouncement(a);
            t.setClassGroup(cg);
            a.getTargetClasses().add(t);
        }
        a.setReferenceCode(buildReferenceCode(author.getSchool(), a.getId()));
        announcementRepo.save(a);

        return new AnnouncementListItemDTO(
                a.getId(), a.getTitle(), a.getCategory(), a.getReferenceCode(), a.getCreatedAt(), a.getAudience());
    }

    private String buildReferenceCode(School school, int announcementId) {
        String day = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        return String.format("(%s/ANN/%s/%06d)", school.getCode().toUpperCase(Locale.ROOT), day, announcementId);
    }
}
