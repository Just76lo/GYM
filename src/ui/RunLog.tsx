import { useEffect, useRef, useState } from 'react'
import { RUN_INTERVALS, RUN_SPRINTS, db, type RunRow } from '../data/db'
import { Stepper } from './common'
import { Icon } from './icons'
import { go } from './util'

const TYPES = ['Sprints + Intervalle', 'Lockeres Laufen', 'Tempolauf', 'Sonstiges']

export function RunLog({ id }: { id: number }) {
  const [run, setRun] = useState<RunRow | null | undefined>(undefined)
  const latest = useRef<RunRow | null>(null)
  useEffect(() => {
    void db.runs.get(id).then((r) => { latest.current = r ?? null; setRun(r ?? null) })
  }, [id])
  if (run === undefined) return <p className="muted">Lade …</p>
  if (!run) return <p>Lauf nicht gefunden. <a href="#/">Zurück</a></p>

  /** Ändert den Lauf lokal und speichert sofort */
  const update = (fn: (r: RunRow) => void) => {
    const next = structuredClone(latest.current!)
    fn(next)
    latest.current = next
    setRun(next)
    void db.runs.put(next)
  }
  const toggle = (key: 'sprints' | 'intervals', i: number) => update((r) => { r[key][i] = !r[key][i] })
  const sprintCount = run.sprints.filter(Boolean).length
  const intervalCount = run.intervals.filter(Boolean).length

  return (
    <>
      <div className="pagehead">
        <button className="iconbtn" aria-label="Zurück" onClick={() => go('/')}><Icon name="back" /></button>
        <div className="grow">
          <h1>Laufen</h1>
          <div className="muted small">{run.date.split('-').reverse().join('.')}</div>
        </div>
        {run.finished && <span className="badge ok">abgeschlossen</span>}
      </div>

      {run.template === 'sprints' && (
        <>
          <section className="card">
            <h3>Sprints</h3>
            <p className="muted small">6–8 × 20–30 m mit voller Pause (ca. 1,5–2 min locker gehen). Jeder Sprint maximal, sauber ausgelaufen.</p>
            <div className="chips">
              {run.sprints.map((d, i) => (
                <button key={i} className={`chip ${d ? 'on' : ''}`} aria-pressed={d} onClick={() => toggle('sprints', i)}>{i + 1}</button>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>{sprintCount} von {RUN_SPRINTS} (Ziel 6–8)</p>
          </section>
          <section className="card">
            <h3>Intervalle</h3>
            <p className="muted small">{RUN_INTERVALS} × 4 min zügig, dazwischen 3 min locker traben.</p>
            <div className="chips">
              {run.intervals.map((d, i) => (
                <button key={i} className={`chip ${d ? 'on' : ''}`} aria-pressed={d} onClick={() => toggle('intervals', i)}>{i + 1}</button>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>{intervalCount} von {RUN_INTERVALS}</p>
          </section>
        </>
      )}

      <section className="card">
        <h3>Protokoll</h3>
        <label>Art</label>
        <select value={run.type} onChange={(e) => update((r) => { r.type = e.target.value })}>
          {[...new Set([run.type, ...TYPES])].map((t) => <option key={t}>{t}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Stepper label="Dauer (min)" value={run.minutes} step={5} min={0} max={300} decimals={0} onChange={(v) => update((r) => { r.minutes = v })} />
          <Stepper label="Gefühl (1–10)" value={run.feel} step={1} min={1} max={10} decimals={0} onChange={(v) => update((r) => { r.feel = v })} />
        </div>
        <label style={{ marginTop: 12 }}>Notizen</label>
        <textarea value={run.notes} placeholder="Wie lief es? Beine frisch oder schwer?" onChange={(e) => update((r) => { r.notes = e.target.value })} />
      </section>

      <button className="btn primary block" onClick={() => { update((r) => { r.finished = true }); go('/') }}>
        <Icon name="check" /> {run.finished ? 'Änderungen speichern' : 'Lauf abschließen'}
      </button>
      <button className="btn ghost danger block" style={{ marginTop: 10 }} onClick={async () => {
        if (confirm('Diesen Lauf wirklich löschen?')) { await db.runs.delete(id); go('/') }
      }}><Icon name="trash" size={18} /> Lauf löschen</button>
    </>
  )
}
