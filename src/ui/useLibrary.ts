import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, loadLibrary } from '../data/db'
import type { LibExercise } from '../data/library'

/** Bibliothek inkl. eigener Übungen und geänderter Fußball-Felder (aktualisiert sich live) */
export function useLibrary(): LibExercise[] {
  const v = useLiveQuery(async () => {
    const [c, o] = await Promise.all([db.custom.count(), db.overrides.toArray()])
    return `${c}:${o.map((x) => x.exId + JSON.stringify(x.patch)).join('|')}`
  }, [])
  const [lib, setLib] = useState<LibExercise[]>([])
  useEffect(() => {
    let alive = true
    void loadLibrary().then((l) => alive && setLib(l))
    return () => { alive = false }
  }, [v])
  return lib
}
