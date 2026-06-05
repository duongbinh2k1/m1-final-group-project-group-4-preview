import { io } from 'socket.io-client'
import { getToken } from '../store/useAuthStore'

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

const socket = io(BASE, {
  autoConnect:         false,
  transports:          ['polling', 'websocket'], // polling first — more reliable on mobile/Render
  upgrade:             true,                     // upgrade to WS once polling is stable
  reconnection:        true,
  reconnectionDelay:   3000,
  reconnectionAttempts: 15,
  timeout:             20000,
  auth: (cb) => cb({ token: `Bearer ${getToken() ?? ''}` }),
})

export default socket
