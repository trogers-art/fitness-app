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

function MacroBar({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  const pct = Math.min(100, target > 0 ? (eaten / target) * 100 : 0)
  const over = eaten > target
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>
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

const S = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', padding: 20 },
  label: { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
}

export default function DashboardClient({ profile, emailConfirmed, todayNutrition, recentWeights, latestCheckin }: Props) {
  if (!profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>No profile found.</p>
        <Link href="/onboarding" className="btn-primary">Complete onboarding</Link>
      </div>
    )
  }

  const imperial = profile.units === 'imperial'
  const nutrition = todayNutrition || { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, workout_calories_burned: 0, net_calories: 0 }
  const netCals = nutrition.total_calories - nutrition.workout_calories_burned
  const calsRemaining = profile.daily_calories - netCals
  const over = calsRemaining < 0

  const rollingAvgKg = computeRollingAverage(recentWeights.map(w => ({ date: w.logged_at, weight_kg: w.weight_kg })))
  const latestWeightKg = recentWeights[0]?.weight_kg
  const displayWeight = (kg: number) => imperial ? `${kgToLbs(kg)} lbs` : `${kg} kg`

  const weightChartData = [...recentWeights].reverse().map(w => ({
    date: new Date(w.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    weight: imperial ? kgToLbs(w.weight_kg) : w.weight_kg,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Email banner */}
      {!emailConfirmed && (
        <div style={{ padding: '10px 16px', borderLeft: '2px solid var(--amber)', background: '#f5a62308', fontSize: 12, color: 'var(--amber)' }}>
          Confirm your email — check your inbox.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <p style={{ ...S.label, marginBottom: 4 }}>
            {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
        </div>
        <Link href="/food" className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}>+ Log food</Link>
      </div>

      {/* Calories */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={S.label}>Calories remaining</span>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
            <span>Eaten <span style={{ color: 'var(--text-2)' }}>{nutrition.total_calories}</span></span>
            <span>Burned <span style={{ color: 'var(--text-2)' }}>{nutrition.workout_calories_burned}</span></span>
            <span>Target <span style={{ color: 'var(--text-2)' }}>{profile.daily_calories}</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 48, fontFamily: 'DM Mono, monospace', fontWeight: 500, lineHeight: 1, color: over ? 'var(--red)' : 'var(--accent)' }}>
            {over ? '+' : ''}{Math.abs(calsRemaining).toLocaleString()}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>kcal {over ? 'over' : 'left'}</span>
        </div>
        <div style={{ height: 1, background: 'var(--border-2)' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (netCals / profile.daily_calories) * 100)}%`,
            background: over ? 'var(--red)' : 'var(--accent)',
            transition: 'width 0.7s ease',
          }} />
        </div>
      </div>

      {/* Macros */}
      <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={S.label}>Macros</span>
        <MacroBar label="Protein" eaten={nutrition.protein_g} target={profile.protein_g} color="#4a90d9" />
        <MacroBar label="Carbs"   eaten={nutrition.carbs_g}   target={profile.carbs_g}   color="var(--amber)" />
        <MacroBar label="Fat"     eaten={nutrition.fat_g}     target={profile.fat_g}     color="#e06060" />
      </div>

      {/* Weight chart */}
      {recentWeights.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={S.label}>Weight trend</span>
            <Link href="/body" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', textDecoration: 'none' }}>
              Log weight
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            {latestWeightKg && (
              <span style={{ fontSize: 22, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                {displayWeight(latestWeightKg)}
              </span>
            )}
            {rollingAvgKg && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                7-day avg <span style={{ color: 'var(--text-2)', fontFamily: 'DM Mono, monospace' }}>{displayWeight(rollingAvgKg)}</span>
              </span>
            )}
          </div>
          {weightChartData.length > 1 && (
            <div style={{ height: 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 0, fontSize: 11, color: 'var(--text)' }}
                    formatter={(v: number) => [imperial ? `${v} lbs` : `${v} kg`, 'Weight']} />
                  {rollingAvgKg && (
                    <ReferenceLine y={imperial ? kgToLbs(rollingAvgKg) : rollingAvgKg}
                      stroke="var(--accent)" strokeDasharray="3 3" strokeOpacity={0.35} />
                  )}
                  <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={1.5}
                    dot={{ r: 2, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Weekly check-in */}
      {latestCheckin && (
        <div style={{ ...S.card, borderLeft: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ ...S.label, color: 'var(--accent)' }}>Weekly check-in</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(latestCheckin.created_at).toLocaleDateString()}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{latestCheckin.explanation}</p>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Scan food */}
        <Link href="/food" style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', transition: 'border-color 0.15s' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}>
          <div style={{ width: 36, height: 36, border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.25"/>
              <rect x="11" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.25"/>
              <rect x="1" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.25"/>
              <rect x="7" y="7" width="2" height="2" fill="currentColor"/>
              <rect x="11" y="7" width="2" height="2" fill="currentColor"/>
              <rect x="7" y="11" width="2" height="2" fill="currentColor"/>
              <rect x="11" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.25"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Scan food</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>Quick log</p>
          </div>
        </Link>

        {/* Start workout — play button, no emoji */}
        <Link href="/workouts" style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', transition: 'border-color 0.15s' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}>
          <div style={{ width: 36, height: 36, border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon points="3,1 13,7 3,13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="miter" fill="none"/>
            </svg>
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
