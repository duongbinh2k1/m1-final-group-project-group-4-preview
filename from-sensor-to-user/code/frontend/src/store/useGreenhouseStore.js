import { create } from 'zustand'

/**
 * Single source of truth for all greenhouse data.
 * Updated exclusively by the useSocket hook via setFromSocketEvent().
 */
export const useGreenhouseStore = create((set) => ({
  // ── Latest state ────────────────────────────────────────────────────
  environment:  null,   // { air_temperature, air_humidity, soil_moisture, timestamp }
  devices:      null,   // { fan, pump }
  ai:           null,   // { status: 'healthy' | 'warning' | 'critical' }
  control:      null,   // { mode: 'off'|'auto'|'manual', thresholds: {...} }
  lastUpdated:  null,   // ISO string

  // ── History (last 200 records each) ─────────────────────────────────
  envHistory: [],
  devHistory: [],
  aiHistory:  [],

  // ── Actions ──────────────────────────────────────────────────────────

  /** Called by useSocket on every "state" event from backend. */
  setFromSocketEvent: (payload) =>
    set((state) => {
      const next = {
        environment: payload.environment  ?? state.environment,
        devices:     payload.devices      ?? state.devices,
        ai:          payload.ai           ?? state.ai,
        control:     payload.control      ?? state.control,
        lastUpdated: payload.last_updated ?? state.lastUpdated,
      }

      // Append to history if we got fresh data
      // environment already carries its own timestamp from the device firmware
      const ts = payload.last_updated
      return {
        ...next,
        envHistory: payload.environment
          ? [...state.envHistory.slice(-199), payload.environment]
          : state.envHistory,
        devHistory: payload.devices
          ? [...state.devHistory.slice(-199), { ...payload.devices, timestamp: ts }]
          : state.devHistory,
        aiHistory: payload.ai
          ? [...state.aiHistory.slice(-199), { ...payload.ai, timestamp: ts }]
          : state.aiHistory,
      }
    }),

  /** Seed initial history from REST API on page load. */
  seedHistory: ({ envHistory, devHistory, aiHistory }) =>
    set({ envHistory, devHistory, aiHistory }),
}))
