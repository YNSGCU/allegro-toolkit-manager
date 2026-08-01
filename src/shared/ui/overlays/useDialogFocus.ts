import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseDialogFocusOptions {
  open: boolean;
  onClose: () => void;
  dismissDisabled?: boolean;
}

export default function useDialogFocus<T extends HTMLElement>({
  open,
  onClose,
  dismissDisabled = false,
}: UseDialogFocusOptions) {
  const dialogRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissDisabledRef = useRef(dismissDisabled);

  onCloseRef.current = onClose;
  dismissDisabledRef.current = dismissDisabled;

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const dialog = dialogRef.current;
    const preferredTarget = dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus]');
    const firstTarget = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (preferredTarget || firstTarget || dialog)?.focus();

    return () => {
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  const handleDialogKeyDown = useCallback((event: ReactKeyboardEvent<T>) => {
    if (event.key === 'Escape' && !dismissDisabledRef.current) {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === first || !dialogRef.current.contains(activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (activeElement === last || !dialogRef.current.contains(activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return { dialogRef, handleDialogKeyDown };
}
