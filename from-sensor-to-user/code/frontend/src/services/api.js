import { getToken } from '../store/useAuthStore'

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized') }
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized') }
  return res
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized') }
  return res
}

export const api = {
  health:             ()             => get('/api/health'),
  state:              ()             => get('/api/state'),
  environmentHistory: (limit = 100) => get(`/api/environment/history?limit=${limit}`),
  devicesHistory:     (limit = 100) => get(`/api/devices/history?limit=${limit}`),
  aiHistory:          (limit = 100) => get(`/api/ai/history?limit=${limit}`),

  getControl: () => get('/api/control'),
  setControl: (payload) =>
    post('/api/control', payload).then(r => {
      if (r.status === 503) return r.json().then(d => ({ _mqttDown: true, ...d }))
      if (!r.ok) throw new Error(`POST /api/control → ${r.status}`)
      return r.json()
    }),

  sendCommand: (payload) =>
    post('/api/control/command', payload).then(r => {
      if (r.status === 204) return
      return r.json().then(d => Promise.reject(d))
    }),

  changePassword: (currentPassword, newPassword) =>
    put('/api/auth/change-password', {
      current_password: currentPassword,
      new_password:     newPassword,
    }).then(async r => {
      if (r.status === 204) return { ok: true }
      const data = await r.json().catch(() => ({}))
      return { ok: false, error: data.detail ?? `Error ${r.status}` }
    }),
}
