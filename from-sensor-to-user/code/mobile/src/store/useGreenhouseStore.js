import { create } from 'zustand'

export const useGreenhouseStore = create((set) => ({
  environment: null,
  devices:     null,
  ai:          null,
  control:     null,
  lastUpdated: null,
  prediction:  null,
  envHistory:  [],
  devHistory:  [],
  aiHistory:   [],

  setFromSocketEvent: (payload) => set((state) => {
    const next = { lastUpdated: payload.last_updated ?? state.lastUpdated }
    if (payload.control) {
      next.control = payload.control
    }
    if (payload.environment) {
      next.environment = payload.environment
      next.envHistory  = [...state.envHistory, payload.environment].slice(-200)
    }
    if (payload.devices) {
      next.devices    = payload.devices
      next.devHistory = [...state.devHistory, payload.devices].slice(-200)
    }
    if (payload.ai) {
      next.ai        = payload.ai
      next.aiHistory = [...state.aiHistory, payload.ai].slice(-200)
    }
    if (payload.prediction) {
      next.prediction = payload.prediction
    }
    return next
  }),

  seedHistory: ({ envHistory, devHistory, aiHistory }) => set({
    envHistory: envHistory ?? [],
    devHistory: devHistory ?? [],
    aiHistory:  aiHistory  ?? [],
  }),
}))
