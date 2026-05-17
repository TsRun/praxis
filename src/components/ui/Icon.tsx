interface IconProps {
  name:
    | 'reset'
    | 'play'
    | 'rewind'
    | 'search'
    | 'sliders'
    | 'tree'
    | 'eye'
    | 'expand'
    | 'collapse'
    | 'arrow-left'
    | 'arrow-right'
    | 'keyboard';
  className?: string;
}

const PATHS: Record<IconProps['name'], string> = {
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  play: 'M6 4l14 8-14 8V4z',
  rewind: 'M11 19V5l-9 7 9 7zM22 19V5l-9 7 9 7z',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  sliders: 'M4 6h10M18 6h2M4 12h6M14 12h6M4 18h12M20 18h0',
  tree:
    'M12 4v3m0 0a3 3 0 1 0-3 3M12 7a3 3 0 1 1 3 3M9 10v3a3 3 0 0 0 6 0v-3M9 10a3 3 0 1 1 0 6M15 10a3 3 0 1 1 0 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  expand: 'M12 5v14M5 12h14',
  collapse: 'M5 12h14',
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  keyboard:
    'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
};

export function Icon({ name, className = 'w-4 h-4' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
