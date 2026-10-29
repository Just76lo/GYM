import { describe, expect, it } from 'vitest'
import { baseLibrary, findAlternatives } from '../data/library'
import { makeDefaultPlan } from '../data/plan'
import { noGainTwoWeeks, weeklyAverages } from './bodyweight'
import { BLOCKS, blockForWeek, weekOfCycle, weekdayIndex } from './periodization'
import {
  explosiveStats, nextIso, nextNordicLevel, roundTo, suggestNext, weightFromE1rm, epley,
} from './progression'
import { analyzeCycle, applyProposals, enforceRules, isStagnant, proposeNextPlan, validatePlan } from './review'
import { buildSession, prescribeOne, type BuildCtx } from './session'
import { buildSummary } from './summary'
import type { ExerciseLog, ExState, Session, SetLog, WeekType } from './types'
import { emptyComplaints } from './types'

const S = (weight: number, reps: number, rir: number): SetLog => ({ weight, reps, rir, done: true })
const rule = { repMin: 5, repMax: 6, inc: 2.5 }

describe('Double Progression', () => {
  it('erhöht das Gewicht, wenn alle Sätze oben und RIR >= Ziel', () => {
    const r = suggestNext(rule, [S(80, 6, 2), S(80, 6, 2), S(80, 6, 2)], 2)
    expect(r).toMatchObject({ weight: 82.5, reps: 5, action: 'increase' })
    expect(r.reason).toContain('+2,5 kg')
  })
  it('doppeltes Inkrement bei RIR 2+ über Ziel', () => {
    const r = suggestNext(rule, [S(80, 6, 4), S(80, 6, 4)], 2)
    expect(r).toMatchObject({ weight: 85, action: 'double' })
  })
  it('gleiches Gewicht, +1 Wiederholung im Bereich', () => {
    const r = suggestNext(rule, [S(80, 5, 2), S(80, 5, 2), S(80, 5, 2)], 2)
    expect(r).toMatchObject({ weight: 80, reps: 6, action: 'repsUp' })
  })
  it('nimmt die schwächste Wiederholungszahl als Basis', () => {
    expect(suggestNext(rule, [S(80, 6, 2), S(80, 5, 2)], 2).reps).toBe(6)
  })
  it('−5 % unter dem unteren Ende', () => {
    const r = suggestNext(rule, [S(100, 4, 2), S(100, 4, 2)], 2)
    expect(r).toMatchObject({ weight: 95, action: 'decrease' })
  })
  it('−5 % wenn RIR mehr als 1 unter Ziel', () => {
    const r = suggestNext(rule, [S(100, 5, 0), S(100, 5, 0)], 2)
    expect(r.action).toBe('decrease')
  })
  it('RIR genau 1 unter Ziel ist noch kein Abzug', () => {
    const r = suggestNext(rule, [S(100, 5, 1), S(100, 5, 1)], 2)
    expect(r.action).not.toBe('decrease')
  })
  it('Abzug sinkt immer mindestens ein Inkrement', () => {
    const r = suggestNext({ repMin: 8, repMax: 10, inc: 2 }, [S(10, 5, 0)], 2)
    expect(r.weight).toBe(8)
  })
  it('ohne Daten kein Vorschlag', () => {
    expect(suggestNext(rule, undefined, 2).action).toBe('start')
  })
  it('Epley und Rückrechnung', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 1)
    expect(weightFromE1rm(116.67, 5, 0, 2.5)).toBe(100)
    expect(roundTo(97.4, 2.5)).toBe(97.5)
  })
})

describe('Nordics', () => {
  it('steigt auf, wenn alle Sätze sauber', () => {
    expect(nextNordicLevel(1, [S(0, 4, 2), S(0, 4, 2)], 0).level).toBe(2)
    expect(nextNordicLevel(3, [S(0, 6, 2), S(0, 6, 2), S(0, 6, 2)], 0).level).toBe(4)
  })
  it('bleibt, wenn nicht sauber', () => {
    expect(nextNordicLevel(2, [S(0, 5, 2), S(0, 4, 2), S(0, 5, 2)], 0).level).toBe(2)
  })
  it('Stufe zurück bei Schmerz >= 3 mit Physio-Hinweis', () => {
    const r = nextNordicLevel(3, [S(0, 6, 2), S(0, 6, 2), S(0, 6, 2)], 3)
    expect(r.level).toBe(2)
    expect(r.message).toContain('Physio')
  })
  it('Stufe 1 fällt nicht unter 1', () => {
    expect(nextNordicLevel(1, [], 5).level).toBe(1)
  })
  it('Sperre verhindert Aufstieg', () => {
    expect(nextNordicLevel(1, [S(0, 4, 2), S(0, 4, 2)], 0, true).level).toBe(1)
  })
})

describe('Isometrie', () => {
  const r = { repMin: 15, repMax: 30, sets: 3 }
  const log = (target: number, holds: number[], variant?: string): ExerciseLog => ({
    pid: 'x', exId: 'x', name: 'x', kind: 'isometric', unit: 's', repMin: 15, repMax: 30, targetReps: target,
    targetWeight: 0, reduced: false, block: 'basis', variant, sets: holds.map((h) => S(0, h, 0)),
  })
  it('startet mit der Untergrenze', () => expect(nextIso(r, undefined, 0).target).toBe(15))
  it('+5 s pro Woche', () => expect(nextIso(r, log(15, [15, 15, 16]), 0).target).toBe(20))
  it('bleibt, wenn nicht geschafft', () => expect(nextIso(r, log(20, [20, 18, 20]), 0).target).toBe(20))
  it('wechselt bei Obergrenze auf die nächste Variante', () => {
    const res = nextIso(r, log(30, [30, 30, 30]), 0, ['kurz', 'lang'])
    expect(res).toMatchObject({ target: 15, variantIdx: 1 })
  })
  it('bleibt bei der letzten Variante an der Obergrenze', () => {
    expect(nextIso(r, log(30, [30, 30, 30]), 1, ['kurz', 'lang'])).toMatchObject({ target: 30, variantIdx: 1 })
  })
})

describe('Explosive Übungen', () => {
  it('Bestwert und Trend, keine Progression', () => {
    const mk = (v: number): ExerciseLog => ({
      pid: 'c', exId: 'c', name: 'c', kind: 'explosive', unit: 'cm', repMin: 3, repMax: 3, targetReps: 3, targetWeight: 0,
      reduced: false, block: 'basis', sets: [S(v, 3, 0)],
    })
    const st = explosiveStats([30, 31, 30, 33, 34, 35].map(mk))
    expect(st.best).toBe(35)
    expect(st.trend).toBe('up')
    expect(explosiveStats([]).trend).toBe('none')
  })
})

describe('Periodisierung', () => {
  it('Blöcke nach Woche', () => {
    expect(blockForWeek(1).id).toBe('basis')
    expect(blockForWeek(4).id).toBe('basis')
    expect(blockForWeek(5).id).toBe('kraft')
    expect(blockForWeek(9).id).toBe('power')
    expect(blockForWeek(11).id).toBe('power')
    expect(blockForWeek(12).id).toBe('deload')
    expect(BLOCKS.find((b) => b.id === 'deload')!.rirLow).toBe(4)
  })
  it('Zykluswoche und Wochentag', () => {
    expect(weekOfCycle('2026-01-05', '2026-01-05')).toBe(1)
    expect(weekOfCycle('2026-01-05', '2026-01-11')).toBe(1)
    expect(weekOfCycle('2026-01-05', '2026-01-12')).toBe(2)
    expect(weekOfCycle('2026-01-05', '2026-03-30')).toBe(13)
    expect(weekdayIndex('2026-01-05')).toBe(0)
  })
})

const plan = makeDefaultPlan()

const log = (pid: string, weight: number, reps: number, rir: number, over: Partial<ExerciseLog> = {}, n = 4): ExerciseLog => {
  const ex = [...plan.days.A, ...plan.days.B].find((e) => e.pid === pid)!
  return {
    pid, exId: ex.exId, name: ex.name, kind: ex.kind, unit: ex.unit, repMin: ex.repMin, repMax: ex.repMax,
    targetReps: reps, targetWeight: weight, reduced: false, block: 'basis',
    sets: Array.from({ length: n }, () => S(weight, reps, rir)), ...over,
  }
}

const ctx = (over: Partial<BuildCtx> = {}): BuildCtx => ({
  day: 'A', block: 'basis', weekType: 'normal' as WeekType, heavyLegs: false, history: {}, states: {}, ...over,
})

describe('Einheit aufbauen', () => {
  it('Basis: Trap-Bar 4x4-5 mit Progression', () => {
    const p = prescribeOne(plan.days.A[0], ctx({ history: { 'a-trapbar': [log('a-trapbar', 100, 5, 2)] } }))!
    expect(p.sets).toBe(4)
    expect(p.weight).toBe(105)
    expect(p.reps).toBe(4)
    expect(p.reason).toContain('+5')
  })
  it('Kraftblock: Trap-Bar 5x3-4, Bank 4x4-5, Gewicht aus e1RM', () => {
    const h = { 'a-trapbar': [log('a-trapbar', 100, 5, 2)] }
    const p = prescribeOne(plan.days.A[0], ctx({ block: 'kraft', history: h }))!
    expect([p.sets, p.repMin, p.repMax]).toEqual([5, 3, 4])
    expect(p.weight).toBe(weightFromE1rm(epley(100, 5), 3, 1.5, 5))
    expect(p.reason).toContain('Neuer Block')
    const b = prescribeOne(plan.days.A[1], ctx({ block: 'power' }))!
    expect([b.sets, b.repMin, b.repMax]).toEqual([4, 4, 5])
  })
  it('Powerblock zeigt Kontrast-Hinweis', () => {
    expect(prescribeOne(plan.days.A[0], ctx({ block: 'power' }))!.hints.join()).toContain('2 Counter-Movement-Jumps')
  })
  it('Deload: Sätze halbiert, Gewicht −10 %, RIR 4, reduziert', () => {
    const h = { 'a-trapbar': [log('a-trapbar', 100, 5, 2, { block: 'power' })] }
    const p = prescribeOne(plan.days.A[0], ctx({ block: 'deload', history: h }))!
    expect(p.sets).toBe(2)
    expect(p.weight).toBe(90)
    expect(p.targetRir).toBe(4)
    expect(p.reduced).toBe(true)
  })
  it('Ohne Spiel: Montag +1 Satz Beine (nicht Nordics), Freitag + RDL', () => {
    const a = buildSession(plan, ctx({ weekType: 'noGame' }))
    expect(a.find((e) => e.pid === 'a-trapbar')!.sets).toBe(5)
    expect(a.find((e) => e.pid === 'a-bss')!.sets).toBe(4)
    expect(a.find((e) => e.pid === 'a-nordic')!.sets).toBe(2)
    expect(a.find((e) => e.pid === 'a-bench')!.sets).toBe(4)
    const b = buildSession(plan, ctx({ day: 'B', weekType: 'noGame' }))
    const rdl = b.find((e) => e.exId === 'Romanian_Deadlift')!
    expect([rdl.sets, rdl.repMin, rdl.rpe]).toEqual([3, 6, 7])
  })
  it('Flag noExtraLegSet unterdrückt den Zusatzsatz', () => {
    const p2 = { ...plan, flags: { noExtraLegSet: true } }
    expect(buildSession(p2, ctx({ weekType: 'noGame' })).find((e) => e.pid === 'a-trapbar')!.sets).toBe(4)
  })
  it('Englische Woche: Beine 2 Sätze RPE 6, Nordics 2x3; Freitag ohne Beinsprünge, CMJ 2x3', () => {
    const a = buildSession(plan, ctx({ weekType: 'english' }))
    const tb = a.find((e) => e.pid === 'a-trapbar')!
    expect([tb.sets, tb.rpe, tb.reduced]).toEqual([2, 6, true])
    const nd = a.find((e) => e.pid === 'a-nordic')!
    expect([nd.sets, nd.repMin]).toEqual([2, 3])
    expect(a.find((e) => e.pid === 'a-bench')!.reduced).toBe(false)
    const b = buildSession(plan, ctx({ day: 'B', weekType: 'english' }))
    expect(b.find((e) => e.pid === 'b-tbjump')).toBeUndefined()
    expect(b.find((e) => e.pid === 'b-slj')).toBeUndefined()
    const cmj = b.find((e) => e.pid === 'b-cmj')!
    expect([cmj.sets, cmj.reps]).toEqual([2, 3])
    expect(b.find((e) => e.pid === 'b-incline')).toBeDefined()
    expect(b.find((e) => e.pid === 'b-isobridge')).toBeDefined()
  })
  it('„90 min gespielt“: Beine −1 Satz RPE 6, Oberkörper unverändert', () => {
    const a = buildSession(plan, ctx({ heavyLegs: true }))
    expect(a.find((e) => e.pid === 'a-trapbar')!.sets).toBe(3)
    expect(a.find((e) => e.pid === 'a-trapbar')!.rpe).toBe(6)
    expect(a.find((e) => e.pid === 'a-bench')!.sets).toBe(4)
    expect(a.find((e) => e.pid === 'a-bench')!.rpe).toBe(8)
  })
  it('reduzierte Einheit löst keinen Abzug aus: Basis ist die letzte reguläre Einheit', () => {
    const regular = log('a-trapbar', 100, 6, 2, { repMax: 5 })
    const reduced = log('a-trapbar', 90, 3, 0, { reduced: true })
    const p = prescribeOne(plan.days.A[0], ctx({ history: { 'a-trapbar': [regular, reduced] } }))!
    expect(p.weight).toBeGreaterThanOrEqual(100)
    expect(p.reason).not.toContain('−5 %')
  })
  it('Explosive: keine Gewichtsprogression; Trap-Bar-Sprünge aus 25 % des 1RM', () => {
    const h = { 'a-trapbar': [log('a-trapbar', 100, 5, 2)] }
    const p = prescribeOne(plan.days.B[3], ctx({ day: 'B', history: h }))!
    expect(p.weight).toBe(roundTo(epley(100, 5) * 0.25, 2.5))
    const cmjLog = log('b-cmj', 35, 3, 0)
    const c = prescribeOne(plan.days.B[0], ctx({ day: 'B', history: { 'b-cmj': [cmjLog] } }))!
    expect(c.weight).toBe(35)
    expect(c.reason).toContain('Keine Gewichtsprogression')
  })
  it('Nordic-Stufe aus Zustand', () => {
    const states: Record<string, ExState> = { 'a-nordic': { pid: 'a-nordic', nordicLevel: 3, variantIdx: 0 } }
    const n = prescribeOne(plan.days.A[5], ctx({ states }))!
    expect([n.sets, n.repMin, n.repMax]).toEqual([3, 4, 6])
  })
  it('Isometrie: Variantenwechsel an der Obergrenze', () => {
    const l = log('a-copenhagen', 0, 30, 0, { targetReps: 30, variant: 'Kurzer Hebel (Knie auf Bank)' }, 3)
    const p = prescribeOne(plan.days.A[6], ctx({ history: { 'a-copenhagen': [l] } }))!
    expect(p.reps).toBe(15)
    expect(p.variant).toContain('Langer Hebel')
  })
})

describe('Körpergewicht', () => {
  const e = (date: string, kg: number) => ({ date, kg })
  it('Wochenschnitt', () => {
    const w = weeklyAverages([e('2026-01-05', 70), e('2026-01-07', 72), e('2026-01-12', 73)])
    expect(w.map((x) => x.avg)).toEqual([71, 73])
  })
  it('Hinweis bei 2 Wochen ohne Zunahme', () => {
    const flat = [e('2026-01-05', 72), e('2026-01-12', 72), e('2026-01-19', 71.9)]
    expect(noGainTwoWeeks(flat)).toBe(true)
    const up = [e('2026-01-05', 72), e('2026-01-12', 72.5), e('2026-01-19', 73)]
    expect(noGainTwoWeeks(up)).toBe(false)
    expect(noGainTwoWeeks(flat.slice(0, 2))).toBe(false)
    expect(noGainTwoWeeks([e('2026-01-05', 80), e('2026-01-12', 80), e('2026-01-19', 80)])).toBe(false)
  })
})

const session = (n: number, weight: number, reps: number, extra: Partial<Session> = {}, pid = 'a-bench', reduced = false): Session => ({
  id: n, date: `2026-01-${String(5 + n).padStart(2, '0')}`, cycleId: 1, planId: 1, day: 'A', week: n, block: 'basis',
  weekType: 'normal', heavyLegs: false, warmupDone: [], notes: '', complaints: emptyComplaints(), prescription: [], finished: true,
  entries: [log(pid, weight, reps, 2, { reduced })], ...extra,
})

describe('Zyklus-Auswertung und Vorschläge', () => {
  const lib = baseLibrary()
  const stagnant = [1, 2, 3, 4, 5].map((n) => session(n, n === 1 ? 82.5 : 80, 5))
  const bw = [{ date: '2026-01-05', kg: 72 }, { date: '2026-01-12', kg: 72 }, { date: '2026-01-19', kg: 71.8 }]

  it('erkennt Stagnation (3+ Einheiten ohne Fortschritt)', () => {
    expect(isStagnant([100, 101, 100, 100, 100])).toBe(true)
    expect(isStagnant([100, 101, 102, 103])).toBe(false)
    expect(isStagnant([100, 100, 100])).toBe(false)
  })
  it('Stagnation → Wiederholungsbereich 4-6 → 6-8 (nie ohne Bestätigung angewendet)', () => {
    const rep = analyzeCycle(plan, stagnant, [], ['normal'])
    const props = proposeNextPlan(rep, plan, lib)
    const p = props.find((x) => x.pid === 'a-bench')!
    expect(p.kind).toBe('rep-range')
    expect(p.patch).toMatchObject({ repMin: 7, repMax: 8 })
    expect(plan.days.A[1].repMin).toBe(5)
  })
  it('Stagnation bei hohem Bereich → Variante mit gleichen Zielmuskeln', () => {
    const p2 = structuredClone(plan)
    p2.days.A[4].repMin = 8
    p2.days.A[4].repMax = 10
    const ss = [1, 2, 3, 4, 5].map((n) => session(n, n === 1 ? 30 : 28, 8, {}, 'a-row'))
    const props = proposeNextPlan(analyzeCycle(p2, ss, [], ['normal']), p2, lib)
    const sw = props.find((x) => x.pid === 'a-row')
    expect(sw?.kind).toBe('swap')
    const alt = lib.find((l) => l.id === sw!.swapTo!.exId)!
    const cur = lib.find((l) => l.id === 'One-Arm_Dumbbell_Row')!
    expect(alt.category).toBe(cur.category)
    expect(alt.primary.some((m) => cur.primary.includes(m))).toBe(true)
  })
  it('gute Progression → behalten mit Startgewicht aus e1RM', () => {
    const ss = [1, 2, 3].map((n) => session(n, 60 + n * 2.5, 5))
    const props = proposeNextPlan(analyzeCycle(plan, ss, [], ['normal']), plan, lib)
    const k = props.find((x) => x.pid === 'a-bench')!
    expect(k.kind).toBe('keep')
    expect(k.patch!.startWeight).toBeGreaterThan(60)
  })
  it('Körpergewicht steigt nicht → +1 Satz bei 2 Oberkörperübungen', () => {
    const props = proposeNextPlan(analyzeCycle(plan, [], bw, ['normal']), plan, lib)
    const sets = props.filter((p) => p.kind === 'add-set')
    expect(sets).toHaveLength(2)
    expect(sets.every((p) => plan.days.A.concat(plan.days.B).find((e) => e.pid === p.pid)!.cat === 'upper')).toBe(true)
    expect(props.some((p) => p.id === 'info-kcal')).toBe(true)
  })
  it('Hamstring-Beschwerden → Nordics sperren + isometrische Hamstring-Übung', () => {
    const ss = [session(1, 80, 5, { complaints: { ...emptyComplaints(), hamstring: 4 } })]
    const props = proposeNextPlan(analyzeCycle(plan, ss, [], ['normal']), plan, lib)
    expect(props.some((p) => p.kind === 'lock-nordic')).toBe(true)
    const add = props.find((p) => p.kind === 'add-exercise')!
    const next = applyProposals(plan, props.filter((p) => p.id !== 'x'), lib, plan)
    expect(next.flags!.nordicLock).toBe(true)
    expect(next.days.B.some((e) => e.exId === add.add!.exId)).toBe(true)
    expect(lib.find((l) => l.id === 'iso-hamstring-hold')!.eccentricHeavy).toBe(false)
  })
  it('viele englische Wochen → kein zusätzliches Beinvolumen', () => {
    const rep = analyzeCycle(plan, [], [], ['english', 'english', 'english', 'normal'])
    expect(proposeNextPlan(rep, plan, lib).some((p) => p.kind === 'no-leg-volume')).toBe(true)
    const rep2 = analyzeCycle(plan, [], [], ['normal', 'normal', 'noGame', 'english'])
    expect(proposeNextPlan(rep2, plan, lib).some((p) => p.kind === 'no-leg-volume')).toBe(true)
    const rep3 = analyzeCycle(plan, [], [], ['normal', 'normal', 'normal', 'noGame'])
    expect(proposeNextPlan(rep3, plan, lib).some((p) => p.kind === 'no-leg-volume')).toBe(false)
  })
  it('einzelne Vorschläge lassen sich selektiv übernehmen', () => {
    const rep = analyzeCycle(plan, stagnant, bw, ['normal'])
    const props = proposeNextPlan(rep, plan, lib)
    const one = props.filter((p) => p.id === 'rep-a-bench')
    const next = applyProposals(plan, one, lib, plan)
    expect(next.days.A[1].repMin).toBe(7)
    expect(next.days.A[2].repMin).toBe(plan.days.A[2].repMin)
  })
  it('feste Regeln: Standardplan ist gültig', () => {
    expect(validatePlan(plan, lib)).toEqual([])
  })
  it('feste Regeln werden erzwungen: Nordics/Copenhagen bleiben, Freitag ohne exzentrisch schwere Beine', () => {
    const bad = structuredClone(plan)
    bad.days.A = bad.days.A.filter((e) => e.kind !== 'nordic' && e.exId !== 'copenhagen-plank')
    bad.days.B.push({ ...bad.days.A[0], pid: 'b-rdl', exId: 'Romanian_Deadlift', name: 'RDL' })
    expect(validatePlan(bad, lib).length).toBeGreaterThanOrEqual(3)
    const fixed = enforceRules(bad, lib, plan)
    expect(validatePlan(fixed, lib)).toEqual([])
  })
  it('Alternativen für Freitag sind nie exzentrisch schwer oder hoch belastet', () => {
    const l = lib.find((x) => x.id === 'Incline_Dumbbell_Press')!
    for (const a of findAlternatives(l, lib, { friday: true })) {
      expect(a.eccentricHeavy).toBe(false)
      expect(a.legsLoad).not.toBe('hoch')
    }
  })
})

describe('Übungsdatenbank', () => {
  const lib = baseLibrary()
  it('enthält die DB und alle fehlenden Planübungen', () => {
    expect(lib.length).toBeGreaterThan(850)
    for (const id of ['nordic-hamstring-curl', 'copenhagen-plank', 'trap-bar-jump', 'iso-single-leg-bridge']) {
      expect(lib.find((l) => l.id === id)).toBeDefined()
    }
  })
  it('alle Planübungen existieren in der Bibliothek', () => {
    for (const e of [...plan.days.A, ...plan.days.B]) expect(lib.find((l) => l.id === e.exId), e.exId).toBeDefined()
  })
  it('kennzeichnet Box Jumps', () => {
    expect(lib.find((l) => l.id === 'Front_Box_Jump')!.needsBox).toBe(true)
    expect(lib.find((l) => l.id === 'Standing_Long_Jump')!.needsBox).toBe(false)
  })
})

describe('Zusammenfassung', () => {
  it('enthält Plan, Leistung, Körpergewicht und Beschwerden', () => {
    const ss = [1, 2].map((n) => session(n, 80, 5, { complaints: { ...emptyComplaints(), knee: 2 } }))
    const rep = analyzeCycle(plan, ss, [{ date: '2026-01-05', kg: 72 }], ['normal'])
    const t = buildSummary(plan, ss, [{ date: '2026-01-05', kg: 72 }], rep, '2026-01-05')
    expect(t).toContain('Bankdrücken')
    expect(t).toContain('Knie 2')
    expect(t).toContain('72')
    expect(t).toContain('Gym B (Freitag)')
  })
})
