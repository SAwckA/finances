from fastapi import APIRouter
from pydantic import BaseModel

from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshRequest(BaseModel):
    """Схема запроса на обновление токенов."""

    refresh_token: str


class GoogleExchangeRequest(BaseModel):
    """Схема запроса обмена одноразового auth_code на JWT."""

    auth_code: str


class GoogleStartResponse(BaseModel):
    """Схема ответа с URL инициации Google OAuth."""

    authorization_url: str


class TokenResponseSchema(BaseModel):
    """Схема ответа с токенами."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.get("/google/start", response_model=GoogleStartResponse)
async def google_start():
    """Инициация входа через Google OAuth2."""
    async with AuthService() as service:
        authorization_url = await service.build_google_authorization_url()
        return GoogleStartResponse(authorization_url=authorization_url)


@router.post("/google/exchange", response_model=TokenResponseSchema)
async def google_exchange(data: GoogleExchangeRequest):
    """Обмен одноразового auth_code на access/refresh токены."""
    async with AuthService() as service:
        result = await service.exchange_google_auth_code(data.auth_code)
        return TokenResponseSchema(
            access_token=result.access_token,
            refresh_token=result.refresh_token,
            token_type=result.token_type,
        )


@router.post("/refresh", response_model=TokenResponseSchema)
async def refresh_tokens(data: RefreshRequest):
    """Обновление токенов."""
    async with AuthService() as service:
        result = await service.refresh_tokens(data.refresh_token)
        return TokenResponseSchema(
            access_token=result.access_token,
            refresh_token=result.refresh_token,
            token_type=result.token_type,
        )
