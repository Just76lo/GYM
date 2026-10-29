import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { activeSessionFor, createSession, db, setWeekType, today } from '../data/db'
import { KCAL_HINT, noGainTwoWeeks } from '../logic/bodyweight'
import { BLOCKS, CYCLE_WEEKS, WEEK_PLAN, blockForWeek, isoDate, parseDate, weekOfCycle, weekdayIndex } from '../logic/periodization'
import type { DayId, WeekType } from '../logic/types'
import { go, unlockAudio } from './common'

const WT: { id: WeekType; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'noGame', label: 'Ohne Spiel' },
  { id: 'english', label: 'Englische Woche' },
]

export function Today() {
  const settings = useLiveQuery(() => db.settings.get('main'))
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? []
  const bw = useLiveQuery(() => db.bodyweights.toArray()) ?? []
  const wk = useLiveQuery(async () => {
    const s = await db.settings.get('main')
    return s ? db.weeks.where('cycleId').equals(s.cycleId).toArray() : []
  }) ?? []
  const [heavy, setHeavy] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!settings) return <p className="muted">Lade …</p>

  const t = today()
  const week = weekOfCycle(settings.startDate, t)
  const wkClamped = Math.min(CYCLE_WEEKS, Math.max(1, week))
  const block = blockForWeek(wkClamped)
  const weekType = wk.find((w) => w.week === wkClamped)?.type ?? 'normal'
  const idx = weekdayIndex(t)
  const todayPlan = WEEK_PLAN[idx]
  const dayId: DayId | null = idx === 0 ? 'A' : idx === 4 ? 'B' : null
  const finishedCycle = week > CYCLE_WEEKS
  const notStarted = week < 1

  // Datum der Wochentage der aktuellen Kalenderwoche
  const monday = parseDate(t)
  monday.setDate(monday.getDate() - idx)
  const dates = WEEK_PLAN.map((_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return isoDate(d)
  })

  const start = async (day: DayId) => {
    if (busy) return
    setBusy(true)
    unlockAudio()
    try {
      const existing = await activeSessionFor(settings.cycleId, t, day)
      if (existing) return go(`/workout/${existing.id}`)
      const s = await createSession({ date: t, day, heavyLegs: day === 'A' && heavy, weekType })
      go(`/workout/${s.id}`)
    } finally {
      setBusy(false)
    }
  }
  const existingToday = (day: DayId) => sessions.find((s) => s.cycleId === settings.cycleId && s.date === t && s.day === day)
  const btn = (day: DayId) => {
    const ex = existingToday(day)
    return ex ? (ex.finished ? 'Einheit ansehen' : 'Einheit fortsetzen') : `Gym ${day} starten`
  }
  const showKcal = noGainTwoWeeks(bw, settings.goalKg)

  return (
    <>
      <h1>Heute</h1>
      <p className="muted">{parseDate(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      {finishedCycle ? (
        <div className="banner ok">
          Zyklus abgeschlossen (12 Wochen). Werte ihn aus und starte einen neuen Zyklus.
          <div style={{ marginTop: 8 }}><button className="btn primary" onClick={() => go('/review')}>Zyklus-Auswertung</button></div>
        </div>
      ) : notStarted ? (
        <div className="banner info">Der Zyklus beginnt am {parseDate(settings.startDate).toLocaleDateString('de-DE')} (Startdatum unter „Mehr“ änderbar).</div>
      ) : (
        <div className="card">
          <div className="row spread">
            <div><b>Woche {week} von {CYCLE_WEEKS}</b><div className="muted small">Block: {block.label} · Ziel-RIR {block.rirText}</div></div>
            <span className="badge ok">{block.label}</span>
          </div>
          <div className="row" style={{ marginTop: 8, gap: 3 }}>
            {BLOCKS.map((b) => (
              <div key={b.id} style={{ flex: b.weeks[1] - b.weeks[0] + 1, height: 6, borderRadius: 3, background: b.id === block.id ? 'var(--accent)' : 'var(--line)' }} />
            ))}
          </div>
        </div>
      )}

      <h2>Wochentyp (Woche {wkClamped})</h2>
      <div className="chips">
        {WT.map((w) => (
          <button key={w.id} className={`chip ${weekType === w.id ? 'on' : ''}`} onClick={() => setWeekType(settings.cycleId, wkClamped, w.id)}>{w.label}</button>
        ))}
      </div>
      <p className="muted small">
        {weekType === 'noGame' && 'Montag +1 Satz Beine, Freitag zusätzlich Rumänisches Kreuzheben 3x6.'}
        {weekType === 'english' && 'Montag Beine nur 2 Sätze RPE 6, Nordics 2x3. Freitag nur Oberkörper, Prävention und 2x3 CMJ.'}
        {weekType === 'normal' && 'Plan unverändert.'}
      </p>

      <div className="card hl">
        <div className="row spread">
          <div>
            <div className="muted small">{todayPlan.label}</div>
            <h3>{todayPlan.title}</h3>
          </div>
        </div>
        {dayId ? (
          <>
            {dayId === 'A' && !existingToday('A') && (
              <label className="check">
                <input type="checkbox" checked={heavy} onChange={(e) => setHeavy(e.target.checked)} />
                <span>90 min gespielt / Beine schwer<br /><span className="muted small">Beine: RPE 6, 1 Satz weniger</span></span>
              </label>
            )}
            <button className="btn primary block" disabled={busy || finishedCycle || notStarted} onClick={() => start(dayId)}>{btn(dayId)}</button>
          </>
        ) : (
          <>
            <p className="muted">
              {todayPlan.kind === 'football' && 'Mannschaftstraining. Heute kein Gym.'}
              {todayPlan.kind === 'recovery' && 'Regeneration: locker bewegen, mobilisieren, schlafen.'}
              {todayPlan.kind === 'rest' && 'Pause oder leichte Aktivierung.'}
              {todayPlan.kind === 'game' && 'Spieltag – viel Erfolg!'}
            </p>
            <div className="row wrap">
              <button className="btn sm" disabled={finishedCycle || notStarted} onClick={() => start('A')}>Gym A nachholen</button>
              <button className="btn sm" disabled={finishedCycle || notStarted} onClick={() => start('B')}>Gym B nachholen</button>
            </div>
          </>
        )}
      </div>

      <h2>Wochenübersicht</h2>
      <div className="week">
        {WEEK_PLAN.map((d, i) => {
          const done = sessions.some((s) => s.date === dates[i] && s.finished)
          return (
            <div key={d.label} className={`day ${i === idx ? 'today' : ''} ${d.kind.startsWith('gym') ? 'gym' : ''} ${done ? 'done' : ''}`}>
              <b>{d.label}</b>
              <span className="muted">{d.title}</span>
              {done && <div>✓</div>}
            </div>
          )
        })}
      </div>

      {showKcal && <div className="banner">{KCAL_HINT}</div>}
    </>
  )
}
