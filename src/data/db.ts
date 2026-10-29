import Dexie, { type Table } from 'dexie'
import type { BwEntry } from '../logic/bodyweight'
import { blockForWeek, isoDate, weekOfCycle } from '../logic/periodization'
import { nextNordicLevel } from '../logic/progression'
import { buildSession } from '../logic/session'
import { emptyComplaints } from '../logic/types'
import type { DayId, ExState, ExerciseLog, Plan, Session, WeekType } from '../logic/types'
import { baseLibrary, type LibExercise } from './library'
import { makeDefaultPlan } from './plan'

export interface Settings {
  key: 'main'
  startDate: string
  activePlanId: number
  cycleId: number
  goalKg: number
}

export interface Cycle {
  id?: number
  startDate: string
  planId: number
  createdAt: string
}

export interface WeekRow {
  cycleId: number
  week: number
  type: WeekType
}

export interface VideoRow {
  id?: number
  exId: string
  kind: 'file' | 'youtube'
  name: string
  blob?: Blob
  url?: string
  createdAt: string
}

export interface OverrideRow {
  exId: string
  patch: Partial<LibExercise>
}

class KDb extends Dexie {
  settings!: Table<Settings, string>
  plans!: Table<Plan, number>
  cycles!: Table<Cycle, number>
  weeks!: Table<WeekRow, [number, number]>
  sessions!: Table<Session, number>
  bodyweights!: Table<BwEntry, string>
  custom!: Table<LibExercise, string>
  videos!: Table<VideoRow, number>
  states!: Table<ExState, string>
  overrides!: Table<OverrideRow, string>

  constructor() {
    super('kraft-app')
    this.version(1).stores({
      settings: 'key',
      plans: '++id, lineage',
      cycles: '++id',
      weeks: '[cycleId+week]',
      sessions: '++id, date, cycleId',
      bodyweights: 'date',
      custom: 'id',
      videos: '++id, exId',
      states: 'pid',
      overrides: 'exId',
    })
  }
}

export const db = new KDb()

export const today = (): string => isoDate(new Date())

/** Legt Standardplan, Zyklus und Einstellungen beim ersten Start an. */
export async function ensureInit(): Promise<void> {
  if (await db.settings.get('main')) return
  await db.transaction('rw', db.settings, db.plans, db.cycles, async () => {
    if (await db.settings.get('main')) return
    const planId = (await db.plans.add(makeDefaultPlan())) as number
    const t = today()
    const monday = new Date()
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const startDate = isoDate(monday)
    const cycleId = (await db.cycles.add({ startDate, planId, createdAt: t })) as number
    await db.settings.add({ key: 'main', startDate, activePlanId: planId, cycleId, goalKg: 80 })
  })
}

export async function startNewCycle(startDate: string, planId?: number): Promise<number> {
  const s = (await db.settings.get('main'))!
  const pid = planId ?? s.activePlanId
  const cycleId = (await db.cycles.add({ startDate, planId: pid, createdAt: today() })) as number
  await db.settings.update('main', { startDate, cycleId, activePlanId: pid })
  return cycleId
}

export async function getWeekType(cycleId: number, week: number): Promise<WeekType | undefined> {
  return (await db.weeks.get([cycleId, week]))?.type
}

export const setWeekType = (cycleId: number, week: number, type: WeekType) =>
  db.weeks.put({ cycleId, week, type })

/** Alle abgeschlossenen Einheiten (alle Zyklen) nach Übung gruppiert, älteste zuerst. */
export async function historyByPid(): Promise<Record<string, ExerciseLog[]>> {
  const all = (await db.sessions.toArray()).filter((s) => s.finished).sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  const out: Record<string, ExerciseLog[]> = {}
  for (const s of all) {
    for (const e of s.entries) if (e.sets.some((x) => x.done)) (out[e.pid] ??= []).push(e)
  }
  return out
}

export async function statesMap(): Promise<Record<string, ExState>> {
  return Object.fromEntries((await db.states.toArray()).map((s) => [s.pid, s]))
}

export async function activeSessionFor(cycleId: number, date: string, day: DayId): Promise<Session | undefined> {
  const list = await db.sessions.where('cycleId').equals(cycleId).toArray()
  return list.find((s) => s.date === date && s.day === day)
}

export async function createSession(opts: {
  date: string
  day: DayId
  heavyLegs: boolean
  weekType: WeekType
}): Promise<Session> {
  const s = (await db.settings.get('main'))!
  const plan = (await db.plans.get(s.activePlanId))!
  const week = Math.min(12, Math.max(1, weekOfCycle(s.startDate, opts.date)))
  const block = blockForWeek(week).id
  const [history, states] = await Promise.all([historyByPid(), statesMap()])
  const prescription = buildSession(plan, {
    day: opts.day, block, weekType: opts.weekType, heavyLegs: opts.heavyLegs, history, states,
  })
  const entries: ExerciseLog[] = prescription.map((p) => ({
    pid: p.pid, exId: p.exId, name: p.name, kind: p.kind, unit: p.unit, repMin: p.repMin, repMax: p.repMax,
    targetReps: p.reps, targetWeight: p.weight, reduced: p.reduced, block, variant: p.variant, sets: [],
  }))
  const session: Session = {
    date: opts.date, cycleId: s.cycleId, planId: s.activePlanId, day: opts.day, week, block,
    weekType: opts.weekType, heavyLegs: opts.heavyLegs, warmupDone: [], notes: '', complaints: emptyComplaints(),
    entries, prescription, finished: false,
  }
  session.id = (await db.sessions.add(session)) as number
  return session
}

/** Schließt die Einheit ab und aktualisiert Zustände (Nordic-Stufe). */
export async function finishSession(session: Session): Promise<string[]> {
  const msgs: string[] = []
  const plan = await db.plans.get(session.planId)
  for (const e of session.entries) {
    if (e.kind !== 'nordic') continue
    const st = (await db.states.get(e.pid)) ?? { pid: e.pid, nordicLevel: 1, variantIdx: 0 }
    const r = nextNordicLevel(st.nordicLevel, e.sets, session.complaints.hamstring, plan?.flags?.nordicLock)
    // reduzierte Einheiten (z. B. englische Woche) sollen die Stufe nicht erhöhen
    const level = e.reduced && r.level > st.nordicLevel ? st.nordicLevel : r.level
    await db.states.put({ ...st, nordicLevel: level })
    msgs.push(`Nordics: ${r.message}`)
  }
  await db.sessions.put({ ...session, finished: true })
  return msgs
}

export async function savePlanVersion(plan: Plan, name?: string): Promise<number> {
  const { id: _id, ...rest } = plan
  void _id
  const id = (await db.plans.add({
    ...rest, name: name ?? plan.name, version: plan.version + 1, createdAt: new Date().toISOString(), template: false,
  })) as number
  await db.settings.update('main', { activePlanId: id })
  return id
}

export async function saveTemplate(plan: Plan, name: string): Promise<number> {
  const { id: _id, ...rest } = plan
  void _id
  return (await db.plans.add({ ...rest, name, template: true, createdAt: new Date().toISOString() })) as number
}

/** Bibliothek = Datenbank + eigene Übungen + Änderungen an Fußball-Feldern */
export async function loadLibrary(): Promise<LibExercise[]> {
  const [custom, ov] = await Promise.all([db.custom.toArray(), db.overrides.toArray()])
  const map = new Map(ov.map((o) => [o.exId, o.patch]))
  return [...baseLibrary(), ...custom].map((l) => (map.has(l.id) ? { ...l, ...map.get(l.id)! } : l))
}

/* ---------------- Backup ---------------- */

const blobToB64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

export async function exportAll(includeVideos: boolean): Promise<string> {
  const videos = await db.videos.toArray()
  const vids = await Promise.all(
    videos.map(async (v) => {
      const { blob, ...rest } = v
      return includeVideos && blob ? { ...rest, data: await blobToB64(blob) } : { ...rest, skipped: v.kind === 'file' }
    }),
  )
  const dump = {
    app: 'kraft-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    plans: await db.plans.toArray(),
    cycles: await db.cycles.toArray(),
    weeks: await db.weeks.toArray(),
    sessions: await db.sessions.toArray(),
    bodyweights: await db.bodyweights.toArray(),
    custom: await db.custom.toArray(),
    states: await db.states.toArray(),
    overrides: await db.overrides.toArray(),
    videos: vids,
  }
  return JSON.stringify(dump)
}

export async function importAll(text: string): Promise<void> {
  const d = JSON.parse(text)
  if (d?.app !== 'kraft-app' || !Array.isArray(d.sessions)) throw new Error('Keine gültige Backup-Datei.')
  const vids: VideoRow[] = await Promise.all(
    (d.videos ?? [])
      .filter((v: { skipped?: boolean }) => !v.skipped)
      .map(async (v: VideoRow & { data?: string }) => {
        const { data, ...rest } = v
        return data ? { ...rest, blob: await (await fetch(data)).blob() } : rest
      }),
  )
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.settings.bulkAdd(d.settings)
    await db.plans.bulkAdd(d.plans)
    await db.cycles.bulkAdd(d.cycles)
    await db.weeks.bulkAdd(d.weeks)
    await db.sessions.bulkAdd(d.sessions)
    await db.bodyweights.bulkAdd(d.bodyweights)
    await db.custom.bulkAdd(d.custom)
    await db.states.bulkAdd(d.states)
    await db.overrides.bulkAdd(d.overrides)
    await db.videos.bulkAdd(vids)
  })
}

export async function wipeAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
