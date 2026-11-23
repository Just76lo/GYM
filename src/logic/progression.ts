import type { ExerciseLog, SetLog } from './types'

export const fmt = (n: number, digits = 1): string =>
  (Math.round(n * 10 ** digits) / 10 ** digits).toString().replace('.', ',')

export const roundTo = (x: number, step: number): number =>
  step > 0 ? Math.round(x / step) * step : x

/** Epley: 1RM = w * (1 + r/30) */
export const epley = (weight: number, reps: number): number => weight * (1 + reps / 30)

export const weightFromE1rm = (e1rm: number, reps: number, rir: number, inc: number): number =>
  Math.max(0, roundTo(e1rm / (1 + (reps + rir) / 30), inc))

export const bestE1rm = (sets: SetLog[]): number =>
  sets.reduce((m, s) => (s.done && s.weight > 0 ? Math.max(m, epley(s.weight, s.reps)) : m), 0)

export const doneSets = (sets: SetLog[]): SetLog[] => sets.filter((s) => s.done)

export const volume = (sets: SetLog[]): number =>
  doneSets(sets).reduce((v, s) => v + s.weight * s.reps, 0)

export function describeSets(sets: SetLog[], unit = 'kg'): string {
  const d = doneSets(sets)
  if (!d.length) return '–'
  const reps = d.map((s) => s.reps)
  const same = reps.every((r) => r === reps[0])
  const rirMin = Math.min(...d.map((s) => s.rir))
  const w = d[d.length - 1].weight
  return `${same ? `${d.length}x${reps[0]}` : reps.join('/')} @ ${fmt(w)} ${unit} · RIR ${rirMin}`
}

export interface ExRule {
  repMin: number
  repMax: number
  inc: number
}

export type Action = 'start' | 'increase' | 'double' | 'hold' | 'repsUp' | 'decrease' | 'reduced'

export interface Suggestion {
  weight: number
  reps: number
  action: Action
  reason: string
}

/**
 * Double Progression mit RIR-Steuerung.
 * `rirLow` ist das untere Ende des Ziel-RIR des aktuellen Blocks.
 * Reihenfolge der Regeln: doppeltes Inkrement > Inkrement > Abzug > Wiederholung +1.
 */
export function suggestNext(rule: ExRule, last: SetLog[] | undefined, rirLow: number): Suggestion {
  const sets = last ? doneSets(last) : []
  if (!sets.length) {
    return { weight: 0, reps: rule.repMin, action: 'start', reason: 'Noch keine Daten – Startgewicht selbst wählen' }
  }
  const weight = sets[sets.length - 1].weight
  const reps = sets.map((s) => s.reps)
  const rirs = sets.map((s) => s.rir)
  const minRir = Math.min(...rirs)
  const avgRir = rirs.reduce((a, b) => a + b, 0) / rirs.length
  const minReps = Math.min(...reps)
  const top = sets.every((s) => s.reps >= rule.repMax)
  const label = `Letztes Mal ${describeSets(sets).split(' @ ')[0]} @ RIR ${minRir}`

  if (top && rule.inc <= 0) {
    return { weight, reps: rule.repMax, action: 'hold', reason: `${label} → Obergrenze erreicht: schwerere Variante wählen` }
  }
  if (top && minRir >= rirLow + 2) {
    const w = weight + 2 * rule.inc
    return { weight: w, reps: rule.repMin, action: 'double', reason: `${label} → +${fmt(2 * rule.inc)} kg (doppelter Sprung)` }
  }
  if (top && minRir >= rirLow) {
    return { weight: weight + rule.inc, reps: rule.repMin, action: 'increase', reason: `${label} → +${fmt(rule.inc)} kg` }
  }
  if (minReps < rule.repMin || avgRir < rirLow - 1) {
    let w = roundTo(weight * 0.95, rule.inc)
    if (w >= weight && weight > 0) w = Math.max(0, weight - rule.inc)
    return { weight: w, reps: rule.repMin, action: 'decrease', reason: `${label} → −5 % (${fmt(w)} kg)` }
  }
  const target = Math.min(rule.repMax, Math.max(rule.repMin, minReps + 1))
  return {
    weight,
    reps: target,
    action: target > minReps ? 'repsUp' : 'hold',
    reason: `${label} → gleiches Gewicht, Ziel ${target} Wdh.`,
  }
}

/** Höchstes Gewicht der letzten abgeschlossenen Sätze */
export const topWeight = (log: ExerciseLog): number =>
  doneSets(log.sets).reduce((m, s) => Math.max(m, s.weight), 0)

/* ---------------- Nordics ---------------- */

export interface NordicLevel {
  level: number
  label: string
  sets: number
  repMin: number
  repMax: number
}

export const NORDIC_LEVELS: NordicLevel[] = [
  { level: 1, label: 'Stufe 1: mit Band', sets: 2, repMin: 4, repMax: 4 },
  { level: 2, label: 'Stufe 2: mit Band', sets: 3, repMin: 5, repMax: 5 },
  { level: 3, label: 'Stufe 3: ohne Band', sets: 3, repMin: 4, repMax: 6 },
  { level: 4, label: 'Stufe 4: langsam (5 s exzentrisch)', sets: 3, repMin: 5, repMax: 5 },
]

export const PHYSIO_HINT = 'Bei anhaltenden Beschwerden Physio aufsuchen.'

export interface NordicResult {
  level: number
  message: string
}

export function nextNordicLevel(
  level: number,
  sets: SetLog[],
  hamstringPain: number,
  locked = false,
): NordicResult {
  const cur = NORDIC_LEVELS[Math.min(Math.max(level, 1), 4) - 1]
  if (hamstringPain >= 3) {
    const l = Math.max(1, cur.level - 1)
    return {
      level: l,
      message: `Beschwerden Oberschenkelrückseite (${hamstringPain}/10) → ${NORDIC_LEVELS[l - 1].label}. ${PHYSIO_HINT}`,
    }
  }
  const done = doneSets(sets)
  const clean = done.length >= cur.sets && done.every((s) => s.reps >= cur.repMax)
  if (clean && cur.level < 4) {
    if (locked) return { level: cur.level, message: 'Aufstieg gesperrt (Beschwerden im letzten Zyklus).' }
    const l = cur.level + 1
    return { level: l, message: `Sauber geschafft → ${NORDIC_LEVELS[l - 1].label}` }
  }
  return { level: cur.level, message: `${cur.label} beibehalten` }
}

/* ---------------- Isometrie / Copenhagen ---------------- */

export interface IsoResult {
  target: number
  variantIdx: number
  reason: string
}

/** +5 s pro Woche bis zur Obergrenze, dann nächste Variante (zurück auf Untergrenze). */
export function nextIso(
  rule: { repMin: number; repMax: number; sets: number },
  last: ExerciseLog | undefined,
  variantIdx: number,
  variants: string[] = [],
): IsoResult {
  if (!last) {
    return { target: rule.repMin, variantIdx, reason: `Start mit ${rule.repMin} s` }
  }
  const d = doneSets(last.sets)
  const ok = d.length >= rule.sets && d.every((s) => s.reps >= last.targetReps)
  if (!ok) {
    return { target: last.targetReps, variantIdx, reason: `Ziel ${last.targetReps} s nicht überall geschafft → gleich bleiben` }
  }
  if (last.targetReps >= rule.repMax) {
    if (variantIdx < variants.length - 1) {
      const v = variantIdx + 1
      return { target: rule.repMin, variantIdx: v, reason: `Obergrenze erreicht → nächste Variante: ${variants[v]}` }
    }
    return { target: rule.repMax, variantIdx, reason: `Obergrenze ${rule.repMax} s gehalten` }
  }
  const t = Math.min(rule.repMax, last.targetReps + 5)
  return { target: t, variantIdx, reason: `Alle Sätze geschafft → +5 s (${t} s)` }
}

/* ---------------- Explosive Übungen ---------------- */

export interface ExplosiveStats {
  best: number
  last: number
  trend: 'up' | 'flat' | 'down' | 'none'
}

/** Bestwert und Trend (letzte 3 vs. 3 davor) – keine Gewichtsprogression. */
export function explosiveStats(logs: ExerciseLog[]): ExplosiveStats {
  const vals = logs
    .map((l) => doneSets(l.sets).reduce((m, s) => Math.max(m, s.weight), 0))
    .filter((v) => v > 0)
  if (!vals.length) return { best: 0, last: 0, trend: 'none' }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const recent = vals.slice(-3)
  const prev = vals.slice(-6, -3)
  let trend: ExplosiveStats['trend'] = 'none'
  if (prev.length) {
    const d = avg(recent) - avg(prev)
    const tol = avg(prev) * 0.01
    trend = d > tol ? 'up' : d < -tol ? 'down' : 'flat'
  }
  return { best: Math.max(...vals), last: vals[vals.length - 1], trend }
}

/* ---------------- Speed-Kniebeuge ---------------- */

const DAY_MS = 86_400_000
const daysBetween = (a: string, b: string): number => {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()) / DAY_MS)
}

export interface SpeedResult {
  weight: number
  reason: string
}

/**
 * Speed-Kniebeuge: keine RIR-Progression. Gleiches Gewicht, alle 2 Wochen +inc,
 * aber nur, wenn das Tempo in allen Einheiten mit diesem Gewicht gut geblieben ist.
 * `start` = 55 % des Kniebeugen-1RM (0, wenn unbekannt).
 */
export function nextSpeedWeight(logs: ExerciseLog[], start: number, inc: number, date?: string): SpeedResult {
  const done = logs.filter((l) => doneSets(l.sets).length > 0)
  if (!done.length) {
    return {
      weight: start,
      reason: start > 0
        ? `Start: 55 % des Kniebeugen-1RM = ${fmt(start)} kg (keine RIR-Progression)`
        : 'Noch keine Daten – 50–60 % des Kniebeugen-1RM wählen (1RM unter „Mehr“ eintragen)',
    }
  }
  const last = done[done.length - 1]
  const w = topWeight(last)
  let i = done.length - 1
  while (i >= 0 && topWeight(done[i]) === w) i--
  const streak = done.slice(i + 1)
  const first = streak[0]
  const good = streak.every((l) => l.tempoGood !== false)
  const elapsed = first.date && (date ?? last.date) ? daysBetween(first.date, (date ?? last.date)!) : null
  const due = elapsed !== null ? elapsed >= 14 : streak.length >= 2
  if (!good) return { weight: w, reason: `Tempo war zuletzt nicht gut → gleiches Gewicht ${fmt(w)} kg` }
  if (due && inc > 0) return { weight: w + inc, reason: `Tempo blieb gut, ${elapsed ?? streak.length * 7} Tage auf ${fmt(w)} kg → +${fmt(inc)} kg` }
  return { weight: w, reason: `Gleiches Gewicht ${fmt(w)} kg bis 2 Wochen vorbei sind (nur bei gutem Tempo +${fmt(inc)} kg)` }
}
