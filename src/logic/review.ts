import type { LibExercise } from '../data/library'
import { findAlternatives } from '../data/library'
import { noGainTwoWeeks, weeklyAverages, type BwEntry } from './bodyweight'
import { bestE1rm, doneSets, fmt, weightFromE1rm } from './progression'
import type { DayId, ExerciseLog, Plan, PlanExercise, Session, WeekType } from './types'

export interface ExerciseStat {
  pid: string
  name: string
  kind: PlanExercise['kind']
  cat: PlanExercise['cat']
  day: DayId
  sessions: number
  firstWeight: number
  lastWeight: number
  firstE1rm: number
  bestE1rm: number
  lastE1rm: number
  best: number
  stagnant: boolean
  good: boolean
}

export interface CycleReport {
  stats: ExerciseStat[]
  bodyFirst?: number
  bodyLast?: number
  goal: number
  bwNoGain: boolean
  maxComplaints: { hamstring: number; groin: number; knee: number; other: number }
  weeks: { normal: number; noGame: number; english: number }
  noGameShare: number
  englishShare: number
  sessionsDone: number
}

/** Fortschrittswert pro Einheit: e1RM (Gewicht), sonst bester Wert bzw. Haltezeit/Wiederholungen */
export function perfOf(l: ExerciseLog): number {
  const d = doneSets(l.sets)
  if (!d.length) return 0
  if (l.kind === 'weight') {
    const e = bestE1rm(d)
    return e > 0 ? e : Math.max(...d.map((s) => s.reps))
  }
  if (l.kind === 'isometric') return Math.max(...d.map((s) => s.reps))
  if (l.kind === 'nordic') return d.reduce((a, s) => a + s.reps, 0)
  return Math.max(...d.map((s) => s.weight))
}

/** Stagnation: 3+ reguläre Einheiten, in denen der Bestwert nicht über dem früheren Maximum liegt. */
export function isStagnant(perf: number[], window = 3): boolean {
  if (perf.length < window + 1) return false
  const before = Math.max(...perf.slice(0, perf.length - window))
  return perf.slice(-window).every((p) => p <= before + 1e-9)
}

export function analyzeCycle(
  plan: Plan,
  sessions: Session[],
  bodyweights: BwEntry[],
  weekTypes: WeekType[],
  goal = 80,
): CycleReport {
  const done = sessions.filter((s) => s.finished).sort((a, b) => a.date.localeCompare(b.date))
  const stats: ExerciseStat[] = []
  for (const day of ['A', 'B'] as DayId[]) {
    for (const ex of plan.days[day]) {
      const logs = done
        .flatMap((s) => s.entries.filter((e) => e.pid === ex.pid && !e.reduced))
        .filter((l) => doneSets(l.sets).length > 0)
      if (!logs.length) {
        stats.push({ pid: ex.pid, name: ex.name, kind: ex.kind, cat: ex.cat, day, sessions: 0, firstWeight: 0, lastWeight: 0, firstE1rm: 0, bestE1rm: 0, lastE1rm: 0, best: 0, stagnant: false, good: false })
        continue
      }
      const perf = logs.map(perfOf)
      const topW = (l: ExerciseLog) => Math.max(...doneSets(l.sets).map((s) => s.weight))
      const first = perf[0]
      const stagnant = ex.kind === 'explosive' ? false : isStagnant(perf)
      stats.push({
        pid: ex.pid, name: ex.name, kind: ex.kind, cat: ex.cat, day, sessions: logs.length,
        firstWeight: topW(logs[0]), lastWeight: topW(logs[logs.length - 1]),
        firstE1rm: first, bestE1rm: Math.max(...perf), lastE1rm: perf[perf.length - 1], best: Math.max(...perf),
        stagnant, good: !stagnant && logs.length >= 2 && perf[perf.length - 1] > first,
      })
    }
  }
  const bw = [...bodyweights].sort((a, b) => a.date.localeCompare(b.date))
  const avgs = weeklyAverages(bw)
  const maxC = { hamstring: 0, groin: 0, knee: 0, other: 0 }
  for (const s of done) {
    maxC.hamstring = Math.max(maxC.hamstring, s.complaints.hamstring)
    maxC.groin = Math.max(maxC.groin, s.complaints.groin)
    maxC.knee = Math.max(maxC.knee, s.complaints.knee)
    maxC.other = Math.max(maxC.other, s.complaints.other)
  }
  const weeks = { normal: 0, noGame: 0, english: 0 }
  for (const w of weekTypes) weeks[w]++
  const total = Math.max(1, weekTypes.length)
  return {
    stats,
    bodyFirst: avgs[0]?.avg,
    bodyLast: avgs[avgs.length - 1]?.avg,
    goal,
    bwNoGain: noGainTwoWeeks(bw, goal),
    maxComplaints: maxC,
    weeks,
    noGameShare: weeks.noGame / total,
    englishShare: weeks.english / total,
    sessionsDone: done.length,
  }
}

/* ---------------- Planvorschläge ---------------- */

export type ProposalKind = 'rep-range' | 'swap' | 'keep' | 'add-set' | 'add-exercise' | 'lock-nordic' | 'no-leg-volume' | 'info'

export interface Proposal {
  id: string
  kind: ProposalKind
  day?: DayId
  pid?: string
  title: string
  before: string
  after: string
  reason: string
  /** Auswirkungen beim Übernehmen */
  patch?: Partial<PlanExercise>
  swapTo?: { exId: string; name: string }
  add?: PlanExercise
  /** nur zur Information, keine Planänderung */
  infoOnly?: boolean
}

const desc = (e: PlanExercise) => `${e.sets}x${e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}${e.unit === 's' ? ' s' : ''}`

export function proposeNextPlan(report: CycleReport, plan: Plan, lib: LibExercise[]): Proposal[] {
  const out: Proposal[] = []
  const hamPain = report.maxComplaints.hamstring >= 3
  const byEx = new Map(lib.map((l) => [l.id, l]))
  const find = (pid: string): [DayId, PlanExercise] | null => {
    for (const d of ['A', 'B'] as DayId[]) {
      const e = plan.days[d].find((x) => x.pid === pid)
      if (e) return [d, e]
    }
    return null
  }

  for (const st of report.stats) {
    const f = find(st.pid)
    if (!f) continue
    const [day, ex] = f
    if (st.stagnant && ex.kind === 'weight' && !['core', 'prevention'].includes(ex.cat)) {
      if (ex.repMax <= 6) {
        const patch = { repMin: ex.repMin + 2, repMax: ex.repMax + 2 }
        out.push({
          id: `rep-${ex.pid}`, kind: 'rep-range', day, pid: ex.pid, title: ex.name,
          before: desc(ex), after: desc({ ...ex, ...patch }), patch,
          reason: `Stagnation (3+ Einheiten ohne Fortschritt) → Wiederholungsbereich ${ex.repMin}–${ex.repMax} auf ${patch.repMin}–${patch.repMax} wechseln`,
        })
      } else {
        const cur = byEx.get(ex.exId)
        const alt = cur ? findAlternatives(cur, lib, { friday: day === 'B', noEccentric: hamPain && day === 'A', limit: 1 })[0] : undefined
        if (alt) {
          out.push({
            id: `swap-${ex.pid}`, kind: 'swap', day, pid: ex.pid, title: ex.name,
            before: ex.name, after: alt.nameDe ?? alt.nameEn, swapTo: { exId: alt.id, name: alt.nameDe ?? alt.nameEn },
            reason: `Stagnation → Variante mit gleichen Zielmuskeln (${alt.primary.join(', ')}) und Kategorie ${alt.category}`,
          })
        } else {
          const patch = { repMin: Math.max(3, ex.repMin - 2), repMax: Math.max(5, ex.repMax - 2) }
          out.push({
            id: `rep-${ex.pid}`, kind: 'rep-range', day, pid: ex.pid, title: ex.name,
            before: desc(ex), after: desc({ ...ex, ...patch }), patch,
            reason: 'Stagnation, keine passende Variante gefunden → Wiederholungsbereich wechseln',
          })
        }
      }
    } else if (st.good && ex.kind === 'weight') {
      const sw = weightFromE1rm(st.lastE1rm, ex.repMin, 2, ex.inc)
      out.push({
        id: `keep-${ex.pid}`, kind: 'keep', day, pid: ex.pid, title: ex.name,
        before: `Start ${fmt(st.firstWeight)} kg`, after: `behalten, Startgewicht ${fmt(sw)} kg`,
        patch: { startWeight: sw },
        reason: `Gute Progression (e1RM ${fmt(st.firstE1rm, 0)} → ${fmt(st.lastE1rm, 0)} kg) → Übung behalten, Startgewicht aus aktuellem e1RM`,
      })
    }
  }

  if (report.bwNoGain) {
    const cands = (['A', 'B'] as DayId[])
      .flatMap((d) => plan.days[d].filter((e) => e.cat === 'upper' && e.kind === 'weight' && e.sets < 5).map((e) => [d, e] as const))
      .slice(0, 2)
    for (const [d, e] of cands) {
      out.push({
        id: `set-${e.pid}`, kind: 'add-set', day: d, pid: e.pid, title: e.name,
        before: desc(e), after: desc({ ...e, sets: e.sets + 1 }), patch: { sets: e.sets + 1 },
        reason: 'Körpergewicht steigt nicht → Oberkörper-Volumen +1 Satz (dazu: +200 kcal pro Tag)',
      })
    }
    out.push({
      id: 'info-kcal', kind: 'info', title: 'Ernährung', before: '–', after: '+200 kcal pro Tag', infoOnly: true,
      reason: 'Körpergewicht stagniert unter dem Ziel von ' + report.goal + ' kg',
    })
  }

  if (hamPain) {
    out.push({
      id: 'lock-nordic', kind: 'lock-nordic', title: 'Nordics', before: 'Aufstieg möglich', after: 'Stufe nicht erhöhen',
      reason: `Beschwerden Oberschenkelrückseite (max. ${report.maxComplaints.hamstring}/10). Bei anhaltenden Beschwerden Physio aufsuchen.`,
    })
    if (!plan.days.B.some((e) => e.exId === 'iso-hamstring-hold')) {
      out.push({
        id: 'add-iso-ham', kind: 'add-exercise', day: 'B', title: 'Isometrischer Hamstring-Hold',
        before: '–', after: '3x20–30 s pro Seite (Freitag)',
        reason: 'Beschwerden Oberschenkelrückseite → zusätzliche isometrische Hamstring-Übung, keine neue exzentrisch schwere Beinübung',
        add: {
          pid: 'b-isoham', exId: 'iso-hamstring-hold', name: 'Isometrischer Hamstring-Hold', kind: 'isometric', cat: 'prevention',
          sets: 3, repMin: 20, repMax: 30, rest: 45, inc: 0, unit: 's', perSide: true,
        },
      })
    }
  }

  if (report.englishShare >= 0.25) {
    out.push({
      id: 'no-leg-volume', kind: 'no-leg-volume', title: 'Bein-Volumen Montag', before: 'Zusatzsatz in Wochen ohne Spiel',
      after: 'Kein zusätzlicher Beinsatz',
      reason: `Viele englische Wochen (${Math.round(report.englishShare * 100)} %) → Bein-Volumen am Montag nicht erhöhen`,
    })
  }
  return out
}

/* ---------------- Plan-Regeln ---------------- */

export function validatePlan(plan: Plan, lib: LibExercise[]): string[] {
  const issues: string[] = []
  const byEx = new Map(lib.map((l) => [l.id, l]))
  const keys = Object.keys(plan.days)
  if (keys.length !== 2 || !plan.days.A || !plan.days.B) issues.push('Gym nur Montag (A) und Freitag (B).')
  if (!plan.days.A.some((e) => e.kind === 'nordic')) issues.push('Nordics fehlen im Plan.')
  if (![...plan.days.A, ...plan.days.B].some((e) => e.exId === 'copenhagen-plank')) issues.push('Copenhagen Plank fehlt im Plan.')
  for (const e of plan.days.B) {
    const l = byEx.get(e.exId)
    if (l?.eccentricHeavy) issues.push(`Freitag: „${e.name}“ ist exzentrisch schwer.`)
    else if (l?.legsLoad === 'hoch') issues.push(`Freitag: „${e.name}“ hat hohe Beinbelastung.`)
  }
  if (!plan.days.A.some((e) => e.cat === 'legs' || e.cat === 'upper')) issues.push('Montag muss Kraft enthalten.')
  return issues
}

/** Wendet Vorschläge an und erzwingt die festen Regeln (sie dürfen nie verletzt werden). */
export function applyProposals(plan: Plan, accepted: Proposal[], lib: LibExercise[], base: Plan): Plan {
  const next: Plan = structuredClone(plan)
  next.flags = { ...(plan.flags ?? {}) }
  for (const p of accepted) {
    if (p.kind === 'lock-nordic') next.flags!.nordicLock = true
    if (p.kind === 'no-leg-volume') next.flags!.noExtraLegSet = true
    if (!p.day) continue
    if (p.add) {
      next.days[p.day].push({ ...p.add })
      continue
    }
    const list = next.days[p.day]
    const i = list.findIndex((e) => e.pid === p.pid)
    if (i < 0) continue
    if (p.swapTo && !['nordic', 'isometric'].includes(list[i].kind)) {
      list[i] = { ...list[i], exId: p.swapTo.exId, name: p.swapTo.name, pid: `${list[i].pid}-v${next.version + 1}` }
    } else if (p.patch) {
      list[i] = { ...list[i], ...p.patch }
    }
  }
  return enforceRules(next, lib, base)
}

export function enforceRules(plan: Plan, lib: LibExercise[], base: Plan): Plan {
  const byEx = new Map(lib.map((l) => [l.id, l]))
  const p = structuredClone(plan)
  p.days.B = p.days.B.filter((e) => {
    const l = byEx.get(e.exId)
    return !(l && (l.eccentricHeavy || l.legsLoad === 'hoch'))
  })
  const nordic = base.days.A.find((e) => e.kind === 'nordic')
  if (nordic && !p.days.A.some((e) => e.kind === 'nordic')) p.days.A.push(structuredClone(nordic))
  const all = [...p.days.A, ...p.days.B]
  const cop = [...base.days.A, ...base.days.B].find((e) => e.exId === 'copenhagen-plank')
  if (cop && !all.some((e) => e.exId === 'copenhagen-plank')) p.days.A.push(structuredClone(cop))
  return p
}
