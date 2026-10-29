import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db, exportAll, importAll, wipeAll, today } from '../data/db'
import { Stepper } from './common'
import { Icon } from './icons'
import { download, go } from './util'

export function More() {
  const s = useLiveQuery(() => db.settings.get('main'))
  const [vids, setVids] = useState(false)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  if (!s) return null
  return (
    <>
      <h1>Mehr</h1>
      <div className="card">
        <button className="navrow" onClick={() => go('/plan')}><Icon name="plan" /><span className="grow">Plan bearbeiten</span><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></button>
        <button className="navrow" onClick={() => go('/review')}><Icon name="review" /><span className="grow">Zyklus-Auswertung</span><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></button>
      </div>

      <h2>Zyklus & Ziel</h2>
      <div className="card">
        <label>Startdatum des Zyklus (Woche 1)</label>
        <input type="date" value={s.startDate} onChange={(e) => e.target.value && db.settings.update('main', { startDate: e.target.value })} />
        <div style={{ marginTop: 12 }}>
          <Stepper label="Ziel-Körpergewicht (kg)" value={s.goalKg} step={0.5} min={40} max={150} onChange={(v) => db.settings.update('main', { goalKg: v })} />
        </div>
      </div>

      <h2>Backup</h2>
      <div className="card">
        <p className="muted small">Alle Daten liegen nur auf diesem Gerät. Exportiere regelmäßig – iOS kann Website-Daten löschen, wenn die App lange nicht genutzt wird.</p>
        <label className="check"><input type="checkbox" checked={vids} onChange={(e) => setVids(e.target.checked)} /><span style={{ color: 'var(--text)' }}>Eigene Videos einschließen (Datei wird groß)</span></label>
        <button className="btn primary block" onClick={async () => {
          download(`kraft-backup-${today()}.json`, await exportAll(vids))
          setMsg('Backup exportiert.')
        }}><Icon name="download" /> Backup exportieren (JSON)</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f || !confirm('Import ersetzt ALLE aktuellen Daten. Fortfahren?')) return
          try {
            await importAll(await f.text())
            setMsg('Backup importiert.')
          } catch (err) {
            setMsg('Fehler: ' + (err as Error).message)
          }
        }} />
        <button className="btn block" style={{ marginTop: 8 }} onClick={() => file.current?.click()}><Icon name="upload" /> Backup importieren</button>
        {msg && <div className="banner ok" style={{ marginTop: 8 }}>{msg}</div>}
      </div>

      <h2>Gefahrenzone</h2>
      <div className="card">
        <button className="btn danger block" onClick={async () => {
          if (confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.') && confirm('Wirklich sicher? Erstelle vorher ein Backup.')) {
            await wipeAll()
            location.hash = '/'
            location.reload()
          }
        }}>Alle Daten löschen</button>
      </div>
      <p className="muted small">Übungsdatenbank: free-exercise-db (Unlicense / gemeinfrei). Kein Tracking, keine Server – alles bleibt auf deinem Gerät.</p>
    </>
  )
}
