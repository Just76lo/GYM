import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../data/db'
import { bestE1rm, describeSets, doneSets, explosiveStats, fmt, volume } from '../logic/progression'
import type { ExerciseLog, Session } from '../logic/types'

type Metric = 'weight' | 'e1rm' | 'volume'

export function Chart({ data, unit, color = '#35d07f' }: { data: { x: string; y: number }[]; unit: string; color?: string }) {
  if (data.length < 2) return <p className="muted">Mindestens 2 Datenpunkte nötig für ein Diagramm.</p>
  return (
    <div className="chartbox">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -10, right: 10, top: 8 }}>
          <CartesianGrid stroke="#2b3340" strokeDasharray="3 3" />
          <XAxis dataKey="x" stroke="#98a2b3" fontSize={11} />
          <YAxis stroke="#98a2b3" fontSize={11} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#171b22', border: '1px solid #2b3340' }} formatter={(v) => [`${fmt(Number(v))} ${unit}`, '']} />
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const short = (d: string) => d.slice(5).split('-').reverse().join('.')

export function History() {
  const sessions = (useLiveQuery(() => db.sessions.toArray()) ?? []).filter((s) => s.finished).sort((a, b) => a.date.localeCompare(b.date))
  const [pid, setPid] = useState<string>('')
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [openSession, setOpenSession] = useState<Session | null>(null)

  const exercises = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of sessions) for (const e of s.entries) if (doneSets(e.sets).length) m.set(e.pid, e.name)
    return [...m.entries()]
  }, [sessions])
  const cur = pid || exercises[0]?.[0] || ''
  const logs: (ExerciseLog & { date: string })[] = sessions.flatMap((s) =>
    s.entries.filter((e) => e.pid === cur && doneSets(e.sets).length).map((e) => ({ ...e, date: s.date })),
  )
  const sample = logs[0]
  const isWeight = sample?.kind === 'weight'
  const unit = sample?.unit ?? 'kg'
  const m: Metric = isWeight ? metric : 'weight'
  const data = logs.map((l) => ({
    x: short(l.date),
    y: m === 'e1rm' ? bestE1rm(l.sets) : m === 'volume' ? volume(l.sets) : Math.max(...doneSets(l.sets).map((s) => (l.kind === 'isometric' || l.kind === 'nordic' ? s.reps : s.weight))),
  }))
  const stats = sample?.kind === 'explosive' ? explosiveStats(logs) : null
  const metricLabel = isWeight ? { weight: 'Gewicht (kg)', e1rm: 'Geschätztes 1RM (kg)', volume: 'Volumen (kg)' }[m] : sample?.kind === 'isometric' ? 'Haltezeit (s)' : sample?.kind === 'nordic' ? 'Wiederholungen' : `Bestwert (${unit})`

  return (
    <>
      <h1>Verlauf</h1>
      {!exercises.length ? (
        <p className="muted">Noch keine abgeschlossenen Einheiten. Nach der ersten Einheit erscheinen hier Diagramme.</p>
      ) : (
        <>
          <select value={cur} onChange={(e) => setPid(e.target.value)}>
            {exercises.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {isWeight && (
            <div className="chips" style={{ marginTop: 10 }}>
              {(['e1rm', 'weight', 'volume'] as Metric[]).map((x) => (
                <button key={x} className={`chip ${metric === x ? 'on' : ''}`} onClick={() => setMetric(x)}>{{ e1rm: '1RM (Epley)', weight: 'Gewicht', volume: 'Volumen' }[x]}</button>
              ))}
            </div>
          )}
          <div className="card">
            <b>{metricLabel}</b>
            <Chart data={data} unit={m === 'weight' && !isWeight ? unit : 'kg'} />
            {stats && <p className="muted">Bestwert {fmt(stats.best)} {unit} · letzter Wert {fmt(stats.last)} {unit} · Trend {({ up: '↗︎ steigend', flat: '→ stabil', down: '↘︎ fallend', none: 'noch offen' })[stats.trend]}</p>}
          </div>
          <h2>Letzte Leistungen</h2>
          <div className="card">
            {[...logs].reverse().slice(0, 12).map((l, i) => (
              <div key={i} className="list-item">
                <div className="row spread"><b>{l.date.split('-').reverse().join('.')}</b>{l.reduced && <span className="badge warn">reduziert</span>}</div>
                <div className="muted small">{describeSets(l.sets, l.unit)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Einheiten</h2>
      <div className="card">
        {!sessions.length && <p className="muted">Noch nichts.</p>}
        {[...sessions].reverse().map((s) => (
          <div key={s.id} className="list-item" onClick={() => setOpenSession(openSession?.id === s.id ? null : s)}>
            <div className="row spread">
              <b>{s.date.split('-').reverse().join('.')} · Gym {s.day}</b>
              <span className="muted small">Woche {s.week} · {s.weekType === 'normal' ? 'normal' : s.weekType === 'noGame' ? 'ohne Spiel' : 'englisch'}</span>
            </div>
            {openSession?.id === s.id && (
              <div className="small" style={{ marginTop: 6 }}>
                {s.entries.filter((e) => doneSets(e.sets).length).map((e) => <div key={e.pid}>{e.name}: <span className="muted">{describeSets(e.sets, e.unit)}</span></div>)}
                {(s.complaints.hamstring || s.complaints.groin || s.complaints.knee || s.complaints.other) > 0 && (
                  <div className="hint">Beschwerden: Hamstring {s.complaints.hamstring} · Leiste {s.complaints.groin} · Knie {s.complaints.knee} · Sonstiges {s.complaints.other}{s.complaints.otherText ? ` (${s.complaints.otherText})` : ''}</div>
                )}
                {s.notes && <div className="muted">„{s.notes}“</div>}
                <button className="btn sm" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); location.hash = `/workout/${s.id}` }}>Bearbeiten</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
