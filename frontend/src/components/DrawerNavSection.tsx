import type { ReactNode } from 'react';

type Props = { title: string; children: ReactNode };

export function DrawerNavSection({ title, children }: Props) {
  return (
    <div className="drawer-nav-section">
      <div className="drawer-nav-section-title">{title}</div>
      {children}
    </div>
  );
}

export function DrawerNavSoon({ text = 'Coming soon' }: { text?: string }) {
  return <div className="drawer-nav-soon">{text}</div>;
}
