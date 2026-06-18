'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Metric {
  id: string
  weight_kg: number
  waist_cm:  number | null
  hips_cm:   number | null
  chest_cm:  number | null
  arms_cm:   number | null
  thighs_cm: number | null
  logged_at: string
  notes:     string | null
}

interface Props {
  metric:    Metric
  imperial:  boolean
  onClose:   () => void
  onSaved:   (updated: Metric) => void
}

const KG_TO_LBS = 2.20462
const CM_TO_IN  = 0.393701

const toDisplay = (kg: number, imperial: boolean) =>
  imperial ? Math.round(kg * KG_TO_LBS * 10) / 10 : Math.round(kg * 10) / 10

const toKg = (val: number, imperial: boolean) =>
  imperial ? Math.round(val / KG_TO_LBS * 10) / 10 : val

const toDisplayCm = (cm: number, imperial: boolean) =>
  imperial ? Math.round(cm * CM_TO_IN * 10) / 10 : Math.round(cm * 10) / 10

const toCm = (val: number, imperial: boolean) =>
  imperial ? Math.round(val / CM_TO_IN * 10) / 10 : val

const S = {
  lbl: { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
}

export default function EditMetricModal({ metric, imperial, onClose, onSaved }: Props) {
  const supabase = createClient()
  const unit        = imperial ? 'lbs' : 'kg'
  const measureUnit = imperial ? 'in'  : 'cm'

  const [weight, setWeight] = useState(String(toDisplay(metric.weight_kg, imperial)))
  const [waist,  setWaist]  = useState(metric.waist_cm  ? String(toDisplayCm(metric.waist_cm,  imperial)) : '')
  const [hips,   setHips]   = useState(metric.hips_cm   ? String(toDisplayCm(metric.hips_cm,   imperial)) : '')
  const [chest,  setChest]  = useState(metric.chest_cm  ? String(toDisplayCm(metric.chest_cm,  imperial)) : '')
  const [arms,   setArms]   = useState(metric.arms_cm   ? String(toDisplayCm(metric.arms_cm,   imperial)) : '')
  const [thighs, setThighs] = useState(metric.thighs_cm ? String(toDisplayCm(metric.thighs_cm, imperial)) : '')
  const [notes,  setNotes]  = useState(metric.notes || '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    if (!weight) { setError('Weight required'); return }
    setSaving(true)
    setError(null)

    const update: any = {
      weight_kg: toKg(parseFloat(weight), imperial),
      waist_cm:  waist  ? toCm(parseFloat(waist),  imperial) : null,
      hips_cm:   hips   ? toCm(parseFloat(hips),   imperial) : null,
      chest_cm:  chest  ? toCm(parseFloat(chest),  imperial) : null,
      arms_cm:   arms   ? toCm(parseFloat(arms),   imperial) : null,
      thighs_cm: thighs ? toCm(parseFloat(thighs), imperial) : null,
      note:      notes || null, // DB column is "note" singular
    }

    const { data, error: updateError } = await supabase
      .from('body_metrics')
      .update(update)
      .eq('id', metric.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('[body] edit error:', updateError)
      setError(updateError.message)
      setSaving(false)
      return
    }

    if (data) {
      onSaved({ ...data, notes: data.note })
    }
    setSaving(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Edit entry</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>
              {new Date(metric.logged_at).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderLeft: '2px solid var(--red)', color: 'var(--red)', fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Weight ({unit})</p>
            <input style={S.input} type="number" step="0.1" min={0} value={weight} onChange={e => setWeight(e.target.value)} />
          </div>

          <p style={{ ...S.lbl, marginBottom: 8 }}>Measurements ({measureUnit})</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Waist',  val: waist,  set: setWaist },
              { label: 'Hips',   val: hips,   set: setHips },
              { label: 'Chest',  val: chest,  set: setChest },
              { label: 'Arms',   val: arms,   set: setArms },
              { label: 'Thighs', val: thighs, set: setThighs },
            ].map(f => (
              <div key={f.label}>
                <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 5 }}>{f.label}</p>
                <input style={S.input} type="number" step="0.5" min={0} value={f.val}
                  onChange={e => f.set(e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 4 }}>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ ...S.input, fontFamily: 'DM Sans, sans-serif', resize: 'vertical' as const }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
