import time
import jwt
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from backend.config import settings

logger = logging.getLogger("agentchain.github_app_auth")

# Dynamic fallback RSA private key for testing/dev environments without a live GitHub App private key
_FALLBACK_RSA_KEY = None

def _get_fallback_private_key() -> str:
  global _FALLBACK_RSA_KEY
  if not _FALLBACK_RSA_KEY:
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    _FALLBACK_RSA_KEY = pem.decode('utf-8')
  return _FALLBACK_RSA_KEY


class GitHubAppAuthService:
  """Cryptographic authentication helper for GitHub App RS256 JWTs and OAuth State Tokens."""

  @staticmethod
  def generate_app_jwt() -> str:
    """Signs an RS256 JWT to authenticate as the GitHub App (valid for 10 minutes)."""
    now = int(time.time())
    payload = {
        'iat': now - 60,  # Issued 60s in past to account for clock drift
        'exp': now + (10 * 60),  # Expires in 10 minutes (GitHub App max)
        'iss': str(settings.GITHUB_APP_ID),
    }

    private_key = settings.GITHUB_APP_PRIVATE_KEY
    if private_key and isinstance(private_key, str) and '\\n' in private_key:
        private_key = private_key.replace('\\n', '\n')

    if not private_key or 'BEGIN' not in private_key:
      private_key = _get_fallback_private_key()

    try:
      token = jwt.encode(payload, private_key, algorithm='RS256')
      return token
    except Exception as e:
      logger.error(f'Failed to sign GitHub App JWT: {e}')
      # Fallback to test key if custom private key was malformed
      return jwt.encode(payload, _get_fallback_private_key(), algorithm='RS256')

  @staticmethod
  def generate_state_token(
      user_id: str,
      redirect_path: str = '/dashboard/settings/connected-accounts',
  ) -> str:
    """Generates a signed, short-lived (15 min) HS256 state token for GitHub App install flow."""
    payload = {
        'sub': user_id,
        'redirect_path': redirect_path,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

  @staticmethod
  def verify_state_token(state_token: str) -> Optional[Dict[str, Any]]:
    """Verifies state token signature and expiration, returning state claims."""
    try:
      payload = jwt.decode(
          state_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
      )
      return {
          'user_id': payload.get('sub'),
          'redirect_path': payload.get(
              'redirect_path', '/dashboard/settings/connected-accounts'
          ),
      }
    except Exception as e:
      logger.warning(f'GitHub App state verification failed: {e}')
      return None


github_app_auth = GitHubAppAuthService()
