from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # MQTT
    mqtt_broker: str = "broker.emqx.io"
    mqtt_port: int = 1883
    mqtt_topic_prefix: str = "mushroom-farm"
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_ca_cert: str = ""   # path to CA cert file, required for port 8883

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Auth (JWT)
    auth_secret_key: str = "change-this-secret-key-in-production"
    auth_algorithm: str = "HS256"
    auth_token_expire_hours: int = 24

    # Supabase — must use service_role key (not anon key) to bypass RLS
    supabase_url: str = ""
    supabase_key: str = ""

    # Telegram notifications
    telegram_bot_token: str = ""
    telegram_chat_id:   str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def topic_environment(self) -> str:
        return f"{self.mqtt_topic_prefix}/rack-1/environment"

    @property
    def topic_devices(self) -> str:
        return f"{self.mqtt_topic_prefix}/rack-1/devices"

    @property
    def topic_ai(self) -> str:
        return f"{self.mqtt_topic_prefix}/rack-1/ai"

    @property
    def topic_config(self) -> str:
        return f"{self.mqtt_topic_prefix}/rack-1/config"

    @property
    def topic_command(self) -> str:
        return f"{self.mqtt_topic_prefix}/rack-1/command"

    @property
    def topic_wildcard(self) -> str:
        return f"{self.mqtt_topic_prefix}/#"


settings = Settings()
