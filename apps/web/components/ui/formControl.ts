/**
 * Shared look of native text-like form controls (Input, Select, Textarea), following the Figma
 * design system: filled surface (--input-background), transparent border, rounded-lg, text-sm.
 *
 * Focus: the border turns --ring and a soft 3px halo appears (Figma's pattern). --ring is the
 * high-contrast slate-900 chosen in Batch 1, so the indicator stays visible. `focus:` rather than
 * `focus-visible:` so selects and date inputs also show it after a mouse click.
 * Invalid: set aria-invalid on the control (red border; red halo while focused).
 * Height stays h-10 (Figma uses h-9) to keep existing layouts and touch targets.
 */
export const FORM_CONTROL_CLASS =
  'w-full rounded-lg border border-transparent bg-input-background px-3 text-sm text-gray-900 ' +
  'placeholder:text-muted-foreground outline-none transition-[color,box-shadow,border-color] ' +
  'focus:border-ring focus:ring-[3px] focus:ring-ring/15 ' +
  'aria-invalid:border-destructive aria-invalid:focus:ring-destructive/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';
