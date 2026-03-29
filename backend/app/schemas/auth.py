from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    timezone: str
    age_confirmed_18_plus: bool

    @field_validator("age_confirmed_18_plus")
    @classmethod
    def must_be_18(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Must confirm age 18+ to register")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class MFAVerifyRequest(BaseModel):
    """End-user TOTP verification after login when MFA is enabled."""

    mfa_token: str  # short-lived token issued after password check
    otp_code: str  # 6-digit TOTP code from authenticator app
