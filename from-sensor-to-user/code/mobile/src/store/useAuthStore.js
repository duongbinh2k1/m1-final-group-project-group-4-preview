import { create } from 'zustand'

// In-memory token (re-login required on app restart)
// Upgrade to expo-secure-store for persistence
let _token = null

export const useAuthStore = create((set) => ({
  token:    null,
  username: null,

  login: (token, username) => {
    _token = token
    set({ token, username })
  },

  logout: () => {
    _token = null
    set({ token: null, username: null })
  },
}))

export function getToken() { return _token }
