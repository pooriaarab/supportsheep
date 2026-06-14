/**
 * LoadingButton Component
 *
 * A composite that extends Button with built-in loading state handling.
 * Replaces the repetitive `{isPending ? 'Saving...' : 'Save'}` pattern
 * found across many forms and dialogs.
 *
 * Usage:
 * ```tsx
 * <LoadingButton loading={mutation.isPending} loadingText="Saving...">
 *   Save
 * </LoadingButton>
 * ```
 */

import { Loader2 } from 'lucide-react';
import { Button } from '../primitives/button';
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<typeof Button>;

interface LoadingButtonProps extends ButtonProps {
  /** Whether the button is in a loading state */
  loading?: boolean;

  /** Text to display while loading (replaces children) */
  loadingText?: string;
}

export function LoadingButton({
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
