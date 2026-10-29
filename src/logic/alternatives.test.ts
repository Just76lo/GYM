import { describe, expect, it } from 'vitest'
import { ALTERNATIVES, alternativesFor, applyAlternative, restoreOriginal } from '../data/alternatives'
import { baseLibrary } from '../data/library'
import { makeDefaultPlan } from '../data/plan'
import { suggestNext } from './progression'
import { RDL_EXTRA, prescribeOne, type BuildCtx } from './session'
import type { ExerciseLog } from './types'

const lib = baseLibrary()
const byId = new Map(lib.map((l) => [l.id, l]))
const plan = makeDefaultPlan()
const all = [...plan.days.A, ...plan.days.B, RDL_EXTRA]

describe('Alternativen pro Planübung', () => {
  it('jede Planübung hat mindestens 3 Alternativen', () => {
    for (const e of all) expect(alternativesFor(e).length, e.name).toBeGreaterThanOrEqual(3)
  })
  it('jede Alternative existiert in der Bibliothek und hat einen deutschen Namen', () => {
    for (const list of Object.values(ALTERNATIVES)) {
      for (const a of list) {
        const l = byId.get(a.exId)
        expect(l, a.exId).toBeDefined()
        expect(l!.nameDe, a.exId).toBeTruthy()
      }
    }
  })
  it('Freitags-Alternativen sind nie exzentrisch schwer oder hoch belastend', () => {
    for (const e of plan.days.B) {
      for (const a of alternativesFor(e)) {
        const l = byId.get(a.exId)!
        expect(l.eccentricHeavy, a.exId).toBe(false)
        expect(l.legsLoad, a.exId).not.toBe('hoch')
      }
    }
  })
  it('keine Alternative braucht eine Box', () => {
    for (const list of Object.values(ALTERNATIVES)) for (const a of list) expect(byId.get(a.exId)!.needsBox).toBe(false)
  })
})

describe('Tauschen', () => {
  const trap = plan.days.A[0]
  it('übernimmt Sätze/Pause, setzt eigenes Schema und eigene pid', () => {
    const goblet = ALTERNATIVES.Trap_Bar_Deadlift.find((a) => a.exId === 'Goblet_Squat')!
    const s = applyAlternative(trap, goblet)
    expect(s).toMatchObject({ exId: 'Goblet_Squat', name: 'Goblet Squat', sets: 4, rest: 150, repMin: 6, repMax: 8, pid: 'a-trapbar@Goblet_Squat' })
    expect(s.kraft).toBeUndefined()
  })
  it('ohne eigenes Schema bleibt die Kraftblock-Überschreibung', () => {
    const s = applyAlternative(trap, ALTERNATIVES.Trap_Bar_Deadlift[0])
    expect(s.kraft).toEqual(trap.kraft)
  })
  it('Tausch vom Tausch bezieht sich aufs Original; Rückgängig stellt es wieder her', () => {
    const a = applyAlternative(trap, ALTERNATIVES.Trap_Bar_Deadlift[0])
    const b = applyAlternative(a, ALTERNATIVES.Trap_Bar_Deadlift[1])
    expect(b.pid).toBe('a-trapbar@Sumo_Deadlift')
    expect(b.orig?.exId).toBe('Trap_Bar_Deadlift')
    expect(alternativesFor(b)).toBe(ALTERNATIVES.Trap_Bar_Deadlift)
    expect(restoreOriginal(b)).toEqual(trap)
  })
  it('Nordic → Beinbeuger wird zur Gewichtsübung', () => {
    const nordic = plan.days.A.find((e) => e.kind === 'nordic')!
    const s = applyAlternative(nordic, ALTERNATIVES['nordic-hamstring-curl'][2])
    expect([s.kind, s.repMin, s.repMax, s.inc]).toEqual(['weight', 6, 8, 2.5])
  })
  it('Trap-Bar-Sprünge greifen auf ein getauschtes Trap-Bar-Kreuzheben zurück', () => {
    const log: ExerciseLog = {
      pid: 'a-trapbar@Barbell_Deadlift', exId: 'Barbell_Deadlift', name: 'x', kind: 'weight', unit: 'kg', repMin: 4, repMax: 5,
      targetReps: 5, targetWeight: 100, reduced: false, block: 'basis', sets: [{ weight: 100, reps: 5, rir: 2, done: true }],
    }
    const ctx: BuildCtx = { day: 'B', block: 'basis', weekType: 'normal', heavyLegs: false, history: { [log.pid]: [log] }, states: {} }
    const p = prescribeOne(plan.days.B.find((e) => e.pid === 'b-tbjump')!, ctx)!
    expect(p.weight).toBeGreaterThan(0)
  })
})

describe('Progression ohne Inkrement', () => {
  it('schlägt an der Obergrenze eine schwerere Variante vor statt „+0 kg“', () => {
    const r = suggestNext({ repMin: 8, repMax: 12, inc: 0 }, [{ weight: 0, reps: 12, rir: 3, done: true }], 2)
    expect(r.action).toBe('hold')
    expect(r.reason).toContain('schwerere Variante')
  })
})
