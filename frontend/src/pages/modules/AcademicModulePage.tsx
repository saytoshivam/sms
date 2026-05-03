import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { AcademicStructureSetupStep } from '../../components/AcademicStructureSetupStep';
import { useAcademicStructureModule } from '../../lib/useAcademicStructureModule';
import { formatApiError } from '../../lib/errors';

const ALLOWED_TABS = ['sections', 'smart', 'load', 'overview'] as const;
type AcademicTab = (typeof ALLOWED_TABS)[number];

export function AcademicModulePage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as AcademicTab | null;
  const initialTab: AcademicTab = ALLOWED_TABS.includes(tabParam as AcademicTab) ? (tabParam as AcademicTab) : 'sections';

  const m = useAcademicStructureModule();

  const status: { level: StatusLevel; label: string } = useMemo(() => {
    if (m.isLoading) return { level: 'idle', label: 'Loading' };
    if (m.isError) return { level: 'error', label: 'Load failed' };
    if ((m.classGroups?.length ?? 0) === 0) return { level: 'warn', label: 'No classes yet' };
    if (m.classDefaultRoomHasConflicts) return { level: 'warn', label: 'Default room conflicts' };
    if (m.dirty) return { level: 'warn', label: `${m.pendingChanges} unsaved` };
    return { level: 'ok', label: `${m.classGroups.length} class${m.classGroups.length === 1 ? '' : 'es'}` };
  }, [m.isLoading, m.isError, m.classGroups, m.classDefaultRoomHasConflicts, m.dirty, m.pendingChanges]);

  const headerActions = (
    <Link to="/app" className="btn secondary">
      Back to hub
    </Link>
  );

  return (
    <ModulePage
      title="Academic structure"
      subtitle="Subject → section mapping, smart assignment, teacher load, and overview. Add or edit section rows in Classes & sections. Saving propagates to the timetable engine."
      status={status}
      headerActions={headerActions}
      changeBar={
        m.dirty
          ? {
              message: `${m.pendingChanges} pending change${m.pendingChanges === 1 ? '' : 's'} — save to apply.`,
              busy: m.savePending,
              tertiary: { label: 'Discard', onClick: m.resetToServer, disabled: m.savePending },
              primary: {
                label: m.saveSuccess ? 'Saved ✓' : 'Save changes',
                onClick: () => void m.save(),
                disabled: m.savePending,
              },
            }
          : null
      }
    >
      {m.isError ? (
        <div className="sms-alert sms-alert--error" style={{ margin: 0, marginBottom: 12 }}>
          <div>
            <div className="sms-alert__title">Could not load academic structure</div>
            <div className="sms-alert__msg">{formatApiError(m.error)}</div>
          </div>
        </div>
      ) : null}

      <AcademicStructureSetupStep
        stepTitle="Academic structure"
        initialTab={initialTab}
        allowedTabs={[...ALLOWED_TABS]}
        classGroups={m.classGroups}
        subjects={m.subjects}
        staff={m.staff}
        rooms={m.rooms}
        allocRows={m.allocRows}
        setAllocRows={m.setAllocRows}
        classSubjectConfigs={m.classSubjectConfigs}
        setClassSubjectConfigs={m.setClassSubjectConfigs}
        sectionSubjectOverrides={m.sectionSubjectOverrides}
        setSectionSubjectOverrides={m.setSectionSubjectOverrides}
        defaultRoomByClassId={m.defaultRoomByClassId}
        setDefaultRoomByClassId={m.setDefaultRoomByClassId}
        classDefaultRoomSelectOptions={m.classDefaultRoomSelectOptions}
        classDefaultRoomUsage={m.classDefaultRoomUsage}
        classDefaultRoomHasConflicts={m.classDefaultRoomHasConflicts}
        autoAssignDefaultRooms={m.autoAssignDefaultRooms}
        defaultRoomsLoading={m.defaultRoomsLoading}
        basicInfo={m.basicInfo ?? null}
        isLoading={m.isLoading}
        isError={m.isError}
        error={m.error}
        roomsError={m.roomsError}
        onSave={() => m.save()}
        savePending={m.savePending}
        saveError={m.saveError}
        saveSuccess={m.saveSuccess}
        formatError={formatApiError}
        assignmentMeta={m.assignmentMeta}
        setAssignmentMeta={m.setAssignmentMeta}
        clearAutoHomeroomAssignments={m.clearAutoHomeroomAssignments}
        patchSectionHomeroom={m.patchSectionHomeroom}
        homeroomSourceByClassId={m.homeroomSourceByClassId}
        classTeacherByClassId={m.classTeacherByClassId}
        classTeacherSourceByClassId={m.classTeacherSourceByClassId}
        patchSectionClassTeacher={m.patchSectionClassTeacher}
        autoAssignClassTeachers={m.autoAssignClassTeachers}
      />
    </ModulePage>
  );
}
