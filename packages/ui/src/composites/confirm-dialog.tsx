/**
 * Confirm Dialog Component
 *
 * A confirmation dialog for destructive or important actions.
 * Uses shadcn AlertDialog with support for destructive variant styling.
 *
 * Usage:
 * ```tsx
 * <ConfirmDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   title="Delete Agent"
 *   description="This action cannot be undone."
 *   confirmLabel="Delete"
 *   variant="destructive"
 *   onConfirm={handleDelete}
 *   loading={isDeleting}
 * >
 *   <ul>
 *     <li>All threads will be removed</li>
 *     <li>Flows will stop working</li>
 *   </ul>
 * </ConfirmDialog>
 * ```
 */

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../primitives/alert-dialog';

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;

  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;

  /** Dialog title */
  title: string;

  /** Dialog description */
  description: string;

  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;

  /** Button variant (default: "default") */
  variant?: 'default' | 'destructive';

  /** Callback when confirm is clicked */
  onConfirm: () => void;

  /** Show loading state on confirm button */
  loading?: boolean;

  /** Optional rich content rendered below the description */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'default',
  onConfirm,
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="overscroll-contain">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={loading}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {loading ? 'Processing…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
