"""
WebSocket consumer for real-time synchronization.
Supports JWT authentication via query string (?token=<access_token>)
or via an initial 'auth' message containing the token.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from .authentication import validate_companion_claims
from .models import ConnectedDevice

logger = logging.getLogger(__name__)
User = get_user_model()


class SyncConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer handling real-time synchronization notifications across devices.
    Authentication flow:
      1. Query-string token: ws://…/ws/sync/?token=<jwt_access_token>
      2. Or send {"action": "auth", "token": "<jwt>"} as first message.
    """

    async def connect(self):
        self.authenticated = False
        self.room_group_name = None
        self.device_group_name = None

        # --- Attempt query-string JWT auth ---
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        token = self._extract_token_from_query(query_string)

        if token:
            auth = await self._authenticate_token(token)
            if auth:
                await self._bind_user(*auth)
                await self.accept()
                await self.send(text_data=json.dumps({
                    "type": "connection_established",
                    "message": "Connected to AstroLedger Sync Stream",
                }))
                return

        # --- Fallback: accept unauthenticated, wait for auth message ---
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "auth_required",
            "message": "Send an auth message with your JWT token to subscribe.",
        }))

    async def disconnect(self, close_code):
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )
        if self.device_group_name:
            await self.channel_layer.group_discard(
                self.device_group_name,
                self.channel_name,
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        action = data.get("action")

        if action == "auth" and not self.authenticated:
            token = data.get("token", "")
            auth = await self._authenticate_token(token)
            if auth:
                await self._bind_user(*auth)
                await self.send(text_data=json.dumps({
                    "type": "connection_established",
                    "message": "Authenticated — subscribed to sync stream.",
                }))
            else:
                await self.send(text_data=json.dumps({
                    "type": "auth_error",
                    "message": "Invalid or expired token.",
                }))
            return

        if action == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def sync_message(self, event):
        """Sends sync change notification payload to the connected device."""
        await self.send(text_data=json.dumps(event["data"]))

    async def device_revoked(self, event):
        """Immediately instruct a removed companion to return to pairing."""
        await self.send(text_data=json.dumps(event["data"]))
        await self.close(code=4003)

    # ─── helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _extract_token_from_query(qs: str) -> str | None:
        """Parse ?token=<jwt> from the query string."""
        for part in qs.split("&"):
            if part.startswith("token="):
                return part[len("token="):]
        return None

    @database_sync_to_async
    def _authenticate_token(self, raw_token: str):
        """Validate a JWT access token and return ``(user, device)``."""
        try:
            validated = AccessToken(raw_token)
            device_id = validate_companion_claims(validated)
            user_id = validated["user_id"]
            user = User.objects.get(id=user_id)
            device = None
            if device_id:
                device = ConnectedDevice.objects.get(
                    user=user,
                    device_id=device_id,
                    is_active=True,
                    session_version=validated.get('companion_session_version'),
                )
            return user, device
        except Exception:
            return None

    async def _bind_user(self, user, device=None):
        """Subscribe the channel to the user's sync group."""
        self.authenticated = True
        self.scope["user"] = user
        self.room_group_name = f"user_sync_{user.id}"
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        if device:
            self.device_group_name = f"device_session_{device.id}"
            await self.channel_layer.group_add(
                self.device_group_name,
                self.channel_name,
            )
