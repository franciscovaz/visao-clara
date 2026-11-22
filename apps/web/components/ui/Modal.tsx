'use client';

import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ModalProps {
  /** Controlled open state; the parent stays the source of truth. */
  open: boolean;
  /** Called on Escape, backdrop click or the close button (only when `dismissible`). */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Actions rendered below the content. Buttons that submit a form inside `children` belong in a `ModalFooter` inside that form instead. */
  footer?: ReactNode;
  /** Max width of the panel (Tailwind max-w-*). Existing modals use `md`. */
  size?: ModalSize;
  /** When false, Escape, backdrop clicks and the close button do nothing (e.g. while a request is in flight). */
  dismissible?: boolean;
  /** Backdrop click closes the modal (default true, the current behaviour of every modal). */
  closeOnBackdropClick?: boolean;
  /** Element to focus on open. Defaults to the first focusable element in the content. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Extra classes for the panel. */
  className?: string;
  closeLabel?: string;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * Accessible modal built on the native <dialog> element (no dependency):
 * showModal() provides the top layer, an inert background, focus containment and Escape handling.
 * This component adds: controlled state, backdrop dismissal, background scroll locking,
 * focus restoration to the opener, and the app's modal styling.
 *
 * Content is only rendered while open, so effects inside it run on each opening.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  closeOnBackdropClick = true,
  initialFocusRef,
  className,
  closeLabel = 'Fechar',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerDownOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  // Keep the latest callbacks/flags in refs so the native event listeners never go stale
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const openRef = useRef(open);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
    openRef.current = open;
  });

  // Open / close the native dialog, lock background scroll and restore focus
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousPaddingRight = root.style.paddingRight;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    root.style.overflow = 'hidden';
    if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`;

    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPaddingRight;
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [open, initialFocusRef]);

  // Escape is handled on `keydown`, not on the dialog's `cancel` event. In Chrome, the close request
  // that Escape triggers is the default action of the keydown; `cancel` can only be prevented once per
  // user activation, so a second Escape fires a non-cancelable `cancel` and force-closes the dialog.
  // Cancelling the keydown stops the close request before it starts, every time.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Respect content that handled Escape itself, and IME composition (Escape cancels the composition)
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      if (dismissibleRef.current) onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Other close requests (e.g. the Android back gesture) still arrive as `cancel`; React state decides.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissibleRef.current) onCloseRef.current();
    };
    // If the platform closes the dialog anyway (a close request that isn't cancelable), sync React state
    // instead of reopening: a closed dialog with `open` still true would leave the page scroll-locked.
    const handleClose = () => {
      if (openRef.current) onCloseRef.current();
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, []);

  // A click on the <dialog> element itself (not on its content) is a click on the backdrop.
  // Both pointerdown and click must happen there, so a text selection dragged outside doesn't close it.
  const isBackdropEvent = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target !== dialogRef.current) return false;
    const rect = dialogRef.current.getBoundingClientRect();
    return (
      event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = isBackdropEvent(event);
      }}
      onClick={(event) => {
        if (pointerDownOnBackdrop.current && isBackdropEvent(event) && closeOnBackdropClick && dismissible) {
          onClose();
        }
        pointerDownOnBackdrop.current = false;
      }}
      className={cn(
        'm-auto max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/15',
        SIZE_CLASSES[size],
        className
      )}
    >
      {open && (
        <div className="relative p-6">
          <div className="mb-6 pr-8">
            <h2 id={titleId} className={cn('text-xl font-bold text-gray-900', description && 'mb-2')}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-gray-600">
                {description}
              </p>
            )}
          </div>

          {children}

          {footer && <ModalFooter>{footer}</ModalFooter>}

          {/* Last in DOM order (as in the Figma/Radix dialog) so initial focus lands on the first field */}
          <button
            type="button"
            onClick={() => dismissible && onClose()}
            disabled={!dismissible}
            aria-label={closeLabel}
            className="absolute right-4 top-4 cursor-pointer rounded-lg p-2 text-gray-400 outline-none transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </dialog>
  );
}

/** Action row for modal forms: place it inside the <form> so submit buttons work. */
export function ModalFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex space-x-3 pt-4', className)} {...props} />;
}
