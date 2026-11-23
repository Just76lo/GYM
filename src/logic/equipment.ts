import type { DayId, Plan, PlanExercise } from './types'

export interface Equipment {
  trapBar: boolean
  medball: boolean
}

export const DEFAULT_EQUIPMENT: Equipment = { trapBar: false, medball: false }

interface Variant {
  pid: string
  exId: string
  name: string
  /** weitere Felder, die beim Wechsel zu dieser Variante gesetzt werden */
  patch: Partial<PlanExercise>
}

interface Pair {
  flag: keyof Equipment
  orig: Variant
  repl: Variant
}

export const SPEED_NOTE = '50–60 % des Kniebeugen-1RM. Satz beenden, sobald die Wiederholung langsamer wird.'

/** Original (mit Gerät) ↔ Ersatz (ohne Gerät). Der Wechsel passiert zur Laufzeit, gespeicherte Pläne bleiben unverändert. */
export const PAIRS: Pair[] = [
  {
    flag: 'trapBar',
    orig: { pid: 'a-trapbar', exId: 'Trap_Bar_Deadlift', name: 'Trap-Bar-Kreuzheben', patch: { inc: 5 } },
    repl: { pid: 'a-deadlift', exId: 'Barbell_Deadlift', name: 'Kreuzheben konventionell', patch: { inc: 5 } },
  },
  {
    flag: 'trapBar',
    orig: {
      pid: 'b-tbjump', exId: 'trap-bar-jump', name: 'Trap-Bar-Sprünge',
      patch: {
        kind: 'explosive', cat: 'legpower', sets: 3, repMin: 3, repMax: 3, rest: 120, inc: 2.5, unit: 'kg', speed: undefined,
        loadFrom: { pid: 'a-trapbar', pct: 0.25 }, note: '20–30 % des Trap-Bar-1RM', rpe: undefined,
      },
    },
    repl: {
      pid: 'b-speedsquat', exId: 'speed-squat', name: 'Speed-Kniebeuge',
      patch: {
        kind: 'explosive', cat: 'legpower', sets: 5, repMin: 3, repMax: 3, rest: 90, inc: 2.5, unit: 'kg', speed: true,
        loadFrom: { pid: 'c-squat', pct: 0.55 }, note: SPEED_NOTE, rpe: undefined,
      },
    },
  },
  {
    flag: 'medball',
    orig: {
      pid: 'b-medball', exId: 'med-ball-rotationswurf', name: 'Med-Ball-Rotationswurf an die Wand',
      patch: { kind: 'explosive', cat: 'power', sets: 3, repMin: 4, repMax: 4, rest: 60, inc: 1, unit: 'kg', perSide: true, rpe: undefined, note: 'Ballgewicht in kg' },
    },
    repl: {
      pid: 'b-woodchop', exId: 'Standing_Cable_Wood_Chop', name: 'Kabel-Holzhacker explosiv',
      patch: { kind: 'weight', cat: 'power', sets: 3, repMin: 5, repMax: 5, rest: 60, inc: 2.5, unit: 'kg', perSide: true, rpe: 7, note: 'Explosiv ziehen, kontrolliert zurück' },
    },
  },
]

/**
 * Tauscht eine Planübung je nach Geräteschalter gegen Original oder Ersatz.
 * Übungen, die per „Ausweichen“ auf etwas anderes getauscht wurden, bleiben unberührt.
 */
export function resolveExercise(ex: PlanExercise, eq: Equipment): PlanExercise {
  for (const p of PAIRS) {
    const isOrig = ex.pid === p.orig.pid && ex.exId === p.orig.exId
    const isRepl = ex.pid === p.repl.pid && ex.exId === p.repl.exId
    if (!isOrig && !isRepl) continue
    const wantOrig = eq[p.flag]
    if ((wantOrig && isOrig) || (!wantOrig && isRepl)) return ex
    const v = wantOrig ? p.orig : p.repl
    return { ...ex, ...v.patch, pid: v.pid, exId: v.exId, name: v.name }
  }
  return ex
}

export const resolveList = (list: PlanExercise[], eq: Equipment): PlanExercise[] =>
  list.map((e) => resolveExercise(e, eq))

const mapDays = (d: Record<DayId, PlanExercise[]>, eq: Equipment): Record<DayId, PlanExercise[]> => ({
  A: resolveList(d.A ?? [], eq), B: resolveList(d.B ?? [], eq), C: resolveList(d.C ?? [], eq),
})

/** Gesamter Plan mit angewendeten Geräteschaltern (Saison und Winterpause) */
export const resolvePlan = (plan: Plan, eq: Equipment): Plan => ({
  ...plan,
  days: mapDays(plan.days, eq),
  winterDays: plan.winterDays ? mapDays(plan.winterDays, eq) : undefined,
})
