/**
 * FormField Component
 *
 * A composite that wraps Label + input + optional error message into a
 * single reusable layout. Eliminates the repetitive `space-y-2` +
 * `Label htmlFor` + error `<p>` pattern found across dozens of forms.
 *
 * Usage:
 * ```tsx
 * <FormField label="Name" htmlFor="name" error={errors.name}>
 *   <Input id="name" value={name} onChange={...} />
 * </FormField>
 * ```
 */

import { Label } from '../primitives/label';
import { cn } from '../utils';

interface FormFieldProps {
  /** The label text displayed above the input */
  label: React.ReactNode;

  /** The id of the associated input element (passed to Label htmlFor) */
  htmlFor?: string;

  /** Optional error message displayed below the input */
  error?: string | null;

  /** Optional description text displayed below the input */
  description?: string;

  /** Whether the field is required (shows asterisk) */
  required?: boolean;

  /** Optional className for the label */
  labelClassName?: string;

  /** Optional className for the outer wrapper */
  className?: string;

  /** The input element(s) to render inside the field */
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  description,
  required,
  labelClassName,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </Label>
      {children}
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}
