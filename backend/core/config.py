"""
Application configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "PathProject"
    debug: bool = True

    # Google Maps
    google_maps_api_key: str = ""

    # Google OAuth (Calendar integration)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/callback"

    # Groq — used by the decision agent (runs Llama on fast inference)
    groq_api_key: str = ""

    # Routing mode: "live" uses Google Maps API, "mock" uses synthetic data
    routing_mode: str = "mock"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
