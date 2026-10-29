import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, savePlanVersion, startNewCycle } from '../data/db'
import { makeDefaultPlan } from '../data/plan'
import { isoDate, parseDate } from '../logic/periodization'
import { fmt } from '../logic/progression'
import { analyzeCycle, applyProposals, proposeNextPlan, validatePlan } from '../logic/review'
import { buildSummary } from '../logic/summary'
import type { WeekType } from '../logic/types'
import { useLibrary } from './useLibrary'
import { Icon } from './icons'
import { copyText, go } from './util'

export function Review() {
  const lib = useLibrary()
  const settings = useLiveQuery(() => db.settings.get('main'))
  const cycles = useLiveQuery(() => db.cycles.toArray()) ?? []
  const [cid, setCid] = useState<number | null>(null)
  const cycleId = cid ?? settings?.cycleId ?? 0
  const data = useLiveQuery(async () => {
    if (!cycleId) return null
    const [sessions, weeks, bw] = await Promise.all([
      db.sessions.where('cycleId').equals(cycleId).toArray(), db.weeks.where('cycleId').equals(cycleId).toArray(), db.bodyweights.toArray(),
    ])
    const cyc = await db.cycles.get(cycleId)
    const plan = (cyc && (await db.plans.get(sessions[0]?.planId ?? cyc.planId))) ?? (await db.plans.get(settings!.activePlanId))
    const active = await db.plans.get(settings!.activePlanId)
    return { sessions, weeks, bw, plan: plan!, active: active!, cyc: cyc! }
  }, [cycleId, settings?.activePlanId])
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
    return isoDate(d)
  })

  const computed = useMemo(() => {
    if (!data || !settings) return null
    const types: WeekType[] = Array.from({ length: 12 }, (_, i) => data.weeks.find((w) => w.week === i + 1)?.type ?? 'normal')
      .slice(0, Math.max(1, new Set(data.sessions.map((s) => s.week)).size ? Math.max(...data.sessions.map((s) => s.week)) : 1))
    const start = data.cyc.startDate
    const bw = data.bw.filter((b) => b.date >= start)
    const report = analyzeCycle(data.plan, data.sessions, bw, types, settings.goalKg)
    const props = proposeNextPlan(report, data.active, lib)
    return { report, props, bw }
  }, [data, settings, lib])

  if (!data || !settings || !computed) return <p className="muted">Lade …</p>
  const { report, props, bw } = computed
  const isCurrent = cycleId === settings.cycleId
  const sel = props.filter((p) => !p.infoOnly && picked[p.id])
  const apply = async (list: typeof props) => {
    const applicable = list.filter((p) => !p.infoOnly)
    const next = applyProposals(data.active, applicable, lib, makeDefaultPlan())
    const issues = validatePlan(next, lib)
    await savePlanVersion(next)
    setMsg(`Neue Planversion gespeichert (${applicable.length} Änderung${applicable.length === 1 ? '' : 'en'}).${issues.length ? ' Hinweis: ' + issues.join(' ') : ''}`)
    setPicked({})
  }

  return (
    <>
      <h1>Zyklus-Auswertung</h1>
      <select value={cycleId} onChange={(e) => setCid(Number(e.target.value))}>
        {cycles.map((c) => <option key={c.id} value={c.id}>Zyklus ab {c.startDate.split('-').reverse().join('.')}{c.id === settings.cycleId ? ' (aktuell)' : ''}</option>)}
      </select>
      <p className="muted">{report.sessionsDone} Einheiten · Wochen: normal {report.weeks.normal}, ohne Spiel {report.weeks.noGame}, englisch {report.weeks.english}</p>

      <h2>Fortschritt pro Übung</h2>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Übung</th><th>Start</th><th>Jetzt</th><th></th></tr></thead>
          <tbody>
            {report.stats.map((s) => (
              <tr key={s.pid}>
                <td>{s.name}</td>
                <td>{s.sessions ? (s.kind === 'weight' ? `${fmt(s.firstE1rm, 0)} kg e1RM` : fmt(s.firstE1rm, 0)) : '–'}</td>
                <td>{s.sessions ? (s.kind === 'weight' ? `${fmt(s.lastE1rm, 0)} kg e1RM` : fmt(s.lastE1rm, 0)) : '–'}</td>
                <td>{s.stagnant ? <span className="badge warn">Stagnation</span> : s.good ? <span className="badge ok">↗︎</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">e1RM nach Epley (Einheiten ohne bewusste Reduktion). Bei Sprung- und Haltewerten: Bestwert.</p>
      </div>

      <h2>Körpergewicht & Beschwerden</h2>
      <div className="card">
        <p>{report.bodyFirst ? `Wochenschnitt ${fmt(report.bodyFirst)} → ${fmt(report.bodyLast ?? 0)} kg (Ziel ${fmt(report.goal)} kg)` : 'Keine Körpergewichtsdaten in diesem Zyklus.'} · {bw.length} Einträge</p>
        <p>Beschwerden max.: Oberschenkelrückseite {report.maxComplaints.hamstring} · Leiste {report.maxComplaints.groin} · Knie {report.maxComplaints.knee} · Sonstiges {report.maxComplaints.other}</p>
      </div>

      <h2>Vorschläge für den nächsten Zyklus</h2>
      <p className="muted small">Regelbasiert, ohne KI. Nichts wird ohne deine Bestätigung geändert. Feste Regeln (Gym nur Mo/Fr, Freitag ohne exzentrisch schwere Beinübungen, Nordics + Copenhagen bleiben) werden immer eingehalten.</p>
      {!props.length && <div className="banner info">Keine Änderungen nötig – Plan beibehalten.</div>}
      {props.map((p) => (
        <div className="card" key={p.id}>
          <div className="row spread">
            <b>{p.title}</b>
            {!p.infoOnly && <input type="checkbox" style={{ width: 26, height: 26, accentColor: 'var(--accent)' }} checked={!!picked[p.id]} onChange={(e) => setPicked({ ...picked, [p.id]: e.target.checked })} aria-label="übernehmen" />}
          </div>
          <div className="diff"><div><div className="muted small">Vorher</div>{p.before}</div><div className="after"><div className="muted small">Nachher</div>{p.after}</div></div>
          <div className="reason">{p.reason}</div>
        </div>
      ))}
      {props.some((p) => !p.infoOnly) && (
        <div className="row">
          <button className="btn primary grow" disabled={!sel.length} onClick={() => apply(sel)}>Ausgewählte übernehmen ({sel.length})</button>
          <button className="btn grow" onClick={() => confirm('Alle Vorschläge übernehmen?') && apply(props)}>Alle übernehmen</button>
        </div>
      )}
      {msg && <div className="banner ok">{msg}<div><button className="btn sm" style={{ marginTop: 6 }} onClick={() => go('/plan')}>Plan ansehen</button></div></div>}

      <h2>Zusammenfassung</h2>
      <button className="btn block" onClick={async () => {
        const text = buildSummary(data.active, data.sessions, bw, report, data.cyc.startDate)
        setMsg((await copyText(text)) ? 'Zusammenfassung in die Zwischenablage kopiert.' : 'Kopieren nicht möglich.')
      }}><Icon name="copy" /> Zusammenfassung kopieren</button>

      {isCurrent && (
        <>
          <h2>Neuer Zyklus</h2>
          <div className="card">
            <p className="muted small">Startet bei Woche 1 mit dem aktiven Plan. Startgewichte werden aus dem letzten e1RM berechnet.</p>
            <label>Startdatum (am besten ein Montag)</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <button className="btn primary block" style={{ marginTop: 10 }} disabled={!parseDate(startDate)} onClick={async () => {
              if (!confirm('Neuen 12-Wochen-Zyklus starten?')) return
              await startNewCycle(startDate)
              go('/')
            }}>Neuen Zyklus starten</button>
          </div>
        </>
      )}
    </>
  )
}
