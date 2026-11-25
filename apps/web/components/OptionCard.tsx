import { cn } from '@/lib/utils';

/**
 * Option icons, exactly as in the Figma reference (OnboardingWizard / OnboardingModal), keyed by the
 * values the app stores. Display only: these maps never change what is saved.
 * `projectType.other` has no Figma counterpart and keeps the app's previous icon.
 */
export const OPTION_ICONS = {
  projectType: {
    'new-construction': '🏗️',
    renovation: '🔨',
    'purchase-with-works': '🏠',
    investment: '💼',
    other: '📋',
  },
  propertyType: {
    house: '🏡',
    apartment: '🏢',
    other: '🏘️',
  },
  phase: {
    planning: '📋',
    design: '📐',
    licenses: '📄',
    construction: '🏗️',
    finishing: '🎨',
    completed: '✅',
  },
  goal: {
    live: '🏡',
    rent: '🔑',
    sell: '💰',
    'long-term-investment': '📈',
  },
} as const;

type OptionCardProps = {
  /** Emoji from OPTION_ICONS (decorative; the title is the accessible name) */
  icon: string;
  title: string;
  selected?: boolean;
  onClick?: () => void;
  /**
   * `stacked` (default): Figma card, emoji above the label from `sm` (compact row on phones).
   * `row`: emoji + label in a row, for long forms such as the edit modal.
   */
  layout?: 'stacked' | 'row';
};

/**
 * Selectable option card shared by onboarding, the add-project wizard and the edit modal, styled
 * after the Figma option buttons. Presentation only: the caller owns the selected value.
 * Rendered as a toggle button (aria-pressed).
 */
export function OptionCard({ icon, title, selected = false, onClick, layout = 'stacked' }: OptionCardProps) {
  const stacked = layout === 'stacked';
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        // Figma: border-2, rounded-lg, blue-400 hover, blue-600 + blue-50 + shadow-md when selected
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border-2 text-left transition-all outline-none',
        'hover:border-blue-400 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        stacked ? 'p-4 sm:flex-col sm:items-start sm:gap-2 sm:p-6' : 'p-3 sm:p-4',
        selected ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-200 bg-white'
      )}
    >
      <span aria-hidden="true" className={cn('shrink-0 leading-none', stacked ? 'text-2xl sm:text-3xl' : 'text-2xl')}>
        {icon}
      </span>
      <span className={cn('min-w-0 font-semibold text-gray-900', !stacked && 'text-sm')}>{title}</span>
    </button>
  );
}
