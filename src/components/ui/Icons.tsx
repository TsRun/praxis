/* Feather-style line icons. Stroke = currentColor. */
import type { SVGProps } from 'react';

interface I extends SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

function makeIcon(d: string | string[]) {
  return function Icon({ size = 14, strokeWidth = 2.2, ...rest }: I) {
    const paths = Array.isArray(d) ? d : [d];
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {paths.map((p, i) => (
          <path key={i} d={p} />
        ))}
      </svg>
    );
  };
}

export const IconTree     = makeIcon('M12 7v4M12 11l-7 6M12 11l7 6');
export const IconList     = makeIcon('M3 6h18M3 12h18M3 18h12');
export const IconGame     = makeIcon([
  'M4 19.5V6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13',
  'M4 19.5h16M9 4.5v15',
]);
export const IconBolt     = makeIcon('M13 2L3 14h9l-1 8 10-12h-9l1-8z');
export const IconPlus     = makeIcon('M12 5v14M5 12h14');
export const IconDownload = makeIcon([
  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
  'M7 10l5 5 5-5M12 15V3',
]);
export const IconCopy     = makeIcon([
  'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z',
  'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
]);
export const IconClipboard = makeIcon([
  'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z',
  'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
]);
export const IconAssign   = makeIcon([
  'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
  'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'M20 8v6M23 11h-6',
]);
export const IconSearch   = makeIcon([
  'M21 21l-4.35-4.35',
  'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
]);
export const IconCheck    = makeIcon('M20 6L9 17l-5-5');
export const IconX        = makeIcon('M18 6L6 18M6 6l12 12');
export const IconFlip     = makeIcon([
  'M7 21V3M3 7l4-4 4 4',
  'M17 3v18M21 17l-4 4-4-4',
]);
export const IconTrash    = makeIcon([
  'M3 6h18',
  'M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6',
]);
export const IconChevDown = makeIcon('M6 9l6 6 6-6');
export const IconClock    = makeIcon([
  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  'M12 6v6l4 2',
]);
export const IconStar     = makeIcon('M12 2l2.39 7.36H22l-6.2 4.5 2.39 7.36L12 16.74 5.81 21.22 8.2 13.86 2 9.36h7.61z');
export const IconUsers    = makeIcon([
  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
  'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'M23 21v-2a4 4 0 0 0-3-3.87',
  'M16 3.13a4 4 0 0 1 0 7.75',
]);
export const IconUser     = makeIcon([
  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
  'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
]);
export const IconMortar   = makeIcon([
  'M22 10v6M2 10l10-5 10 5-10 5z',
  'M6 12v5c0 1.66 4 3 6 3s6-1.34 6-3v-5',
]);
export const IconBookOpen = makeIcon([
  'M4 19.5V6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13',
  'M4 19.5h16M9 4.5v15',
]);
export const IconHelp     = makeIcon([
  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
]);
export const IconMore     = makeIcon([
  'M12 6a1.5 1.5 0 1 0 0 0',
  'M12 12a1.5 1.5 0 1 0 0 0',
  'M12 18a1.5 1.5 0 1 0 0 0',
]);
export const IconArrowL   = makeIcon('M19 12H5M12 19l-7-7 7-7');
export const IconArrowR   = makeIcon('M5 12h14M12 5l7 7-7 7');
export const IconAlert    = makeIcon([
  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  'M12 8v4M12 16h.01',
]);
export const IconLamp     = makeIcon([
  'M9 18h6M10 22h4',
  'M12 2a7 7 0 0 0-4 12.7c1 .9 1.5 2 1.5 3.3h5c0-1.3.5-2.4 1.5-3.3A7 7 0 0 0 12 2z',
]);
export const IconGrid     = makeIcon([
  'M3 3h7v7H3z',
  'M14 3h7v7h-7z',
  'M3 14h7v7H3z',
  'M14 14h7v7h-7z',
]);
export const IconLogout   = makeIcon([
  'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
  'M16 17l5-5-5-5M21 12H9',
]);

export const IconSun = makeIcon([
  'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
]);
export const IconMoon = makeIcon('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
