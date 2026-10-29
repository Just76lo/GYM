import { isoDate, parseDate } from './periodization'

export interface BwEntry {
  date: string
  kg: number
}

export interface WeekAvg {
  weekStart: string
  avg: number
  n: number
}

/** Montag der Woche (YYYY-MM-DD) */
export function weekStartOf(date: string): string {
  const d = parseDate(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDate(d)
}

export function weeklyAverages(entries: BwEntry[]): WeekAvg[] {
  const map = new Map<string, number[]>()
  for (const e of entries) {
    const k = weekStartOf(e.date)
    map.set(k, [...(map.get(k) ?? []), e.kg])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, v]) => ({ weekStart, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
}

export const KCAL_HINT = '+200 kcal pro Tag erwägen: Das Körpergewicht steigt seit 2 Wochen nicht.'

/**
 * Keine Zunahme in 2 Wochen: Der aktuelle und der vorherige Wochenschnitt
 * liegen jeweils nicht über dem Schnitt von vor 2 Wochen (Toleranz 0,1 kg).
 */
export function noGainTwoWeeks(entries: BwEntry[], goal = 80): boolean {
  const w = weeklyAverages(entries)
  if (w.length < 3) return false
  const [a, b, c] = w.slice(-3)
  if (c.avg >= goal) return false
  return b.avg <= a.avg + 0.1 && c.avg <= a.avg + 0.1
}
