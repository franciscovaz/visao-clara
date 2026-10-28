import { APP_ENV } from '@/lib/env';

const BADGES = {
  local: { label: 'LOCAL', title: 'Ambiente local (Supabase Docker)', className: 'bg-slate-700/85' },
  dev: { label: 'DEV', title: 'Ambiente de desenvolvimento (visao-clara-dev)', className: 'bg-amber-500/90' },
} as const;

// Small corner label so LOCAL and DEV are never mistaken for production. Hidden in production.
// Sits above the mobile bottom navigation and never captures clicks.
export default function EnvironmentBadge() {
  if (APP_ENV !== 'local' && APP_ENV !== 'dev') return null;
  const badge = BADGES[APP_ENV];

  return (
    <div
      role="status"
      title={badge.title}
      aria-label={badge.title}
      className={`pointer-events-none fixed bottom-24 right-3 z-[60] select-none rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white shadow-sm md:bottom-3 ${badge.className}`}
    >
      {badge.label}
    </div>
  );
}
