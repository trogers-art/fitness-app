'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { UserProfile, DailyNutritionSummary, BodyMetric } from '@/lib/types'
import { computeRollingAverage } from '@/lib/utils/metrics'
import Link from 'next/link'

interface Props {
  profile: UserProfile | null
  emailConfirmed: boolean
  todayNutrition: DailyNutritionSummary | null
  recentWeights: Pick<BodyMetric, 'weight_kg' | 'logged_at'>[]
  latestCheckin: { explanation: string; created_at: string } | null
}

const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10

const L: Record<string, React.CSSProperties> = {
  label:   { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card:    { background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 20px' },
}

function MacroBar({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  const pct = Math.min(100, target > 0 ? (eaten / target) * 100 : 0)
  const over = eaten > target
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={L.label}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>
          <span style={{ color: over ? 'var(--red)' : color }}>{Math.round(eaten)}g</span>
          <span style={{ color: 'var(--text-3)' }}> / {target}g</span>
        </span>
      </div>
      <div style={{ height: 2, background: 'var(--border-2)', width: '100%' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--red)' : color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

export default function DashboardClient({ profile, emailConfirmed, todayNutrition, recentWeights, latestCheckin }: Props) {
  if (!profile) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
      <p style={{ color: 'var(--text-2)', fontSize: 14 }}>No profile found.</p>
      <Link href="/onboarding" className="btn">Complete onboarding</Link>
    </div>
  )

  const imperial = profile.units === 'imperial'
  const n = todayNutrition || { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, workout_calories_burned: 0 }
  const net = n.total_calories - n.workout_calories_burned
  const remaining = profile.daily_calories - net
  const over = remaining < 0

  const rollingKg = computeRollingAverage(recentWeights.map(w => ({ date: w.logged_at, weight_kg: w.weight_kg })))
  const latestKg  = recentWeights[0]?.weight_kg
  const display   = (kg: number) => imperial ? `${kgToLbs(kg)} lbs` : `${kg} kg`

  const chartData = [...recentWeights].reverse().map(w => ({
    date: new Date(w.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    weight: imperial ? kgToLbs(w.weight_kg) : w.weight_kg,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Email banner */}
      {!emailConfirmed && (
        <div style={{ padding: '10px 14px', borderLeft: '2px solid var(--amber)', background: 'transparent', fontSize: 12, color: 'var(--amber)' }}>
          Confirm your email — check your inbox.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...L.label, marginBottom: 4 }}>{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Dashboard</h1>
        </div>
        <Link href="/food" className="btn" style={{ fontSize: 12, padding: '7px 13px' }}>+ Log food</Link>
      </div>

      {/* Calories */}
      <div style={L.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={L.label}>Calories remaining</span>
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
            <span>Eaten <span style={{ color: 'var(--text-2)' }}>{n.total_calories}</span></span>
            <span>Burned <span style={{ color: 'var(--text-2)' }}>{n.workout_calories_burned}</span></span>
            <span>Target <span style={{ color: 'var(--text-2)' }}>{profile.daily_calories}</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 46, fontFamily: 'DM Mono, monospace', fontWeight: 500, lineHeight: 1, color: over ? 'var(--red)' : 'var(--text)' }}>
            {over ? '+' : ''}{Math.abs(remaining).toLocaleString()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>kcal {over ? 'over' : 'left'}</span>
        </div>
        <div style={{ height: 1, background: 'var(--border-2)' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (net / profile.daily_calories) * 100)}%`, background: over ? 'var(--red)' : 'var(--text)', transition: 'width 0.7s ease' }} />
        </div>
      </div>

      {/* Macros */}
      <div style={{ ...L.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={L.label}>Macros</span>
        <MacroBar label="Protein" eaten={n.protein_g} target={profile.protein_g} color="var(--blue)" />
        <MacroBar label="Carbs"   eaten={n.carbs_g}   target={profile.carbs_g}   color="var(--amber)" />
        <MacroBar label="Fat"     eaten={n.fat_g}     target={profile.fat_g}     color="var(--red)" />
      </div>

      {/* Weight chart */}
      {recentWeights.length > 0 && (
        <div style={L.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={L.label}>Weight trend</span>
            <Link href="/body" style={{ ...L.label, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 0 }}>Log weight</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            {latestKg && <span style={{ fontSize: 22, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>{display(latestKg)}</span>}
            {rollingKg && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>7-day avg <span style={{ color: 'var(--text-2)', fontFamily: 'DM Mono, monospace' }}>{display(rollingKg)}</span></span>}
          </div>
          {chartData.length > 1 && (
            <div style={{ height: 96 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 0, fontSize: 11, color: 'var(--text)' }}
                    formatter={(v: number) => [imperial ? `${v} lbs` : `${v} kg`, 'Weight']} />
                  {rollingKg && <ReferenceLine y={imperial ? kgToLbs(rollingKg) : rollingKg} stroke="var(--text-3)" strokeDasharray="3 3" />}
                  <Line type="monotone" dataKey="weight" stroke="var(--text)" strokeWidth={1.5} dot={{ r: 2, fill: 'var(--text)', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Check-in */}
      {latestCheckin && (
        <div style={{ ...L.card, borderLeft: '2px solid var(--text-3)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span style={L.label}>Weekly check-in</span>
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{new Date(latestCheckin.created_at).toLocaleDateString()}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{latestCheckin.explanation}</p>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link href="/food" style={{ ...L.card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/><rect x="10" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="10" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="7" width="1.5" height="1.5" fill="currentColor"/><rect x="10" y="7" width="1.5" height="1.5" fill="currentColor"/><rect x="7" y="10" width="1.5" height="1.5" fill="currentColor"/><rect x="10" y="10" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Scan food</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>Quick log</p>
          </div>
        </Link>
        <Link href="/workouts" style={{ ...L.card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><polygon points="2.5,1 12,6.5 2.5,12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="miter" fill="none"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Start workout</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>Today&apos;s session</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
