import { describe, expect, it } from 'vitest'
import { WINTER_WEEKS, winterBlockForWeek, winterWeekOf } from './periodization'
import {
  DEFAULT_WEEK, SPRINT_HINT, addDays, gymRules, gymWarnings, kindOn, mdInfo, mondayOf, nextDueGym, presetsFor, sprintHint,
  weekDates, weekTypeFor, WEEK_PRESETS, type DayKind, type ScheduleCtx,
} from './schedule'

const ctx = (over: Partial<ScheduleCtx> = {}): ScheduleCtx => ({
  phase: 'season', winterStart: '2026-11-30', defaults: DEFAULT_WEEK, overrides: new Map(), ...over,
})
const get = (c: ScheduleCtx) => (d: string): DayKind => kindOn(c, d)

describe('Phasen und Winterwochen', () => {
  it('Winterpause startet am 30.11.2026 und dauert 9 Wochen', () => {
    expect(winterWeekOf('2026-11-30', '2026-11-30')).toBe(1)
    expect(winterWeekOf('2026-11-30', '2026-12-20')).toBe(3)
    expect(winterWeekOf('2026-11-30', '2026-12-21')).toBe(4)
    expect(winterWeekOf('2026-11-30', '2026-12-27')).toBe(4)
    expect(winterWeekOf('2026-11-30', '2027-01-25')).toBe(WINTER_WEEKS)
    expect(winterWeekOf('2026-11-30', '2027-01-31')).toBe(WINTER_WEEKS)
    expect(winterWeekOf('2026-11-30', '2027-02-01')).toBe(10)
  })
  it('Blöcke: Aufbau 1–3, leicht 4, Kraft 5–8, Übergang 9', () => {
    const ids = Array.from({ length: 9 }, (_, i) => winterBlockForWeek(i + 1).id)
    expect(ids).toEqual(['wbuild', 'wbuild', 'wbuild', 'wlight', 'wstrength', 'wstrength', 'wstrength', 'wstrength', 'wtrans'])
    expect([1, 4, 5, 9].map((w) => winterBlockForWeek(w).rirText)).toEqual(['2', '4', '1–2', '3'])
  })
  it('Standardwochen der Phasen', () => {
    expect(DEFAULT_WEEK.season).toEqual(['gymA', 'football', 'recovery', 'football', 'gymB', 'rest', 'game'])
    expect(DEFAULT_WEEK.winter).toEqual(['gymA', 'runSprint', 'gymC', 'recovery', 'gymB', 'rest', 'rest'])
  })
  it('Winter: Do in Woche 1–4 Regeneration, ab Woche 5 Laufen', () => {
    const c = ctx({ phase: 'winter' })
    expect(kindOn(c, '2026-12-24')).toBe('recovery') // Woche 4
    expect(kindOn(c, '2026-12-31')).toBe('runEasy') // Woche 5 beginnt am 28.12.
    expect(kindOn(c, '2027-01-07')).toBe('runEasy') // Woche 6
  })
  it('Einzelne Tage lassen sich überschreiben, Rest bleibt Standard', () => {
    const c = ctx({ overrides: new Map([['2026-11-24', 'gymC' as DayKind]]) })
    expect(kindOn(c, '2026-11-24')).toBe('gymC')
    expect(kindOn(c, '2026-11-26')).toBe('football')
  })
})

describe('Spielabstand (MD)', () => {
  const g = get(ctx())
  it('Standardwoche: Mo = MD+1 (Spiel am Sonntag davor), Fr = MD-2, Sa = MD-1', () => {
    expect(mdInfo('2026-11-23', g).label).toBe('MD+1') // Montag nach Sonntagsspiel (über die Wochengrenze)
    expect(mdInfo('2026-11-27', g).label).toBe('MD-2')
    expect(mdInfo('2026-11-28', g).label).toBe('MD-1')
    expect(mdInfo('2026-11-29', g).label).toBe('Spieltag')
  })
  it('über Wochengrenzen: Sonntag vorher / Montag danach', () => {
    const c = ctx({ overrides: new Map([['2026-12-07', 'game' as DayKind], ['2026-12-06', 'rest' as DayKind]]) })
    const k = get(c)
    expect(mdInfo('2026-12-06', k).next).toBe(1) // Sonntag, Spiel am Montag der Folgewoche
    expect(mdInfo('2026-12-04', k).next).toBe(3)
    expect(mdInfo('2026-12-08', k).prev).toBe(1) // Dienstag danach
  })
  it('Gym am Tag vor dem Spiel: MD-1-Regel und bestätigbare Warnung', () => {
    const c = ctx({ overrides: new Map([['2026-11-28', 'gymB' as DayKind]]) })
    expect(gymRules('2026-11-28', get(c)).md1).toBe(true)
    expect(gymWarnings('2026-11-28', get(c))[0]).toContain('MD-1')
  })
  it('MD-2, MD+1 und direkt aufeinanderfolgende Gym-Tage', () => {
    const c = ctx({ overrides: new Map([['2026-11-24', 'gymB' as DayKind]]) })
    const k = get(c)
    expect(gymRules('2026-11-23', k)).toMatchObject({ plus1: true, md2: false, b2b: false })
    expect(gymRules('2026-11-24', k)).toMatchObject({ b2b: true, plus1: false })
    expect(gymRules('2026-11-27', k)).toMatchObject({ md2: true })
    expect(gymWarnings('2026-11-24', k).join(' ')).toContain('direkt hintereinander')
  })
  it('keine Spiele in der Winterpause: keine Regeln', () => {
    const k = get(ctx({ phase: 'winter' }))
    for (const d of weekDates('2026-12-01')) expect(mdInfo(d, k)).toMatchObject({ next: null, prev: null, label: '' })
  })
})

describe('Wochen und Vorlagen', () => {
  it('Montag und Wochentage', () => {
    expect(mondayOf('2026-11-29')).toBe('2026-11-23')
    expect(weekDates('2026-11-25')[6]).toBe('2026-11-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('alle Vorlagen haben 7 Tage; Gym-Tage 0–4', () => {
    for (const phase of ['season', 'winter'] as const) {
      for (const p of presetsFor(phase)) {
        expect(p.week).toHaveLength(7)
        expect(p.week.filter((k) => k.startsWith('gym')).length).toBeLessThanOrEqual(4)
      }
    }
    expect(WEEK_PRESETS.map((p) => p.label)).toEqual(['Sonntagsspiel', 'Samstagsspiel', 'Englische Woche', 'Ohne Spiel'])
  })
  it('Vorlagen: Spiele an den richtigen Tagen, Gym nie am MD-1', () => {
    for (const p of WEEK_PRESETS) {
      const dates = weekDates('2026-11-23')
      const get2 = (d: string): DayKind => (dates.includes(d) ? p.week[dates.indexOf(d)] : 'rest')
      for (const d of dates) if (get2(d).startsWith('gym')) expect(gymRules(d, get2).md1, `${p.label} ${d}`).toBe(false)
    }
    expect(WEEK_PRESETS[0].week[6]).toBe('game')
    expect(WEEK_PRESETS[1].week[5]).toBe('game')
    expect(WEEK_PRESETS[2].week.filter((x) => x === 'game')).toHaveLength(2)
    expect(WEEK_PRESETS[3].week).not.toContain('game')
  })
  it('Wochentyp: ohne Spiel nur in der Saison', () => {
    const season = get(ctx())
    const none = get(ctx({ overrides: new Map([['2026-11-29', 'rest' as DayKind]]) }))
    expect(weekTypeFor('season', weekDates('2026-11-23'), season)).toBe('normal')
    expect(weekTypeFor('season', weekDates('2026-11-23'), none)).toBe('noGame')
    expect(weekTypeFor('winter', weekDates('2026-11-23'), none)).toBe('normal')
  })
})

describe('Heute trainieren', () => {
  const s = (day: 'A' | 'B' | 'C', date: string) => ({ day, date })
  it('Winterpause: A → C → B → A', () => {
    expect(nextDueGym('winter', [])).toBe('A')
    expect(nextDueGym('winter', [s('A', '2026-11-30')])).toBe('C')
    expect(nextDueGym('winter', [s('A', '2026-11-30'), s('C', '2026-12-02')])).toBe('B')
    expect(nextDueGym('winter', [s('A', '2026-11-30'), s('C', '2026-12-02'), s('B', '2026-12-04')])).toBe('A')
  })
  it('Saison: A → B → A', () => {
    expect(nextDueGym('season', [s('A', '2026-11-23')])).toBe('B')
    expect(nextDueGym('season', [s('A', '2026-11-23'), s('B', '2026-11-27')])).toBe('A')
  })
  it('nimmt die zuletzt absolvierte Einheit, unabhängig von der Reihenfolge der Liste', () => {
    expect(nextDueGym('winter', [s('B', '2026-12-04'), s('A', '2026-11-30'), s('C', '2026-12-02')])).toBe('A')
  })
  it('Phasenwechsel: C zählt in der Saison nicht, danach geht es mit der Saison-Reihenfolge weiter', () => {
    expect(nextDueGym('season', [s('B', '2026-11-27'), s('C', '2026-12-02')])).toBe('A')
    expect(nextDueGym('winter', [s('B', '2026-11-27'), s('A', '2026-11-30')])).toBe('C')
  })
})

describe('Sprint-Hinweis', () => {
  it('Winterpause ohne Sprints: Hinweis, mit Sprints: keiner, Saison: keiner', () => {
    const dates = weekDates('2026-12-07')
    const without = (d: string): DayKind => (d === dates[1] ? 'runEasy' : 'rest')
    const withSprint = (d: string): DayKind => (d === dates[1] ? 'runSprint' : 'rest')
    expect(sprintHint('winter', dates, without)).toBe(SPRINT_HINT)
    expect(SPRINT_HINT).toBe('Mindestens 1x pro Woche Sprints, wichtig für die Oberschenkelrückseite.')
    expect(sprintHint('winter', dates, withSprint)).toBeNull()
    expect(sprintHint('season', dates, without)).toBeNull()
  })
})
