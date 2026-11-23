import { baseLibrary } from '../data/library'
import { DEFAULT_EQUIPMENT, resolveExercise, type Equipment } from './equipment'
import { applyBlock, blockInfo, isReliefBlock } from './periodization'
import type { GymRules } from './schedule'
import {
  NORDIC_LEVELS,
  bestE1rm,
  doneSets,
  epley,
  fmt,
  nextIso,
  nextSpeedWeight,
  roundTo,
  suggestNext,
  topWeight,
  weightFromE1rm,
} from './progression'
import type {
  BlockId,
  DayId,
  ExState,
  ExerciseLog,
  Phase,
  Plan,
  PlanExercise,
  Prescribed,
  WeekType,
} from './types'

export interface Adjusted {
  ex: PlanExercise
  reduced: boolean
  loadFactor: number
  rpe?: number
  rirOverride?: number
  hints: string[]
}

export interface AdjustCtx {
  day: DayId
  block: BlockId
  weekType: WeekType
  heavyLegs: boolean
  nordicLevel?: number
  noExtraLegSet?: boolean
  phase?: Phase
  /** Winterwoche 1–9 */
  winterWeek?: number
  /** Spielabstand-Regeln für diesen Tag */
  rules?: Pick<GymRules, 'md1' | 'md2' | 'plus1' | 'b2b'>
  /** exzentrisch schwere Übungen (Standard: Bibliotheksflags) */
  eccHeavy?: (exId: string) => boolean
}

let eccSet: Set<string> | null = null
const defaultEccHeavy = (exId: string): boolean => {
  eccSet ??= new Set(baseLibrary().filter((l) => l.eccentricHeavy).map((l) => l.id))
  return eccSet.has(exId)
}

/** Rumänisches Kreuzheben – Zusatzübung am Freitag in Wochen ohne Spiel */
export const RDL_EXTRA: PlanExercise = {
  pid: 'extra-rdl',
  exId: 'Romanian_Deadlift',
  name: 'Rumänisches Kreuzheben',
  kind: 'weight',
  cat: 'legs',
  sets: 3,
  repMin: 6,
  repMax: 6,
  rpe: 7,
  rest: 120,
  inc: 2.5,
  unit: 'kg',
  note: 'Nur in Wochen ohne Spiel',
}

export const extrasFor = (day: DayId, weekType: WeekType): PlanExercise[] =>
  day === 'B' && weekType === 'noGame' ? [RDL_EXTRA] : []

/**
 * Wandelt eine Planübung in die effektive Übung der Einheit um
 * (Block, Nordic-Stufe, Wochentyp, „90 min gespielt“, Deload).
 * Gibt null zurück, wenn die Übung in dieser Einheit entfällt.
 */
export function adjustExercise(base: PlanExercise, ctx: AdjustCtx): Adjusted | null {
  let ex = applyBlock(base, ctx.block)
  let reduced = false
  let loadFactor = 1
  let rpe = ex.rpe
  let rirOverride: number | undefined
  const hints: string[] = []

  if (ex.kind === 'nordic') {
    const lv = NORDIC_LEVELS[Math.min(Math.max(ctx.nordicLevel ?? 1, 1), 4) - 1]
    ex = { ...ex, sets: lv.sets, repMin: lv.repMin, repMax: lv.repMax, note: lv.label }
  }

  const isLeg = ex.cat === 'legs'
  const rules = ctx.rules
  if (ex.rpeWeek1 !== undefined && ctx.winterWeek === 1) rpe = ex.rpeWeek1

  if (ctx.day === 'A' && ctx.weekType === 'english' && isLeg) {
    ex = { ...ex, sets: Math.min(ex.sets, 2) }
    if (ex.kind === 'nordic') ex = { ...ex, repMin: 3, repMax: 3 }
    rpe = 6
    loadFactor *= 0.9
    reduced = true
    hints.push('Englische Woche: 2 Sätze, RPE 6')
  }
  if (ctx.day === 'A' && ctx.weekType === 'noGame' && isLeg && ex.kind !== 'nordic' && !ctx.noExtraLegSet) {
    ex = { ...ex, sets: ex.sets + 1 }
    hints.push('Ohne Spiel: +1 Satz')
  }
  if (ctx.day === 'B' && ctx.weekType === 'english') {
    if (ex.cat === 'legpower') return null
    if (ex.tag === 'cmj') {
      ex = { ...ex, sets: 2, repMin: 3, repMax: 3 }
      hints.push('Englische Woche: 2x3 CMJ')
    }
  }
  // MD+1 bei Gym B: Sprünge auf 2x3 CMJ reduzieren
  if (ctx.day === 'B' && rules?.plus1) {
    if (ex.cat === 'legpower') return null
    if (ex.tag === 'cmj') {
      ex = { ...ex, sets: 2, repMin: 3, repMax: 3 }
      reduced = true
      hints.push('MD+1: Sprünge auf 2x3 CMJ reduziert')
    }
  }
  // Bein-Abschlag: „90 min gespielt“ (nur Saison) oder MD+1
  const heavy = ctx.heavyLegs && ctx.phase !== 'winter'
  if (ctx.day !== 'B' && isLeg && (heavy || rules?.plus1)) {
    ex = { ...ex, sets: Math.max(1, ex.sets - 1) }
    rpe = 6
    loadFactor *= 0.9
    reduced = true
    hints.push(rules?.plus1 ? 'MD+1: Bein-RPE 6, −1 Satz' : '90 min gespielt / Beine schwer: −1 Satz, RPE 6')
  }
  // MD-2 / MD-1: keine exzentrisch schweren Beinübungen, Bein-RPE max. 7
  if ((rules?.md1 || rules?.md2) && isLeg) {
    if (ex.kind === 'nordic') {
      ex = { ...ex, sets: Math.min(ex.sets, 2), repMin: 3, repMax: 3 }
    } else if ((ctx.eccHeavy ?? defaultEccHeavy)(ex.exId)) {
      return null
    }
    rpe = Math.min(rpe ?? 7, 7)
    reduced = true
    hints.push(`${rules.md1 ? 'MD-1' : 'MD-2'}: Bein-RPE max. 7, nichts exzentrisch Schweres`)
  }
  if (rules?.md1) {
    ex = { ...ex, sets: Math.max(1, Math.ceil(ex.sets / 2)) }
    reduced = true
    hints.push('MD-1: nur Aktivierung, Sätze halbiert')
  }
  // zwei Gym-Tage direkt hintereinander: Beinvolumen −1 Satz
  if (rules?.b2b && (isLeg || ex.cat === 'legpower')) {
    ex = { ...ex, sets: Math.max(1, ex.sets - 1) }
    reduced = true
    hints.push('Gym am Vortag: Beinvolumen −1 Satz')
  }
  if (ctx.block === 'deload') {
    ex = { ...ex, sets: Math.max(1, Math.ceil(ex.sets / 2)) }
    if (ex.kind === 'weight') loadFactor *= 0.9
    rirOverride = 4
    reduced = true
    hints.push('Deload: Sätze halbiert' + (ex.kind === 'weight' ? ', Gewicht −10 %' : ''))
  }
  if (ctx.block === 'wlight') {
    ex = { ...ex, sets: Math.max(1, Math.ceil(ex.sets / 2)) }
    rirOverride = 4
    reduced = true
    hints.push('Leichte Woche: Sätze halbiert, Ziel-RIR 4 – ausgelassene Einheiten sind kein Rückschritt')
  }
  if (ctx.block === 'wtrans') {
    ex = { ...ex, sets: Math.max(1, ex.sets - 1) }
    rirOverride = 3
    reduced = true
    hints.push('Übergang: 1 Satz weniger, Ziel-RIR 3')
  }
  if (ctx.block === 'power' && ex.contrast) {
    hints.push('Kontrast: nach jedem Satz 2 Counter-Movement-Jumps')
  }
  return { ex, reduced, loadFactor, rpe, rirOverride, hints }
}

export interface BuildCtx extends AdjustCtx {
  history: Record<string, ExerciseLog[]>
  states: Record<string, ExState>
  /** Kniebeugen-1RM aus den Einstellungen (Fallback für Speed-Kniebeuge) */
  squat1rm?: number
  /** Datum der Einheit (YYYY-MM-DD) */
  date?: string
  equipment?: Equipment
}

function initialWeight(ex: PlanExercise, history: Record<string, ExerciseLog[]>, inc: number): number | null {
  if (ex.loadFrom) {
    const from = ex.loadFrom.pid
    const logs = history[from] ?? Object.entries(history).find(([k]) => k.startsWith(`${from}@`))?.[1] ?? []
    const src = logs.filter((l) => !l.reduced).slice(-1)[0]
    if (src) {
      const e1 = bestE1rm(src.sets)
      if (e1 > 0) return roundTo(e1 * ex.loadFrom.pct, inc)
    }
  }
  return ex.startWeight ?? null
}

function speedStart(ex: PlanExercise, ctx: BuildCtx): number {
  const pct = ex.loadFrom?.pct ?? 0.55
  if (ex.loadFrom) {
    const from = ex.loadFrom.pid
    const logs = ctx.history[from] ?? Object.entries(ctx.history).find(([k]) => k.startsWith(`${from}@`))?.[1] ?? []
    const src = logs.filter((l) => !l.reduced).slice(-1)[0]
    const e1 = src ? bestE1rm(src.sets) : 0
    if (e1 > 0) return roundTo(e1 * pct, ex.inc)
  }
  return ctx.squat1rm && ctx.squat1rm > 0 ? roundTo(ctx.squat1rm * pct, ex.inc) : 0
}

export function prescribeOne(base: PlanExercise, ctx: BuildCtx, extra = false): Prescribed | null {
  const state = ctx.states[base.pid]
  const adj = adjustExercise(base, { ...ctx, nordicLevel: state?.nordicLevel ?? 1 })
  if (!adj) return null
  const { ex } = adj
  const blk = blockInfo(ctx.block)
  const rirLow = adj.rirOverride ?? blk.rirLow
  const logs = ctx.history[base.pid] ?? []
  const lastReal = [...logs].reverse().find((l) => !l.reduced)
  const lastAny = logs[logs.length - 1]
  const hints = [...adj.hints]
  let weight = 0
  let reps = ex.repMin
  let reason = ''
  let variant: string | undefined

  if (ex.kind === 'isometric') {
    const vIdx = Math.max(0, ex.variants?.indexOf(lastReal?.variant ?? '') ?? 0)
    const r = nextIso(ex, lastReal, vIdx, ex.variants)
    reps = Math.min(ex.repMax, Math.max(ex.repMin, r.target))
    variant = ex.variants?.[r.variantIdx]
    reason = r.reason
  } else if (ex.kind === 'nordic') {
    reps = ex.repMin
    reason = state ? `${ex.note}` : `Start: ${ex.note}`
  } else if (ex.kind === 'explosive' && ex.speed) {
    const r = nextSpeedWeight(logs, speedStart(ex, ctx), ex.inc, ctx.date)
    weight = r.weight
    reps = ex.repMin
    reason = r.reason
    if (weight > 0) hints.push(`50–60 % des 1RM ≈ ${fmt(weight * 50 / 55, 1)}–${fmt(weight * 60 / 55, 1)} kg`)
  } else if (ex.kind === 'explosive') {
    const w = lastAny && doneSets(lastAny.sets).length ? topWeight(lastAny) : 0
    const init = initialWeight(ex, ctx.history, ex.inc)
    if (ex.loadFrom && init) {
      weight = init
      reason = `${fmt(ex.loadFrom.pct * 100, 0)} % des Trap-Bar-1RM = ${fmt(init)} kg (keine Progression)`
    } else {
      weight = w || init || 0
      reason = lastAny ? 'Keine Gewichtsprogression – Bestwert schlagen' : 'Maximaler Einsatz, nur loggen'
    }
    reps = ex.repMin
  } else {
    const prevBlock = lastReal?.block
    // Aufbau (Winterpause): obere Wiederholungsbereiche
    const upper = ctx.block === 'wbuild'
    if (!lastReal) {
      weight = initialWeight(ex, ctx.history, ex.inc) ?? 0
      reps = upper ? ex.repMax : ex.repMin
      reason = weight ? `Startgewicht ${fmt(weight)} kg` : 'Noch keine Daten – Startgewicht selbst wählen'
    } else if (isReliefBlock(ctx.block)) {
      weight = topWeight(lastReal)
      reps = ex.repMin
      reason = `${blk.label}: Arbeitsgewicht ${fmt(weight)} kg`
    } else if (prevBlock && prevBlock !== ctx.block && !isReliefBlock(prevBlock)) {
      const e1 = bestE1rm(lastReal.sets)
      const target = upper ? ex.repMax : ex.repMin
      weight = e1 > 0 ? weightFromE1rm(e1, target, rirLow, ex.inc) : topWeight(lastReal)
      reps = target
      reason = `Neuer Block (${blk.label}): e1RM ${fmt(e1)} kg → ${fmt(weight)} kg × ${target}`
    } else {
      const s = suggestNext({ repMin: ex.repMin, repMax: ex.repMax, inc: ex.inc }, lastReal.sets, rirLow)
      weight = s.weight
      reps = Math.min(ex.repMax, Math.max(ex.repMin, s.reps))
      reason = s.reason
    }
    if (adj.loadFactor !== 1 && weight > 0) {
      const before = weight
      weight = roundTo(weight * adj.loadFactor, ex.inc)
      reason += ` · angepasst ${fmt(before)} → ${fmt(weight)} kg`
    }
  }

  if (adj.reduced && !isReliefBlock(ctx.block)) {
    reason += ' · bewusst reduziert, zählt nicht negativ'
  }

  return {
    pid: ex.pid,
    exId: ex.exId,
    name: ex.name,
    kind: ex.kind,
    unit: ex.unit,
    cat: ex.cat,
    sets: ex.sets,
    repMin: ex.repMin,
    repMax: ex.repMax,
    rest: ex.rest,
    inc: ex.inc,
    rpe: adj.rpe,
    targetRir: rirLow,
    weight,
    reps,
    reduced: adj.reduced,
    reason,
    hints,
    perSide: ex.perSide,
    variant,
    contrast: ex.contrast,
    extra,
    speed: ex.speed,
  }
}

/** Übungsliste eines Tages in der gewählten Phase (Saison: A/B, Winterpause: A/B/C) */
export const daysOf = (plan: Plan, phase: Phase = 'season'): Record<DayId, PlanExercise[]> =>
  phase === 'winter' ? (plan.winterDays ?? { A: [], B: [], C: [] }) : { ...plan.days, C: plan.days.C ?? [] }

export function buildSession(plan: Plan, ctx: BuildCtx): Prescribed[] {
  const out: Prescribed[] = []
  const eq = ctx.equipment ?? DEFAULT_EQUIPMENT
  for (const raw of daysOf(plan, ctx.phase)[ctx.day]) {
    const ex = resolveExercise(raw, eq)
    const p = prescribeOne(ex, { ...ctx, noExtraLegSet: plan.flags?.noExtraLegSet })
    if (p) out.push(p)
  }
  for (const ex of ctx.phase === 'winter' ? [] : extrasFor(ctx.day, ctx.weekType)) {
    const p = prescribeOne(ex, ctx, true)
    if (p) out.push(p)
  }
  return out
}

/** Geschätztes 1RM der letzten regulären Einheit */
export const lastE1rm = (logs: ExerciseLog[] | undefined): number => {
  const l = [...(logs ?? [])].reverse().find((x) => !x.reduced && bestE1rm(x.sets) > 0)
  return l ? bestE1rm(l.sets) : 0
}

export { epley }
