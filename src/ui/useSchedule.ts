import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type RunRow } from '../data/db'
import { normalizeSettings, type Settings } from '../data/migrate'
import { kindGetter, type DayKind, type ScheduleCtx } from '../logic/schedule'
import type { Session } from '../logic/types'

export interface ScheduleState {
  settings: Settings
  sctx: ScheduleCtx
  getKind: (date: string) => DayKind
  sessions: Session[]
  runs: RunRow[]
}

/** Einstellungen, Wochenplan, Einheiten und Läufe – live aus der Datenbank */
export function useSchedule(): ScheduleState | undefined {
  const raw = useLiveQuery(() => db.settings.get('main'))
  const rows = useLiveQuery(() => db.schedule.toArray())
  const sessions = useLiveQuery(() => db.sessions.toArray())
  const runs = useLiveQuery(() => db.runs.toArray())
  return useMemo(() => {
    if (!raw || !rows || !sessions || !runs) return undefined
    const settings = normalizeSettings(raw)
    const sctx: ScheduleCtx = {
      phase: settings.phase, winterStart: settings.winterStart, defaults: settings.defaultWeeks,
      overrides: new Map(rows.map((r) => [r.date, r.kind])),
    }
    return { settings, sctx, getKind: kindGetter(sctx), sessions, runs }
  }, [raw, rows, sessions, runs])
}
