import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, type VideoRow } from '../data/db'
import {
  BOX_ALTERNATIVES, FOCI, equipDe, findAlternatives, muscleDe, nameOf, ytSearchUrl, LEVEL_DE,
  type Focus, type LibExercise, type Load,
} from '../data/library'
import { ALTERNATIVES } from '../data/alternatives'
import { Sheet } from './common'
import { useLibrary } from './useLibrary'
import { Icon } from './icons'
import { asset } from './util'

export function DemoLoop({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (images.length < 2) return
    const id = setInterval(() => setI((x) => (x + 1) % images.length), 900)
    return () => clearInterval(id)
  }, [images])
  if (!images.length) return <div className="muted">Kein Demo-Bild in der Datenbank – nutze „Video ansehen“ oder lade ein eigenes Video hoch.</div>
  return <img className="demo" src={asset(`exdb/img/${images[i]}`)} alt={alt} />
}

function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null
}

function VideoPlayer({ v }: { v: VideoRow }) {
  const url = useMemo(() => (v.blob ? URL.createObjectURL(v.blob) : ''), [v.blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  const emb = v.url ? ytEmbed(v.url) : null
  return (
    <div className="card">
      <div className="row spread">
        <b className="small">{v.name}</b>
        <button className="btn sm danger" onClick={() => confirm('Video löschen?') && db.videos.delete(v.id!)}>Löschen</button>
      </div>
      {v.kind === 'file' && <video src={url} controls playsInline preload="metadata" />}
      {v.kind === 'youtube' && (
        navigator.onLine && emb ? <iframe src={emb} allow="encrypted-media" allowFullScreen title={v.name} /> : (
          <p className="muted">{emb ? 'Offline – Einbettung nur mit Internet.' : ''} <a href={v.url} target="_blank" rel="noreferrer">Link öffnen</a></p>
        )
      )}
    </div>
  )
}

export function Videos({ exId, name }: { exId: string; name: string }) {
  const vids = useLiveQuery(() => db.videos.where('exId').equals(exId).toArray(), [exId]) ?? []
  const [link, setLink] = useState('')
  const file = useRef<HTMLInputElement>(null)
  return (
    <>
      <h2>Eigene Videos</h2>
      {vids.map((v) => <VideoPlayer key={v.id} v={v} />)}
      <div className="row wrap">
        <input ref={file} type="file" accept="video/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          await db.videos.add({ exId, kind: 'file', name: `${name} · ${new Date().toLocaleDateString('de-DE')}`, blob: f, createdAt: new Date().toISOString() })
          e.target.value = ''
        }} />
        <button className="btn grow" onClick={() => file.current?.click()}><Icon name="video" /> Aufnehmen oder hochladen</button>
      </div>
      <label>YouTube-Link hinterlegen</label>
      <div className="row">
        <input type="text" inputMode="url" placeholder="https://youtu.be/…" value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="btn" disabled={!/^https?:\/\//.test(link)} onClick={async () => {
          await db.videos.add({ exId, kind: 'youtube', name: 'YouTube', url: link, createdAt: new Date().toISOString() })
          setLink('')
        }}>Speichern</button>
      </div>
    </>
  )
}

export function ExerciseSheet({ exId, onClose, onPick, pickLabel }: {
  exId: string; onClose: () => void; onPick?: (l: LibExercise) => void; pickLabel?: string
}) {
  const lib = useLibrary()
  const [stack, setStack] = useState<string[]>([exId])
  const curId = stack[stack.length - 1]
  const ex = lib.find((l) => l.id === curId)
  const [alt, setAlt] = useState(false)
  const open = (id: string) => { setStack([...stack, id]); setAlt(false) }
  if (!ex) return <Sheet title="Übung" onClose={onClose}><p className="muted">Nicht in der Bibliothek gefunden.</p></Sheet>
  const patch = async (p: Partial<LibExercise>) => {
    const cur = await db.overrides.get(ex.id)
    await db.overrides.put({ exId: ex.id, patch: { ...cur?.patch, ...p } })
  }
  const instr = ex.instrDe ?? []
  const alts = findAlternatives(ex, lib, { limit: 6 })
  const curated = ALTERNATIVES[ex.id] ?? []
  return (
    <Sheet title={nameOf(ex)} onClose={onClose}>
      {stack.length > 1 && (
        <button className="btn xs" onClick={() => setStack(stack.slice(0, -1))}><Icon name="back" size={14} /> Zurück</button>
      )}
      {ex.nameDe && ex.nameDe !== ex.nameEn && <p className="muted">{ex.nameEn}</p>}
      <DemoLoop images={ex.images} alt={ex.nameEn} />
      <div className="chips">
        <span className="badge">{ex.category}</span>
        <span className="badge">{equipDe(ex.equipment)}</span>
        <span className="badge">{LEVEL_DE[ex.level] ?? ex.level}</span>
        {ex.source === 'eigene' && <span className="badge ok">eigene</span>}
      </div>
      {ex.needsBox && (
        <div className="banner">
          <Icon name="alert" size={16} /> Braucht eine Box, die es in deinem Gym nicht gibt. Alternativen: {BOX_ALTERNATIVES.join(' · ')}
        </div>
      )}
      <p className="small"><b>Ziel:</b> {ex.primary.map(muscleDe).join(', ') || '–'}{ex.secondary.length ? ` · Hilfsmuskeln: ${ex.secondary.map(muscleDe).join(', ')}` : ''}</p>

      <a className="btn block" href={ytSearchUrl(ex)} target="_blank" rel="noreferrer"><Icon name="play" /> Video ansehen (YouTube-Suche)</a>

      {curated.length > 0 && (
        <>
          <h2>Falls nicht verfügbar</h2>
          {curated.map((a) => {
            const l = lib.find((x) => x.id === a.exId)
            return (
              <button className="list-item row" key={a.exId} onClick={() => open(a.exId)}>
                {l?.images[0] ? <img className="thumb" src={asset(`exdb/img/${l.images[0]}`)} alt="" /> : <div className="thumb" />}
                <div className="grow"><b>{a.name}</b><div className="muted small">{a.why}</div></div>
              </button>
            )
          })}
        </>
      )}

      <h2>Ausführung</h2>
      {instr.length ? (
        <ol>{instr.map((t, i) => <li key={i}>{t}</li>)}</ol>
      ) : (
        <>
          <p className="muted small">Deutsche Hinweise gibt es für die Planübungen. Englische Originalbeschreibung (free-exercise-db):</p>
          <ol>{(ex.instrEn ?? []).map((t, i) => <li key={i}>{t}</li>)}</ol>
        </>
      )}
      {ex.mistakesDe && (
        <>
          <h2>Typische Fehler</h2>
          <ul>{ex.mistakesDe.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>
      )}

      <h2>Fußball-Felder</h2>
      <label>Belastung Beine</label>
      <div className="chips">
        {(['niedrig', 'mittel', 'hoch'] as Load[]).map((l) => (
          <button key={l} className={`chip ${ex.legsLoad === l ? 'on' : ''}`} onClick={() => patch({ legsLoad: l })}>{l}</button>
        ))}
      </div>
      <label>Exzentrisch schwer</label>
      <div className="chips">
        {[true, false].map((b) => (
          <button key={String(b)} className={`chip ${ex.eccentricHeavy === b ? 'on' : ''}`} onClick={() => patch({ eccentricHeavy: b })}>{b ? 'ja' : 'nein'}</button>
        ))}
      </div>
      <label>Geeignet 2 Tage vor Spiel</label>
      <div className="chips">
        {[true, false].map((b) => (
          <button key={String(b)} className={`chip ${ex.ok2DaysBeforeGame === b ? 'on' : ''}`} onClick={() => patch({ ok2DaysBeforeGame: b })}>{b ? 'ja' : 'nein'}</button>
        ))}
      </div>
      <label>Präventionsfokus</label>
      <div className="chips">
        {FOCI.map((f: Focus) => (
          <button key={f} className={`chip ${ex.focus.includes(f) ? 'on' : ''}`}
            onClick={() => patch({ focus: ex.focus.includes(f) ? ex.focus.filter((x) => x !== f) : [...ex.focus, f] })}>{f}</button>
        ))}
      </div>
      <p className="muted small">Für Übungen außerhalb deines Plans sind die Werte Schätzungen aus Muskel, Ausrüstung und Name – bitte bei Bedarf anpassen.</p>

      <Videos exId={ex.id} name={nameOf(ex)} />

      <h2>Ähnliche Übungen</h2>
      <button className="btn sm" onClick={() => setAlt(!alt)}>{alt ? 'Ausblenden' : 'Gleiche Zielmuskeln und Kategorie anzeigen'}</button>
      {alt && alts.map((a) => (
        <div className="list-item row" key={a.id} onClick={() => open(a.id)}>
          {a.images[0] && <img className="thumb" src={asset(`exdb/img/${a.images[0]}`)} alt="" />}
          <div className="grow"><b>{nameOf(a)}</b><div className="muted small">{a.primary.map(muscleDe).join(', ')} · {equipDe(a.equipment)}</div></div>
          {onPick && <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); onPick(a) }}>{pickLabel ?? 'Wählen'}</button>}
        </div>
      ))}
      {onPick && <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => onPick(ex)}>{pickLabel ?? 'Diese Übung wählen'}</button>}
    </Sheet>
  )
}
