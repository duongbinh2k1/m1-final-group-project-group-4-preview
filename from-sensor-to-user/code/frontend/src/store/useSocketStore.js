import { create } from 'zustand'

export const ConnectionStatus = {
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  DISCONNECTED: 'disconnected',
  ERROR:        'error',
}

export const useSocketStore = create((set) => ({
  status:    ConnectionStatus.DISCONNECTED,
  mqttStatus: 'disconnected',   // forwarded from backend

  setStatus:     (status)     => set({ status }),
  setMqttStatus: (mqttStatus) => set({ mqttStatus }),
}))
