import { PROTECTED, alternativesFor, baseExId, type Alternative } from '../data/alternatives'
import type { PlanExercise } from '../logic/types'
import { useLibrary } from './useLibrary'
import { Sheet } from './common'
import { Icon } from './icons'
import { asset } from './util'

export type AltChoice = { alt: Alternative | null; permanent: boolean }

const scheme = (e: PlanExercise, a?: Alternative) => {
  const x = { ...e, ...a?.adjust }
  const reps = x.repMin === x.repMax ? `${x.repMin}` : `${x.repMin}–${x.repMax}`
  return `${x.sets} × ${reps}${x.unit === 's' ? ' s' : ''}`
}

/**
 * Ausweichübungen für eine Planübung. `allowPermanent` blendet „Dauerhaft im Plan“ ein;
 * Pflichtübungen (Nordics, Copenhagen) lassen sich nur für eine Einheit tauschen.
 */
export function AltSheet({ ex, allowPermanent, planMode, onPick, onClose, onMore }: {
  ex: PlanExercise
  allowPermanent: boolean
  /** Plan-Editor: nur ein Button „Übernehmen“ */
  planMode?: boolean
  onPick: (c: AltChoice) => void
  onClose: () => void
  onMore?: () => void
}) {
  const lib = useLibrary()
  const img = (id: string) => lib.find((l) => l.id === id)?.images[0]
  const alts = alternativesFor(ex)
  const isProtected = PROTECTED.has(baseExId(ex))
  const perm = allowPermanent && !isProtected

  const row = (key: string, exId: string, name: string, why: string, alt: Alternative | null, current = false) => (
    <div className="alt" key={key}>
      <div className="row">
        {img(exId) ? <img className="thumb" src={asset(`exdb/img/${img(exId)}`)} alt="" /> : <div className="thumb" />}
        <div className="grow">
          <b>{name}</b>
          <div className="muted small">{why}</div>
          <div className="muted small">{scheme(ex.orig ? { ...ex, ...ex.orig } : ex, alt ?? undefined)}</div>
        </div>
      </div>
      {current ? <span className="badge ok">aktuell</span> : planMode ? (
        <button className="btn sm block" style={{ marginTop: 8 }} disabled={isProtected} onClick={() => onPick({ alt, permanent: true })}>Übernehmen</button>
      ) : (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn sm grow" onClick={() => onPick({ alt, permanent: false })}>Nur heute</button>
          {perm && <button className="btn sm primary grow" onClick={() => onPick({ alt, permanent: true })}>Dauerhaft im Plan</button>}
        </div>
      )}
    </div>
  )

  return (
    <Sheet title="Übung nicht verfügbar?" onClose={onClose}>
      <p className="muted">Ausweichübungen für <b style={{ color: 'var(--text)' }}>{ex.orig?.name ?? ex.name}</b>. Sätze und Pausen bleiben gleich, jede Variante hat ihren eigenen Verlauf.</p>
      {isProtected && (allowPermanent || planMode) && (
        <div className="banner info"><Icon name="alert" size={16} /> {planMode ? 'Pflichtübung: Nordics und Copenhagen bleiben im Plan. Für einzelne Einheiten kannst du im Training über „Ausweichen“ tauschen.' : 'Pflichtübung: nur für diese Einheit tauschbar.'}</div>
      )}
      {ex.orig && row('orig', ex.orig.exId, ex.orig.name, 'Zurück zur ursprünglichen Planübung.', null)}
      {alts.map((a) => row(a.exId, a.exId, a.name, a.why, a, a.exId === ex.exId))}
      {!alts.length && <p className="muted">Für diese Übung gibt es keine kuratierten Alternativen.</p>}
      {onMore && <button className="btn block" style={{ marginTop: 12 }} onClick={onMore}><Icon name="book" /> Weitere aus der Bibliothek</button>}
    </Sheet>
  )
}
