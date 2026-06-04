import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'

const NAV = [
  { to: '/',            label: 'Dashboard',   icon: '⬡' },
  { to: '/environment', label: 'Environment', icon: '◈' },
  { to: '/devices',     label: 'Devices',     icon: '◉' },
  { to: '/ai',          label: 'AI Health',   icon: '◆' },
  { to: '/control',     label: 'Control',     icon: '⊡' },
  { to: '/twin',        label: '3D Twin',     icon: '◳' },
]

const S = {
  aside: {
    width: 224, minHeight: '100vh',
    background: '#F5F6F8',
    borderRight: 'none',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  logoWrap: {
    padding: '28px 20px 22px',
    borderBottom: 'none',
  },
  logoPrefix: {
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 10, fontWeight: 600,
    color: '#A8C4A8', letterSpacing: '0.12em',
    textTransform: 'uppercase', marginBottom: 8,
  },
  logoDot: {
    display: 'inline-block',
    width: 7, height: 7, borderRadius: '50%',
    background: '#16A34A',
    boxShadow: '0 0 6px rgba(22,163,74,0.4)',
    marginRight: 8, verticalAlign: 'middle',
  },
  logoName: {
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 17, fontWeight: 700,
    color: '#1A261A', letterSpacing: '-0.01em',
    display: 'flex', alignItems: 'center',
  },
  logoSub: {
    fontFamily: "'Inter',sans-serif",
    fontSize: 11, color: '#7A967A', marginTop: 4,
  },
  nav: { padding: '14px 10px', flex: 1 },
  footer: {
    padding: '14px 20px',
    borderTop: 'none',
    fontSize: 10,
    fontFamily: "'JetBrains Mono',monospace",
    color: '#A8C4A8', letterSpacing: '0.06em',
    display: 'flex', alignItems: 'center', gap: 6,
  },
}

const MONO = "'JetBrains Mono',monospace"

function ChangePasswordModal({ onClose }) {
  const [cur,    setCur]    = useState('')
  const [next,   setNext]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState(false)
  const [busy,   setBusy]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (next.length < 8)         return setErr('New password must be at least 8 characters')
    if (next !== confirm)        return setErr('Passwords do not match')
    setBusy(true)
    const res = await api.changePassword(cur, next)
    setBusy(false)
    if (res.ok) { setOk(true); setTimeout(onClose, 1200) }
    else        setErr(res.error)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px',
    fontFamily: MONO, fontSize: 12,
    border: '1.5px solid #EAEDEA', borderRadius: 6,
    background: '#FAFBFC', color: '#1A261A', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10,
        padding: '28px 24px', width: 300,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#1A261A', margin: '0 0 20px' }}>
          change_password
        </p>

        {ok ? (
          <p style={{ fontFamily: MONO, fontSize: 11, color: '#16A34A', textAlign: 'center' }}>
            ✓ Password updated
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {[
              { label: 'current', value: cur,     set: setCur     },
              { label: 'new',     value: next,    set: setNext    },
              { label: 'confirm', value: confirm, set: setConfirm },
            ].map(({ label, value, set }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, color: '#9BB09B', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {label}
                </label>
                <input
                  type="password"
                  value={value}
                  onChange={e => set(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            ))}

            {err && (
              <p style={{ fontFamily: MONO, fontSize: 10, color: '#DC2626', margin: '0 0 12px', padding: '6px 10px', background: 'rgba(220,38,38,0.06)', borderRadius: 4 }}>
                ✕ {err}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: '8px 0',
                fontFamily: MONO, fontSize: 10, fontWeight: 600,
                background: 'none', border: '1.5px solid #EAEDEA',
                borderRadius: 6, color: '#9BB09B', cursor: 'pointer',
              }}>
                cancel
              </button>
              <button type="submit" disabled={busy} style={{
                flex: 1, padding: '8px 0',
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                background: busy ? '#C0D0C0' : '#16A34A',
                border: 'none', borderRadius: 6,
                color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
              }}>
                {busy ? 'saving...' : 'save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function Sidebar() {
  const logout   = useAuthStore((s) => s.logout)
  const username = useAuthStore((s) => s.username)
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside style={S.aside}>
      <div style={S.logoWrap}>
        <p style={S.logoPrefix}>~/mushroom-aiot</p>
        <p style={S.logoName}>
          <span style={S.logoDot} />
          GreenHouse
        </p>
        <p style={S.logoSub}>AIoT Platform · v0.1</p>
      </div>

      <nav style={S.nav}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "'Inter',sans-serif",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#16A34A' : '#7A967A',
              background: isActive ? '#FFFFFF' : 'transparent',
              border: 'none',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)' : 'none',
              textDecoration: 'none',
              transition: 'all 0.15s',
              marginBottom: 2,
            })}
          >
            <span style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 13,
              opacity: 0.7,
            }}>
              {icon}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={S.footer}>
        <div style={{ flex: 1 }}>
          <span style={{ color: '#16A34A', fontSize: 8 }}>● </span>
          {username ?? 'admin'} · rack-1
        </div>
        <button
          onClick={() => setShowPwd(true)}
          style={{
            fontFamily: MONO,
            fontSize: 9, color: '#9BB09B',
            background: 'none', border: 'none',
            cursor: 'pointer', letterSpacing: '0.06em',
            padding: '0 6px 0 0',
          }}
        >
          passwd
        </button>
        <button
          onClick={handleLogout}
          style={{
            fontFamily: MONO,
            fontSize: 9, color: '#9BB09B',
            background: 'none', border: 'none',
            cursor: 'pointer', letterSpacing: '0.06em',
            padding: 0,
          }}
        >
          logout
        </button>
      </div>

      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
    </aside>
  )
}
