'use client';

import { useRef, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface ConfirmDialogProps {
  open: boolean;
  /** Short question or action, e.g. "Eliminar documento". */
  title: string;
  /** The consequence of confirming, in pt-PT. */
  description: ReactNode;
  /** Label of the confirm button, e.g. "Eliminar". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `destructive` (default) for irreversible actions. */
  variant?: 'destructive' | 'primary';
  /**
   * The action is running: both buttons are blocked, the confirm button shows a spinner and the
   * dialog cannot be dismissed. Only for callers that keep the dialog open while they work.
   */
  loading?: boolean;
  /** Announced to assistive technologies while `loading` (pt-PT). */
  loadingLabel?: string;
  /** Error from the last attempt (pt-PT); the caller keeps the dialog open so the user can retry or cancel. */
  error?: string | null;
  /** The caller runs the action and decides when to close the dialog. */
  onConfirm: () => void;
  /** Cancelar, Escape, backdrop and the close button (blocked while `loading`). */
  onCancel: () => void;
}

// While loading, the buttons use aria-disabled instead of `disabled`: a disabled button cannot hold
// focus, so the browser would drop focus to the page body. aria-disabled keeps the buttons focusable
// (focus stays in the dialog, Tab works) while the click handlers ignore activation.
const BLOCKED_CLASSES = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/**
 * Confirmation for actions that need an explicit decision (role="alertdialog").
 * Focus starts on Cancelar, so pressing Enter by accident never confirms.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  loading = false,
  loadingLabel = 'A processar…',
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      role="alertdialog"
      dismissible={!loading}
      initialFocusRef={cancelRef}
    >
      {/* Rendered for the whole time the dialog is open, so the change to "loading" is announced */}
      <span role="status" className="sr-only">
        {loading ? loadingLabel : ''}
      </span>
      {error && (
        <p role="alert" className="-mt-2 mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!loading) onCancel();
          }}
          aria-disabled={loading || undefined}
          className={`w-full sm:w-auto ${BLOCKED_CLASSES}`}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant}
          size="sm"
          onClick={() => {
            if (!loading) onConfirm();
          }}
          aria-disabled={loading || undefined}
          aria-busy={loading || undefined}
          className={`w-full sm:w-auto ${BLOCKED_CLASSES}`}
        >
          {loading && <Spinner size="sm" tone="current" label={null} className="-ml-1 mr-2" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
