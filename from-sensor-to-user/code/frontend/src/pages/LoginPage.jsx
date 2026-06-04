import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
const MONO = "'JetBrains Mono',monospace"

export function LoginPage() {
  const login    = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Login failed')
        return
      }
      login(data.access_token, username)
      navigate('/')
    } catch {
      setError('Cannot reach backend. Check connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F6F8',
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 12,
        padding: '40px 36px',
        width: 360,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: MONO, fontSize: 10, color: '#9BB09B', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            ~/mushroom-aiot
          </p>
          <p style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#1A261A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', boxShadow: '0 0 6px rgba(22,163,74,0.4)' }} />
            GreenHouse
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#9BB09B', margin: '4px 0 0' }}>
            AIoT Platform · Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: MONO, fontSize: 10, color: '#9BB09B', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
              username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px',
                fontFamily: MONO, fontSize: 13,
                border: '1.5px solid #EAEDEA', borderRadius: 6,
                outline: 'none', color: '#1A261A', background: '#FAFBFC',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontFamily: MONO, fontSize: 10, color: '#9BB09B', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
              password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px',
                fontFamily: MONO, fontSize: 13,
                border: '1.5px solid #EAEDEA', borderRadius: 6,
                outline: 'none', color: '#1A261A', background: '#FAFBFC',
              }}
            />
          </div>

          {error && (
            <p style={{ fontFamily: MONO, fontSize: 11, color: '#DC2626', margin: '0 0 16px', padding: '8px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: 6 }}>
              ✕ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 0',
              fontFamily: MONO, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              background: loading ? '#C0D0C0' : '#16A34A',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'signing_in...' : 'sign_in'}
          </button>
        </form>
      </div>
    </div>
  )
}
