'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type Tab = 'log' | 'history'

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

interface Profile {
  units:            string
  goal:             string
  weight_kg:        number
  target_weight_kg: number | null
  daily_calories:   number
}

interface Props {
  profile:        Profile | null
  initialMetrics: Metric[]
}

const KG_TO_LBS = 2.20462
const CM_TO_IN  = 0.393701

const toDisplay = (kg: number, imperial: boolean) =>
  imperial ? Math.round(kg * KG_TO_LBS * 10) / 10 : Math.round(kg * 10) / 10

const toKg = (val: number, imperial: boolean) =>
  imperial ? Math.round(val / KG_TO_LBS * 10) / 10 : val

const toCm = (val: number, imperial: boolean) =>
  imperial ? Math.round(val / CM_TO_IN * 10) / 10 : val

const displayMeasure = (cm: number | null, imperial: boolean) => {
  if (!cm) return null
  return imperial ? `${Math.round(cm * CM_TO_IN * 10) / 10}"` : `${cm}cm`
}

function computeRolling7(metrics: Metric[]): Map<string, number> {
  const sorted  = [...metrics].sort((a,b) => a.logged_at.localeCompare(b.logged_at))
  const result  = new Map<string, number>()
  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i-6), i+1)
    const avg    = window.reduce((s,m) => s + m.weight_kg, 0) / window.length
    result.set(sorted[i].logged_at.split('T')[0], Math.round(avg * 100) / 100)
  }
  return result
}

const S = {
  lbl:  { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
}

export default function BodyClient({ profile, initialMetrics }: Props) {
  const supabase  = createClient()
  const [, startTransition] = useTransition()
  const imperial  = profile?.units === 'imperial'
  const unit      = imperial ? 'lbs' : 'kg'
  const measureUnit = imperial ? 'in' : 'cm'

  const [tab,           setTab]           = useState<Tab>('log')
  const [metrics,       setMetrics]       = useState<Metric[]>(initialMetrics)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [showMeasures,  setShowMeasures]  = useState(false)
  const [deleting,      setDeleting]      = useState<string | null>(null)

  // Form state
  const [weight,   setWeight]  = useState('')
  const [waist,    setWaist]   = useState('')
  const [hips,     setHips]    = useState('')
  const [chest,    setChest]   = useState('')
  const [arms,     setArms]    = useState('')
  const [thighs,   setThighs]  = useState('')
  const [notes,    setNotes]   = useState('')

  // Stats
  const sorted      = [...metrics].sort((a,b) => b.logged_at.localeCompare(a.logged_at))
  const latest      = sorted[0]
  const rolling     = computeRolling7(metrics)
  const latestDate  = latest?.logged_at.split('T')[0] ?? ''
  const avgKg       = rolling.get(latestDate) ?? null

  // Weekly delta
  const now         = new Date()
  const weekAgo     = new Date(now)
  weekAgo.setDate(now.getDate() - 7)
  const thisWeek    = sorted.filter(m => new Date(m.logged_at) >= weekAgo)
  const prevWeek    = sorted.filter(m => {
    const d = new Date(m.logged_at)
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14)
    return d >= twoWeeksAgo && d < weekAgo
  })
  const thisAvg     = thisWeek.length ? thisWeek.reduce((s,m) => s + m.weight_kg, 0) / thisWeek.length : null
  const prevAvg     = prevWeek.length ? prevWeek.reduce((s,m) => s + m.weight_kg, 0) / prevWeek.length : null
  const weeklyDelta = thisAvg && prevAvg ? thisAvg - prevAvg : null

  // Rate (kg/week over last 14 days)
  const rateMetrics = sorted.slice(0, 14)
  let rateKgPerWeek: number | null = null
  if (rateMetrics.length >= 2) {
    const oldest = rateMetrics[rateMetrics.length - 1]
    const newest = rateMetrics[0]
    const days   = (new Date(newest.logged_at).getTime() - new Date(oldest.logged_at).getTime()) / 86400000
    if (days > 0) rateKgPerWeek = ((newest.weight_kg - oldest.weight_kg) / days) * 7
  }

  // Goal projection
  const goalKg = profile?.target_weight_kg ?? null
  const weeksToGoal = goalKg && rateKgPerWeek && rateKgPerWeek < 0 && latest
    ? (latest.weight_kg - goalKg) / Math.abs(rateKgPerWeek)
    : null
  const projectedDate = weeksToGoal
    ? new Date(Date.now() + weeksToGoal * 7 * 86400000)
    : null

  // Rate alert
  const rateDisplay = rateKgPerWeek
    ? imperial
      ? `${Math.abs(Math.round(rateKgPerWeek * KG_TO_LBS * 10) / 10)} lbs/wk`
      : `${Math.abs(Math.round(rateKgPerWeek * 10) / 10)} kg/wk`
    : null
  let alertType: 'good' | 'fast' | 'slow' | null = null
  if (rateKgPerWeek !== null && profile?.goal === 'fat_loss') {
    if (rateKgPerWeek < -0.9) alertType = 'fast'
    else if (rateKgPerWeek > -0.1) alertType = 'slow'
    else alertType = 'good'
  }

  // Chart data
  const chartData = [...metrics]
    .sort((a,b) => a.logged_at.localeCompare(b.logged_at))
    .slice(-30)
    .map(m => {
      const date = m.logged_at.split('T')[0]
      return {
        date:    new Date(m.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        actual:  toDisplay(m.weight_kg, imperial),
        average: rolling.get(date) ? toDisplay(rolling.get(date)!, imperial) : null,
      }
    })

  // Start weight for progress bar
  const startWeight = sorted[sorted.length - 1]?.weight_kg ?? latest?.weight_kg
  const pct = goalKg && startWeight && latest
    ? Math.min(100, Math.max(0, Math.round(((startWeight - latest.weight_kg) / (startWeight - goalKg)) * 100)))
    : 0

  async function handleSave() {
    if (!weight) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const weight_kg = toKg(parseFloat(weight), imperial)
    const entry: any = {
      user_id:   user.id,
      weight_kg,
      logged_at: new Date().toISOString(),
    }
    if (waist)  entry.waist_cm  = toCm(parseFloat(waist),  imperial)
    if (hips)   entry.hips_cm   = toCm(parseFloat(hips),   imperial)
    if (chest)  entry.chest_cm  = toCm(parseFloat(chest),  imperial)
    if (arms)   entry.arms_cm   = toCm(parseFloat(arms),   imperial)
    if (thighs) entry.thighs_cm = toCm(parseFloat(thighs), imperial)
    if (notes)  entry.notes     = notes

    const { data } = await supabase.from('body_metrics').insert(entry).select('*').single()
    if (data) {
      setMetrics(prev => [data, ...prev])
      setSaved(true)
      setWeight(''); setWaist(''); setHips(''); setChest(''); setArms(''); setThighs(''); setNotes('')
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('body_metrics').delete().eq('id', id)
    setMetrics(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
  }

  const chartColor    = 'var(--text)'
  const chartAvgColor = 'var(--text-3)'
  const chartGrid     = 'var(--border-2)'
  const chartTick     = 'var(--text-3)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div>
        <p style={{ ...S.lbl, marginBottom: 4 }}>Tracking</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Body</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['log','history'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 16px', fontSize: 11, fontWeight: tab === t ? 600 : 400,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--btn-bg)' : '2px solid transparent',
            color: tab === t ? 'var(--page-title)' : 'var(--text-3)',
            fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize',
          }}>{t === 'log' ? 'Log' : 'History'}</button>
        ))}
      </div>

      {/* ── LOG TAB ── */}
      {tab === 'log' && (
        <>
          {/* Entry form */}
          <div style={{ ...S.card, padding: '18px 20px' }}>
            <p style={{ ...S.lbl, marginBottom: 14 }}>Today&apos;s entry</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ ...S.lbl, marginBottom: 6 }}>Weight ({unit})</p>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...S.input, paddingRight: 40 }} type="number" step="0.1" min={0} value={weight}
                    onChange={e => setWeight(e.target.value)} placeholder={latest ? String(toDisplay(latest.weight_kg, imperial)) : '0'} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>{unit}</span>
                </div>
              </div>
            </div>

            {/* Measurements toggle */}
            <button onClick={() => setShowMeasures(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px 0', marginBottom: showMeasures ? 12 : 0 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif' }}>
                Body measurements <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(optional)</span>
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: showMeasures ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--text-3)' }}>
                <path d="M1.5 3l3.5 3.5L8.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/>
              </svg>
            </button>

            {showMeasures && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Waist', val: waist, set: setWaist },
                  { label: 'Hips',  val: hips,  set: setHips },
                  { label: 'Chest', val: chest, set: setChest },
                  { label: 'Arms',  val: arms,  set: setArms },
                ].map(f => (
                  <div key={f.label}>
                    <p style={{ ...S.lbl, marginBottom: 5 }}>{f.label} ({measureUnit})</p>
                    <input style={S.input} type="number" step="0.5" min={0} value={f.val}
                      onChange={e => f.set(e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <button onClick={handleSave} disabled={saving || !weight}
                style={{ width: '100%', padding: 11, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (!weight || saving) ? 0.4 : 1 }}>
                {saved ? 'Saved' : saving ? 'Saving...' : 'Save entry'}
              </button>
            </div>
          </div>

          {/* Stats grid */}
          {latest && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Current',    value: `${toDisplay(latest.weight_kg, imperial)} ${unit}` },
                { label: '7-day avg',  value: avgKg ? `${toDisplay(avgKg, imperial)} ${unit}` : '—' },
                { label: 'This week',  value: weeklyDelta !== null ? `${weeklyDelta > 0 ? '+' : ''}${toDisplay(weeklyDelta, imperial)} ${unit}` : '—', color: weeklyDelta !== null ? (weeklyDelta < 0 ? 'var(--green)' : 'var(--red)') : undefined },
                { label: 'Goal',       value: goalKg ? `${toDisplay(goalKg, imperial)} ${unit}` : '—' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <p style={S.lbl}>{s.label}</p>
                  <p style={{ fontSize: 18, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: s.color ?? 'var(--text)', marginTop: 4 }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Rate alert */}
          {alertType && rateDisplay && (
            <div style={{
              padding: '10px 14px',
              borderLeft: `2px solid ${alertType === 'good' ? 'var(--green)' : alertType === 'fast' ? 'var(--red)' : 'var(--amber)'}`,
              fontSize: 12,
              color: alertType === 'good' ? 'var(--green)' : alertType === 'fast' ? 'var(--red)' : 'var(--amber)',
            }}>
              {alertType === 'good' && `On track — losing ${rateDisplay}.${projectedDate ? ` Projected to reach goal by ${projectedDate.toLocaleDateString('en', { month: 'short', day: 'numeric' })}.` : ''}`}
              {alertType === 'fast' && `Losing too fast at ${rateDisplay}. Consider eating slightly more to preserve muscle.`}
              {alertType === 'slow' && `Rate is slow at ${rateDisplay}. Check your food logging to make sure you&apos;re hitting your deficit.`}
            </div>
          )}

          {/* Trend chart */}
          {chartData.length > 1 && (
            <div style={{ ...S.card, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={S.lbl}>Trend</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--text-3)' }}>
                  <span>— Actual</span>
                  <span style={{ opacity: 0.6 }}>- - 7-day avg</span>
                </div>
              </div>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: chartTick }} tickLine={false} axisLine={false} />
                    <YAxis domain={['auto','auto']} tick={{ fontSize: 9, fill: chartTick }} tickLine={false} axisLine={false} width={36}
                      tickFormatter={v => `${v}${unit === 'lbs' ? '' : ''}`} />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 0, fontSize: 11, color: 'var(--text)' }}
                      formatter={(v: number, name: string) => [`${v} ${unit}`, name === 'actual' ? 'Actual' : '7-day avg']} />
                    <Line type="monotone" dataKey="actual" stroke={chartColor} strokeWidth={1.5} dot={{ r: 2.5, fill: chartColor, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="average" stroke={chartAvgColor} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Goal projection */}
          {latest && goalKg && startWeight && (
            <div style={{ ...S.card, padding: '18px 20px' }}>
              <p style={{ ...S.lbl, marginBottom: 14 }}>Goal projection</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Remaining</p>
                  <span style={{ fontSize: 28, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text)' }}>
                    {toDisplay(Math.max(0, latest.weight_kg - goalKg), imperial)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 4 }}>{unit}</span>
                </div>
                {projectedDate && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Projected</p>
                    <p style={{ fontSize: 20, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text)' }}>
                      {projectedDate.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {Math.round(weeksToGoal! * 10) / 10} weeks at current rate
                    </p>
                  </div>
                )}
              </div>
              <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--btn-bg)', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-3)' }}>
                <span>Start: {toDisplay(startWeight, imperial)} {unit}</span>
                <span>{pct}% there</span>
                <span>Goal: {toDisplay(goalKg, imperial)} {unit}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div style={S.card}>
          <p style={{ ...S.lbl, padding: '14px 16px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>Weight log</p>
          {sorted.length === 0 && (
            <p style={{ ...S.lbl, textAlign: 'center', padding: '32px 0', marginBottom: 0 }}>No entries yet.</p>
          )}
          {sorted.map((m, i) => {
            const prev  = sorted[i + 1]
            const delta = prev ? m.weight_kg - prev.weight_kg : null
            const deltaDisplay = delta !== null
              ? `${delta > 0 ? '+' : ''}${toDisplay(Math.abs(delta), imperial)} ${unit}`
              : null
            const hasMeasures = m.waist_cm || m.hips_cm || m.chest_cm || m.arms_cm
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                    {new Date(m.logged_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  {hasMeasures && (
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                      {[
                        m.waist_cm  ? `W: ${displayMeasure(m.waist_cm,  imperial)}` : null,
                        m.hips_cm   ? `H: ${displayMeasure(m.hips_cm,   imperial)}` : null,
                        m.chest_cm  ? `C: ${displayMeasure(m.chest_cm,  imperial)}` : null,
                        m.arms_cm   ? `A: ${displayMeasure(m.arms_cm,   imperial)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', marginRight: 12 }}>
                  <p style={{ fontSize: 14, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                    {toDisplay(m.weight_kg, imperial)} {unit}
                  </p>
                  {deltaDisplay && (
                    <p style={{ fontSize: 10, margin: '2px 0 0', color: delta! < 0 ? 'var(--green)' : 'var(--red)' }}>
                      {delta! < 0 ? '−' : '+'}{toDisplay(Math.abs(delta!), imperial)} {unit}
                    </p>
                  )}
                </div>
                <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, opacity: deleting === m.id ? 0.4 : 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
