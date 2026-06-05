import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { api } from '../services/api'
import socket from '../services/socket'
import { useGreenhouseStore } from '../store/useGreenhouseStore'
import { ConnectionStatus, useSocketStore } from '../store/useSocketStore'

export function useSocket() {
  const setFromSocketEvent = useGreenhouseStore((s) => s.setFromSocketEvent)
  const seedHistory        = useGreenhouseStore((s) => s.seedHistory)
  const setStatus          = useSocketStore((s) => s.setStatus)
  const setMqttStatus      = useSocketStore((s) => s.setMqttStatus)

  useEffect(() => {
    setStatus(ConnectionStatus.CONNECTING)
    socket.connect()

    function onConnect() {
      setStatus(ConnectionStatus.CONNECTED)
      Promise.all([
        api.environmentHistory(200),
        api.devicesHistory(200),
        api.aiHistory(200),
      ]).then(([env, dev, ai]) => {
        seedHistory({ envHistory: env.data, devHistory: dev.data, aiHistory: ai.data })
      }).catch((err) => console.warn('[API] seed failed:', err))
    }

    function onDisconnect()   { setStatus(ConnectionStatus.DISCONNECTED) }
    function onConnectError() { setStatus(ConnectionStatus.ERROR) }
    function onState(payload) {
      setFromSocketEvent(payload)
      if (payload.mqtt_status) setMqttStatus(payload.mqtt_status)
    }

    socket.on('connect',       onConnect)
    socket.on('disconnect',    onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('state',         onState)

    return () => {
      socket.off('connect',       onConnect)
      socket.off('disconnect',    onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('state',         onState)
      socket.disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useGreenhouseSnapshot() {
  return useGreenhouseStore(useShallow((s) => ({
    environment: s.environment,
    devices:     s.devices,
    ai:          s.ai,
    lastUpdated: s.lastUpdated,
  })))
}

export function useEnvironment() {
  return useGreenhouseStore(useShallow((s) => ({ data: s.environment, history: s.envHistory })))
}

export function useDevices() {
  return useGreenhouseStore(useShallow((s) => ({ data: s.devices, history: s.devHistory })))
}

export function useAI() {
  return useGreenhouseStore(useShallow((s) => ({ data: s.ai, history: s.aiHistory })))
}

export function useConnectionStatus() {
  return useSocketStore(useShallow((s) => ({ status: s.status, mqttStatus: s.mqttStatus })))
}
