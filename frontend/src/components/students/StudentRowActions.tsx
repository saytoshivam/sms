import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { RowActionsMenu } from '../RowActionsMenu';
import { ConfirmDialog } from '../ConfirmDialog';

type Props = {
  studentId: number;
  studentName: string;
  onDeleted?: () => void;
};

export function StudentRowActions({ studentId, studentName, onDeleted }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async () => { await api.delete(`/api/students/${studentId}`); },
    onSuccess: () => {
      setConfirmOpen(false);
      onDeleted?.();
    },
  });

  return (
    <>
      <RowActionsMenu
        ariaLabel={`Actions for ${studentName}`}
        actions={[
          {
            id: 'delete-student',
            label: 'Delete student',
            danger: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Delete student?"
        description={`This will permanently delete ${studentName} and all their records (enrollments, documents, attendance, guardian links, etc.). This cannot be undone.`}
        danger
        confirmLabel={deleteMut.isPending ? 'Deleting…' : 'Delete'}
        confirmDisabled={deleteMut.isPending}
        onClose={() => (deleteMut.isPending ? null : setConfirmOpen(false))}
        onConfirm={async () => { await deleteMut.mutateAsync(); }}
      />
    </>
  );
}
