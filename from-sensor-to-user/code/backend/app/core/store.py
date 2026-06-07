from collections import deque
from datetime import datetime
from typing import Optional

from app.models.enums import MQTTStatus
from app.models.schemas import AIPayload, ControlPayload, DevicesPayload, EnvironmentPayload

HISTORY_MAX = 200


class AppStore:
    """
    In-memory state store — single source of truth for latest sensor data.
    Shared across MQTT service, REST routes, and WebSocket broadcaster.
    Phase 2: swap deques for InfluxDB / SQLite writes.
    """

    def __init__(self):
        self.environment:  Optional[EnvironmentPayload] = None
        self.devices:      Optional[DevicesPayload]     = None
        self.ai:           Optional[AIPayload]          = None
        self.control:      ControlPayload               = ControlPayload()
        self.last_updated: Optional[datetime]           = None
        self.mqtt_status:  MQTTStatus                   = MQTTStatus.disconnected

        # Weather forecast + proactive recommendations
        self.prediction:        Optional[dict] = None
        # Log of auto-commands sent by the proactive scheduler (newest first, max 20)
        self.scheduled_actions: list           = []

        self.history_environment: deque = deque(maxlen=HISTORY_MAX)
        self.history_devices:     deque = deque(maxlen=HISTORY_MAX)
        self.history_ai:          deque = deque(maxlen=HISTORY_MAX)

    def update_environment(self, payload: EnvironmentPayload, ts: datetime) -> None:
        self.environment = payload
        self.last_updated = ts
        self.history_environment.append(payload.model_dump(mode="json"))

    def update_devices(self, payload: DevicesPayload, ts: datetime) -> None:
        self.devices = payload
        self.last_updated = ts
        self.history_devices.append({"timestamp": ts.isoformat(), **payload.model_dump()})

    def update_ai(self, payload: AIPayload, ts: datetime) -> None:
        self.ai = payload
        self.last_updated = ts
        self.history_ai.append({"timestamp": ts.isoformat(), **payload.model_dump()})

    def update_prediction(self, data: dict) -> None:
        self.prediction = data

    def add_scheduled_action(self, action: dict) -> None:
        """Prepend action log entry; keep last 20."""
        self.scheduled_actions = [action, *self.scheduled_actions[:19]]

    def update_control(self, payload: ControlPayload) -> None:
        self.control = payload

    def set_mqtt_status(self, status: MQTTStatus) -> None:
        self.mqtt_status = status

    def to_state_dict(self) -> dict:
        return {
            "environment":  self.environment.model_dump(mode="json")  if self.environment  else None,
            "devices":      self.devices.model_dump(mode="json")      if self.devices      else None,
            "ai":           self.ai.model_dump(mode="json")           if self.ai           else None,
            "control":      self.control.model_dump(mode="json"),
            "last_updated": self.last_updated.isoformat()             if self.last_updated else None,
            "mqtt_status":  self.mqtt_status.value,
            "prediction":        self.prediction,
            "scheduled_actions": self.scheduled_actions,
        }


# Singleton — import this everywhere
store = AppStore()
