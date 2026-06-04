import { io } from 'socket.io-client'
import { getToken } from '../store/useAuthStore'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

// Singleton — one connection for the entire app lifetime.
// Token is read lazily at connect time so it's always fresh after login.
const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling'],
  auth: (cb) => cb({ token: `Bearer ${getToken() ?? ''}` }),
})

export default socket
