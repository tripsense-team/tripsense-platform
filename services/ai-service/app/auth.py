import uuid
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> str:
    if not credentials or credentials.scheme.lower() != "bearer" or not settings.jwt_access_secret:
        raise HTTPException(401, detail={"code": "UNAUTHENTICATED", "message": "Valid access token required", "retryable": False})
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_access_secret, algorithms=["HS256"])
        if claims.get("type") != "ACCESS":
            raise ValueError("not an access token")
        return str(uuid.UUID(claims["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, detail={"code": "UNAUTHENTICATED", "message": "Invalid or expired access token", "retryable": False})

