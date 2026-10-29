import { weeklyAverages, type BwEntry } from './bodyweight'
import { CYCLE_WEEKS } from './periodization'
import { describeSets, doneSets, fmt } from './progression'
import type { CycleReport } from './review'
import type { DayId, Plan, Session } from './types'

const rangeText = (e: Plan['days']['A'][number]) =>
  `${e.sets}x${e.repMin === e.repMax ? e.repMin : `${e.repMin}-${e.repMax}`}${e.unit === 's' ? ' s' : ''}${e.perSide ? '/Seite' : ''}`

/** Fertiger Text für die Zwischenablage (zum Einfügen in einen Chat) */
export function buildSummary(
  plan: Plan,
  sessions: Session[],
  bodyweights: BwEntry[],
  report: CycleReport | null,
  startDate: string,
): string {
  const L: string[] = []
  L.push(`TRAININGSZUSAMMENFASSUNG – ${plan.name} (v${plan.version})`)
  L.push(`Zyklusstart: ${startDate} · Einheiten absolviert: ${sessions.filter((s) => s.finished).length}`)
  L.push('')
  L.push('AKTUELLER PLAN')
  for (const d of ['A', 'B'] as DayId[]) {
    L.push(d === 'A' ? 'Gym A (Montag):' : 'Gym B (Freitag):')
    for (const e of plan.days[d]) L.push(`- ${e.name} ${rangeText(e)}${e.rest ? `, Pause ${e.rest} s` : ''}`)
  }
  L.push('')
  L.push('LEISTUNGSVERLAUF (letzte Einheit je Übung, RIR = niedrigster Satz)')
  const done = sessions.filter((s) => s.finished).sort((a, b) => a.date.localeCompare(b.date))
  for (const d of ['A', 'B'] as DayId[]) {
    for (const e of plan.days[d]) {
      const logs = done.flatMap((s) => s.entries.filter((x) => x.pid === e.pid && doneSets(x.sets).length))
      if (!logs.length) continue
      const first = logs[0]
      const last = logs[logs.length - 1]
      L.push(`- ${e.name}: ${describeSets(first.sets, e.unit)} → ${describeSets(last.sets, e.unit)} (${logs.length} Einheiten)`)
    }
  }
  const rirs = done.flatMap((s) => s.entries.flatMap((e) => doneSets(e.sets).map((x) => x.rir)))
  if (rirs.length) L.push(`Durchschnittlicher RIR aller Sätze: ${fmt(rirs.reduce((a, b) => a + b, 0) / rirs.length)}`)
  L.push('')
  L.push('KÖRPERGEWICHT (Wochenschnitte, Ziel ' + (report?.goal ?? 80) + ' kg)')
  const w = weeklyAverages(bodyweights).slice(-CYCLE_WEEKS)
  L.push(w.length ? w.map((x) => `${x.weekStart}: ${fmt(x.avg)} kg`).join(' · ') : 'Keine Einträge')
  L.push('')
  L.push('BESCHWERDEN (Maximum pro Bereich, Skala 0–10)')
  const c = report?.maxComplaints ?? done.reduce(
    (m, s) => ({
      hamstring: Math.max(m.hamstring, s.complaints.hamstring), groin: Math.max(m.groin, s.complaints.groin),
      knee: Math.max(m.knee, s.complaints.knee), other: Math.max(m.other, s.complaints.other),
    }),
    { hamstring: 0, groin: 0, knee: 0, other: 0 },
  )
  L.push(`Oberschenkelrückseite ${c.hamstring} · Leiste ${c.groin} · Knie ${c.knee} · Sonstiges ${c.other}`)
  if (report) {
    L.push('')
    L.push(`WOCHENTYPEN: normal ${report.weeks.normal} · ohne Spiel ${report.weeks.noGame} · englisch ${report.weeks.english}`)
    const st = report.stats.filter((s) => s.stagnant).map((s) => s.name)
    L.push(`Stagnation: ${st.length ? st.join(', ') : 'keine'}`)
  }
  const notes = done.filter((s) => s.notes.trim()).slice(-5)
  if (notes.length) {
    L.push('')
    L.push('NOTIZEN')
    for (const s of notes) L.push(`- ${s.date} (Gym ${s.day}): ${s.notes.trim()}`)
  }
  return L.join('\n')
}
