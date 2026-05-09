export function StudentListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="sw-skeleton sw-desktop-only" aria-hidden>
      <div className="sw-skeleton-row sw-skeleton-row--head" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sw-skeleton-row" />
      ))}
    </div>
  );
}

export function StudentCardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="sw-skeleton-cards sw-mobile-only" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="sw-skeleton-card" />
      ))}
    </div>
  );
}
