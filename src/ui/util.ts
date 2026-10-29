import { useEffect, useState } from 'react'

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

export interface TimerState {
  endsAt: number
  total: number
  label: string
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
