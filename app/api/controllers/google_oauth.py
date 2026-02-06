from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse

from app.config.env import settings
from app.services.auth_service import AuthService

router = APIRouter(tags=["auth"])


@router.get("/auth/google/callback")
async def google_callback(
    code: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
):
    """Callback endpoint для Google OAuth2."""
    async with AuthService() as service:
        auth_code = await service.finish_google_oauth(code=code, state=state)

    redirect_url = f"{settings.frontend_base_url.rstrip('/')}/dashboard?auth_code={auth_code}"
    return RedirectResponse(url=redirect_url, status_code=302)
