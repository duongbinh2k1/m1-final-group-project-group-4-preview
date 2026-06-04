import { useEffect } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar }       from './components/layout/Sidebar'
import { useSocket }     from './hooks/useSocket'
import { AppRouter }     from './router'
import { useAuthStore }  from './store/useAuthStore'

function AuthGuard({ children }) {
  const token    = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!token && location.pathname !== '/login') {
      navigate('/login', { replace: true })
    }
  }, [token, location.pathname, navigate])

  return children
}

/**
 * Renders only when authenticated.
 * useSocket() is called here so the socket connects AFTER a valid token
 * exists — prevents the ws:error that occurs when connecting with no token.
 */
function AuthenticatedShell() {
  useSocket()
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F6F8', color: '#1A261A' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <AppRouter />
      </div>
    </div>
  )
}

function AppShell() {
  const token = useAuthStore((s) => s.token)

  // No token → show login page only, no socket connection
  if (!token) return <AppRouter />

  // Token present → mount socket + full shell
  return <AuthenticatedShell />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    </BrowserRouter>
  )
}
