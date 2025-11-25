from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserCreate, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Схема запроса на вход."""

    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    """Схема запроса на обновление токенов."""

    refresh_token: str


class TokenResponseSchema(BaseModel):
    """Схема ответа с токенами."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: UserCreate):
    """Регистрация нового пользователя."""
    async with AuthService() as service:
        return await service.register(data)


@router.post("/login", response_model=TokenResponseSchema)
async def login(data: LoginRequest):
    """Вход в систему."""
    async with AuthService() as service:
        result = await service.login(data.email, data.password)
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
