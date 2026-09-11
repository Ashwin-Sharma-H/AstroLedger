"""
Sync Services: Record-and-Broadcast utility for real-time change tracking.
Persists a ChangeEvent and pushes a notification via Channels to the
user's sync group so all connected devices receive the update instantly.
"""
import uuid
import json
import logging
from django.core.serializers.json import DjangoJSONEncoder
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import ChangeEvent

logger = logging.getLogger(__name__)

def _make_json_safe(data):
    if not data:
        return {}
    try:
        return json.loads(json.dumps(data, cls=DjangoJSONEncoder))
    except Exception as e:
        logger.warning("Failed to encode payload with DjangoJSONEncoder: %s", e)
        return {}


def record_and_broadcast_change(
    *,
    user,
    entity_type: str,
    entity_id,
    operation: str,
    version: int = 1,
    payload: dict | None = None,
    device_id: str = "server",
):
    """
    1. Creates an immutable ChangeEvent record.
    2. Broadcasts to user_sync_{user_id} via Channels layer so all
       connected WebSocket clients receive instant invalidation signals.

    Args:
        user:        The Django user who owns the entity.
        entity_type: 'client' or 'consultation'.
        entity_id:   UUID of the mutated entity.
        operation:   'CREATE', 'UPDATE', or 'DELETE'.
        version:     Current version of the entity post-mutation.
        payload:     Optional serialised snapshot of the changed object.
        device_id:   Originating device (default 'server' for API writes).
    """
    idempotency_key = f"{device_id}_{entity_type}_{entity_id}_{operation}_{uuid.uuid4().hex[:12]}"

    event = ChangeEvent.objects.create(
        user=user,
        device_id=device_id,
        entity_type=entity_type,
        entity_id=entity_id,
        operation=operation,
        version=version,
        idempotency_key=idempotency_key,
        payload=_make_json_safe(payload),
    )

    # Broadcast to all connected devices for this user
    try:
        channel_layer = get_channel_layer()
        group_name = f"user_sync_{user.id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "sync_message",
                "data": {
                    "type": "sync_invalidation",
                    "entity_type": entity_type,
                    "entity_id": str(entity_id),
                    "operation": operation,
                    "version": version,
                    "idempotency_key": idempotency_key,
                    "timestamp": event.timestamp.isoformat(),
                },
            },
        )
    except Exception as exc:
        # Non-fatal — sync broadcast failure must never block the API response
        logger.warning("Sync broadcast failed for %s/%s: %s", entity_type, entity_id, exc)

    return event
