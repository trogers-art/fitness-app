'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
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

function MacroRingChart({ eaten, target, color }: { eaten: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((eaten / target) * 100))
  const data = [{ value: pct, fill: color }]
  return (
    <div className="relative w-16 h-16">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f3f4f6' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-gray-700">{pct}%</span>
      </div>
    </div>
  )
}

export default function DashboardClient({ profile, todayNutrition, recentWeights, latestCheckin, emailConfirmed }: Props) {
  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No profile found.</p>
        <Link href="/onboarding" className="btn-primary">Complete onboarding</Link>
      </div>
    )
  }

  const nutrition = todayNutrition || { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, workout_calories_burned: 0, net_calories: 0 }
  const netCals = nutrition.total_calories - nutrition.workout_calories_burned
  const calsRemaining = profile.daily_calories - netCals
  const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10
  const isImperial = profile.units === 'imperial'
  const displayWeight = (kg: number) => isImperial ? `${kgToLbs(kg)} lbs` : `${kg} kg`
  const rollingAvgKg = computeRollingAverage(recentWeights.map(w => ({ date: w.logged_at, weight_kg: w.weight_kg })))
  const rollingAvg = rollingAvgKg ? kgToLbs(rollingAvgKg) : null
  const latestWeight = recentWeights[0]?.weight_kg ? kgToLbs(recentWeights[0].weight_kg) : null

  const weightChartData = recentWeights
    .slice()
    .reverse()
    .map(w => ({ date: new Date(w.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }), weight: w.weight_kg }))

  return (
    <div className="space-y-5">
      {/* Email confirmation banner */}
      {!emailConfirmed && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Confirm your email address</p>
            <p className="text-xs text-amber-600 mt-0.5">Check your inbox and click the confirmation link to secure your account.</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Net calories card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-600">Calories remaining</span>
          <Link href="/food" className="text-xs text-brand-600 font-medium">Log food →</Link>
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold ${calsRemaining < 0 ? 'text-red-500' : 'text-gray-900'}`}>
            {calsRemaining.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 pb-1">kcal</span>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span>Eaten: <strong className="text-gray-700">{nutrition.total_calories}</strong></span>
          <span>Burned: <strong className="text-gray-700">{nutrition.workout_calories_burned}</strong></span>
          <span>Target: <strong className="text-gray-700">{profile.daily_calories}</strong></span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${netCals > profile.daily_calories ? 'bg-red-400' : 'bg-brand-500'}`}
            style={{ width: `${Math.min(100, (netCals / profile.daily_calories) * 100)}%` }}
          />
        </div>
      </div>

      {/* Macros row */}
      <div className="card p-5">
        <h3 className="text-sm font-medium text-gray-600 mb-4">Macros</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Protein', eaten: nutrition.protein_g, target: profile.protein_g, color: '#3b82f6', unit: 'g' },
            { label: 'Carbs', eaten: nutrition.carbs_g, target: profile.carbs_g, color: '#f59e0b', unit: 'g' },
            { label: 'Fat', eaten: nutrition.fat_g, target: profile.fat_g, color: '#ef4444', unit: 'g' },
          ].map(m => (
            <div key={m.label} className="flex flex-col items-center gap-2">
              <MacroRingChart eaten={m.eaten} target={m.target} color={m.color} />
              <div className="text-center">
                <div className="text-xs font-medium text-gray-700">{m.label}</div>
                <div className="text-xs text-gray-500">{Math.round(m.eaten)}/{m.target}{m.unit}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weight trend */}
      {recentWeights.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Weight trend</h3>
            <Link href="/body" className="text-xs text-brand-600 font-medium">Log weight →</Link>
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-2xl font-bold text-gray-900">{latestWeight ? displayWeight(recentWeights[0].weight_kg) : ''}</span>
            {rollingAvg && (
              <span className="text-sm text-gray-500">7-day avg: {rollingAvgKg ? displayWeight(rollingAvgKg) : ''}</span>
            )}
          </div>
          {weightChartData.length > 1 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: number) => [isImperial ? `${Math.round(v * 2.20462 * 10) / 10} lbs` : `${v} kg`, 'Weight']}
                  />
                  {rollingAvg && <ReferenceLine y={rollingAvg} stroke="#22c55e" strokeDasharray="3 3" />}
                  <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Weekly check-in card */}
      {latestCheckin && (
        <div className="card p-5 border-l-4 border-l-brand-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Weekly check-in</span>
            <span className="text-xs text-gray-400">{new Date(latestCheckin.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-gray-700">{latestCheckin.explanation}</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/food" className="card p-4 flex items-center gap-3 hover:border-brand-200 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Scan food</div>
            <div className="text-xs text-gray-500">Quick log</div>
          </div>
        </Link>
        <Link href="/workouts" className="card p-4 flex items-center gap-3 hover:border-brand-200 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
            <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Start workout</div>
            <div className="text-xs text-gray-500">Today&apos;s session</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
