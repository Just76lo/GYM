import { describe, expect, it } from 'vitest'
import { makeDefaultPlan, makeWinterDays, normalizePlan, winterA, winterB, winterC } from '../data/plan'
import { DEFAULT_EQUIPMENT, resolveExercise, resolveList, resolvePlan } from './equipment'
import { nextSpeedWeight } from './progression'
import { buildSession, prescribeOne, type BuildCtx } from './session'
import type { BlockId, DayId, ExerciseLog, SetLog } from './types'

const plan = makeDefaultPlan()
const S = (weight: number, reps: number, rir: number): SetLog => ({ weight, reps, rir, done: true })
const L = (pid: string, sets: SetLog[], over: Partial<ExerciseLog> = {}): ExerciseLog => ({
  pid, exId: pid, name: pid, kind: 'weight', unit: 'kg', repMin: 5, repMax: 6, targetReps: 5, targetWeight: sets[0]?.weight ?? 0,
  reduced: false, block: 'basis', sets, ...over,
})
const ctx = (day: DayId, block: BlockId, over: Partial<BuildCtx> = {}): BuildCtx => ({
  day, block, weekType: 'normal', heavyLegs: false, history: {}, states: {}, phase: 'winter', winterWeek: 1, ...over,
})
const pick = (c: BuildCtx, pid: string) => buildSession(plan, c).find((p) => p.pid === pid)!

describe('Winterpause: Pläne laut Vorgabe', () => {
  it('Gym A (Kraft): 8 Übungen mit den vorgegebenen Parametern', () => {
    const a = buildSession(plan, ctx('A', 'wbuild'))
    expect(a.map((p) => p.name)).toEqual([
      'Kreuzheben konventionell', 'Bankdrücken', 'Klimmzüge (gewichtet)', 'Bulgarian Split Squat', 'KH-Rudern einarmig',
      'Nordic Hamstring Curls', 'Copenhagen Plank', 'Pallof Press',
    ])
    const dl = a[0]
    expect([dl.sets, dl.repMin, dl.repMax, dl.rpe, dl.rest, dl.inc]).toEqual([4, 4, 5, 8, 150, 5])
    const bench = a[1]
    expect([bench.sets, bench.repMin, bench.repMax, bench.rpe, bench.rest, bench.inc]).toEqual([4, 5, 6, 8, 150, 2.5])
    const bss = a[3]
    expect([bss.sets, bss.repMin, bss.repMax, bss.rpe, bss.rest, bss.perSide]).toEqual([3, 6, 8, 8, 90, true])
    expect(a[6]).toMatchObject({ sets: 3, repMin: 20, repMax: 30, rest: 60, perSide: true })
    expect(a[7]).toMatchObject({ sets: 3, rest: 45, perSide: true })
  })
  it('Gym C (Muskelaufbau): 9 Übungen', () => {
    const c = buildSession(plan, ctx('C', 'wbuild'))
    expect(c.map((p) => p.name)).toEqual([
      'Kniebeuge', 'Rumänisches Kreuzheben', 'LH-Schrägbankdrücken', 'Brustgestütztes Rudern', 'Hip Thrust', 'Adduktorenmaschine',
      'Seitheben', 'Bizeps + Trizeps (Supersatz)', 'Wadenheben',
    ])
    expect(c.map((p) => [p.sets, p.rest])).toEqual([[3, 150], [3, 120], [3, 120], [3, 90], [3, 90], [2, 60], [3, 60], [3, 60], [3, 60]])
    expect(c.map((p) => p.rpe)).toEqual([8, 7, 8, 8, 8, 8, 9, 9, 8])
  })
  it('Gym B: Schnellkraft + Oberkörper ohne Medball und Trap-Bar', () => {
    const b = buildSession(plan, ctx('B', 'wbuild'))
    expect(b.map((p) => p.name)).toEqual([
      'Countermovement Jumps', 'Standweitsprung', 'Skater Jumps', 'Kabel-Holzhacker explosiv', 'Speed-Kniebeuge',
      'Schulterdrücken stehend', 'Dips (gewichtet)', 'Latzug', 'Face Pulls', 'Isometrische Single-Leg-Bridge', 'Wadenheben',
    ])
    expect(b[0]).toMatchObject({ sets: 4, repMin: 3, rest: 90 })
    expect(b[1]).toMatchObject({ sets: 3, unit: 'cm' })
    expect(b[5]).toMatchObject({ sets: 3, repMin: 6, repMax: 8, rest: 120 })
    expect(b[8]).toMatchObject({ sets: 3, repMin: 15, rest: 60 })
    expect(b[9]).toMatchObject({ sets: 3, repMin: 30, unit: 's', perSide: true, rest: 45 })
  })
  it('Winter-Pläne sind in jedem Plan vorhanden, auch in alten ohne Winterdaten', () => {
    const old = { ...makeDefaultPlan(), days: { A: plan.days.A, B: plan.days.B } as never, winterDays: undefined }
    const n = normalizePlan(old)
    expect(n.days.C).toEqual([])
    expect(n.winterDays?.C).toHaveLength(winterC.length)
    expect(n.winterDays?.A).toHaveLength(winterA.length)
    expect(n.winterDays?.B).toHaveLength(winterB.length)
    expect(n.days.A).toBe(plan.days.A)
  })
})

describe('Winterpause: Wochen und Blöcke', () => {
  it('Aufbau: obere Wiederholungsbereiche beim Start und beim Blockwechsel, RIR 2', () => {
    const start = pick(ctx('A', 'wbuild'), 'a-bench')
    expect([start.reps, start.targetRir]).toEqual([6, 2])
    const seasonLog = L('a-bench', [S(100, 5, 2), S(100, 5, 2)], { block: 'kraft' })
    const p = pick(ctx('A', 'wbuild', { history: { 'a-bench': [seasonLog] } }), 'a-bench')
    expect(p.reps).toBe(6)
    expect(p.weight).toBeLessThan(100) // 6 Wdh bei RIR 2 aus e1RM(100×5) = 116,7
    expect(p.reason).toContain('Neuer Block')
  })
  it('Woche 4: Sätze halbiert, Ziel-RIR 4, zählt nicht negativ', () => {
    const a = buildSession(plan, ctx('A', 'wlight', { winterWeek: 4 }))
    expect(a.find((p) => p.pid === 'a-deadlift')).toMatchObject({ sets: 2, targetRir: 4, reduced: true })
    expect(a.find((p) => p.pid === 'a-bench')).toMatchObject({ sets: 2, targetRir: 4, reduced: true })
    const c = buildSession(plan, ctx('C', 'wlight', { winterWeek: 4 }))
    expect(c.find((p) => p.pid === 'c-adductor')!.sets).toBe(1)
    expect(c.every((p) => p.reduced)).toBe(true)
  })
  it('Woche 4: leichte Einheit verändert die nächste Empfehlung nicht', () => {
    const real = L('a-bench', [S(100, 6, 2), S(100, 6, 2)], { block: 'wbuild' })
    const light = L('a-bench', [S(100, 3, 4)], { block: 'wlight', reduced: true })
    const a = pick(ctx('A', 'wstrength', { winterWeek: 5, history: { 'a-bench': [real, light] } }), 'a-bench')
    const b = pick(ctx('A', 'wstrength', { winterWeek: 5, history: { 'a-bench': [real] } }), 'a-bench')
    expect(a.weight).toBe(b.weight)
  })
  it('Kraft (Woche 5–8): Kreuzheben, Kniebeuge, Bankdrücken mit 4–5 Wdh, RIR 1–2', () => {
    const a = buildSession(plan, ctx('A', 'wstrength', { winterWeek: 6 }))
    expect(a.find((p) => p.pid === 'a-deadlift')).toMatchObject({ repMin: 4, repMax: 5, targetRir: 1 })
    expect(a.find((p) => p.pid === 'a-bench')).toMatchObject({ repMin: 4, repMax: 5 })
    const c = buildSession(plan, ctx('C', 'wstrength', { winterWeek: 6 }))
    expect(c.find((p) => p.pid === 'c-squat')).toMatchObject({ repMin: 4, repMax: 5 })
    expect(c.find((p) => p.pid === 'c-hipthrust')).toMatchObject({ repMin: 8, repMax: 10 })
  })
  it('Übergang (Woche 9): 1 Satz weniger pro Übung, RIR 3', () => {
    const base = buildSession(plan, ctx('A', 'wstrength', { winterWeek: 8 }))
    const tr = buildSession(plan, ctx('A', 'wtrans', { winterWeek: 9 }))
    base.forEach((b, i) => {
      expect(tr[i].sets, b.name).toBe(Math.max(1, b.sets - 1))
      expect(tr[i].targetRir).toBe(3)
      expect(tr[i].reduced).toBe(true)
    })
  })
  it('Rumänisches Kreuzheben: Woche 1 RPE 7, danach RPE 8', () => {
    expect(pick(ctx('C', 'wbuild', { winterWeek: 1 }), 'extra-rdl').rpe).toBe(7)
    expect(pick(ctx('C', 'wbuild', { winterWeek: 2 }), 'extra-rdl').rpe).toBe(8)
  })
  it('keine Spiel-Abschläge: „90 min gespielt“ und „Ohne Spiel“ greifen in der Winterpause nicht', () => {
    const heavy = buildSession(plan, ctx('A', 'wbuild', { heavyLegs: true }))
    expect(heavy.find((p) => p.pid === 'a-deadlift')).toMatchObject({ sets: 4, rpe: 8, reduced: false })
    const noGame = buildSession(plan, ctx('B', 'wbuild', { weekType: 'normal' }))
    expect(noGame.some((p) => p.pid === 'extra-rdl')).toBe(false)
    const rdlFriday = buildSession(plan, ctx('B', 'wbuild', { weekType: 'noGame' }))
    expect(rdlFriday.some((p) => p.extra)).toBe(false)
    expect(heavy.find((p) => p.pid === 'a-bss')!.rpe).toBe(8) // Bein-RPE bis 8
  })
  it('Gleiche Übung = gleicher Verlauf über die Phasen', () => {
    const history = { 'a-bench': [L('a-bench', [S(80, 6, 2), S(80, 6, 2), S(80, 6, 2), S(80, 6, 2)], { block: 'basis' })] }
    const season = buildSession(plan, { ...ctx('A', 'basis'), phase: 'season', history }).find((p) => p.pid === 'a-bench')!
    const winter = buildSession(plan, ctx('A', 'wbuild', { history })).find((p) => p.pid === 'a-bench')!
    expect(season.weight).toBe(82.5)
    expect(winter.pid).toBe(season.pid)
    expect(winter.weight).toBeGreaterThan(0)
    expect(winter.reason).toContain('e1RM 96') // aus demselben Verlauf berechnet
  })
})

describe('Spielabstand-Regeln in der Einheit', () => {
  const none = { md1: false, md2: false, plus1: false, b2b: false }
  const A = (rules: Partial<typeof none>, over: Partial<BuildCtx> = {}) => buildSession(plan, ctx('A', 'wbuild', { phase: 'season', rules: { ...none, ...rules }, ...over }))
  it('MD+1: Bein-RPE 6, −1 Satz, Oberkörper unverändert', () => {
    const a = A({ plus1: true }, { phase: 'winter' })
    expect(a.find((p) => p.pid === 'a-deadlift')).toMatchObject({ sets: 3, rpe: 6, reduced: true })
    expect(a.find((p) => p.pid === 'a-bench')).toMatchObject({ sets: 4, reduced: false })
  })
  it('MD+1 bei Gym B: Sprünge auf 2×3 CMJ reduziert', () => {
    const b = buildSession(plan, ctx('B', 'wbuild', { rules: { ...none, plus1: true } }))
    expect(b.find((p) => p.pid === 'b-cmj')).toMatchObject({ sets: 2, repMin: 3, reduced: true })
    expect(b.some((p) => p.pid === 'b-slj' || p.pid === 'b-skater' || p.pid === 'b-speedsquat')).toBe(false)
    expect(b.some((p) => p.pid === 'b-ohp')).toBe(true)
  })
  it('MD-2: keine exzentrisch schweren Beinübungen, Bein-RPE max. 7', () => {
    const a = A({ md2: true }, { phase: 'winter' })
    expect(a.some((p) => p.pid === 'a-bss')).toBe(false)
    expect(a.find((p) => p.pid === 'a-nordic')).toMatchObject({ sets: 2, repMin: 3 }) // Pflichtübung bleibt, reduziert
    expect(a.find((p) => p.pid === 'a-deadlift')!.rpe).toBe(7)
    expect(a.find((p) => p.pid === 'a-bench')!.rpe).toBe(8)
  })
  it('MD-1: nur Aktivierung – Sätze halbiert', () => {
    const a = A({ md1: true }, { phase: 'winter' })
    expect(a.find((p) => p.pid === 'a-bench')).toMatchObject({ sets: 2, reduced: true })
  })
  it('zwei Gym-Tage hintereinander: Beinvolumen −1 Satz in der zweiten Einheit', () => {
    const a = A({ b2b: true }, { phase: 'winter' })
    expect(a.find((p) => p.pid === 'a-deadlift')!.sets).toBe(3)
    expect(a.find((p) => p.pid === 'a-bench')!.sets).toBe(4)
  })
  it('automatisch reduzierte Einheit zählt nicht negativ für die Progression', () => {
    const full = L('a-deadlift', [S(120, 5, 2), S(120, 5, 2), S(120, 5, 2), S(120, 5, 2)], { block: 'wbuild' })
    const reduced = L('a-deadlift', [S(108, 3, 0)], { block: 'wbuild', reduced: true })
    const a = prescribeOne(winterA[0], { ...ctx('A', 'wbuild'), history: { 'a-deadlift': [full, reduced] } })!
    const b = prescribeOne(winterA[0], { ...ctx('A', 'wbuild'), history: { 'a-deadlift': [full] } })!
    expect(a.weight).toBe(b.weight)
  })
})

describe('Ausrüstung: Trap-Bar und Medball', () => {
  const season = (eq = DEFAULT_EQUIPMENT) => buildSession(plan, { day: 'A', block: 'basis', weekType: 'normal', heavyLegs: false, history: {}, states: {}, equipment: eq })
  it('ohne Trap-Bar: Kreuzheben konventionell, gleiche Sätze/Wdh/RPE, +5 kg', () => {
    const dl = season()[0]
    expect(dl).toMatchObject({ pid: 'a-deadlift', name: 'Kreuzheben konventionell', exId: 'Barbell_Deadlift', sets: 4, repMin: 4, repMax: 5, rpe: 7.5, inc: 5 })
  })
  it('Trap-Bar AN: Original wieder aktiv', () => {
    expect(season({ trapBar: true, medball: false })[0]).toMatchObject({ pid: 'a-trapbar', name: 'Trap-Bar-Kreuzheben', exId: 'Trap_Bar_Deadlift' })
  })
  it('alte Trap-Bar-Einträge bleiben als eigene Übung, die neue startet ohne deren Verlauf', () => {
    const history = { 'a-trapbar': [L('a-trapbar', [S(140, 5, 2)])] }
    const p = buildSession(plan, { day: 'A', block: 'basis', weekType: 'normal', heavyLegs: false, history, states: {}, equipment: DEFAULT_EQUIPMENT })[0]
    expect(p.pid).toBe('a-deadlift')
    expect(p.weight).toBe(0)
    expect(history['a-trapbar']).toHaveLength(1)
  })
  it('Trap-Bar-Sprünge → Speed-Kniebeuge 5×3, 90 s, aus dem Kniebeugen-1RM', () => {
    const b = buildSession(plan, { day: 'B', block: 'basis', weekType: 'normal', heavyLegs: false, history: {}, states: {}, equipment: DEFAULT_EQUIPMENT, squat1rm: 150 })
    const sp = b.find((p) => p.pid === 'b-speedsquat')!
    expect(sp).toMatchObject({ name: 'Speed-Kniebeuge', sets: 5, repMin: 3, repMax: 3, rest: 90, weight: 82.5 })
    expect(sp.reason).toContain('keine RIR-Progression')
    expect(b.some((p) => p.pid === 'b-tbjump')).toBe(false)
  })
  it('Speed-Kniebeuge nimmt das Kniebeugen-1RM aus dem Verlauf', () => {
    const history = { 'c-squat': [L('c-squat', [S(100, 5, 2)])] } // e1RM 116,7 → 55 % = 64,2 → 65
    const sp = buildSession(plan, { day: 'B', block: 'basis', weekType: 'normal', heavyLegs: false, history, states: {}, equipment: DEFAULT_EQUIPMENT }).find((p) => p.pid === 'b-speedsquat')!
    expect(sp.weight).toBe(65)
  })
  it('Med-Ball-Rotationswurf → Kabel-Holzhacker explosiv 3×5/Seite, 60 s, +2,5 kg', () => {
    const b = buildSession(plan, { day: 'B', block: 'basis', weekType: 'normal', heavyLegs: false, history: {}, states: {}, equipment: DEFAULT_EQUIPMENT })
    expect(b.find((p) => p.pid === 'b-woodchop')).toMatchObject({ name: 'Kabel-Holzhacker explosiv', sets: 3, repMin: 5, repMax: 5, rest: 60, inc: 2.5, perSide: true })
    expect(b.some((p) => p.pid === 'b-medball')).toBe(false)
  })
  it('Medball AN / Trap-Bar AN: Originale auch in der Saison-Gym-B', () => {
    const b = buildSession(plan, { day: 'B', block: 'basis', weekType: 'normal', heavyLegs: false, history: {}, states: {}, equipment: { trapBar: true, medball: true } })
    expect(b.find((p) => p.pid === 'b-medball')).toMatchObject({ name: 'Med-Ball-Rotationswurf an die Wand', sets: 3, repMin: 4 })
    expect(b.find((p) => p.pid === 'b-tbjump')).toMatchObject({ name: 'Trap-Bar-Sprünge', sets: 3, rest: 120 })
  })
  it('gilt auch in der Winterpause: Schalter AN bringt Originale zurück', () => {
    const b = buildSession(plan, ctx('B', 'wbuild', { equipment: { trapBar: true, medball: true } }))
    expect(b.some((p) => p.pid === 'b-medball')).toBe(true)
    expect(b.some((p) => p.pid === 'b-tbjump')).toBe(true)
    const a = buildSession(plan, ctx('A', 'wbuild', { equipment: { trapBar: true, medball: false } }))
    expect(a[0].pid).toBe('a-trapbar')
  })
  it('per „Ausweichen“ getauschte Übungen bleiben unberührt; Auflösen ist umkehrbar', () => {
    const swapped = { ...plan.days.A[0], pid: 'a-trapbar@Goblet_Squat', exId: 'Goblet_Squat' }
    expect(resolveExercise(swapped, DEFAULT_EQUIPMENT)).toBe(swapped)
    const on = resolveExercise(plan.days.A[0], { trapBar: true, medball: true })
    expect(on).toBe(plan.days.A[0])
    const off = resolveExercise(plan.days.A[0], DEFAULT_EQUIPMENT)
    expect(resolveExercise(off, { trapBar: true, medball: false })).toMatchObject({ pid: 'a-trapbar', exId: 'Trap_Bar_Deadlift' })
    expect(resolveList(plan.days.B, DEFAULT_EQUIPMENT).map((e) => e.pid)).toContain('b-speedsquat')
    expect(resolvePlan(plan, DEFAULT_EQUIPMENT).days.A[0].pid).toBe('a-deadlift')
    expect(plan.days.A[0].pid).toBe('a-trapbar') // gespeicherter Plan bleibt unverändert
  })
})

describe('Speed-Kniebeuge: Progression', () => {
  const log = (w: number, date: string, tempoGood = true) => L('b-speedsquat', [S(w, 3, 3), S(w, 3, 3)], { date, tempoGood, kind: 'explosive' })
  it('Start bei 55 % bzw. ohne Daten 0', () => {
    expect(nextSpeedWeight([], 82.5, 2.5).weight).toBe(82.5)
    expect(nextSpeedWeight([], 0, 2.5).reason).toContain('1RM')
  })
  it('nach einer Woche gleiches Gewicht, nach zwei Wochen +2,5 kg bei gutem Tempo', () => {
    const logs = [log(80, '2026-12-01')]
    expect(nextSpeedWeight(logs, 0, 2.5, '2026-12-08').weight).toBe(80)
    const two = [log(80, '2026-12-01'), log(80, '2026-12-08')]
    expect(nextSpeedWeight(two, 0, 2.5, '2026-12-15').weight).toBe(82.5)
  })
  it('Tempo nicht gut → kein Plus', () => {
    const two = [log(80, '2026-12-01'), log(80, '2026-12-08', false)]
    const r = nextSpeedWeight(two, 0, 2.5, '2026-12-15')
    expect(r.weight).toBe(80)
    expect(r.reason).toContain('nicht gut')
  })
  it('nach der Erhöhung beginnt die Zählung neu', () => {
    const logs = [log(80, '2026-12-01'), log(80, '2026-12-08'), log(82.5, '2026-12-15')]
    expect(nextSpeedWeight(logs, 0, 2.5, '2026-12-22').weight).toBe(82.5)
    expect(nextSpeedWeight(logs, 0, 2.5, '2026-12-29').weight).toBe(85)
  })
  it('wird nicht über RIR gesteuert: Verlauf mit RIR 0 ändert nichts', () => {
    const l = L('b-speedsquat', [S(80, 3, 0)], { date: '2026-12-01', tempoGood: true, kind: 'explosive' })
    expect(nextSpeedWeight([l], 0, 2.5, '2026-12-02').weight).toBe(80)
  })
})

describe('Winter-Plandaten', () => {
  it('makeWinterDays liefert unabhängige Kopien', () => {
    const a = makeWinterDays()
    a.A[0].sets = 99
    expect(makeWinterDays().A[0].sets).toBe(4)
  })
})
