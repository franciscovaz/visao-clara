'use client';

import type { ReactNode } from 'react';

/** In-page link that scrolls smoothly (as in the design) and still works without JavaScript. */
export function SmoothScrollLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
        window.history.replaceState(null, '', `#${targetId}`);
      }}
    >
      {children}
    </a>
  );
}
