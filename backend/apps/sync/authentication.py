"""Authentication helpers for companion-device sessions.

Main-station tokens are regular account tokens.  Tokens issued by the QR/PIN
claim flow additionally carry a device id and session version; those claims
let the server revoke one companion without signing out the account owner.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import ConnectedDevice


DEVICE_ID_CLAIM = "companion_device_id"
DEVICE_SESSION_CLAIM = "companion_session_version"


def validate_companion_claims(token):
    """Raise a structured 401 when a companion token has been revoked."""
    device_id = token.get(DEVICE_ID_CLAIM)
    if not device_id:
        # A normal Main PC account session is deliberately not device-bound.
        return None

    session_version = token.get(DEVICE_SESSION_CLAIM)
    is_valid = ConnectedDevice.objects.filter(
        user_id=token.get("user_id"),
        device_id=device_id,
        is_active=True,
        session_version=session_version,
    ).exists()
    if not is_valid:
        raise InvalidToken({
            "detail": "This sub system was removed from the Main PC.",
            "code": "device_revoked",
        })
    return device_id


class CompanionAwareJWTAuthentication(JWTAuthentication):
    """JWT authentication which rejects revoked QR/PIN companion sessions."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        validate_companion_claims(token)
        return token
