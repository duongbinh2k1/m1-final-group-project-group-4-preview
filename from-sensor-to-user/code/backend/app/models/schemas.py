from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ControlMode, HealthStatus, MQTTStatus


# ─── Control config ──────────────────────────────────────────────────────────

class ThresholdsPayload(BaseModel):
    temp_fan_on:     float = Field(30.0, ge=-20, le=80,  description="°C — fan turns ON above this")
    humidity_fan_on: float = Field(50.0, ge=0,   le=100, description="% — fan turns ON below this")
    soil_pump_on:    float = Field(25.0, ge=0,   le=100, description="% — pump turns ON below this")


class ControlPayload(BaseModel):
    mode:       ControlMode       = ControlMode.auto
    thresholds: ThresholdsPayload = Field(default_factory=ThresholdsPayload)


class CommandPayload(BaseModel):
    device:   str            = Field(..., pattern="^(fan|pump)$", description="fan or pump")
    state:    Optional[bool] = Field(None, description="true=CMD_ON, false=CMD_OFF, null=CMD_NONE (release to mode)")
    duration: int            = Field(0, ge=0, le=3600, description="seconds before auto-off; 0 = no timer")


# ─── Incoming MQTT payloads ───────────────────────────────────────────────────

class EnvironmentPayload(BaseModel):
    timestamp:       datetime
    air_temperature: float = Field(..., ge=-20, le=80,  description="°C")
    air_humidity:    float = Field(..., ge=0,   le=100, description="%")
    soil_moisture:   float = Field(..., ge=0,   le=100, description="%")

    @field_validator("timestamp", mode="before")
    @classmethod
    def _parse_unix_ts(cls, v):
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v, tz=timezone.utc)
        return v


class DevicesPayload(BaseModel):
    fan:  bool
    pump: bool


class AIPayload(BaseModel):
    status: HealthStatus


# ─── API responses ────────────────────────────────────────────────────────────

# timestamp is now part of the payload itself
EnvironmentRecord = EnvironmentPayload


class DevicesRecord(DevicesPayload):
    timestamp: datetime


class AIRecord(AIPayload):
    timestamp: datetime


class StateResponse(BaseModel):
    environment:  Optional[EnvironmentPayload] = None
    devices:      Optional[DevicesPayload]     = None
    ai:           Optional[AIPayload]          = None
    last_updated: Optional[datetime]           = None
    mqtt_status:  MQTTStatus                   = MQTTStatus.disconnected


class HistoryResponse(BaseModel):
    data:  list
    count: int


class HealthResponse(BaseModel):
    status:      str
    mqtt_status: MQTTStatus
    last_updated: Optional[datetime]
    history_counts: dict[str, int]
