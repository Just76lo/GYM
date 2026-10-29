import { useMemo, useState } from 'react'
import { db } from '../data/db'
import {
  EQUIP_DE, FOCI, LIB_CATEGORIES, MUSCLE_DE, equipDe, muscleDe, nameOf,
  type Focus, type LibCategory, type LibExercise, type Load,
} from '../data/library'
import { ExerciseSheet, useLibrary } from './ExerciseSheet'
import { Sheet, asset } from './common'

const PAGE = 50
const tri = (v: string) => (v === '' ? null : v === 'ja')

export function Library() {
  const lib = useLibrary()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equip, setEquip] = useState('')
  const [cat, setCat] = useState('')
  const [load, setLoad] = useState('')
  const [ecc, setEcc] = useState('')
  const [pre, setPre] = useState('')
  const [foc, setFoc] = useState('')
  const [box, setBox] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const e = tri(ecc)
    const p = tri(pre)
    return lib.filter((l) =>
      (!t || l.nameEn.toLowerCase().includes(t) || (l.nameDe ?? '').toLowerCase().includes(t)) &&
      (!muscle || l.primary.includes(muscle) || l.secondary.includes(muscle)) &&
      (!equip || l.equipment === equip) &&
      (!cat || l.category === cat) &&
      (!load || l.legsLoad === load) &&
      (e === null || l.eccentricHeavy === e) &&
      (p === null || l.ok2DaysBeforeGame === p) &&
      (!foc || l.focus.includes(foc as Focus)) &&
      (!box || l.needsBox),
    ).sort((a, b) => (a.source === 'free-exercise-db' ? 1 : 0) - (b.source === 'free-exercise-db' ? 1 : 0) || nameOf(a).localeCompare(nameOf(b)))
  }, [lib, q, muscle, equip, cat, load, ecc, pre, foc, box])

  const reset = () => { setQ(''); setMuscle(''); setEquip(''); setCat(''); setLoad(''); setEcc(''); setPre(''); setFoc(''); setBox(false) }
  const sel = (v: string, set: (x: string) => void, label: string, opts: [string, string][]) => (
    <select value={v} onChange={(e) => { set(e.target.value); setPage(1) }} aria-label={label}>
      <option value="">{label}</option>
      {opts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  )

  return (
    <>
      <div className="row spread"><h1>Übungen</h1><button className="btn sm primary" onClick={() => setCreating(true)}>+ Eigene</button></div>
      <p className="muted small">{lib.length} Übungen offline (free-exercise-db, Unlicense) · Treffer: {list.length}</p>
      <input type="search" placeholder="Suchen (deutsch/englisch)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        {sel(muscle, setMuscle, 'Muskel', Object.entries(MUSCLE_DE))}
        {sel(equip, setEquip, 'Equipment', Object.entries(EQUIP_DE))}
        {sel(cat, setCat, 'Kategorie', LIB_CATEGORIES.map((c) => [c, c]))}
        {sel(load, setLoad, 'Belastung Beine', ['niedrig', 'mittel', 'hoch'].map((c) => [c, c]))}
        {sel(ecc, setEcc, 'Exzentrisch schwer', [['ja', 'ja'], ['nein', 'nein']])}
        {sel(pre, setPre, '2 Tage vor Spiel', [['ja', 'geeignet'], ['nein', 'ungeeignet']])}
        {sel(foc, setFoc, 'Präventionsfokus', FOCI.map((f) => [f, f]))}
        <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={box} onChange={(e) => setBox(e.target.checked)} /><span style={{ color: 'var(--text)' }}>nur Box-Übungen</span></label>
      </div>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={reset}>Filter zurücksetzen</button>

      <div className="card">
        {list.slice(0, page * PAGE).map((l) => (
          <div key={l.id} className="list-item row" onClick={() => setOpen(l.id)}>
            {l.images[0] ? <img className="thumb" loading="lazy" src={asset(`exdb/img/${l.images[0]}`)} alt="" /> : <div className="thumb" />}
            <div className="grow">
              <b>{nameOf(l)}</b>
              <div className="muted small">{l.primary.map(muscleDe).join(', ')} · {equipDe(l.equipment)}</div>
              <div className="chips" style={{ marginTop: 2 }}>
                <span className="badge">{l.category}</span>
                {l.needsBox && <span className="badge warn">Box nötig</span>}
                {l.eccentricHeavy && <span className="badge bad">exzentrisch schwer</span>}
                {l.legsLoad === 'hoch' && <span className="badge warn">Beine hoch</span>}
              </div>
            </div>
          </div>
        ))}
        {list.length > page * PAGE && <button className="btn block" onClick={() => setPage(page + 1)}>Mehr anzeigen</button>}
        {!list.length && <p className="muted">Keine Treffer.</p>}
      </div>
      {open && <ExerciseSheet exId={open} onClose={() => setOpen(null)} />}
      {creating && <CreateExercise onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); setOpen(id) }} />}
    </>
  )
}

export function CreateExercise({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [name, setName] = useState('')
  const [cat, setCat] = useState<LibCategory>('Kraft')
  const [muscle, setMuscle] = useState('chest')
  const [equip, setEquip] = useState('dumbbell')
  const [load, setLoad] = useState<Load>('niedrig')
  const [ecc, setEcc] = useState(false)
  const [text, setText] = useState('')
  return (
    <Sheet title="Eigene Übung" onClose={onClose}>
      <label>Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <label>Kategorie</label>
      <select value={cat} onChange={(e) => setCat(e.target.value as LibCategory)}>{LIB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <label>Hauptmuskel</label>
      <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>{Object.entries(MUSCLE_DE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <label>Equipment</label>
      <select value={equip} onChange={(e) => setEquip(e.target.value)}>{Object.entries(EQUIP_DE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <label>Belastung Beine</label>
      <select value={load} onChange={(e) => setLoad(e.target.value as Load)}>{['niedrig', 'mittel', 'hoch'].map((c) => <option key={c}>{c}</option>)}</select>
      <label className="check"><input type="checkbox" checked={ecc} onChange={(e) => setEcc(e.target.checked)} /><span style={{ color: 'var(--text)' }}>Exzentrisch schwer</span></label>
      <label>Ausführung</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn primary block" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={async () => {
        const id = `eigene-${Date.now()}`
        const ex: LibExercise = {
          id, nameEn: name.trim(), nameDe: name.trim(), level: 'intermediate', equipment: equip, primary: [muscle], secondary: [],
          category: cat, images: [], instrDe: text.trim() ? text.split('\n').filter(Boolean) : undefined, legsLoad: load,
          eccentricHeavy: ecc, ok2DaysBeforeGame: load === 'niedrig' || (load === 'mittel' && !ecc), focus: [], needsBox: false, source: 'eigene',
        }
        await db.custom.add(ex)
        onDone(id)
      }}>Speichern</button>
    </Sheet>
  )
}
