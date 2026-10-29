import type { Plan, PlanExercise, WarmupItem } from '../logic/types'

const ex = (e: PlanExercise): PlanExercise => e

export const defaultWarmup: WarmupItem[] = [
  { id: 'w1', text: '5 min Rad oder Rudern' },
  { id: 'w2', text: "World's Greatest Stretch – 5 pro Seite" },
  { id: 'w3', text: 'Hüfte 90/90 – 5 pro Seite' },
  { id: 'w4', text: 'Sprunggelenk an der Wand – 5 pro Seite' },
  { id: 'w5', text: 'Glute Bridge – 2 × 10' },
  { id: 'w6', text: 'Monster Walks mit Band – 2 × 10' },
  { id: 'w7', text: 'Copenhagen kurzer Hebel – 1 × 10 s pro Seite' },
]

export const gymA: PlanExercise[] = [
  ex({
    pid: 'a-trapbar', exId: 'Trap_Bar_Deadlift', name: 'Trap-Bar-Kreuzheben', kind: 'weight', cat: 'legs',
    sets: 4, repMin: 4, repMax: 5, rpe: 7.5, rest: 150, inc: 5, unit: 'kg',
    kraft: { sets: 5, repMin: 3, repMax: 4 }, contrast: true, note: 'RPE 7–8',
  }),
  ex({
    pid: 'a-bench', exId: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Bankdrücken', kind: 'weight', cat: 'upper',
    sets: 4, repMin: 5, repMax: 6, rpe: 8, rest: 150, inc: 2.5, unit: 'kg',
    kraft: { sets: 4, repMin: 4, repMax: 5 },
  }),
  ex({
    pid: 'a-pullup', exId: 'Pullups', name: 'Klimmzüge (gewichtet)', kind: 'weight', cat: 'upper',
    sets: 4, repMin: 5, repMax: 6, rpe: 8, rest: 120, inc: 2.5, unit: 'kg',
    kraft: { sets: 4, repMin: 4, repMax: 5 }, note: 'Zusatzgewicht eintragen (0 = Körpergewicht)',
  }),
  ex({
    pid: 'a-bss', exId: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', kind: 'weight', cat: 'legs',
    sets: 3, repMin: 6, repMax: 8, rpe: 7, rest: 90, inc: 2, unit: 'kg', perSide: true,
    note: 'Kurzhanteln – Gewicht pro Hand',
  }),
  ex({
    pid: 'a-row', exId: 'One-Arm_Dumbbell_Row', name: 'KH-Rudern einarmig', kind: 'weight', cat: 'upper',
    sets: 3, repMin: 8, repMax: 10, rpe: 8, rest: 90, inc: 2, unit: 'kg', perSide: true,
  }),
  ex({
    pid: 'a-nordic', exId: 'nordic-hamstring-curl', name: 'Nordic Hamstring Curls', kind: 'nordic', cat: 'legs',
    sets: 3, repMin: 3, repMax: 6, rest: 120, inc: 0, unit: 'kg', note: 'Stufenprogression',
  }),
  ex({
    pid: 'a-copenhagen', exId: 'copenhagen-plank', name: 'Copenhagen Plank', kind: 'isometric', cat: 'core',
    sets: 3, repMin: 15, repMax: 30, rest: 60, inc: 0, unit: 's', perSide: true,
    variants: ['Kurzer Hebel (Knie auf Bank)', 'Langer Hebel (Fuß auf Bank)'],
  }),
  ex({
    pid: 'a-pallof', exId: 'Pallof_Press', name: 'Pallof Press', kind: 'weight', cat: 'core',
    sets: 3, repMin: 10, repMax: 10, rest: 45, inc: 2.5, unit: 'kg', perSide: true,
  }),
]

export const gymB: PlanExercise[] = [
  ex({
    pid: 'b-cmj', exId: 'countermovement-jump', name: 'Countermovement Jumps', kind: 'explosive', cat: 'power', tag: 'cmj',
    sets: 4, repMin: 3, repMax: 3, rest: 90, inc: 0, unit: 'cm', note: 'Maximaler Einsatz – Sprunghöhe in cm loggen',
  }),
  ex({
    pid: 'b-slj', exId: 'Standing_Long_Jump', name: 'Standweitsprung', kind: 'explosive', cat: 'legpower',
    sets: 3, repMin: 3, repMax: 3, rest: 90, inc: 0, unit: 'cm', note: 'Weite in cm loggen',
  }),
  ex({
    pid: 'b-medball', exId: 'med-ball-rotationswurf', name: 'Med-Ball-Rotationswurf an die Wand', kind: 'explosive', cat: 'power',
    sets: 3, repMin: 4, repMax: 4, rest: 60, inc: 1, unit: 'kg', perSide: true, note: 'Ballgewicht in kg',
  }),
  ex({
    pid: 'b-tbjump', exId: 'trap-bar-jump', name: 'Trap-Bar-Sprünge', kind: 'explosive', cat: 'legpower',
    sets: 3, repMin: 3, repMax: 3, rest: 120, inc: 2.5, unit: 'kg', loadFrom: { pid: 'a-trapbar', pct: 0.25 },
    note: '20–30 % des Trap-Bar-1RM',
  }),
  ex({
    pid: 'b-incline', exId: 'Incline_Dumbbell_Press', name: 'KH-Schrägbankdrücken', kind: 'weight', cat: 'upper',
    sets: 3, repMin: 8, repMax: 10, rpe: 8, rest: 90, inc: 2, unit: 'kg', note: 'Gewicht pro Hand',
  }),
  ex({
    pid: 'b-pull', exId: 'Seated_Cable_Rows', name: 'Kabelrudern oder Latzug', kind: 'weight', cat: 'upper',
    sets: 3, repMin: 10, repMax: 10, rpe: 8, rest: 90, inc: 2.5, unit: 'kg',
  }),
  ex({
    pid: 'b-ohp', exId: 'Standing_Military_Press', name: 'Schulterdrücken stehend', kind: 'weight', cat: 'upper',
    sets: 3, repMin: 8, repMax: 8, rpe: 8, rest: 90, inc: 2.5, unit: 'kg',
  }),
  ex({
    pid: 'b-facepull', exId: 'Face_Pull', name: 'Face Pulls + Bizeps/Trizeps (Supersatz)', kind: 'weight', cat: 'upper',
    sets: 3, repMin: 12, repMax: 12, rpe: 8, rest: 60, inc: 2.5, unit: 'kg', note: '2–3 Sätze, Supersatz',
  }),
  ex({
    pid: 'b-isobridge', exId: 'iso-single-leg-bridge', name: 'Isometrische Single-Leg-Bridge', kind: 'isometric', cat: 'prevention',
    sets: 3, repMin: 20, repMax: 30, rest: 45, inc: 0, unit: 's', perSide: true,
    variants: ['Ferse auf Bank', 'Ferse auf Bank + Gewicht auf der Hüfte'],
  }),
  ex({
    pid: 'b-calf', exId: 'Standing_Calf_Raises', name: 'Wadenheben', kind: 'weight', cat: 'prevention',
    sets: 3, repMin: 10, repMax: 12, rpe: 8, rest: 60, inc: 2.5, unit: 'kg',
  }),
]

export function makeDefaultPlan(): Plan {
  return {
    lineage: 'standard',
    name: 'Fußball-Kraftplan (Standard)',
    version: 1,
    createdAt: new Date().toISOString(),
    days: { A: structuredClone(gymA), B: structuredClone(gymB) },
    warmup: structuredClone(defaultWarmup),
    flags: {},
  }
}
