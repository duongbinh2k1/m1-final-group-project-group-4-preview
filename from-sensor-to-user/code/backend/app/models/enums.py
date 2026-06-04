from enum import Enum


class HealthStatus(str, Enum):
    healthy  = "healthy"
    warning  = "warning"
    critical = "critical"


class MQTTStatus(str, Enum):
    connected    = "connected"
    disconnected = "disconnected"
    error        = "error"


class ControlMode(str, Enum):
    off    = "off"
    auto   = "auto"
    manual = "manual"
