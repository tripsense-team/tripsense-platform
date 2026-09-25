from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    ai_database_url: str = "sqlite:///./tripsense_ai.db"
    jwt_access_secret: str = ""
    openai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    ai_model_base_url: str | None = None
    ai_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    eureka_server: str | None = "http://localhost:8761/eureka/"
    ai_service_port: int = 8085
    max_message_chars: int = 8000
    max_context_messages: int = 20
    max_output_tokens: int = 1200
    run_timeout_seconds: int = 600
    per_user_active_runs: int = 3
    per_user_requests_per_minute: int = 10
    model_input_cost_per_million: float = 0
    model_output_cost_per_million: float = 0
    place_service_url: str = "http://place-service:8082"
    trip_service_url: str = "http://trip-service:8084"
    user_service_url: str = "http://user-service:8081"
    tool_timeout_seconds: float = 60.0
    max_tool_response_bytes: int = 262_144
    max_tool_calls_per_run: int = 4
    weather_provider: str = "mock"
    routing_provider: str = "mock"
    brave_search_api_key: str = ""
    max_web_searches_per_run: int = 2
    routing_osrm_base_url: str = ""
    run_lease_seconds: int = 600
    run_lease_poll_millis: int = 100
    max_clarifications_per_goal: int = 2
    summary_recent_messages: int = 8

    @property
    def allowed_origins(self) -> list[str]:
        return [value.strip() for value in self.ai_allowed_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
