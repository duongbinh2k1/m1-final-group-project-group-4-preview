import { useEffect } from 'react'
import { api } from '../services/api'
import socket from '../services/socket'
import { useGreenhouseStore } from '../store/useGreenhouseStore'
import { ConnectionStatus, useSocketStore } from '../store/useSocketStore'

/**
 * Call once at the top of the app (App.jsx).
 * Connects the socket, wires all events, seeds history from REST on first connect.
 */
export function useSocket() {
  const setFromSocketEvent = useGreenhouseStore((s) => s.setFromSocketEvent)
  const seedHistory        = useGreenhouseStore((s) => s.seedHistory)
  const setStatus          = useSocketStore((s) => s.setStatus)
  const setMqttStatus      = useSocketStore((s) => s.setMqttStatus)

  useEffect(() => {
    // ── Connect ──────────────────────────────────────────────────────
    setStatus(ConnectionStatus.CONNECTING)
    socket.connect()

    // ── Socket events ─────────────────────────────────────────────────
    function onConnect() {
      setStatus(ConnectionStatus.CONNECTED)
      console.log('[Socket] Connected', socket.id)

      // Seed history once from REST so charts have data immediately
      Promise.all([
        api.environmentHistory(200),
        api.devicesHistory(200),
        api.aiHistory(200),
      ]).then(([env, dev, ai]) => {
        seedHistory({
          envHistory: env.data,
          devHistory: dev.data,
          aiHistory:  ai.data,
        })
      }).catch((err) => console.warn('[API] History seed failed:', err))
    }

    function onDisconnect(reason) {
      setStatus(ConnectionStatus.DISCONNECTED)
      console.log('[Socket] Disconnected:', reason)
    }

    function onConnectError(err) {
      setStatus(ConnectionStatus.ERROR)
      console.error('[Socket] Connection error:', err.message)
    }

    function onState(payload) {
      setFromSocketEvent(payload)
      if (payload.mqtt_status) setMqttStatus(payload.mqtt_status)
    }

    socket.on('connect',       onConnect)
    socket.on('disconnect',    onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('state',         onState)

    // ── Cleanup on unmount ────────────────────────────────────────────
    return () => {
      socket.off('connect',       onConnect)
      socket.off('disconnect',    onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('state',         onState)
      socket.disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
