import type { BlockId, PlanExercise } from './types'

export interface BlockInfo {
  id: BlockId
  label: string
  weeks: [number, number]
  rirLow: number
  rirHigh: number
  rirText: string
}

export const BLOCKS: BlockInfo[] = [
  { id: 'basis', label: 'Basis', weeks: [1, 4], rirLow: 2, rirHigh: 3, rirText: '2–3' },
  { id: 'kraft', label: 'Kraft', weeks: [5, 8], rirLow: 1.5, rirHigh: 2, rirText: '1,5–2' },
  { id: 'power', label: 'Power', weeks: [9, 11], rirLow: 1.5, rirHigh: 2, rirText: '1,5–2' },
  { id: 'deload', label: 'Deload', weeks: [12, 12], rirLow: 4, rirHigh: 4, rirText: '4' },
]

export const CYCLE_WEEKS = 12

export const blockInfo = (id: BlockId): BlockInfo => BLOCKS.find((b) => b.id === id)!

export function blockForWeek(week: number): BlockInfo {
  const w = Math.min(Math.max(week, 1), CYCLE_WEEKS)
  return BLOCKS.find((b) => w >= b.weeks[0] && w <= b.weeks[1])!
}

const DAY_MS = 86_400_000

/** Datum (YYYY-MM-DD) → lokale Mitternacht */
export const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Zykluswoche (1-basiert) für ein Datum; < 1 vor Start, > 12 nach Zyklusende. */
export function weekOfCycle(start: string, date: string): number {
  const diff = Math.round((parseDate(date).getTime() - parseDate(start).getTime()) / DAY_MS)
  return Math.floor(diff / 7) + 1
}

/** 0 = Montag … 6 = Sonntag */
export const weekdayIndex = (date: string): number => (parseDate(date).getDay() + 6) % 7

export const WEEK_PLAN = [
  { label: 'Mo', title: 'Gym A', kind: 'gymA' },
  { label: 'Di', title: 'Fußball', kind: 'football' },
  { label: 'Mi', title: 'Regeneration', kind: 'recovery' },
  { label: 'Do', title: 'Fußball', kind: 'football' },
  { label: 'Fr', title: 'Gym B', kind: 'gymB' },
  { label: 'Sa', title: 'Pause / Aktivierung', kind: 'rest' },
  { label: 'So', title: 'Spiel', kind: 'game' },
] as const

/** Wendet Block-Überschreibungen (Kraft/Power) auf Sätze und Wiederholungsbereich an. */
export function applyBlock(ex: PlanExercise, block: BlockId): PlanExercise {
  if ((block === 'kraft' || block === 'power') && ex.kraft) {
    return { ...ex, ...ex.kraft }
  }
  return ex
}
