import { WINTER_START_DEFAULT } from '../logic/periodization'
import { DEFAULT_WEEK, type DayKind } from '../logic/schedule'
import type { Phase } from '../logic/types'

export interface Settings {
  key: 'main'
  startDate: string
  activePlanId: number
  cycleId: number
  goalKg: number
  /** aktive Trainingsphase */
  phase: Phase
  /** Montag der ersten Winterwoche */
  winterStart: string
  trapBar: boolean
  medball: boolean
  /** Kniebeugen-1RM für die Speed-Kniebeuge, solange noch kein Kniebeugen-Verlauf existiert */
  squat1rm?: number
  /** Standardwoche je Phase */
  defaultWeeks: Record<Phase, DayKind[]>
}

type OldSettings = Pick<Settings, 'key' | 'startDate' | 'activePlanId' | 'cycleId' | 'goalKg'> & Partial<Settings>

/** Ergänzt die Einstellungen aus Version 1 um Phase, Geräte-Schalter und Standardwochen. Bestehende Werte bleiben. */
export function normalizeSettings(s: OldSettings): Settings {
  return {
    ...s,
    phase: s.phase ?? 'season',
    winterStart: s.winterStart ?? WINTER_START_DEFAULT,
    trapBar: s.trapBar ?? false,
    medball: s.medball ?? false,
    defaultWeeks: {
      season: s.defaultWeeks?.season ?? [...DEFAULT_WEEK.season],
      winter: s.defaultWeeks?.winter ?? [...DEFAULT_WEEK.winter],
    },
  }
}
