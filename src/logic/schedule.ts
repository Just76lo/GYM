import { isoDate, parseDate, weekdayIndex, winterWeekOf } from './periodization'
import type { DayId, Phase, WeekType } from './types'

/** Was an einem Tag geplant ist */
export type DayKind =
  | 'gymA' | 'gymB' | 'gymC'
  | 'football' | 'game'
  | 'runSprint' | 'runEasy'
  | 'recovery' | 'rest'

export const DAY_KINDS: { id: DayKind; label: string; short: string }[] = [
  { id: 'gymA', label: 'Gym A', short: 'Gym A' },
  { id: 'gymB', label: 'Gym B', short: 'Gym B' },
  { id: 'gymC', label: 'Gym C', short: 'Gym C' },
  { id: 'football', label: 'Fußballtraining', short: 'Fußball' },
  { id: 'game', label: 'Spiel', short: 'Spiel' },
  { id: 'runSprint', label: 'Laufen: Sprints + Intervalle', short: 'Sprints' },
  { id: 'runEasy', label: 'Laufen: locker (20–30 min)', short: 'Laufen' },
  { id: 'recovery', label: 'Regeneration', short: 'Regen.' },
  { id: 'rest', label: 'Pause', short: 'Pause' },
]

export const kindLabel = (k: DayKind): string => DAY_KINDS.find((d) => d.id === k)!.label
export const kindShort = (k: DayKind): string => DAY_KINDS.find((d) => d.id === k)!.short
export const isGymKind = (k: DayKind): boolean => k === 'gymA' || k === 'gymB' || k === 'gymC'
export const isRunKind = (k: DayKind): boolean => k === 'runSprint' || k === 'runEasy'
export const gymDayOf = (k: DayKind): DayId | null => (isGymKind(k) ? (k.slice(3) as DayId) : null)
export const gymKindOf = (d: DayId): DayKind => `gym${d}` as DayKind

export type WeekTemplate = DayKind[]

/** Standardwoche je Phase (Mo–So) */
export const DEFAULT_WEEK: Record<Phase, WeekTemplate> = {
  season: ['gymA', 'football', 'recovery', 'football', 'gymB', 'rest', 'game'],
  winter: ['gymA', 'runSprint', 'gymC', 'recovery', 'gymB', 'rest', 'rest'],
}

export interface WeekPreset { id: string; label: string; week: WeekTemplate }

/** Vorlagen für einzelne Wochen */
export const WEEK_PRESETS: WeekPreset[] = [
  { id: 'sunday', label: 'Sonntagsspiel', week: ['gymA', 'football', 'recovery', 'football', 'gymB', 'rest', 'game'] },
  { id: 'saturday', label: 'Samstagsspiel', week: ['gymA', 'football', 'gymB', 'football', 'recovery', 'game', 'rest'] },
  { id: 'english', label: 'Englische Woche', week: ['gymA', 'football', 'game', 'recovery', 'gymB', 'rest', 'game'] },
  { id: 'nogame', label: 'Ohne Spiel', week: ['gymA', 'football', 'recovery', 'football', 'gymB', 'rest', 'rest'] },
]

const WINTER_PRESETS: WeekPreset[] = [
  { id: 'sunday', label: 'Sonntagsspiel', week: ['gymA', 'runSprint', 'gymC', 'recovery', 'gymB', 'rest', 'game'] },
  { id: 'saturday', label: 'Samstagsspiel', week: ['gymA', 'runSprint', 'gymC', 'gymB', 'rest', 'game', 'rest'] },
  { id: 'english', label: 'Englische Woche', week: ['gymA', 'runSprint', 'game', 'recovery', 'gymB', 'rest', 'game'] },
  { id: 'nogame', label: 'Ohne Spiel', week: DEFAULT_WEEK.winter },
]

/** Wochenvorlagen passend zur Phase (in der Winterpause mit Laufen und Gym C statt Mannschaftstraining) */
export const presetsFor = (phase: Phase): WeekPreset[] => (phase === 'winter' ? WINTER_PRESETS : WEEK_PRESETS)

/* ---------------- Datum ---------------- */

export const addDays = (date: string, n: number): string => {
  const d = parseDate(date)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
export const mondayOf = (date: string): string => addDays(date, -weekdayIndex(date))
export const weekDates = (date: string): string[] => {
  const m = mondayOf(date)
  return Array.from({ length: 7 }, (_, i) => addDays(m, i))
}

/* ---------------- Tagesplan ---------------- */

export interface ScheduleCtx {
  phase: Phase
  winterStart: string
  defaults: Record<Phase, WeekTemplate>
  /** Einzeln überschriebene Tage */
  overrides: ReadonlyMap<string, DayKind>
}

export function kindOn(ctx: ScheduleCtx, date: string): DayKind {
  const o = ctx.overrides.get(date)
  if (o) return o
  const i = weekdayIndex(date)
  const k = ctx.defaults[ctx.phase][i]
  // Winterpause: Donnerstag ab Woche 5 locker laufen statt Regeneration
  if (ctx.phase === 'winter' && i === 3 && k === 'recovery' && winterWeekOf(ctx.winterStart, date) >= 5) return 'runEasy'
  return k
}

export const kindGetter = (ctx: ScheduleCtx) => (date: string): DayKind => kindOn(ctx, date)

/* ---------------- Spielabstand (MD) ---------------- */

export interface MdInfo {
  /** Tage bis zum nächsten Spiel (0 = heute), null = keins in den nächsten 6 Tagen */
  next: number | null
  /** Tage seit dem letzten Spiel, null = keins in den letzten 6 Tagen */
  prev: number | null
  label: string
}

/** Spielabstand aus den eingetragenen Tagen, auch über Wochengrenzen */
export function mdInfo(date: string, getKind: (d: string) => DayKind): MdInfo {
  if (getKind(date) === 'game') return { next: 0, prev: 0, label: 'Spieltag' }
  let next: number | null = null
  let prev: number | null = null
  for (let i = 1; i <= 6; i++) {
    if (next === null && getKind(addDays(date, i)) === 'game') next = i
    if (prev === null && getKind(addDays(date, -i)) === 'game') prev = i
  }
  let label = ''
  if (next !== null && next <= 2) label = `MD-${next}`
  else if (prev !== null && prev <= 2) label = `MD+${prev}`
  else if (next !== null) label = `MD-${next}`
  else if (prev !== null) label = `MD+${prev}`
  return { next, prev, label }
}

export interface GymRules {
  /** MD-1: kein Gym, höchstens 15 min Aktivierung */
  md1: boolean
  /** MD-2: keine exzentrisch schweren Beinübungen, Bein-RPE max. 7 */
  md2: boolean
  /** MD+1: Bein-RPE 6, −1 Satz, bei Gym B Sprünge auf 2×3 CMJ */
  plus1: boolean
  /** Vortag war auch Gym: Beinvolumen −1 Satz */
  b2b: boolean
  gameDay: boolean
  label: string
}

export function gymRules(date: string, getKind: (d: string) => DayKind): GymRules {
  const m = mdInfo(date, getKind)
  return {
    md1: m.next === 1,
    md2: m.next === 2,
    plus1: m.prev === 1,
    b2b: isGymKind(getKind(addDays(date, -1))),
    gameDay: getKind(date) === 'game',
    label: m.label,
  }
}

/** Bestätigbare Hinweise für einen geplanten Gym-Tag (blockieren nie) */
export function gymWarnings(date: string, getKind: (d: string) => DayKind): string[] {
  const r = gymRules(date, getKind)
  const w: string[] = []
  if (r.gameDay) w.push('Spieltag: Gym am Spieltag ist nicht vorgesehen.')
  if (r.md1) w.push('MD-1: Am Tag vor dem Spiel besser kein Gym, höchstens 15 min Aktivierung. Bei „Trotzdem“ wird die Einheit stark gekürzt.')
  if (r.md2) w.push('MD-2: keine exzentrisch schweren Beinübungen, Bein-RPE max. 7.')
  if (r.plus1) w.push('MD+1: Bein-RPE 6 und 1 Satz weniger. Bei Gym B werden Sprünge auf 2×3 CMJ reduziert.')
  if (r.b2b) w.push('Zwei Gym-Tage direkt hintereinander: In dieser zweiten Einheit gibt es 1 Satz weniger fürs Bein.')
  return w
}

/** Winterpause: Woche ohne Sprints eingetragen */
export const SPRINT_HINT = 'Mindestens 1x pro Woche Sprints, wichtig für die Oberschenkelrückseite.'

export function sprintHint(phase: Phase, dates: string[], getKind: (d: string) => DayKind): string | null {
  if (phase !== 'winter') return null
  return dates.some((d) => getKind(d) === 'runSprint') ? null : SPRINT_HINT
}

/** Automatischer Wochentyp (nur Saison): Woche ohne Spiel → Zusatzsatz + RDL */
export function weekTypeFor(phase: Phase, dates: string[], getKind: (d: string) => DayKind): WeekType {
  if (phase !== 'season') return 'normal'
  return dates.some((d) => getKind(d) === 'game') ? 'normal' : 'noGame'
}

/* ---------------- Heute trainieren ---------------- */

export const GYM_ROTATION: Record<Phase, DayId[]> = { season: ['A', 'B'], winter: ['A', 'C', 'B'] }

/** Nächste fällige Einheit: Winterpause A → C → B, Saison A → B */
export function nextDueGym(
  phase: Phase,
  finished: { day: DayId; date: string; id?: number }[],
): DayId {
  const rot = GYM_ROTATION[phase]
  const last = finished
    .filter((s) => rot.includes(s.day))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
    .pop()
  if (!last) return rot[0]
  return rot[(rot.indexOf(last.day) + 1) % rot.length]
}
