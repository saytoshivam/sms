import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { AcademicStructureSetupStep } from '../../components/AcademicStructureSetupStep';
import { useAcademicStructureModule } from '../../lib/useAcademicStructureModule';
import { formatApiError } from '../../lib/errors';
import { isWorkspaceReadOnly, WorkspaceReadOnlyRibbon } from '../../lib/workspaceViewMode';

const ALLOWED_TABS = ['sections', 'smart', 'load', 'overview'] as const;
type AcademicTab = (typeof ALLOWED_TABS)[number];

export function AcademicModulePage() {
  const [searchParams] = useSearchParams();
  const readOnly = isWorkspaceReadOnly(searchParams);

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
    <Link to="/app/operations-hub" className="btn secondary">
      Back to hub
    </Link>
  );

  return (
    <ModulePage
      title="Academic structure"
      subtitle={
        readOnly
          ? 'Read-only mapping overview — open Operations hub › Academic structure for edits.'
          : 'Subject → section mapping, smart assignment, teacher load, and overview. Add or edit section rows in Classes & sections. Saving propagates to the timetable engine.'
      }
      status={status}
      headerActions={headerActions}
      impact={readOnly ? null : undefined}
      changeBar={
        readOnly || !m.dirty
          ? null
          : {
              message: `${m.pendingChanges} pending change${m.pendingChanges === 1 ? '' : 's'} — save to apply.`,
              busy: m.savePending,
              tertiary: { label: 'Discard', onClick: m.resetToServer, disabled: m.savePending },
              primary: {
                label: m.saveSuccess ? 'Saved ✓' : 'Save changes',
                onClick: () => void m.save(),
                disabled: m.savePending,
              },
            }
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

      {readOnly ? <WorkspaceReadOnlyRibbon title="Academic structure — browse only" /> : null}

      {(() => {
        const step = (
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
            clearHomeroomDraft={m.clearHomeroomDraft}
            clearAutoAssignedClassTeachers={m.clearAutoAssignedClassTeachers}
            clearAllClassTeacherAssignments={m.clearAllClassTeacherAssignments}
            clearAutoHomeroomAssignments={m.clearAutoHomeroomAssignments}
            patchSectionHomeroom={m.patchSectionHomeroom}
            homeroomSourceByClassId={m.homeroomSourceByClassId}
            homeroomLockedByClassId={m.homeroomLockedByClassId}
            patchHomeroomLock={m.patchHomeroomLock}
            homeroomSelectOptions={m.classDefaultRoomSelectOptions}
            classTeacherByClassId={m.classTeacherByClassId}
            classTeacherSourceByClassId={m.classTeacherSourceByClassId}
            classTeacherLockedByClassId={m.classTeacherLockedByClassId}
            patchSectionClassTeacher={m.patchSectionClassTeacher}
            patchClassTeacherLock={m.patchClassTeacherLock}
            autoAssignClassTeachers={m.autoAssignClassTeachers}
          />
        );
        return readOnly ? (
          /** `inert` keeps layout scrollable but blocks edits (browse from sidebar). */
          <div inert>{step}</div>
        ) : (
          step
        );
      })()}
    </ModulePage>
  );
}
