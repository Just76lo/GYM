import { useEffect, useState } from 'react'
import { ensureInit } from './data/db'
import { Body } from './ui/Body'
import { History } from './ui/History'
import { Library } from './ui/Library'
import { More } from './ui/More'
import { PlanEditor } from './ui/PlanEditor'
import { Review } from './ui/Review'
import { Today } from './ui/Today'
import { Workout } from './ui/Workout'
import { useHash } from './ui/common'

const TABS = [
  ['/', '🏋️', 'Heute'],
  ['/history', '📈', 'Verlauf'],
  ['/body', '⚖️', 'Körper'],
  ['/library', '📚', 'Übungen'],
  ['/more', '⋯', 'Mehr'],
] as const

export default function App() {
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')
  const hash = useHash()
  useEffect(() => {
    ensureInit().then(() => setReady(true)).catch((e) => setErr(String(e)))
    // Speicher dauerhaft anfordern, damit iOS die Daten nicht aufräumt
    void navigator.storage?.persist?.()
  }, [])

  if (err) return <div className="main"><h1>Fehler</h1><p className="err">{err}</p><p>IndexedDB ist nicht verfügbar (privater Modus?).</p></div>
  if (!ready) return <div className="main"><p className="muted">Lade …</p></div>

  const m = hash.match(/^\/workout\/(\d+)/)
  let page
  if (m) page = <Workout key={m[1]} id={Number(m[1])} />
  else if (hash === '/history') page = <History />
  else if (hash === '/body') page = <Body />
  else if (hash === '/library') page = <Library />
  else if (hash === '/more') page = <More />
  else if (hash === '/plan') page = <PlanEditor />
  else if (hash === '/review') page = <Review />
  else page = <Today />

  const active = (p: string) => (p === '/' ? ['/', ''].includes(hash) || !!m : hash === p || (p === '/more' && ['/plan', '/review'].includes(hash)))

  return (
    <div className="app">
      <div className="main" key={hash.split('/')[1]}>{page}</div>
      <nav className="tabbar">
        {TABS.map(([p, icon, label]) => (
          <a key={p} href={`#${p}`} className={active(p) ? 'on' : ''}><b>{icon}</b>{label}</a>
        ))}
      </nav>
    </div>
  )
}
