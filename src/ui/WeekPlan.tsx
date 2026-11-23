import { useState } from 'react'
import { applyWeek, resetDay, resetWeek, saveDefaultWeek, setDayKind } from '../data/db'
import { parseDate, weekdayIndex } from '../logic/periodization'
import {
  DAY_KINDS, addDays, gymRules, gymWarnings, isGymKind, isRunKind, kindOn, kindShort, mdInfo, presetsFor, sprintHint, weekDates,
  type DayKind,
} from '../logic/schedule'
import { Sheet } from './common'
import { Icon } from './icons'
import type { ScheduleState } from './useSchedule'

const LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const fmtDay = (d: string) => `${parseDate(d).getDate()}.${parseDate(d).getMonth() + 1}.`

/** Wochenansicht Mo–So: Tag antippen oder per Drag & Drop tauschen, Vorlagen, Standardwoche speichern */
export function WeekPlan({ state, today }: { state: ScheduleState; today: string }) {
  const { settings, sctx, getKind, sessions, runs } = state
  const [offset, setOffset] = useState(0)
  const [pick, setPick] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const dates = weekDates(addDays(today, offset * 7))
  const kinds = dates.map(getKind)
  const phase = settings.phase

  const done = (d: string) => sessions.some((s) => s.date === d && s.finished) || runs.some((r) => r.date === d && r.finished)

  /** Setzt einen Tag; mehr als 4 Gym-Tage nur nach Bestätigung */
  const assign = async (date: string, kind: DayKind) => {
    const gyms = dates.filter((d) => (d === date ? isGymKind(kind) : isGymKind(getKind(d)))).length
    if (isGymKind(kind) && gyms > 4 && !confirm('Mehr als 4 Gym-Tage in einer Woche sind nicht vorgesehen. Trotzdem eintragen?')) return
    await setDayKind(date, kind)
  }
  const swapDays = async (a: number, b: number) => {
    if (a === b) return
    await setDayKind(dates[a], kinds[b])
    await setDayKind(dates[b], kinds[a])
  }

  const warnings = dates.flatMap((d, i) => (isGymKind(kinds[i]) ? gymWarnings(d, getKind).map((w) => `${LABELS[i]}: ${w}`) : []))
  const hint = sprintHint(phase, dates, getKind)
  const isDefault = kinds.every((k, i) => !sctx.overrides.has(dates[i]) && k === kindOn({ ...sctx, overrides: new Map() }, dates[i]))
  const pickIdx = pick ? dates.indexOf(pick) : -1

  return (
    <>
      <div className="row spread" style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>Wochenplan</h2>
        <div className="row">
          <button className="iconbtn" aria-label="Vorherige Woche" onClick={() => setOffset(offset - 1)}><Icon name="back" /></button>
          <button className="btn xs ghost" onClick={() => setOffset(0)}>{fmtDay(dates[0])}–{fmtDay(dates[6])}</button>
          <button className="iconbtn" aria-label="Nächste Woche" onClick={() => setOffset(offset + 1)}><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></button>
        </div>
      </div>
      <div className="week" style={{ marginTop: 8 }}>
        {dates.map((d, i) => {
          const k = kinds[i]
          const md = mdInfo(d, getKind).label
          const edited = sctx.overrides.has(d)
          return (
            <button
              key={d}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom !== null) void swapDays(dragFrom, i); setDragFrom(null) }}
              onDragEnd={() => setDragFrom(null)}
              onClick={() => setPick(d)}
              aria-label={`${LABELS[i]} ${fmtDay(d)}: ${kindShort(k)}`}
              className={`day ${d === today ? 'today' : ''} ${isGymKind(k) ? 'gym' : ''} ${done(d) ? 'done' : ''}`}
              style={{ cursor: 'pointer', opacity: dragFrom === i ? 0.5 : 1 }}
            >
              <b>{LABELS[i]}</b>
              <span>{fmtDay(d)}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{kindShort(k)}</span>
              {md && <span style={{ fontSize: '.55rem' }}>{md}</span>}
              {done(d) ? <Icon name="check" size={14} /> : edited ? <span aria-label="geändert">●</span> : null}
            </button>
          )
        })}
      </div>
      <p className="muted small">Tag antippen oder auf einen anderen Tag ziehen (tauscht beide). ● = diese Woche geändert.</p>

      {hint && <div className="banner"><Icon name="alert" size={16} /> {hint}</div>}
      {warnings.map((w) => <div className="banner info" key={w}>{w}</div>)}

      <div className="chips" style={{ marginTop: 8 }}>
        {presetsFor(phase).map((p) => (
          <button key={p.id} className="chip" onClick={async () => { await applyWeek(dates[0], p.week); setMsg(`Vorlage „${p.label}“ eingetragen.`) }}>{p.label}</button>
        ))}
      </div>
      <div className="row wrap" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={async () => { await saveDefaultWeek(phase, kinds); await resetWeek(dates[0]); setMsg(`Standardwoche für ${phase === 'winter' ? 'Winterpause' : 'Saison'} gespeichert.`) }}>Als Standardwoche speichern</button>
        <button className="btn sm ghost" disabled={isDefault} onClick={async () => { await resetWeek(dates[0]); setMsg('Woche auf Standard zurückgesetzt.') }}>Auf Standard zurücksetzen</button>
      </div>
      {msg && <div className="banner ok" style={{ marginTop: 8 }} onClick={() => setMsg('')}>{msg}</div>}

      {pick && pickIdx >= 0 && (
        <Sheet title={`${LABELS[pickIdx]} ${fmtDay(pick)}`} onClose={() => setPick(null)}>
          <div className="chips">
            {DAY_KINDS.map((k) => (
              <button key={k.id} className={`chip ${kinds[pickIdx] === k.id ? 'on' : ''}`} onClick={async () => { await assign(pick, k.id); setPick(null) }}>{k.label}</button>
            ))}
          </div>
          {sctx.overrides.has(pick) && (
            <button className="btn block ghost" style={{ marginTop: 12 }} onClick={async () => { await resetDay(pick); setPick(null) }}>Auf Standard zurücksetzen</button>
          )}
          {isRunKind(kinds[pickIdx]) && <p className="muted small">Lauf-Vorlage mit Abhaken und Protokoll startest du am Tag selbst unter „Heute“.</p>}
          {(() => {
            const r = gymRules(pick, getKind)
            return r.label ? <p className="muted small">Spielabstand an diesem Tag: {r.label}</p> : null
          })()}
          <p className="muted small">{weekdayIndex(pick) === 3 && phase === 'winter' ? 'Winterpause: ab Woche 5 ist am Donnerstag standardmäßig lockeres Laufen (20–30 min) eingetragen.' : ''}</p>
        </Sheet>
      )}
    </>
  )
}
