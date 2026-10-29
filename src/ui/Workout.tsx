import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, finishSession, historyByPid } from '../data/db'
import { blockInfo } from '../logic/periodization'
import { describeSets, doneSets, explosiveStats, fmt } from '../logic/progression'
import type { ExerciseLog, Prescribed, Session, SetLog } from '../logic/types'
import { ExerciseSheet } from './ExerciseSheet'
import { RestTimer, Stepper, go, unlockAudio, useWakeLock, type TimerState } from './common'

const COMPLAINT_FIELDS = [
  ['hamstring', 'Oberschenkelrückseite'],
  ['groin', 'Leiste'],
  ['knee', 'Knie'],
  ['other', 'Sonstiges'],
] as const

export function Workout({ id }: { id: number }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const plan = useLiveQuery(async () => (session ? db.plans.get(session.planId) : undefined), [session?.planId])
  const [hist, setHist] = useState<Record<string, ExerciseLog[]>>({})
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [showWarm, setShowWarm] = useState(true)
  const [msgs, setMsgs] = useState<string[] | null>(null)
  const sref = useRef<Session | undefined>(undefined)
  const pending = useRef(0)
  if (pending.current === 0) sref.current = session
  useWakeLock(!!session && !session.finished)

  useEffect(() => {
    void historyByPid().then(setHist)
  }, [id])

  const update = (fn: (s: Session) => void) => {
    const cur = sref.current
    if (!cur) return
    const next = structuredClone(cur)
    fn(next)
    sref.current = next
    pending.current++
    void db.sessions.put(next).finally(() => { pending.current-- })
  }

  if (session === undefined) return <p className="muted">Lade …</p>
  if (!session) return <p>Einheit nicht gefunden. <a href="#/">Zurück</a></p>

  const blk = blockInfo(session.block)
  const rx = (pid: string) => session.prescription.find((p) => p.pid === pid)!

  return (
    <>
      <div className="row spread">
        <h1>Gym {session.day} · {session.date.split('-').reverse().join('.')}</h1>
        <button className="btn sm" onClick={() => go('/')}>‹ Zurück</button>
      </div>
      <p className="muted">
        Woche {session.week} · {blk.label} · Ziel-RIR {blk.rirText}
        {session.weekType !== 'normal' && ` · ${session.weekType === 'noGame' ? 'ohne Spiel' : 'englische Woche'}`}
        {session.heavyLegs && ' · Beine schwer'}
        {session.finished && ' · abgeschlossen'}
      </p>

      <div className="card">
        <div className="row spread" onClick={() => setShowWarm(!showWarm)}>
          <h3>Aufwärmen ({session.warmupDone.length}/{plan?.warmup.length ?? 0})</h3>
          <span className="muted">{showWarm ? '▲' : '▼'}</span>
        </div>
        {showWarm && plan?.warmup.map((w) => (
          <label key={w.id} className="check" style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
            <input
              type="checkbox"
              checked={session.warmupDone.includes(w.id)}
              onChange={(e) => update((s) => {
                s.warmupDone = e.target.checked ? [...s.warmupDone, w.id] : s.warmupDone.filter((x) => x !== w.id)
              })}
            />
            <span>{w.text}</span>
          </label>
        ))}
      </div>

      {session.entries.map((entry, ei) => {
        const p = rx(entry.pid)
        return (
          <ExerciseCard
            key={entry.pid}
            p={p}
            entry={entry}
            last={hist[entry.pid]}
            block={session.block}
            disabled={false}
            onOpen={() => setOpen(entry.exId)}
            onSet={(j, patch) => {
              update((s) => {
                const e = s.entries[ei]
                while (e.sets.length <= j) {
                  const prev = e.sets[e.sets.length - 1]
                  e.sets.push({ weight: prev?.weight ?? p.weight, reps: prev?.reps ?? p.reps, rir: prev?.rir ?? Math.ceil(p.targetRir), done: false })
                }
                const wasDone = e.sets[j].done
                e.sets[j] = { ...e.sets[j], ...patch }
                if (patch.done && !wasDone) {
                  const last = ei === s.entries.length - 1 && j >= p.sets - 1
                  if (!last) setTimer({ endsAt: Date.now() + p.rest * 1000, total: p.rest, label: p.name })
                }
              })
              if (patch.done) unlockAudio()
            }}
          />
        )
      })}

      <div className="card">
        <h3>Beschwerden</h3>
        <p className="muted small">Skala 0–10. Bei Oberschenkelrückseite ≥ 3 geht die Nordic-Stufe zurück.</p>
        {COMPLAINT_FIELDS.map(([k, label]) => (
          <div key={k} style={{ marginTop: 8 }}>
            <div className="row spread"><span>{label}</span><b>{session.complaints[k]}</b></div>
            <input
              type="range" min={0} max={10} step={1} value={session.complaints[k]} style={{ width: '100%', accentColor: session.complaints[k] >= 3 ? '#ff6b6b' : '#35d07f' }}
              onChange={(e) => update((s) => { s.complaints[k] = Number(e.target.value) })}
            />
          </div>
        ))}
        {session.complaints.other > 0 && (
          <input type="text" placeholder="Was genau?" value={session.complaints.otherText} onChange={(e) => update((s) => { s.complaints.otherText = e.target.value })} />
        )}
        {session.complaints.hamstring >= 3 && <div className="banner">Beschwerden Oberschenkelrückseite – Bei anhaltenden Beschwerden Physio aufsuchen.</div>}
      </div>

      <div className="card">
        <h3>Notizen</h3>
        <textarea value={session.notes} placeholder="Wie lief's? Technik, Gefühl, Besonderheiten …" onChange={(e) => update((s) => { s.notes = e.target.value })} />
      </div>

      {msgs ? (
        <div className="banner ok">
          <b>Einheit gespeichert.</b>
          {msgs.map((m, i) => <div key={i}>{m}</div>)}
          <button className="btn primary block" style={{ marginTop: 8 }} onClick={() => go('/')}>Fertig</button>
        </div>
      ) : (
        <button
          className="btn primary block"
          onClick={async () => {
            const cur = sref.current!
            if (!doneSets(cur.entries.flatMap((e) => e.sets)).length && !confirm('Keine Sätze geloggt. Trotzdem abschließen?')) return
            setMsgs(await finishSession(cur))
            setTimer(null)
          }}
        >
          {session.finished ? 'Änderungen speichern' : 'Einheit abschließen'}
        </button>
      )}
      <button className="btn danger block" style={{ marginTop: 10 }} onClick={async () => {
        if (confirm('Diese Einheit wirklich löschen?')) {
          await db.sessions.delete(id)
          go('/')
        }
      }}>Einheit löschen</button>

      <RestTimer timer={timer} onChange={setTimer} />
      {open && <ExerciseSheet exId={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function ExerciseCard({ p, entry, last, block, onOpen, onSet }: {
  p: Prescribed; entry: ExerciseLog; last?: ExerciseLog[]; block: string; disabled: boolean
  onOpen: () => void; onSet: (j: number, patch: Partial<SetLog>) => void
}) {
  const rows = Math.max(p.sets, entry.sets.length)
  const unitW = p.unit === 'cm' ? 'cm' : 'kg'
  const showW = p.kind === 'weight' || (p.kind === 'explosive')
  const showRir = p.kind === 'weight' || p.kind === 'nordic'
  const prev = useMemo(() => [...(last ?? [])].reverse().find((l) => doneSets(l.sets).length), [last])
  const stats = useMemo(() => (p.kind === 'explosive' ? explosiveStats(last ?? []) : null), [last, p.kind])
  const range = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`
  const repLabel = p.unit === 's' ? 'Sek.' : 'Wdh.'
  const trend = { up: '↗︎ steigend', flat: '→ stabil', down: '↘︎ fallend', none: '' }

  return (
    <div className="card">
      <div className="row spread" onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div className="grow">
          <h3>{p.name}{p.extra ? ' (Zusatz)' : ''}</h3>
          <div className="muted small">
            {p.sets} × {range}{p.unit === 's' ? ' s' : ''}{p.perSide ? ' / Seite' : ''}
            {p.rpe ? ` · RPE ${fmt(p.rpe)}` : ''} · Pause {p.rest} s · Ziel-RIR {fmt(p.targetRir)}
          </div>
        </div>
        <span className="badge">Demo ▸</span>
      </div>
      {p.variant && <div className="hint">Variante: {p.variant}</div>}
      <div className="reason">{p.reason}</div>
      {p.hints.map((h, i) => <div className="hint" key={i}>{h}</div>)}
      {prev && p.kind !== 'explosive' && <div className="muted small" style={{ marginTop: 4 }}>Zuletzt ({prev.block === block ? 'gleicher Block' : 'früherer Block'}): {describeSets(prev.sets, p.unit)}</div>}
      {stats && stats.best > 0 && <div className="muted small" style={{ marginTop: 4 }}>Bestwert {fmt(stats.best)} {unitW} · zuletzt {fmt(stats.last)} {unitW} {trend[stats.trend]}</div>}

      {Array.from({ length: rows }, (_, j) => {
        const s = entry.sets[j]
        const prevSet = entry.sets[j - 1]
        const w = s?.weight ?? prevSet?.weight ?? p.weight
        const r = s?.reps ?? prevSet?.reps ?? p.reps
        const rir = s?.rir ?? prevSet?.rir ?? Math.ceil(p.targetRir)
        const done = !!s?.done
        return (
          <div key={j}>
            <div className="setrow">
              <div className="setno">{j + 1}</div>
              {showW ? (
                <Stepper label={unitW} value={w} step={p.inc || (p.unit === 'cm' ? 1 : 2.5)} onChange={(v) => onSet(j, { weight: v })} />
              ) : <div />}
              <Stepper label={repLabel} value={r} step={p.unit === 's' ? 5 : 1} decimals={0} onChange={(v) => onSet(j, { reps: v })} />
              <button className={`donebtn ${done ? 'on' : ''}`} aria-label="Satz erledigt" onClick={() => onSet(j, { done: !done, weight: w, reps: r, rir })}>✓</button>
              {showRir && (
                <div className="rir">
                  <span className="lbl">RIR</span>
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <button key={v} className={rir === v ? 'on' : ''} onClick={() => onSet(j, { rir: v, weight: w, reps: r })}>{v}</button>
                  ))}
                </div>
              )}
            </div>
            {done && p.contrast && block === 'power' && <div className="hint">➜ Kontrast: jetzt 2 Counter-Movement-Jumps</div>}
          </div>
        )
      })}
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => onSet(rows, {})}>+ Satz</button>
    </div>
  )
}
