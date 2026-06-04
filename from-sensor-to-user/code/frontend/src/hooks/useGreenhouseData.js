import { useGreenhouseStore } from '../store/useGreenhouseStore'
import { useSocketStore } from '../store/useSocketStore'

/** Latest environment reading + history */
export function useEnvironment() {
  return useGreenhouseStore((s) => ({
    data:    s.environment,
    history: s.envHistory,
  }))
}

/** Latest device states + history */
export function useDevices() {
  return useGreenhouseStore((s) => ({
    data:    s.devices,
    history: s.devHistory,
  }))
}

/** Latest AI classification + history */
export function useAI() {
  return useGreenhouseStore((s) => ({
    data:    s.ai,
    history: s.aiHistory,
  }))
}

/** Full state snapshot (for dashboard overview) */
export function useGreenhouseSnapshot() {
  return useGreenhouseStore((s) => ({
    environment: s.environment,
    devices:     s.devices,
    ai:          s.ai,
    lastUpdated: s.lastUpdated,
  }))
}

/** WebSocket + MQTT connection status */
export function useConnectionStatus() {
  return useSocketStore((s) => ({
    status:     s.status,
    mqttStatus: s.mqttStatus,
  }))
}
