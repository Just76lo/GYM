import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { makeDefaultPlan } from './plan'

/** Schema und Daten von Version 1 (vor dem Update), unverändert gespeichert */
const V1 = {
  settings: 'key', plans: '++id, lineage', cycles: '++id', weeks: '[cycleId+week]', sessions: '++id, date, cycleId',
  bodyweights: 'date', custom: 'id', videos: '++id, exId', states: 'pid', overrides: 'exId',
}

const set = (weight: number, reps: number, rir: number) => ({ weight, reps, rir, done: true })
const entry = (pid: string, name: string, w: number) => ({
  pid, exId: pid, name, kind: 'weight', unit: 'kg', repMin: 4, repMax: 5, targetReps: 4, targetWeight: w, reduced: false, block: 'basis',
  sets: [set(w, 5, 2), set(w, 5, 2), set(w, 4, 1)],
})
const session = (date: string, day: 'A' | 'B', entries: unknown[]) => ({
  date, cycleId: 1, planId: 1, day, week: 1, block: 'basis', weekType: 'normal', heavyLegs: false, warmupDone: ['w1'],
  notes: `Notiz ${date}`, complaints: { hamstring: 1, groin: 0, knee: 0, other: 0, otherText: '' }, entries, prescription: [], finished: true,
})

describe('Datenmigration Version 1 → 2', () => {
  it('erhält Verlauf, Gewichte, Körpergewicht, Pläne und ergänzt Phasen, Gym C, Wochenplan', async () => {
    // --- alte Datenbank anlegen ---
    const old = new Dexie('kraft-app')
    old.version(1).stores(V1)
    const oldPlan = makeDefaultPlan() as unknown as Record<string, unknown>
    delete oldPlan.winterDays
    ;(oldPlan.days as Record<string, unknown>) = { A: makeDefaultPlan().days.A, B: makeDefaultPlan().days.B } // wie in v1: nur A und B
    const sessions = [
      session('2026-11-02', 'A', [entry('a-trapbar', 'Trap-Bar-Kreuzheben', 140), entry('a-bench', 'Bankdrücken', 90)]),
      session('2026-11-06', 'B', [entry('b-tbjump', 'Trap-Bar-Sprünge', 35), entry('b-ohp', 'Schulterdrücken stehend', 50)]),
      session('2026-11-09', 'A', [entry('a-trapbar', 'Trap-Bar-Kreuzheben', 145)]),
    ]
    const bw = [{ date: '2026-11-01', kg: 74.5 }, { date: '2026-11-08', kg: 74.9 }]
    await old.table('plans').add(oldPlan)
    await old.table('cycles').add({ startDate: '2026-11-02', planId: 1, createdAt: '2026-11-02' })
    await old.table('settings').add({ key: 'main', startDate: '2026-11-02', activePlanId: 1, cycleId: 1, goalKg: 80 })
    await old.table('sessions').bulkAdd(sessions)
    await old.table('bodyweights').bulkAdd(bw)
    await old.table('states').add({ pid: 'a-nordic', nordicLevel: 3, variantIdx: 0 })
    await old.table('weeks').add({ cycleId: 1, week: 2, type: 'english' })
    await old.table('custom').add({ id: 'eigene-1', nameEn: 'Eigene' })
    await old.table('overrides').add({ exId: 'x', patch: { nameDe: 'Y' } })
    old.close()

    // --- App-Datenbank öffnen: Upgrade läuft ---
    const { db, historyByPid, exportAll, importAll, ensureInit } = await import('./db')
    await ensureInit()
    expect(db.verno).toBe(2)

    // Verlauf unverändert
    const got = await db.sessions.toArray()
    expect(got).toHaveLength(3)
    for (let i = 0; i < 3; i++) expect(got[i]).toMatchObject(sessions[i])
    expect(await db.bodyweights.toArray()).toEqual(bw)
    expect(await db.states.get('a-nordic')).toEqual({ pid: 'a-nordic', nordicLevel: 3, variantIdx: 0 })
    expect(await db.weeks.toArray()).toEqual([{ cycleId: 1, week: 2, type: 'english' }])
    expect(await db.custom.get('eigene-1')).toBeDefined()
    expect(await db.overrides.get('x')).toBeDefined()
    expect(await db.cycles.count()).toBe(1)

    // alte Trap-Bar-Einträge bleiben als eigene Übung im Verlauf
    const hist = await historyByPid()
    expect(hist['a-trapbar'].map((e) => e.sets[0].weight)).toEqual([140, 145])
    expect(hist['a-trapbar'][0].date).toBe('2026-11-02')
    expect(hist['b-tbjump']).toHaveLength(1)
    expect(hist['a-deadlift']).toBeUndefined()

    // Einstellungen: alte Werte bleiben, neue mit Standardwerten
    const s = (await db.settings.get('main'))!
    expect(s).toMatchObject({
      startDate: '2026-11-02', activePlanId: 1, cycleId: 1, goalKg: 80,
      phase: 'season', winterStart: '2026-11-30', trapBar: false, medball: false,
    })
    expect(s.defaultWeeks.season).toEqual(['gymA', 'football', 'recovery', 'football', 'gymB', 'rest', 'game'])
    expect(s.defaultWeeks.winter).toEqual(['gymA', 'runSprint', 'gymC', 'recovery', 'gymB', 'rest', 'rest'])

    // Plan: Saison-Übungen unverändert, Gym C leer, Winterpause ergänzt
    const p = (await db.plans.get(1))!
    expect(p.days.A).toEqual(makeDefaultPlan().days.A)
    expect(p.days.B).toEqual(makeDefaultPlan().days.B)
    expect(p.days.C).toEqual([])
    expect(p.winterDays?.A).toHaveLength(8)
    expect(p.winterDays?.B).toHaveLength(11)
    expect(p.winterDays?.C).toHaveLength(9)
    expect(p.warmup).toHaveLength(7)

    // neue Tabellen sind benutzbar
    await db.schedule.put({ date: '2026-12-01', kind: 'gymC' })
    const runId = await db.runs.add({ date: '2026-12-02', template: 'sprints', sprints: [], intervals: [], type: 'x', minutes: 30, feel: 7, notes: '', finished: true })
    expect((await db.schedule.get('2026-12-01'))?.kind).toBe('gymC')
    expect(await db.runs.get(runId)).toBeDefined()

    // Backup v2 enthält alles; Import eines Version-1-Backups ergänzt die neuen Felder
    const dump = JSON.parse(await exportAll(false))
    expect(dump.version).toBe(2)
    expect(dump.sessions).toHaveLength(3)
    expect(dump.schedule).toHaveLength(1)
    expect(dump.runs).toHaveLength(1)

    const v1 = { ...dump, version: 1, schedule: undefined, runs: undefined }
    v1.settings = [{ key: 'main', startDate: '2026-11-02', activePlanId: 1, cycleId: 1, goalKg: 80 }]
    v1.plans = [{ ...oldPlan, id: 1 }]
    await importAll(JSON.stringify(v1))
    expect(await db.sessions.count()).toBe(3)
    expect((await db.settings.get('main'))!.phase).toBe('season')
    expect((await db.plans.get(1))!.winterDays?.C).toHaveLength(9)
    expect(await db.schedule.count()).toBe(0)
  })
})
