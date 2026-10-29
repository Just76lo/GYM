import type { SVGProps } from 'react'

const P: Record<string, string> = {
  today: 'M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12',
  chart: 'M4 20h16M6 16l4-5 3 3 5-7',
  scale: 'M4 20h16l-2-12H6L4 20zM9 8a3 3 0 0 1 6 0M12 8l1.5-2',
  book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h9',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'M8 5l11 7-11 7V5z',
  video: 'M4 7h11v10H4zM15 10l5-3v10l-5-3',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  back: 'M15 5l-7 7 7 7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  plan: 'M8 5h11M8 12h11M8 19h11M4 5h.01M4 12h.01M4 19h.01',
  review: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
}

export type IconName = keyof typeof P

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  )
}
