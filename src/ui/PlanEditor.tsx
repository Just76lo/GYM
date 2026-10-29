import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, savePlanVersion, saveTemplate } from '../data/db'
import { nameOf, type LibExercise } from '../data/library'
import { validatePlan } from '../logic/review'
import { fmt } from '../logic/progression'
import type { Cat, DayId, Plan, PlanExercise } from '../logic/types'
import { ExerciseSheet, useLibrary } from './ExerciseSheet'
import { Sheet, Stepper } from './common'

function fromLib(l: LibExercise, day: DayId): PlanExercise {
  const explosive = l.category === 'Schnellkraft/Plyometrie'
  const cat: Cat = explosive ? (l.legsLoad === 'niedrig' ? 'power' : 'legpower')
    : l.category === 'Rumpf' ? 'core' : l.category === 'Prävention' ? 'prevention'
    : l.primary.some((m) => ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(m)) ? 'legs' : 'upper'
  return {
    pid: `${day.toLowerCase()}-${Date.now().toString(36)}`, exId: l.id, name: nameOf(l), kind: explosive ? 'explosive' : 'weight', cat,
    sets: 3, repMin: explosive ? 3 : 8, repMax: explosive ? 3 : 10, rpe: explosive ? undefined : 8, rest: explosive ? 90 : 90,
    inc: explosive ? 0 : 2.5, unit: explosive && l.legsLoad !== 'niedrig' ? 'cm' : 'kg',
  }
}

export function PlanEditor() {
  const settings = useLiveQuery(() => db.settings.get('main'))
  const active = useLiveQuery(async () => {
    const s = await db.settings.get('main')
    return s ? db.plans.get(s.activePlanId) : undefined
  })
  const allPlans = useLiveQuery(() => db.plans.toArray()) ?? []
  const lib = useLibrary()
  const [draft, setDraft] = useState<Plan | null>(null)
  const [tab, setTab] = useState<DayId | 'warm' | 'ver'>('A')
  const [edit, setEdit] = useState<{ day: DayId; i: number } | null>(null)
  const [swap, setSwap] = useState<{ day: DayId; i: number } | null>(null)
  const [adding, setAdding] = useState<DayId | null>(null)
  const [addQ, setAddQ] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { if (active && !draft) setDraft(structuredClone(active)) }, [active, draft])
  const dirty = useMemo(() => !!draft && !!active && JSON.stringify({ d: draft.days, w: draft.warmup, f: draft.flags, n: draft.name }) !== JSON.stringify({ d: active.days, w: active.warmup, f: active.flags, n: active.name }), [draft, active])
  if (!draft || !settings) return <p className="muted">Lade …</p>

  const byEx = new Map(lib.map((l) => [l.id, l]))
  const issues = validatePlan(draft, lib)
  const mut = (fn: (p: Plan) => void) => setDraft((d) => { const n = structuredClone(d!); fn(n); return n })
  const warn = (day: DayId, e: PlanExercise) => {
    const l = byEx.get(e.exId)
    if (day !== 'B' || !l) return null
    if (l.eccentricHeavy) return 'Freitag: exzentrisch schwer!'
    if (l.legsLoad === 'hoch') return 'Freitag: hohe Beinbelastung!'
    return null
  }
  const cur = edit ? draft.days[edit.day][edit.i] : null
  const setCur = (patch: Partial<PlanExercise>) => edit && mut((p) => { p.days[edit.day][edit.i] = { ...p.days[edit.day][edit.i], ...patch } })

  return (
    <>
      <h1>Plan bearbeiten</h1>
      <p className="muted">{draft.name} · Version {draft.version}</p>
      <div className="chips">
        {([['A', 'Gym A (Mo)'], ['B', 'Gym B (Fr)'], ['warm', 'Aufwärmen'], ['ver', 'Versionen']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {issues.map((s, i) => <div className="banner" key={i}>⚠️ {s}</div>)}

      {(tab === 'A' || tab === 'B') && (
        <>
          {draft.days[tab].map((e, i) => {
            const w = warn(tab, e)
            return (
              <div className="card" key={e.pid}>
                <div className="row spread">
                  <div className="grow">
                    <b>{e.name}</b>
                    <div className="muted small">{e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}{e.unit === 's' ? ' s' : ''}{e.perSide ? '/Seite' : ''}{e.rpe ? ` · RPE ${fmt(e.rpe)}` : ''} · {e.rest} s{e.inc ? ` · +${fmt(e.inc)} kg` : ''}</div>
                    {w && <div className="hint">⚠️ {w}</div>}
                  </div>
                  <div className="row">
                    <button className="btn sm" disabled={i === 0} onClick={() => mut((p) => { const l = p.days[tab]; [l[i - 1], l[i]] = [l[i], l[i - 1]] })}>↑</button>
                    <button className="btn sm" disabled={i === draft.days[tab].length - 1} onClick={() => mut((p) => { const l = p.days[tab]; [l[i + 1], l[i]] = [l[i], l[i + 1]] })}>↓</button>
                  </div>
                </div>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <button className="btn sm" onClick={() => setEdit({ day: tab, i })}>Bearbeiten</button>
                  <button className="btn sm" onClick={() => setSwap({ day: tab, i })}>Tauschen</button>
                  <button className="btn sm danger" onClick={() => confirm(`„${e.name}“ entfernen?`) && mut((p) => { p.days[tab].splice(i, 1) })}>Entfernen</button>
                </div>
              </div>
            )
          })}
          <button className="btn block" onClick={() => setAdding(tab)}>+ Übung hinzufügen</button>
        </>
      )}

      {tab === 'warm' && (
        <div className="card">
          {draft.warmup.map((w, i) => (
            <div className="row" key={w.id} style={{ marginBottom: 8 }}>
              <input type="text" value={w.text} onChange={(e) => mut((p) => { p.warmup[i].text = e.target.value })} />
              <button className="btn sm danger" onClick={() => mut((p) => { p.warmup.splice(i, 1) })}>✕</button>
            </div>
          ))}
          <button className="btn block" onClick={() => mut((p) => { p.warmup.push({ id: `w${Date.now()}`, text: 'Neuer Punkt' }) })}>+ Punkt</button>
        </div>
      )}

      {tab === 'ver' && (
        <>
          <p className="muted small">Jede Speicherung erzeugt eine neue Version. Frühere Zyklen behalten ihre Einheiten im Verlauf.</p>
          {[...allPlans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => (
            <div className="card" key={p.id}>
              <div className="row spread">
                <div className="grow"><b>{p.name}</b><div className="muted small">v{p.version} · {new Date(p.createdAt).toLocaleDateString('de-DE')}{p.template ? ' · Vorlage' : ''}</div></div>
                {p.id === settings.activePlanId ? <span className="badge ok">aktiv</span> : (
                  <button className="btn sm" onClick={async () => { await db.settings.update('main', { activePlanId: p.id! }); setDraft(null) }}>Aktivieren</button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ height: 70 }} />
      <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(68px + env(safe-area-inset-bottom))', zIndex: 15 }} className="row">
        <button className="btn primary grow" disabled={!dirty} onClick={async () => {
          await savePlanVersion(draft)
          setDraft(null)
          setMsg('Als neue Version gespeichert.')
        }}>Speichern (neue Version)</button>
        <button className="btn" onClick={async () => {
          const n = prompt('Name der Vorlage?', `${draft.name} – Vorlage`)
          if (n) { await saveTemplate(draft, n); setMsg('Vorlage gespeichert.') }
        }}>Als Vorlage</button>
      </div>
      {msg && <div className="banner ok" onClick={() => setMsg('')}>{msg}</div>}

      {cur && edit && (
        <Sheet title={cur.name} onClose={() => setEdit(null)}>
          <label>Name</label>
          <input type="text" value={cur.name} onChange={(e) => setCur({ name: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Stepper label="Sätze" value={cur.sets} step={1} min={1} max={10} decimals={0} onChange={(v) => setCur({ sets: v })} />
            <Stepper label="Pause (s)" value={cur.rest} step={15} min={0} max={600} decimals={0} onChange={(v) => setCur({ rest: v })} />
            <Stepper label={cur.unit === 's' ? 'Sek. von' : 'Wdh. von'} value={cur.repMin} step={cur.unit === 's' ? 5 : 1} min={1} decimals={0} onChange={(v) => setCur({ repMin: v, repMax: Math.max(v, cur.repMax) })} />
            <Stepper label={cur.unit === 's' ? 'Sek. bis' : 'Wdh. bis'} value={cur.repMax} step={cur.unit === 's' ? 5 : 1} min={1} decimals={0} onChange={(v) => setCur({ repMax: v, repMin: Math.min(v, cur.repMin) })} />
            <Stepper label="Ziel-RPE" value={cur.rpe ?? 8} step={0.5} min={5} max={10} onChange={(v) => setCur({ rpe: v })} />
            <Stepper label="Inkrement (kg)" value={cur.inc} step={0.5} min={0} max={20} onChange={(v) => setCur({ inc: v })} />
            <Stepper label="Startgewicht (kg)" value={cur.startWeight ?? 0} step={2.5} min={0} max={500} onChange={(v) => setCur({ startWeight: v || undefined })} />
          </div>
          <p className="muted small">Das Ziel-RIR kommt aus dem Block (Basis 2–3, Kraft/Power 1,5–2, Deload 4).</p>
          <button className="btn primary block" onClick={() => setEdit(null)}>Fertig</button>
        </Sheet>
      )}

      {swap && (
        <ExerciseSheet
          exId={draft.days[swap.day][swap.i].exId}
          onClose={() => setSwap(null)}
          pickLabel="Hierher tauschen"
          onPick={(l) => {
            mut((p) => {
              const old = p.days[swap.day][swap.i]
              p.days[swap.day][swap.i] = { ...old, exId: l.id, name: nameOf(l), pid: `${old.pid}-t${Date.now().toString(36)}` }
            })
            setSwap(null)
          }}
        />
      )}

      {adding && (
        <Sheet title="Übung hinzufügen" onClose={() => setAdding(null)}>
          <input type="search" placeholder="Suchen …" value={addQ} onChange={(e) => setAddQ(e.target.value)} />
          {lib.filter((l) => addQ.trim().length > 1 && (nameOf(l).toLowerCase().includes(addQ.toLowerCase()) || l.nameEn.toLowerCase().includes(addQ.toLowerCase()))).slice(0, 30).map((l) => (
            <div className="list-item row spread" key={l.id} onClick={() => { mut((p) => { p.days[adding].push(fromLib(l, adding)) }); setAdding(null); setAddQ('') }}>
              <span>{nameOf(l)}</span>
              {adding === 'B' && (l.eccentricHeavy || l.legsLoad === 'hoch') && <span className="badge bad">Fr ungeeignet</span>}
            </div>
          ))}
        </Sheet>
      )}
    </>
  )
}
