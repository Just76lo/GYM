import { useState } from 'react'
import { activeSessionFor, createRun, createSession, db, setDayKind, today } from '../data/db'
import { KCAL_HINT, noGainTwoWeeks } from '../logic/bodyweight'
import {
  BLOCKS, CYCLE_WEEKS, WINTER_BLOCKS, WINTER_WEEKS, blockForWeek, parseDate, weekOfCycle, winterBlockForWeek, winterWeekOf,
} from '../logic/periodization'
import {
  GYM_ROTATION, gymDayOf, gymKindOf, gymWarnings, kindLabel, mdInfo, nextDueGym, type DayKind,
} from '../logic/schedule'
import type { DayId, Phase } from '../logic/types'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from './icons'
import { go, unlockAudio } from './util'
import { useSchedule } from './useSchedule'
import { WeekPlan } from './WeekPlan'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'season', label: 'Saison' },
  { id: 'winter', label: 'Winterpause' },
]

const DAY_TEXT: Partial<Record<DayKind, string>> = {
  football: 'Mannschaftstraining. Heute kein Gym.',
  recovery: 'Regeneration: locker bewegen, mobilisieren, schlafen.',
  rest: 'Pause oder leichte Aktivierung.',
  game: 'Spieltag – viel Erfolg!',
}

export function Today() {
  const state = useSchedule()
  const bw = useLiveQuery(() => db.bodyweights.toArray()) ?? []
  const [heavy, setHeavy] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!state) return <p className="muted">Lade …</p>

  const { settings, getKind, sessions, runs } = state
  const phase = settings.phase
  const t = today()
  const kind = getKind(t)
  const gymDay = gymDayOf(kind)

  // Season: 12-Wochen-Zyklus, Winterpause: 9 Wochen ab Startdatum
  const cycleWeek = weekOfCycle(settings.startDate, t)
  const cycleClamped = Math.min(CYCLE_WEEKS, Math.max(1, cycleWeek))
  const seasonBlock = blockForWeek(cycleClamped)
  const winterWeek = winterWeekOf(settings.winterStart, t)
  const winterBlock = winterBlockForWeek(winterWeek)
  const finishedCycle = phase === 'season' && cycleWeek > CYCLE_WEEKS
  const notStarted = phase === 'season' ? cycleWeek < 1 : winterWeek < 1
  const winterOver = phase === 'winter' && winterWeek > WINTER_WEEKS
  // Saison-Nutzer: Winterpause hat begonnen
  const winterRunning = phase === 'season' && winterWeek >= 1 && winterWeek <= WINTER_WEEKS

  const setPhase = (p: Phase) => {
    // Die Winterpause beginnt erst am Startdatum: früheres Umschalten nur nach Bestätigung
    if (p === 'winter' && t < settings.winterStart && !confirm(`Die Winterpause beginnt erst am ${parseDate(settings.winterStart).toLocaleDateString('de-DE')}. Trotzdem schon wechseln?`)) return
    return db.settings.update('main', { phase: p })
  }
  const sessionToday = (day: DayId) => sessions.find((s) => s.cycleId === settings.cycleId && s.date === t && s.day === day)
  const runToday = runs.find((r) => r.date === t)
  const startLabel = (day: DayId) => {
    const ex = sessionToday(day)
    return ex ? (ex.finished ? 'Einheit ansehen' : 'Einheit fortsetzen') : `Gym ${day} starten`
  }
  const warningsToday = gymWarnings(t, getKind)
  const suggestion = nextDueGym(phase, sessions.filter((s) => s.finished))
  const md = mdInfo(t, getKind).label

  const start = async (day: DayId) => {
    if (busy) return
    const existing = await activeSessionFor(settings.cycleId, t, day)
    if (existing) return go(`/workout/${existing.id}`)
    const w = gymWarnings(t, getKind)
    // Warnungen sind nur Hinweise: einmal bestätigen, dann geht es weiter
    if (w.length && !confirm(`${w.join('\n\n')}\n\nTrotzdem trainieren?`)) return
    setBusy(true)
    unlockAudio()
    try {
      const s = await createSession({ date: t, day, heavyLegs: phase === 'season' && day === 'A' && heavy })
      go(`/workout/${s.id}`)
    } finally {
      setBusy(false)
    }
  }

  /** „Heute trainieren“: nächste fällige Einheit eintragen und starten */
  const trainToday = async () => {
    await setDayKind(t, gymKindOf(suggestion))
    // Warnungen kommen aus dem neu eingetragenen Tag; getKind kennt ihn erst nach dem Neuladen
    const ex = await activeSessionFor(settings.cycleId, t, suggestion)
    if (ex) return go(`/workout/${ex.id}`)
    const next = (d: string) => (d === t ? gymKindOf(suggestion) : getKind(d))
    const w = gymWarnings(t, next)
    if (w.length && !confirm(`${w.join('\n\n')}\n\nTrotzdem trainieren?`)) return
    setBusy(true)
    unlockAudio()
    try {
      const s = await createSession({ date: t, day: suggestion, heavyLegs: false })
      go(`/workout/${s.id}`)
    } finally {
      setBusy(false)
    }
  }

  const startRun = async () => {
    const r = await createRun(t, kind === 'runSprint' ? 'sprints' : 'easy')
    go(`/run/${r.id}`)
  }

  const showKcal = noGainTwoWeeks(bw, settings.goalKg)
  const blocked = busy || finishedCycle || notStarted

  return (
    <>
      <h1>Heute</h1>
      <p className="muted">{parseDate(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}{md ? ` · ${md}` : ''}</p>

      <div className="chips" style={{ marginBottom: 8 }} role="group" aria-label="Phase">
        {PHASES.map((p) => (
          <button key={p.id} className={`chip ${phase === p.id ? 'on' : ''}`} aria-pressed={phase === p.id} onClick={() => void setPhase(p.id)}>{p.label}</button>
        ))}
      </div>

      {winterRunning && (
        <div className="banner info">
          Die Winterpause hat begonnen (Woche {winterWeek} von {WINTER_WEEKS}).
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => void setPhase('winter')}>Zur Winterpause wechseln</button></div>
        </div>
      )}
      {winterOver && (
        <div className="banner info">
          Mannschaftstraining startet? In Phase Saison wechseln.
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => void setPhase('season')}>Zu Saison wechseln</button></div>
        </div>
      )}

      {phase === 'winter' ? (
        notStarted ? (
          <div className="banner info">Die Winterpause beginnt am {parseDate(settings.winterStart).toLocaleDateString('de-DE')} (unter „Mehr“ änderbar).</div>
        ) : !winterOver && (
          <div className="card">
            <div className="row spread">
              <div><b>Winterpause · Woche {winterWeek} von {WINTER_WEEKS}</b><div className="muted small">{winterBlock.label} · Ziel-RIR {winterBlock.rirText}</div></div>
              <span className="badge ok">{winterBlock.label}</span>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 3 }}>
              {WINTER_BLOCKS.map((b) => (
                <div key={b.id} style={{ flex: b.weeks[1] - b.weeks[0] + 1, height: 6, borderRadius: 3, background: b.id === winterBlock.id ? 'var(--accent)' : 'var(--line)' }} />
              ))}
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {winterBlock.id === 'wbuild' && 'Obere Wiederholungsbereiche, Ziel-RIR 2.'}
              {winterBlock.id === 'wlight' && 'Leichte Woche: Sätze halbiert, Ziel-RIR 4. Ausgelassene Einheiten sind kein Rückschritt.'}
              {winterBlock.id === 'wstrength' && 'Kreuzheben, Kniebeuge und Bankdrücken mit 4–5 Wdh, Ziel-RIR 1–2.'}
              {winterBlock.id === 'wtrans' && 'Übergang: 1 Satz weniger pro Übung, Ziel-RIR 3.'}
            </p>
          </div>
        )
      ) : finishedCycle ? (
        <div className="banner ok">
          Zyklus abgeschlossen (12 Wochen). Werte ihn aus und starte einen neuen Zyklus.
          <div style={{ marginTop: 8 }}><button className="btn primary" onClick={() => go('/review')}>Zyklus-Auswertung</button></div>
        </div>
      ) : notStarted ? (
        <div className="banner info">Der Zyklus beginnt am {parseDate(settings.startDate).toLocaleDateString('de-DE')} (Startdatum unter „Mehr“ änderbar).</div>
      ) : (
        <div className="card">
          <div className="row spread">
            <div><b>Woche {cycleWeek} von {CYCLE_WEEKS}</b><div className="muted small">Block: {seasonBlock.label} · Ziel-RIR {seasonBlock.rirText}</div></div>
            <span className="badge ok">{seasonBlock.label}</span>
          </div>
          <div className="row" style={{ marginTop: 8, gap: 3 }}>
            {BLOCKS.map((b) => (
              <div key={b.id} style={{ flex: b.weeks[1] - b.weeks[0] + 1, height: 6, borderRadius: 3, background: b.id === seasonBlock.id ? 'var(--accent)' : 'var(--line)' }} />
            ))}
          </div>
        </div>
      )}

      <div className="card hl">
        <div className="muted small">Heute geplant</div>
        <h3>{kindLabel(kind)}</h3>
        {gymDay ? (
          <>
            {warningsToday.map((w) => <div className="hint" key={w}><Icon name="alert" size={14} /> {w}</div>)}
            {phase === 'season' && gymDay === 'A' && !sessionToday('A') && (
              <label className="check">
                <input type="checkbox" checked={heavy} onChange={(e) => setHeavy(e.target.checked)} />
                <span>90 min gespielt / Beine schwer<br /><span className="muted small">Beine: RPE 6, 1 Satz weniger</span></span>
              </label>
            )}
            <button className="btn primary block" disabled={blocked} onClick={() => void start(gymDay)}>{startLabel(gymDay)}</button>
          </>
        ) : kind === 'runSprint' || kind === 'runEasy' ? (
          <>
            <p className="muted">
              {kind === 'runSprint' ? 'Sprints 6–8 × 20–30 m mit voller Pause, dann 4 × 4 min zügig mit 3 min locker.' : 'Lockeres Laufen, 20–30 min.'}
            </p>
            <button className="btn primary block" onClick={() => void startRun()}>
              {runToday ? (runToday.finished ? 'Lauf ansehen' : 'Lauf fortsetzen') : 'Lauf starten'}
            </button>
          </>
        ) : (
          <p className="muted">{DAY_TEXT[kind]}</p>
        )}
      </div>

      <div className="card">
        <div className="row spread">
          <div>
            <b>Heute trainieren</b>
            <div className="muted small">
              Fällig: Gym {suggestion} (Reihenfolge {GYM_ROTATION[phase].join(' → ')}). Wird für heute eingetragen.
            </div>
          </div>
          <button className="btn sm primary" disabled={blocked} onClick={() => void trainToday()}>Gym {suggestion}</button>
        </div>
        {!gymDay && (
          <div className="row wrap" style={{ marginTop: 8 }}>
            {GYM_ROTATION[phase].filter((d) => d !== suggestion).map((d) => (
              <button key={d} className="btn sm" disabled={blocked} onClick={() => void start(d)}>Gym {d} nachholen</button>
            ))}
          </div>
        )}
      </div>

      <WeekPlan state={state} today={t} />

      {showKcal && <div className="banner" style={{ marginTop: 12 }}>{KCAL_HINT}</div>}
    </>
  )
}
