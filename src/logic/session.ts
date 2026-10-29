import { applyBlock, blockInfo } from './periodization'
import {
  NORDIC_LEVELS,
  bestE1rm,
  doneSets,
  epley,
  fmt,
  nextIso,
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
  if (ctx.day === 'A' && ctx.heavyLegs && isLeg) {
    ex = { ...ex, sets: Math.max(1, ex.sets - 1) }
    rpe = 6
    loadFactor *= 0.9
    reduced = true
    hints.push('90 min gespielt / Beine schwer: −1 Satz, RPE 6')
  }
  if (ctx.block === 'deload') {
    ex = { ...ex, sets: Math.max(1, Math.ceil(ex.sets / 2)) }
    if (ex.kind === 'weight') loadFactor *= 0.9
    rirOverride = 4
    reduced = true
    hints.push('Deload: Sätze halbiert' + (ex.kind === 'weight' ? ', Gewicht −10 %' : ''))
  }
  if (ctx.block === 'power' && ex.contrast) {
    hints.push('Kontrast: nach jedem Satz 2 Counter-Movement-Jumps')
  }
  return { ex, reduced, loadFactor, rpe, rirOverride, hints }
}

export interface BuildCtx extends AdjustCtx {
  history: Record<string, ExerciseLog[]>
  states: Record<string, ExState>
}

function initialWeight(ex: PlanExercise, history: Record<string, ExerciseLog[]>, inc: number): number | null {
  if (ex.loadFrom) {
    const src = (history[ex.loadFrom.pid] ?? []).filter((l) => !l.reduced).slice(-1)[0]
    if (src) {
      const e1 = bestE1rm(src.sets)
      if (e1 > 0) return roundTo(e1 * ex.loadFrom.pct, inc)
    }
  }
  return ex.startWeight ?? null
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
    if (!lastReal) {
      weight = initialWeight(ex, ctx.history, ex.inc) ?? 0
      reason = weight ? `Startgewicht ${fmt(weight)} kg` : 'Noch keine Daten – Startgewicht selbst wählen'
    } else if (ctx.block === 'deload') {
      weight = topWeight(lastReal)
      reps = ex.repMin
      reason = `Deload: Arbeitsgewicht ${fmt(weight)} kg`
    } else if (prevBlock && prevBlock !== ctx.block && prevBlock !== 'deload') {
      const e1 = bestE1rm(lastReal.sets)
      weight = e1 > 0 ? weightFromE1rm(e1, ex.repMin, rirLow, ex.inc) : topWeight(lastReal)
      reps = ex.repMin
      reason = `Neuer Block (${blk.label}): e1RM ${fmt(e1)} kg → ${fmt(weight)} kg × ${ex.repMin}`
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

  if (adj.reduced && ctx.block !== 'deload') {
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
  }
}

export function buildSession(plan: Plan, ctx: BuildCtx): Prescribed[] {
  const out: Prescribed[] = []
  for (const ex of plan.days[ctx.day]) {
    const p = prescribeOne(ex, { ...ctx, noExtraLegSet: plan.flags?.noExtraLegSet })
    if (p) out.push(p)
  }
  for (const ex of extrasFor(ctx.day, ctx.weekType)) {
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
