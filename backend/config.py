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
    SUPPORTED_CHAIN_IDS: List[int] = [1, 137, 80002, 11155111, 31337, 84532, 421614, 11155420]

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
    # GitHub App Credentials (Multi-Tenant Integration)
    GITHUB_APP_ID: str = os.getenv("GITHUB_APP_ID", "4802496")
    GITHUB_APP_CLIENT_ID: str = os.getenv("GITHUB_APP_CLIENT_ID", "Iv23liymNV2R7YU7Wtbx")
    GITHUB_APP_CLIENT_SECRET: str = os.getenv("GITHUB_APP_CLIENT_SECRET", "01db4c0c1346d75cdbddc7dbf10a9071bad43bdf")
    GITHUB_APP_PRIVATE_KEY: str = os.getenv("GITHUB_APP_PRIVATE_KEY", """-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAsCWgiOtTpDlVyoQDksatGdRqEsz+WwJ2K4Wjk9yMRfRwr8+m
nq3mzoYF7omZ7iHfPV8GcxOGCJkWaGzhv3TO22jHgc7KDfty8dwv+zVg53G3p376
bU7y7zAZHIh806HgPrfQigORuo39wmW3ma9XQyZfVh1zg/eivd1tCTOuf78f+ag7
kcwkS/n0mOqAk2lKMei3+Hmvr5Uu4CQZ6J54S5zq0KvTjouwCIvgglcLBzeSWv0r
/dOWb1m2zOkClN5fAvT2FvrMbJ4NsLsB8OflFiq8QFnUvS3qM0nwBnOHfBzR73in
dkn8zHY+A3DLQK6P5gOEwthNnt2U51+0+/UXewIDAQABAoIBAHUdr20ZuhT4ohfy
SkXunu0LlDNH5N4x9svdIPOQshtY+QuL7uaWDV3HMm51QslX8AvoAGvG0VkqIAHy
Uu5vBZJQSkX+bc16H+S7V5OY3ANGUquk+3BuC4wI2Mll3kj/2g8ZPChnUx9MhSoZ
Y0dlk4lsG/svvbxCjAvdC0ARAragDIlpMiBYjZ+5v4nWDstcdeTXYeNcQzSbtgQO
MDKQYgm58ijrU1PDAezPZnS34s95sALBc/U6u9GFFlISKIfEqcbccpIxEDinKuZd
vdpHOzfxhpPGTjWHi5HNIyvBXC6+md56Hxs1Vqx+4Cq3XcGO2Zs1dhmq/HBVHq0x
plcfDaECgYEA1cVrtlL71PINlLa3zCMkdNRPnMOHybPBeFupnVMw7pZfflRPaLmr
g2u1kr21CZjmtH3hitDQ33U2CZxxcf3p4P67Ss6ugatnEN9mw7laxHVfUSokToyL
tjMfbfkIuWZ1a/vNZv4SrM78YQ6OPIBq8NTcrh3vvel4BR5UFWvk5PkCgYEA0vGF
ULOVHO4JkPFbrH+2gjDJjzwlmHmJRbG0GJXxBK8kR3fCCu6wUV48hb64c3s89AWX
G4Od4XnPl/M1+NlWFGi/DE+q4Ms0u/KvFPxWBbaiOyZ9VEzGz2BcNJEcCFRQDlMm
iV8Ocjshr6+M3HX/8g7LoFQVrmRk2ckpNn0UIRMCgYB1/LzyqOKuKdstFZxkY5Ef
mn9GevVbcod6Mr1vRBdh2EVkqIwbtT7hDnXtRB/D6EyNmlz+DTr72um0bFCBJjAM
KwycwW63yy7btTI3HProLBAr8CKR6CjEq3rRa/5QtihhLV21Vs5f6u6Jc0s2QXrE
6ffTclp8a3v+9zpZiG+RoQKBgQDDWH0AHj5Bm0LqokkmNuM6L5oI9kdOq4ZvL0C7
3+diUhtDv+jHnQFVaPKdXOCNuRvaU277QOitjNOtQMLDn+kyX0pFSWXSZPyB7R0s
Tv4OrnIQWvWHYs5d7zuURqlyITo9+czfPFMxgAcTHnxREUmjzQXPhO7LIBexA7QR
zMUeVwKBgH/ILqNcyYlF/MDp7ni/bJ/Zv5HYMOQZLwcrSkFJf0pYTkIA4uzYlIWH
a5BXNR5EN1h7AMj2KjzoY43NEz+nlQ404nFp605YODY+K7lL3EeGzr5fVP2bfu3x
+fr02dpcYhAPeF1DF1zqumQBaQwstakmixdR9gntqVqfQdiCV6Fa
-----END RSA PRIVATE KEY-----""")
    GITHUB_APP_SLUG: str = os.getenv("GITHUB_APP_SLUG", "agentchainapp")

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

