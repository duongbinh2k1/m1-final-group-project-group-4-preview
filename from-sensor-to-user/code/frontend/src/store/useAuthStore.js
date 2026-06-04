import { create } from 'zustand'

const TOKEN_KEY = 'mushroom_token'

export const useAuthStore = create((set) => ({
  token:    localStorage.getItem(TOKEN_KEY) ?? null,
  username: null,

  login: (token, username) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, username })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, username: null })
  },
}))

/** Read token without subscribing to the store (for api.js / socket.js) */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
