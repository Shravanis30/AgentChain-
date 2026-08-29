import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="allow"
    )

    PROJECT_NAME: str = "AgentChain Enterprise Platform API"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Security & JWT Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "agentchain-enterprise-super-secret-key-32bytes!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours
    SIWE_NONCE_EXPIRE_SECONDS: int = int(os.getenv("SIWE_NONCE_EXPIRE_SECONDS", "300")) # 5 minutes

    # SIWE Specifications
    SIWE_DOMAIN: str = os.getenv("SIWE_DOMAIN", "agentchain.ai")
    SIWE_URI: str = os.getenv("SIWE_URI", "https://agentchain.ai")
    SUPPORTED_CHAIN_IDS: List[int] = [137, 80002, 1]

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./agentchain.db"
    )
    DATABASE_ECHO: bool = False

    # Redis Cache & Nonce Store
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Vector DB (Qdrant)
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_COLLECTION: str = "agentchain_knowledge"

    # AI Model Provider Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")

    # Blockchain & Smart Contracts
    POLYGON_RPC_URL: str = os.getenv("POLYGON_RPC_URL", "https://rpc-amoy.polygon.technology")
    CHAIN_ID: int = int(os.getenv("CHAIN_ID", "80002")) # Polygon Amoy Testnet
    MARKETPLACE_CONTRACT_ADDRESS: str = os.getenv("MARKETPLACE_CONTRACT_ADDRESS", "0x1234567890123456789012345678901234567890")
    REGISTRY_CONTRACT_ADDRESS: str = os.getenv("REGISTRY_CONTRACT_ADDRESS", "0x0987654321098765432109876543210987654321")
    SETTLEMENT_ORACLE_PRIVATE_KEY: str = os.getenv("SETTLEMENT_ORACLE_PRIVATE_KEY", "")

    # Event Indexer Configuration
    INDEXER_POLL_INTERVAL_SECONDS: float = float(os.getenv("INDEXER_POLL_INTERVAL_SECONDS", "2.0"))
    CONFIRMATION_DEPTH: int = int(os.getenv("CONFIRMATION_DEPTH", "2"))
    REORG_LIMIT: int = int(os.getenv("REORG_LIMIT", "20"))
    MAX_RPC_RETRIES: int = int(os.getenv("MAX_RPC_RETRIES", "5"))

    # Revenue Split Basis Points (Total = 10000 BPS = 100%)
    DEV_SPLIT_BPS: int = 8500 # 85%
    STAKER_SPLIT_BPS: int = 1000 # 10%
    DAO_SPLIT_BPS: int = 500 # 5%

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]

    def validate_security(self) -> None:
        """Validates configuration security constraints, failing fast on insecure defaults."""
        if self.ENVIRONMENT == "production":
            if "super-secret" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError("CRITICAL SECURITY RISK: Insecure or default SECRET_KEY in production mode!")
            if "sqlite" in self.DATABASE_URL:
                raise ValueError("CRITICAL SECURITY RISK: SQLite database is prohibited in production. Use PostgreSQL.")
            if not self.REDIS_URL:
                raise ValueError("CRITICAL SECURITY RISK: REDIS_URL must be configured in production.")
            if "*" in self.CORS_ORIGINS:
                raise ValueError("CRITICAL SECURITY RISK: Wildcard CORS origin is prohibited in production.")
            if self.MARKETPLACE_CONTRACT_ADDRESS == "0x0000000000000000000000000000000000000000":
                raise ValueError("CRITICAL SECURITY RISK: Unconfigured MARKETPLACE_CONTRACT_ADDRESS in production.")
            if not self.SETTLEMENT_ORACLE_PRIVATE_KEY:
                raise ValueError("CRITICAL SECURITY RISK: SETTLEMENT_ORACLE_PRIVATE_KEY must be configured in production.")

settings = Settings()
settings.validate_security()

