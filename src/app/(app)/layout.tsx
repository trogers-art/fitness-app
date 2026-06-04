import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import ThemeApplier from '@/components/layout/ThemeApplier'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Select only guaranteed columns — theme falls back to default if column missing
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, goal')
    .eq('user_id', user.id)
    .single()

  if (error || !profile) redirect('/onboarding')

  // Theme fetched separately so a missing column doesn't break the layout check
  const { data: themeRow } = await supabase
    .from('user_profiles')
    .select('theme')
    .eq('user_id', user.id)
    .single()

  const theme = ((themeRow?.theme) ?? 'default') as 'default' | 'dark' | 'light'

  return (
    <>
      <ThemeApplier theme={theme} />
      <AppShell email={user.email ?? ''} theme={theme}>
        {children}
      </AppShell>
    </>
  )
}
