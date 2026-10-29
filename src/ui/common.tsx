import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmt } from '../logic/progression'
import { Icon } from './icons'
import { beep, type TimerState } from './util'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h1>{title}</h1>
          <button className="iconbtn" aria-label="Schließen" onClick={onClose}><Icon name="plus" style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
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

/* ---------------- Pausentimer (zeitstempelbasiert) ---------------- */

export function RestTimer({ timer, onChange }: { timer: TimerState | null; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(() => Date.now())
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
