/**
 * Icons the reference paints as a CSS mask or a background image rather than
 * as an inline `<svg>`.
 *
 * `scripts/spec-icons.mjs` cannot extract these: in the DOM they are an empty
 * `div` whose art lives in a `mask-image` or `background-image` data URI, so
 * they are transcribed by hand from that URI and kept out of the generated
 * `index.tsx`, which is overwritten on every run of the extractor.
 *
 * Server components: no state, nothing reaches the client bundle. Size comes
 * from font-size, colour from `currentColor`.
 */

import type { SVGProps } from 'react';

/**
 * Arrow in a circle, revealed on the hover state of a primary button. The
 * reference draws 18x18 of art centred in a 24x24 box with a 1.5 stroke.
 */
export function IconArrowCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M 9.75 12 L 12.75 9 M 12.75 9 L 9.75 6 M 12.75 9 L 5.25 9 M 18 9 C 18 13.971 13.971 18 9 18 C 4.029 18 0 13.971 0 9 C 0 4.029 4.029 0 9 0 C 13.971 0 18 4.029 18 9 Z"
        fill="transparent"
        height="18px"
        width="18px"
        strokeDasharray=""
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        stroke="currentColor"
        transform="translate(3 3)"
      />
    </svg>
  );
}

/**
 * Chevron pointing up, drawn on an open FAQ item. It is the mirror of the
 * closed-state chevron (Icon05) and the reference paints it white, so the
 * colour comes from `currentColor` here.
 */
export function IconChevronUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 25" width="1em" height="1em" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M 12 7.536 C 12.192 7.536 12.384 7.609 12.53 7.756 L 20.03 15.256 C 20.323 15.549 20.323 16.023 20.03 16.316 C 19.737 16.609 19.263 16.609 18.97 16.316 L 12 9.347 L 5.03 16.316 C 4.737 16.609 4.263 16.609 3.97 16.316 C 3.677 16.023 3.677 15.549 3.97 15.256 L 11.47 7.756 C 11.616 7.609 11.808 7.536 12 7.536 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Arrows of the testimonials slider. The reference loads them as `img` files
 * whose SVG also carries the red disc of the button; only the white glyph is
 * kept here, in the same 50x51 coordinate system, so a 26px box scales it
 * exactly as the reference does.
 */
export function IconSliderPrev(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 51" width="1em" height="1em" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M15.47 26.29a.75.75 0 0 1 0-1.06l4.773-4.773a.75.75 0 0 1 1.06 1.06l-4.242 4.243 4.242 4.243a.75.75 0 1 1-1.06 1.06zm18.53.22H16v-1.5h18z"
      />
    </svg>
  );
}

/** Right-hand arrow of the testimonials slider. */
export function IconSliderNext(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 51" width="1em" height="1em" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M34.53 26.29a.75.75 0 0 0 0-1.06l-4.773-4.773a.75.75 0 0 0-1.06 1.06l4.242 4.243-4.242 4.243a.75.75 0 1 0 1.06 1.06zM16 26.51h18v-1.5H16z"
      />
    </svg>
  );
}


/**
 * Gearbox lever of the car-detail specifications.
 *
 * The reference serves it as a standalone file from the Framer asset tree
 * (`/assets/img/agudnPe97vqYRzrRuJtfPOem4.svg`), so `scripts/spec-icons.mjs`
 * never saw it. The art is copied here verbatim in its own 24x24 grid, with
 * the baked `#FD3B3B` swapped for `currentColor` so the row decides the
 * colour - phase 2 must not depend on the Framer tree.
 */
export function IconTransmission(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g fill="currentColor">
        <path d="M2 4a2 2 0 1 1 2.75 1.855v5.395h6.5V5.855a2 2 0 1 1 1.5 0v5.395H16c.964 0 1.612-.002 2.095-.066.461-.063.659-.17.789-.3s.237-.328.3-.79c.064-.482.066-1.13.066-2.094V5.855a2 2 0 1 1 1.5 0v2.197c0 .898 0 1.648-.08 2.242-.084.628-.27 1.195-.726 1.65-.455.456-1.022.642-1.65.726-.594.08-1.343.08-2.242.08H12.75v5.395a2 2 0 1 1-1.5 0V12.75h-6.5v5.395a2 2 0 1 1-1.5 0V5.855A2 2 0 0 1 2 4" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M17.25 15a.75.75 0 0 1 .75-.75h2.286c1.375 0 2.464 1.134 2.464 2.5a2.5 2.5 0 0 1-1.641 2.358l1.53 2.5a.75.75 0 1 1-1.279.784l-1.923-3.142h-.687V22a.75.75 0 0 1-1.5 0zm1.5 2.75h1.536c.518 0 .964-.433.964-1s-.446-1-.964-1H18.75z"
        />
      </g>
    </svg>
  );
}

/**
 * Fuel pump of the car-detail specifications. The reference paints it inside
 * a Framer sprite that the extractor cannot resolve, so it is drawn here in
 * the same 24x24 grid and the same 1.5 stroke weight as the other outline
 * icons of the set.
 */
export function IconFuel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h4A2.5 2.5 0 0 1 13 5.5V21" />
        <path d="M2.75 21h11.5" />
        <path d="M6.5 6.75h4.5v3.5H6.5z" />
        <path d="M13 9h3.25a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 0 1.75 1.75A1.75 1.75 0 0 0 21.5 16.75V9.5l-2.75-3" />
      </g>
    </svg>
  );
}

/**
 * Drivetrain of the car-detail specifications - the sixth spec, added on the
 * client's request 22.08.2026 and absent from the reference. Redrawn as a
 * vector from the artwork the client supplied (a raster schematic of four
 * wheels, the gearbox on the front axle and the driveshaft running back to
 * the differential), in the same 24x24 grid and 1.5 stroke weight as the
 * other outline icons of the set, so it sits on the row like a sibling.
 */
export function IconDrivetrain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Four wheels, front pair on top. */}
        <rect x="2.6" y="3.2" width="3.4" height="6.4" rx="1.3" />
        <rect x="18" y="3.2" width="3.4" height="6.4" rx="1.3" />
        <rect x="2.6" y="14.4" width="3.4" height="6.4" rx="1.3" />
        <rect x="18" y="14.4" width="3.4" height="6.4" rx="1.3" />
        {/* Front axle with the gearbox sitting on it. */}
        <path d="M6 6.4h4M14 6.4h4" />
        <rect x="10" y="4.2" width="4" height="4.4" rx="1.2" />
        {/* Driveshaft down to the differential on the rear axle. */}
        <path d="M12 8.6v6.9" />
        <path d="M6 17.6h3.9M14.1 17.6H18" />
        <circle cx="12" cy="17.6" r="2.1" />
      </g>
    </svg>
  );
}
