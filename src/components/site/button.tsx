import type { ReactNode } from 'react';
import { IconArrowCircle } from './icons/mask-icons';

/**
 * Primary button of the site.
 *
 * Reference: a 40px accent pill with 10/32 padding, a 32px radius and a 16/22
 * w600 white label. On hover a 24x24 circled arrow in surface-alt appears
 * after the label with the button's own 10px gap, and the pair re-centres -
 * the label moves left by half of what the icon and the gap take. The icon is
 * absent from the flow at rest, so the resting frame is untouched.
 */
export function SiteButton({
  href,
  children,
  className
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = className === undefined ? 'site-button t-f0mgg6' : 'site-button t-f0mgg6 ' + className;
  return (
    <a className={classes} href={href}>
      <span className="site-button-label">{children}</span>
      <IconArrowCircle className="site-button-icon" />
    </a>
  );
}
