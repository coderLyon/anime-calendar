import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function base(props: P) {
  return { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, ...props };
}

export function StarIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.6l6.1-.8Z" />
    </svg>
  );
}

export function CalendarIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9h18M8 2.8v3.4M16 2.8v3.4M8 13.5h8M8 17h5" />
    </svg>
  );
}

export function RefreshIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M20 11a8.1 8.1 0 0 0-14.9-3.5L4 10" />
      <path d="M4 5v5h5M4 13a8.1 8.1 0 0 0 14.9 3.5L20 14" />
      <path d="M20 19v-5h-5" />
    </svg>
  );
}

export function SearchIcon(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  );
}

export function DownloadIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
      <path d="M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </svg>
  );
}

export function UploadIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 15.5v-11m0 0 4 4m-4-4-4 4" />
      <path d="M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </svg>
  );
}

export function WarnIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 9.5v4.5M12 17.2v.1" />
    </svg>
  );
}

export function ErrIcon(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}

export function ChevronRightIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  );
}

export function ChevronDownIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronUpIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

export function ExternalIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M19 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18V7a1.5 1.5 0 0 1 1.5-1.5H10" />
    </svg>
  );
}

export function EmptyIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9h18M8 2.8v3.4M16 2.8v3.4" />
      <path d="m8.5 14.5 2.3 2.3 4.7-5" />
    </svg>
  );
}

export function MoonIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

export function SunIcon(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
    </svg>
  );
}
