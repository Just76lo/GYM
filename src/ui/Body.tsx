import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, today } from '../data/db'
import { KCAL_HINT, noGainTwoWeeks, weeklyAverages } from '../logic/bodyweight'
import { fmt } from '../logic/progression'
import { Stepper } from './common'
import { Icon } from './icons'

export function Body() {
  const entries = (useLiveQuery(() => db.bodyweights.toArray()) ?? []).sort((a, b) => a.date.localeCompare(b.date))
  const settings = useLiveQuery(() => db.settings.get('main'))
  const goal = settings?.goalKg ?? 80
  const [date, setDate] = useState(today())
  const last = entries[entries.length - 1]
  const [kg, setKg] = useState<number | null>(null)
  const val = kg ?? last?.kg ?? 70
  const avgs = weeklyAverages(entries)
  const cur = avgs[avgs.length - 1]
  const data = avgs.map((a) => ({ x: a.weekStart.slice(5).split('-').reverse().join('.'), y: Math.round(a.avg * 10) / 10 }))

  return (
    <>
      <h1>Körpergewicht</h1>
      <p className="muted">Ziel: {fmt(goal)} kg{cur ? ` · aktueller Wochenschnitt ${fmt(cur.avg)} kg (noch ${fmt(Math.max(0, goal - cur.avg))} kg)` : ''}</p>
      {noGainTwoWeeks(entries, goal) && <div className="banner">{KCAL_HINT}</div>}

      <div className="card">
        <label>Datum</label>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <Stepper label="Gewicht (kg)" value={val} step={0.1} min={30} max={200} onChange={setKg} />
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={async () => {
          await db.bodyweights.put({ date, kg: Math.round(val * 10) / 10 })
          setKg(null)
        }}>Speichern</button>
      </div>

      <h2>Wochendurchschnitt</h2>
      <div className="card">
        {data.length < 2 ? <p className="muted">Ab 2 Wochen mit Einträgen erscheint der Verlauf.</p> : (
          <div className="chartbox">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: -10, right: 10, top: 8 }}>
                <CartesianGrid stroke="#2b3340" strokeDasharray="3 3" />
                <XAxis dataKey="x" stroke="#98a2b3" fontSize={11} />
                <YAxis stroke="#98a2b3" fontSize={11} domain={[(m: number) => Math.floor(Math.min(m, goal - 1)), (m: number) => Math.ceil(Math.max(m, goal + 1))]} />
                <Tooltip contentStyle={{ background: '#171b22', border: '1px solid #2b3340' }} formatter={(v) => [`${v} kg`, 'Ø Woche']} />
                <ReferenceLine y={goal} stroke="#f5b942" strokeDasharray="5 4" label={{ value: `Ziel ${goal}`, fill: '#f5b942', fontSize: 11 }} />
                <Line type="monotone" dataKey="y" stroke="#5aa9ff" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <h2>Einträge</h2>
      <div className="card">
        {!entries.length && <p className="muted">Noch keine Einträge.</p>}
        {[...entries].reverse().slice(0, 30).map((e) => (
          <div key={e.date} className="list-item row spread">
            <span>{e.date.split('-').reverse().join('.')}</span>
            <b>{fmt(e.kg)} kg</b>
            <button className="iconbtn danger" aria-label="Eintrag löschen" onClick={() => db.bodyweights.delete(e.date)}><Icon name="trash" size={18} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
