import { useId, type ReactNode } from 'react';

/**
 * One labelled form control.
 *
 * Extracted as a component rather than as an `@apply` CSS class: the repetition
 * in a form is structural (label, control, hint, error, and the ids tying them
 * together), not merely visual, and only the structural version can guarantee
 * the accessibility wiring is present every time.
 *
 * `useId` generates the id, so a label is always bound to its input and an
 * error is always announced — NFR-10 by construction rather than by review.
 */
interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}

const INPUT_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100';

export { INPUT_CLASS };

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>

      {children({ id, describedBy })}

      {hint && (
        <p className="text-xs text-slate-500" id={hintId}>
          {hint}
        </p>
      )}

      {error && (
        <p className="text-xs font-medium text-red-700" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
