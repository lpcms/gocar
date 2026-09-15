import type { ReactNode } from 'react';

/**
 * One field of a site form.
 *
 * Reference (spec/dom/contact@1440-en.json plus scripts/diag-form.mjs): the
 * field is a `label` wrapping a 50px surface-alt box with a 10px radius and
 * 15px padding; the control itself is transparent, has no border, is 16/19.2
 * in ink and its placeholder is the muted colour. A form stacks its fields
 * with a 15px gap. The booking form uses the same box with 12px padding, a
 * 40px height and a translucent grey fill, which is the `compact` variant.
 *
 * Two things the reference does not do (plan section 7.3): the field carries a
 * real accessible name instead of relying on the placeholder, which disappears
 * as soon as the visitor types - the name is rendered visually hidden, the way
 * the reference itself hides the label of the locale select - and an invalid
 * field can show a message. Neither changes a resting frame.
 */
export function FormField({
  label,
  htmlFor,
  error,
  invalid,
  compact,
  area,
  children
}: {
  label: string;
  htmlFor: string;
  error?: string;
  /** Marks the field without printing a message under it. */
  invalid?: boolean;
  compact?: boolean;
  area?: boolean;
  children: ReactNode;
}) {
  const errorId = htmlFor + '-error';
  const boxClasses = ['site-field-box'];
  if (compact === true) boxClasses.push('site-field-box--compact');
  if (area === true) boxClasses.push('site-field-box--area');

  const flagged = error !== undefined || invalid === true;

  return (
    <div className={flagged ? 'site-field site-field--invalid' : 'site-field'}>
      <label className="site-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      <span className={boxClasses.join(' ')}>{children}</span>
      {error === undefined ? null : (
        <span className="site-field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
