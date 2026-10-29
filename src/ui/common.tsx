import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmt } from '../logic/progression'

export function useHash(): string {
  const [h, setH] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => setH(location.hash.slice(1) || '/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return h
}
export const go = (path: string) => {
  location.hash = path
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="btn sm close" onClick={onClose}>Schließen</button>
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}

export function Stepper({
  label, value, step, onChange, min = 0, max = 9999, decimals = 1,
}: {
  label: string; value: number | ''; step: number; onChange: (v: number) => void; min?: number; max?: number; decimals?: number
}) {
  const [txt, setTxt] = useState<string | null>(null)
  const num = value === '' ? 0 : value
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="stepper">
      <small>{label}</small>
      <div className="ctl">
        <button type="button" aria-label="weniger" onClick={() => onChange(clamp(num - step))}>−</button>
        <input
          inputMode="decimal"
          value={txt ?? (value === '' ? '' : fmt(num, decimals))}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setTxt(e.target.value)
            const v = parseFloat(e.target.value.replace(',', '.'))
            if (!Number.isNaN(v)) onChange(clamp(v))
          }}
          onBlur={() => setTxt(null)}
        />
        <button type="button" aria-label="mehr" onClick={() => onChange(clamp(num + step))}>+</button>
      </div>
    </div>
  )
}

/* ---------------- Ton & Vibration ---------------- */

let audioCtx: AudioContext | null = null
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx ??= new AC()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch { /* kein Audio verfügbar */ }
}
export function beep(times = 3) {
  try {
    unlockAudio()
    if (!audioCtx) return
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      o.frequency.value = 880
      g.gain.value = 0.25
      o.connect(g).connect(audioCtx.destination)
      const t = audioCtx.currentTime + i * 0.28
      o.start(t)
      o.stop(t + 0.16)
    }
  } catch { /* ignorieren */ }
  try { navigator.vibrate?.([200, 100, 200, 100, 300]) } catch { /* iOS unterstützt das nicht */ }
}

/* ---------------- Pausentimer (zeitstempelbasiert) ---------------- */

export interface TimerState {
  endsAt: number
  total: number
  label: string
}

export function RestTimer({ timer, onChange }: { timer: TimerState | null; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(Date.now())
  const fired = useRef(0)
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [timer])
  useEffect(() => {
    if (timer && now >= timer.endsAt && fired.current !== timer.endsAt) {
      fired.current = timer.endsAt
      beep()
    }
  }, [now, timer])
  if (!timer) return null
  const left = Math.ceil((timer.endsAt - now) / 1000)
  const over = left <= 0
  const mm = Math.floor(Math.abs(left) / 60)
  const ss = String(Math.abs(left) % 60).padStart(2, '0')
  return (
    <div className={`timer ${over ? 'over' : ''}`}>
      <div>
        <div className="small">{over ? 'Pause vorbei – los!' : `Pause · ${timer.label}`}</div>
        <div className="t">{over ? '+' : ''}{mm}:{ss}</div>
      </div>
      <button onClick={() => onChange({ ...timer, endsAt: timer.endsAt - 15000 })}>−15</button>
      <button onClick={() => onChange({ ...timer, endsAt: timer.endsAt + 15000 })}>+15</button>
      <button onClick={() => onChange(null)}>OK</button>
    </div>
  )
}

/** Bildschirm wach halten (wo unterstützt) */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    let lock: { release: () => Promise<void> } | null = null
    const req = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null
      } catch { /* nicht verfügbar */ }
    }
    void req()
    const vis = () => document.visibilityState === 'visible' && void req()
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      void lock?.release().catch(() => {})
    }
  }, [active])
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function download(name: string, text: string | Blob, type = 'application/json') {
  const blob = typeof text === 'string' ? new Blob([text], { type }) : text
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`
