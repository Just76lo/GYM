export type DayId = 'A' | 'B'
export type WeekType = 'normal' | 'noGame' | 'english'
export type BlockId = 'basis' | 'kraft' | 'power' | 'deload'
export type Kind = 'weight' | 'explosive' | 'isometric' | 'nordic'
export type Cat = 'legs' | 'upper' | 'core' | 'prevention' | 'power' | 'legpower'
export type Unit = 'kg' | 'cm' | 's'

export interface RepOverride {
  sets?: number
  repMin?: number
  repMax?: number
}

export interface PlanExercise {
  pid: string
  exId: string
  name: string
  kind: Kind
  cat: Cat
  sets: number
  repMin: number
  repMax: number
  rpe?: number
  rest: number
  inc: number
  unit: Unit
  perSide?: boolean
  note?: string
  tag?: string
  startWeight?: number
  /** Überschreibung für Kraft-/Power-Block */
  kraft?: RepOverride
  /** Isometrie: Varianten, wenn die Obergrenze erreicht ist */
  variants?: string[]
  /** Startlast als Prozent des geschätzten 1RM einer anderen Übung */
  loadFrom?: { pid: string; pct: number }
  /** Power-Block: nach jedem Satz Kontrast-Hinweis */
  contrast?: boolean
}

export interface WarmupItem {
  id: string
  text: string
}

export interface PlanFlags {
  noExtraLegSet?: boolean
  nordicLock?: boolean
}

export interface Plan {
  id?: number
  lineage: string
  name: string
  version: number
  template?: boolean
  createdAt: string
  days: Record<DayId, PlanExercise[]>
  warmup: WarmupItem[]
  flags?: PlanFlags
}

export interface SetLog {
  weight: number
  reps: number
  rir: number
  done: boolean
}

export interface ExerciseLog {
  pid: string
  exId: string
  name: string
  kind: Kind
  unit: Unit
  repMin: number
  repMax: number
  targetReps: number
  targetWeight: number
  reduced: boolean
  block: BlockId
  variant?: string
  sets: SetLog[]
}

export interface Complaints {
  hamstring: number
  groin: number
  knee: number
  other: number
  otherText: string
}

export interface Session {
  id?: number
  date: string
  cycleId: number
  planId: number
  day: DayId
  week: number
  block: BlockId
  weekType: WeekType
  heavyLegs: boolean
  warmupDone: string[]
  notes: string
  complaints: Complaints
  entries: ExerciseLog[]
  /** Vorschläge/Begründungen zum Start der Einheit */
  prescription: Prescribed[]
  finished: boolean
}

export interface Prescribed {
  pid: string
  exId: string
  name: string
  kind: Kind
  unit: Unit
  cat: Cat
  sets: number
  repMin: number
  repMax: number
  rest: number
  inc: number
  rpe?: number
  targetRir: number
  weight: number
  reps: number
  reduced: boolean
  reason: string
  hints: string[]
  perSide?: boolean
  variant?: string
  contrast?: boolean
  extra?: boolean
}

export interface ExState {
  pid: string
  nordicLevel: number
  variantIdx: number
}

export const emptyComplaints = (): Complaints => ({
  hamstring: 0,
  groin: 0,
  knee: 0,
  other: 0,
  otherText: '',
})
