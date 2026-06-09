export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '48px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 48 }}>
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            fontWeight: 500,
          }}>
            Fitapp
          </span>
          <div style={{ marginTop: 8, width: 24, height: 1, background: 'var(--border-2)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}
