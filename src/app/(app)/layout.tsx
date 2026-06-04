import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import ThemeApplier from '@/components/layout/ThemeApplier'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, theme')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const theme = (profile.theme ?? 'default') as 'default' | 'dark' | 'light'

  return (
    <>
      <ThemeApplier theme={theme} />
      <AppShell email={user.email ?? ''} theme={theme}>
        {children}
      </AppShell>
    </>
  )
}
