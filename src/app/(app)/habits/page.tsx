'use client'

import { useState, useEffect, useCallback } from 'react'

interface Habit {
  id: string
  name: string
  type: 'binary' | 'count'
  target_count: number
  category: string | null
  order_index: number
}

interface HabitLog {
  id: string
  habit_id: string
  logged_date: string
  count: number
}

const S = {
  lbl: { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
}

const TODAY = new Date().toISOString().split('T')[0]

// ── Heatmap ────────────────────────────────────────────────────────────────

function Heatmap({ logs }: { logs: HabitLog[] }) {
  const logsByDate: Record<string, number> = {}
  for (const l of logs) logsByDate[l.logged_date] = l.count

  // Build 84 days (12 weeks) ending today
  const days: { date: string; count: number }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().split('T')[0]
    days.push({ date, count: logsByDate[date] || 0 })
  }

  // Group into weeks (columns of 7)
  const weeks: { date: string; count: number }[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 3, minWidth: 'fit-content' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((day, di) => {
              const filled = day.count > 0
              const isToday = day.date === TODAY
              return (
                <div
                  key={di}
                  title={day.date}
                  style={{
                    width: 11, height: 11, flexShrink: 0,
                    background: filled ? 'var(--green)' : 'var(--surface-2)',
                    opacity: filled ? 1 : 1,
                    outline: isToday ? '1px solid var(--text-3)' : 'none',
                    outlineOffset: 1,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Streak calculation ─────────────────────────────────────────────────────

function computeStreaks(logs: HabitLog[]): { current: number; longest: number; rate: number } {
  if (logs.length === 0) return { current: 0, longest: 0, rate: 0 }

  const dates = new Set(logs.map(l => l.logged_date))
  const sorted = Array.from(dates).sort()

  // Current streak — count back from today
  let current = 0
  const d = new Date()
  while (true) {
    const key = d.toISOString().split('T')[0]
    if (dates.has(key)) {
      current++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  // Longest streak
  let longest = 0
  let run = 0
  let prev: Date | null = null
  for (const dateStr of sorted) {
    const cur = new Date(dateStr)
    if (prev) {
      const diff = (cur.getTime() - prev.getTime()) / 86400000
      if (diff === 1) { run++ } else { run = 1 }
    } else {
      run = 1
    }
    if (run > longest) longest = run
    prev = cur
  }

  // Completion rate over last 30 days
  const rate = Math.round((Math.min(dates.size, 30) / 30) * 100)

  return { current, longest, rate }
}

// ── Add Habit Modal ────────────────────────────────────────────────────────

function AddHabitModal({ onSaved, onClose }: { onSaved: (h: Habit) => void; onClose: () => void }) {
  const [name,        setName]        = useState('')
  const [type,        setType]        = useState<'binary' | 'count'>('binary')
  const [target,      setTarget]      = useState(8)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name required'); return }
    setSaving(true)
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, type, target_count: target }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return }
    onSaved(data.habit)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>New habit</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <p style={{ fontSize: 11, color: 'var(--red)', margin: 0 }}>{error}</p>}
          <div>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Name</p>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Morning workout"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
          </div>
          <div>
            <p style={{ ...S.lbl, marginBottom: 8 }}>Type</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['binary', 'count'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  style={{
                    padding: '5px 12px', fontSize: 11, border: '1px solid', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    borderColor: type === t ? 'var(--text)' : 'var(--border-2)',
                    background: type === t ? 'var(--btn-bg)' : 'transparent',
                    color: type === t ? 'var(--btn-fg)' : 'var(--text-2)',
                  }}>
                  {t === 'binary' ? 'Yes / No' : 'Count'}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '6px 0 0' }}>
              {type === 'binary' ? 'Mark as done each day.' : 'Track a number — glasses of water, pages read, etc.'}
            </p>
          </div>
          {type === 'count' && (
            <div>
              <p style={{ ...S.lbl, marginBottom: 6 }}>Daily target</p>
              <input
                type="number" min={1} max={100} value={target}
                onChange={e => setTarget(parseInt(e.target.value) || 1)}
                style={{ width: 80, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Add habit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const [habits,      setHabits]      = useState<Habit[]>([])
  const [logs,        setLogs]        = useState<HabitLog[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [logging,     setLogging]     = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [habRes, logRes] = await Promise.all([
      fetch('/api/habits', { credentials: 'include' }),
      fetch('/api/habits/log', { credentials: 'include' }),
    ])
    const [habData, logData] = await Promise.all([habRes.json(), logRes.json()])
    setHabits(habData.habits || [])
    setLogs(logData.logs || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Today's logs keyed by habit_id
  const todayLogs: Record<string, HabitLog> = {}
  for (const l of logs) {
    if (l.logged_date === TODAY) todayLogs[l.habit_id] = l
  }

  // All logs keyed by habit_id for heatmaps
  const logsByHabit: Record<string, HabitLog[]> = {}
  for (const l of logs) {
    if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = []
    logsByHabit[l.habit_id].push(l)
  }

  async function toggleBinary(habit: Habit) {
    if (logging[habit.id]) return
    setLogging(prev => ({ ...prev, [habit.id]: true }))
    const alreadyDone = !!todayLogs[habit.id]

    if (alreadyDone) {
      // Optimistic remove
      setLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.logged_date === TODAY)))
      await fetch('/api/habits/log', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ habit_id: habit.id, logged_date: TODAY }),
      })
    } else {
      // Optimistic add
      const fake: HabitLog = { id: 'temp', habit_id: habit.id, logged_date: TODAY, count: 1 }
      setLogs(prev => [...prev, fake])
      const res = await fetch('/api/habits/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ habit_id: habit.id, logged_date: TODAY, count: 1 }),
      })
      const data = await res.json()
      if (data.log) {
        setLogs(prev => prev.map(l => l.id === 'temp' ? data.log : l))
      }
    }
    setLogging(prev => ({ ...prev, [habit.id]: false }))
  }

  async function updateCount(habit: Habit, newCount: number) {
    if (newCount < 0) return
    if (logging[habit.id]) return
    setLogging(prev => ({ ...prev, [habit.id]: true }))

    if (newCount === 0) {
      setLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.logged_date === TODAY)))
      await fetch('/api/habits/log', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ habit_id: habit.id, logged_date: TODAY }),
      })
    } else {
      // Optimistic update
      const existing = todayLogs[habit.id]
      if (existing) {
        setLogs(prev => prev.map(l => l.habit_id === habit.id && l.logged_date === TODAY ? { ...l, count: newCount } : l))
      } else {
        const fake: HabitLog = { id: 'temp', habit_id: habit.id, logged_date: TODAY, count: newCount }
        setLogs(prev => [...prev, fake])
      }
      const res = await fetch('/api/habits/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ habit_id: habit.id, logged_date: TODAY, count: newCount }),
      })
      const data = await res.json()
      if (data.log) {
        setLogs(prev => prev.map(l => (l.id === 'temp' || (l.habit_id === habit.id && l.logged_date === TODAY)) ? data.log : l))
      }
    }
    setLogging(prev => ({ ...prev, [habit.id]: false }))
  }

  async function deleteHabit(id: string) {
    if (!confirm('Delete this habit? All history will be lost.')) return
    setHabits(prev => prev.filter(h => h.id !== id))
    await fetch(`/api/habits/${id}`, { method: 'DELETE', credentials: 'include' })
  }

  const doneTodayCount = habits.filter(h => {
    const log = todayLogs[h.id]
    if (!log) return false
    if (h.type === 'binary') return true
    return log.count >= h.target_count
  }).length

  const dayName = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ ...S.lbl, textAlign: 'center', padding: '40px 0' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...S.lbl, marginBottom: 4 }}>Daily habits</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Habits</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn" style={{ fontSize: 11, padding: '6px 11px' }}>
          + Add habit
        </button>
      </div>

      {/* Today summary */}
      {habits.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{dayName}</p>
          <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: doneTodayCount === habits.length ? 'var(--green)' : 'var(--text-3)', margin: 0 }}>
            {doneTodayCount} / {habits.length} done
          </p>
        </div>
      )}

      {/* Empty state */}
      {habits.length === 0 && (
        <div style={{ ...S.card, padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' }}>No habits yet. Add one to start tracking.</p>
          <button onClick={() => setShowAdd(true)} className="btn" style={{ fontSize: 12 }}>Add your first habit</button>
        </div>
      )}

      {/* Habit list */}
      {habits.length > 0 && (
        <div style={{ ...S.card, overflow: 'hidden' }}>
          {habits.map((habit, i) => {
            const log      = todayLogs[habit.id]
            const isDone   = habit.type === 'binary' ? !!log : (log?.count || 0) >= habit.target_count
            const curCount = log?.count || 0

            return (
              <div key={habit.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: i < habits.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: logging[habit.id] ? 0.6 : 1,
                transition: 'opacity 0.1s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  {/* Check button — binary only */}
                  {habit.type === 'binary' && (
                    <button
                      onClick={() => toggleBinary(habit)}
                      style={{
                        width: 28, height: 28, flexShrink: 0,
                        border: `1.5px solid ${isDone ? 'var(--green)' : 'var(--border-2)'}`,
                        background: isDone ? 'var(--green)' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {isDone && (
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2 7l3 3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="square"/>
                        </svg>
                      )}
                    </button>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0,
                      textDecoration: isDone && habit.type === 'binary' ? 'line-through' : 'none',
                      opacity: isDone && habit.type === 'binary' ? 0.5 : 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {habit.name}
                    </p>
                    {habit.type === 'count' && (
                      <p style={{ fontSize: 10, color: isDone ? 'var(--green)' : 'var(--text-3)', margin: '2px 0 0' }}>
                        {curCount} / {habit.target_count}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {/* Count stepper */}
                  {habit.type === 'count' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <button
                        onClick={() => updateCount(habit, curCount - 1)}
                        style={{ width: 28, height: 28, border: '1px solid var(--border-2)', background: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        −
                      </button>
                      <span style={{ width: 32, textAlign: 'center', fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                        {curCount}
                      </span>
                      <button
                        onClick={() => updateCount(habit, curCount + 1)}
                        style={{ width: 28, height: 28, border: '1px solid var(--border-2)', background: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        +
                      </button>
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Heatmaps */}
      {habits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ ...S.lbl, margin: 0 }}>12-week history</p>
          {habits.map(habit => {
            const habitLogs = logsByHabit[habit.id] || []
            const { current, longest, rate } = computeStreaks(habitLogs)
            return (
              <div key={habit.id} style={{ ...S.card, padding: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>{habit.name}</p>
                <Heatmap logs={habitLogs} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, background: 'var(--surface-2)', padding: '10px 12px' }}>
                    <p style={{ ...S.lbl, marginBottom: 4 }}>Current streak</p>
                    <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      {current} {current === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                  <div style={{ flex: 1, background: 'var(--surface-2)', padding: '10px 12px' }}>
                    <p style={{ ...S.lbl, marginBottom: 4 }}>Longest streak</p>
                    <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      {longest} {longest === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                  <div style={{ flex: 1, background: 'var(--surface-2)', padding: '10px 12px' }}>
                    <p style={{ ...S.lbl, marginBottom: 4 }}>30-day rate</p>
                    <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--text)' : 'var(--red)', margin: 0 }}>
                      {rate}%
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddHabitModal
          onSaved={habit => { setHabits(prev => [...prev, habit]); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
