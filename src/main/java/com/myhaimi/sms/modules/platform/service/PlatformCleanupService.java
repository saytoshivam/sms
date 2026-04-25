package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.modules.platform.api.PlatformCleanupV1Controller;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.RoomRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.repository.SubjectClassGroupRepo;
import com.myhaimi.sms.repository.SubjectClassMappingRepo;
import com.myhaimi.sms.repository.SubjectSectionOverrideRepo;
import com.myhaimi.sms.repository.StaffTeachableSubjectRepository;
import com.myhaimi.sms.repository.SubjectAllocationRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlatformCleanupService {

    private final SubjectRepo subjectRepo;
    private final RoomRepo roomRepo;
    private final ClassGroupRepo classGroupRepo;

    private final SubjectAllocationRepo subjectAllocationRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final SubjectClassGroupRepo subjectClassGroupRepo;
    private final SubjectSectionOverrideRepo subjectSectionOverrideRepo;
    private final SubjectClassMappingRepo subjectClassMappingRepo;
    private final StaffTeachableSubjectRepository staffTeachableSubjectRepository;

    @Transactional
    public PlatformCleanupV1Controller.PurgeResult purgeSoftDeleted() {
        int subjPurged = 0;
        int roomsPurged = 0;
        int classPurged = 0;
        int skipped = 0;

        for (Subject s : subjectRepo.findAllSoftDeleted()) {
            try {
                Integer schoolId = s.getSchool() == null ? null : s.getSchool().getId();
                if (schoolId == null) {
                    skipped += 1;
                    continue;
                }
                if (subjectAllocationRepo.countBySchool_IdAndSubject_Id(schoolId, s.getId()) > 0) {
                    skipped += 1;
                    continue;
                }
                if (timetableEntryRepo.countBySchool_IdAndSubject_Id(schoolId, s.getId()) > 0) {
                    skipped += 1;
                    continue;
                }
                subjectClassGroupRepo.deleteBySubject_Id(s.getId());
                subjectSectionOverrideRepo.deleteBySubject_Id(s.getId());
                subjectClassMappingRepo.deleteBySubject_Id(s.getId());
                staffTeachableSubjectRepository.deleteBySubject_Id(s.getId());
                subjectRepo.delete(s);
                subjPurged += 1;
            } catch (Exception ignored) {
                skipped += 1;
            }
        }

        for (Room r : roomRepo.findAllSoftDeleted()) {
            try {
                roomRepo.delete(r);
                roomsPurged += 1;
            } catch (Exception ignored) {
                skipped += 1;
            }
        }

        for (ClassGroup cg : classGroupRepo.findAllSoftDeleted()) {
            try {
                classGroupRepo.delete(cg);
                classPurged += 1;
            } catch (Exception ignored) {
                skipped += 1;
            }
        }

        return new PlatformCleanupV1Controller.PurgeResult(subjPurged, roomsPurged, classPurged, skipped);
    }
}

