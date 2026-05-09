import type { ComponentProps } from 'react';
import { ErpWorkspaceChrome } from './ErpWorkspaceChrome';

/** School leadership · same shell as teachers/students via {@link ErpWorkspaceChrome}. */
export function SchoolLeaderErpChrome(props: Omit<ComponentProps<typeof ErpWorkspaceChrome>, 'persona'>) {
  return <ErpWorkspaceChrome {...props} persona="leader" />;
}
