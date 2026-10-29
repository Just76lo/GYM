import { useEffect, useMemo, useRef, useState } from 'react'
import { applyAlternative, basePid, restoreOriginal } from '../data/alternatives'
import { db, finishSession, historyByPid, savePlanVersion, statesMap } from '../data/db'
import { blockInfo } from '../logic/periodization'
import { describeSets, doneSets, explosiveStats, fmt } from '../logic/progression'
import { RDL_EXTRA, prescribeOne } from '../logic/session'
import type { ExerciseLog, Plan, PlanExercise, Prescribed, Session, SetLog } from '../logic/types'
import { AltSheet, type AltChoice } from './AltSheet'
import { ExerciseSheet } from './ExerciseSheet'
import { RestTimer, Stepper } from './common'
import { Icon } from './icons'
import { go, unlockAudio, useWakeLock, type TimerState } from './util'

const COMPLAINT_FIELDS = [
  ['hamstring', 'Oberschenkelrückseite'],
  ['groin', 'Leiste'],
  ['knee', 'Knie'],
  ['other', 'Sonstiges'],
] as const

const toLog = (p: Prescribed, s: Session): ExerciseLog => ({
  pid: p.pid, exId: p.exId, name: p.name, kind: p.kind, unit: p.unit, repMin: p.repMin, repMax: p.repMax,
  targetReps: p.reps, targetWeight: p.weight, reduced: p.reduced, block: s.block, variant: p.variant, sets: [],
})

/** Planübung, aus der ein Eintrag der Einheit entstanden ist */
const planExerciseFor = (plan: Plan, s: Session, pid: string): PlanExercise | undefined =>
  basePid(pid) === RDL_EXTRA.pid ? RDL_EXTRA : plan.days[s.day].find((e) => basePid(e.pid) === basePid(pid))

export function Workout({ id }: { id: number }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [plan, setPlan] = useState<Plan>()
  const [hist, setHist] = useState<Record<string, ExerciseLog[]>>({})
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [demo, setDemo] = useState<string | null>(null)
  const [swapIdx, setSwapIdx] = useState<number | null>(null)
  const [showWarm, setShowWarm] = useState(true)
  const [msgs, setMsgs] = useState<string[] | null>(null)
  const latest = useRef<Session | null>(null)
  useWakeLock(!!session && !session.finished)

  useEffect(() => {
    let alive = true
    void (async () => {
      const s = (await db.sessions.get(id)) ?? null
      const [p, h] = await Promise.all([s ? db.plans.get(s.planId) : undefined, historyByPid()])
      if (!alive) return
      latest.current = s
      setSession(s)
      setPlan(p)
      setHist(h)
      if (s && s.warmupDone.length === (p?.warmup.length ?? 0) && s.warmupDone.length) setShowWarm(false)
    })()
    return () => { alive = false }
  }, [id])

  /** Ändert die Einheit lokal und speichert sie sofort (kein Datenverlust beim Neuladen). */
  const update = (fn: (s: Session) => void) => {
    if (!latest.current) return
    const next = structuredClone(latest.current)
    fn(next)
    latest.current = next
    setSession(next)
    void db.sessions.put(next)
  }

  if (session === undefined) return <p className="muted">Lade …</p>
  if (!session) return <p>Einheit nicht gefunden. <a href="#/">Zurück</a></p>

  const blk = blockInfo(session.block)
  const rx = (pid: string) => session.prescription.find((p) => p.pid === pid)!

  const swap = async (i: number, { alt, permanent }: AltChoice) => {
    const s = latest.current!
    const entry = s.entries[i]
    if (!plan) return
    const base = planExerciseFor(plan, s, entry.pid)
    if (!base) return
    if (doneSets(entry.sets).length && !confirm('Für diese Übung sind schon Sätze geloggt. Trotzdem tauschen?')) return
    const next = alt ? applyAlternative(base, alt) : restoreOriginal(base)
    const p = prescribeOne(next, {
      day: s.day, block: s.block, weekType: s.weekType, heavyLegs: s.heavyLegs, history: hist,
      states: await statesMap(), noExtraLegSet: plan.flags?.noExtraLegSet,
    }, base.pid === RDL_EXTRA.pid)
    if (!p) return
    update((x) => {
      x.prescription[i] = p
      x.entries[i] = toLog(p, x)
    })
    if (permanent && base.pid !== RDL_EXTRA.pid) {
      const np = structuredClone(plan)
      np.days[s.day] = np.days[s.day].map((e) => (e.pid === base.pid ? next : e))
      const planId = await savePlanVersion(np)
      setPlan({ ...np, id: planId, version: np.version + 1 })
    }
    setSwapIdx(null)
  }

  const swapEx = swapIdx !== null && plan ? planExerciseFor(plan, session, session.entries[swapIdx].pid) : undefined
  // Für die Anzeige: der aktuelle Stand dieser Einheit (evtl. nur heute getauscht)
  const swapShown = swapEx && swapIdx !== null
    ? (session.entries[swapIdx].exId === swapEx.exId ? swapEx : { ...swapEx, exId: session.entries[swapIdx].exId, orig: swapEx.orig ?? restoreOriginal(swapEx) })
    : undefined

  return (
    <>
      <div className="pagehead">
        <button className="iconbtn" aria-label="Zurück" onClick={() => go('/')}><Icon name="back" /></button>
        <div className="grow">
          <h1>Gym {session.day}</h1>
          <div className="muted small">
            {session.date.split('-').reverse().join('.')} · Woche {session.week} · {blk.label} · Ziel-RIR {blk.rirText}
          </div>
        </div>
        {session.finished && <span className="badge ok">abgeschlossen</span>}
      </div>
      {(session.weekType !== 'normal' || session.heavyLegs) && (
        <div className="chips" style={{ marginBottom: 6 }}>
          {session.weekType === 'noGame' && <span className="badge">Woche ohne Spiel</span>}
          {session.weekType === 'english' && <span className="badge warn">Englische Woche</span>}
          {session.heavyLegs && <span className="badge warn">Beine schwer</span>}
        </div>
      )}

      <section className="card">
        <button className="rowbtn" onClick={() => setShowWarm(!showWarm)}>
          <h3>Aufwärmen</h3>
          <span className="muted small">{session.warmupDone.length}/{plan?.warmup.length ?? 0}</span>
          <Icon name={showWarm ? 'up' : 'down'} size={18} />
        </button>
        {showWarm && plan?.warmup.map((w) => (
          <label key={w.id} className="check">
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
      </section>

      {session.entries.map((entry, ei) => (
        <ExerciseCard
          key={`${ei}-${entry.pid}`}
          p={rx(entry.pid)}
          entry={entry}
          last={hist[entry.pid]}
          block={session.block}
          onDemo={() => setDemo(entry.exId)}
          onSwap={() => setSwapIdx(ei)}
          onSet={(j, patch) => {
            const p = rx(entry.pid)
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
      ))}

      <section className="card">
        <h3>Beschwerden</h3>
        <p className="muted small">Skala 0–10. Ab 3 an der Oberschenkelrückseite geht die Nordic-Stufe eine Stufe zurück.</p>
        {COMPLAINT_FIELDS.map(([k, label]) => (
          <div key={k} className="slider">
            <div className="row spread"><span>{label}</span><b className={session.complaints[k] >= 3 ? 'err' : ''}>{session.complaints[k]}</b></div>
            <input
              type="range" min={0} max={10} step={1} value={session.complaints[k]}
              className={session.complaints[k] >= 3 ? 'hot' : ''}
              onChange={(e) => update((s) => { s.complaints[k] = Number(e.target.value) })}
            />
          </div>
        ))}
        {session.complaints.other > 0 && (
          <input type="text" placeholder="Was genau?" value={session.complaints.otherText} onChange={(e) => update((s) => { s.complaints.otherText = e.target.value })} />
        )}
        {session.complaints.hamstring >= 3 && <div className="banner"><Icon name="alert" size={16} /> Bei anhaltenden Beschwerden Physio aufsuchen.</div>}
      </section>

      <section className="card">
        <h3>Notizen</h3>
        <textarea value={session.notes} placeholder="Technik, Gefühl, Besonderheiten …" onChange={(e) => update((s) => { s.notes = e.target.value })} />
      </section>

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
            const cur = latest.current!
            if (!doneSets(cur.entries.flatMap((e) => e.sets)).length && !confirm('Keine Sätze geloggt. Trotzdem abschließen?')) return
            setMsgs(await finishSession(cur))
            setTimer(null)
          }}
        >
          <Icon name="check" /> {session.finished ? 'Änderungen speichern' : 'Einheit abschließen'}
        </button>
      )}
      <button className="btn ghost danger block" style={{ marginTop: 10 }} onClick={async () => {
        if (confirm('Diese Einheit wirklich löschen?')) {
          await db.sessions.delete(id)
          go('/')
        }
      }}><Icon name="trash" size={18} /> Einheit löschen</button>

      <RestTimer timer={timer} onChange={setTimer} />
      {demo && <ExerciseSheet exId={demo} onClose={() => setDemo(null)} />}
      {swapShown && swapIdx !== null && (
        <AltSheet
          ex={swapShown}
          allowPermanent={basePid(swapShown.pid) !== RDL_EXTRA.pid && !session.finished}
          onPick={(c) => void swap(swapIdx, c)}
          onClose={() => setSwapIdx(null)}
        />
      )}
    </>
  )
}

function ExerciseCard({ p, entry, last, block, onDemo, onSwap, onSet }: {
  p: Prescribed; entry: ExerciseLog; last?: ExerciseLog[]; block: string
  onDemo: () => void; onSwap: () => void; onSet: (j: number, patch: Partial<SetLog>) => void
}) {
  const rows = Math.max(p.sets, entry.sets.length)
  const unitW = p.unit === 'cm' ? 'cm' : 'kg'
  const showW = p.kind === 'weight' || p.kind === 'explosive'
  const showRir = p.kind === 'weight' || p.kind === 'nordic'
  const prev = useMemo(() => [...(last ?? [])].reverse().find((l) => doneSets(l.sets).length), [last])
  const stats = useMemo(() => (p.kind === 'explosive' ? explosiveStats(last ?? []) : null), [last, p.kind])
  const range = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`
  const repLabel = p.unit === 's' ? 'Sek.' : 'Wdh.'
  const trend = { up: 'steigend', flat: 'stabil', down: 'fallend', none: '' }
  const doneCount = doneSets(entry.sets).length

  return (
    <section className={`card ex ${doneCount >= p.sets ? 'complete' : ''}`}>
      <div className="row spread">
        <button className="titlebtn grow" onClick={onDemo}>
          <h3>{p.name}{p.extra ? <span className="badge" style={{ marginLeft: 6 }}>Zusatz</span> : null}</h3>
          <div className="muted small">
            {p.sets} × {range}{p.unit === 's' ? ' s' : ''}{p.perSide ? ' pro Seite' : ''}
            {p.rpe ? ` · RPE ${fmt(p.rpe)}` : ''} · {p.rest} s Pause
          </div>
        </button>
        <span className="muted small">{doneCount}/{p.sets}</span>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button className="btn xs" onClick={onDemo}><Icon name="play" size={14} /> Demo</button>
        <button className="btn xs" onClick={onSwap}><Icon name="swap" size={14} /> Ausweichen</button>
      </div>
      {p.variant && <div className="hint">Variante: {p.variant}</div>}
      <div className="reason">{p.reason}</div>
      {p.hints.map((h, i) => <div className="hint" key={i}>{h}</div>)}
      {prev && p.kind !== 'explosive' && <div className="muted small" style={{ marginTop: 4 }}>Zuletzt: {describeSets(prev.sets, p.unit)}</div>}
      {stats && stats.best > 0 && <div className="muted small" style={{ marginTop: 4 }}>Bestwert {fmt(stats.best)} {unitW} · zuletzt {fmt(stats.last)} {unitW}{stats.trend !== 'none' ? ` · ${trend[stats.trend]}` : ''}</div>}

      {Array.from({ length: rows }, (_, j) => {
        const s = entry.sets[j]
        const prevSet = entry.sets[j - 1]
        const w = s?.weight ?? prevSet?.weight ?? p.weight
        const r = s?.reps ?? prevSet?.reps ?? p.reps
        const rir = s?.rir ?? prevSet?.rir ?? Math.ceil(p.targetRir)
        const done = !!s?.done
        return (
          <div key={j} className={`set ${done ? 'done' : ''}`}>
            <div className="setrow">
              <div className="setno">{j + 1}</div>
              {showW ? (
                <Stepper label={unitW} value={w} step={p.inc || (p.unit === 'cm' ? 1 : 2.5)} onChange={(v) => onSet(j, { weight: v })} />
              ) : <div />}
              <Stepper label={repLabel} value={r} step={p.unit === 's' ? 5 : 1} decimals={0} onChange={(v) => onSet(j, { reps: v })} />
              <button className={`donebtn ${done ? 'on' : ''}`} aria-label="Satz erledigt" onClick={() => onSet(j, { done: !done, weight: w, reps: r, rir })}><Icon name="check" size={22} /></button>
              {showRir && (
                <div className="rir">
                  <span className="lbl">RIR</span>
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <button key={v} className={rir === v ? 'on' : ''} onClick={() => onSet(j, { rir: v, weight: w, reps: r })}>{v}</button>
                  ))}
                </div>
              )}
            </div>
            {done && p.contrast && block === 'power' && <div className="hint">Kontrast: jetzt 2 Countermovement Jumps</div>}
          </div>
        )
      })}
      <button className="btn xs" style={{ marginTop: 10 }} onClick={() => onSet(rows, {})}><Icon name="plus" size={14} /> Satz</button>
    </section>
  )
}
