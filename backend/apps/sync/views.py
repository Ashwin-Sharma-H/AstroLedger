"""
Sync REST endpoints:
  POST /api/sync/push/  — Receives offline mutation queue and applies to models.
  GET  /api/sync/pull/  — Pulls server change events after a cursor timestamp.
"""
import logging
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .models import ChangeEvent
from .serializers import ChangeEventSerializer
from .services import record_and_broadcast_change

logger = logging.getLogger(__name__)


class SyncPushView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Receives pending mutations queued offline on a client device.
        For each event:
          1. Check idempotency — skip if already applied.
          2. Apply the mutation to the actual model (Client / Consultation).
          3. Record a ChangeEvent and broadcast to other devices.
        """
        events_data = request.data.get('events', [])
        applied_keys = []
        errors = []

        for item in events_data:
            idempotency_key = item.get('idempotency_key')
            if not idempotency_key:
                continue

            # Idempotency check
            if ChangeEvent.objects.filter(idempotency_key=idempotency_key).exists():
                applied_keys.append(idempotency_key)
                continue

            entity_type = item.get('entity_type', '')
            operation = item.get('operation', 'UPDATE')
            entity_id = item.get('entity_id')
            payload = item.get('payload', {})
            device_id = item.get('device_id', 'unknown')

            try:
                with transaction.atomic():
                    self._apply_mutation(
                        user=request.user,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        operation=operation,
                        payload=payload,
                    )

                    # Record ChangeEvent and broadcast
                    record_and_broadcast_change(
                        user=request.user,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        operation=operation,
                        version=item.get('version', 1),
                        payload=payload,
                        device_id=device_id,
                    )

                applied_keys.append(idempotency_key)
            except Exception as exc:
                logger.warning("Push apply error for %s: %s", idempotency_key, exc)
                errors.append({'key': idempotency_key, 'error': str(exc)})

        return Response({
            "status": "success",
            "applied_keys": applied_keys,
            "errors": errors,
        }, status=status.HTTP_200_OK)

    @staticmethod
    def _apply_mutation(*, user, entity_type, entity_id, operation, payload):
        """
        Apply an offline mutation to the corresponding Django model.
        Uses last-write-wins; version conflicts are tracked via ChangeEvent.
        """
        if entity_type == 'client':
            from apps.clients.models import Client

            if operation == 'CREATE':
                Client.objects.update_or_create(
                    id=entity_id,
                    defaults={**payload, 'user': user},
                )
            elif operation == 'UPDATE':
                Client.objects.filter(id=entity_id, user=user).update(**payload)
            elif operation == 'DELETE':
                Client.objects.filter(id=entity_id, user=user).update(
                    is_deleted=True,
                )

        elif entity_type == 'consultation':
            from apps.consultations.models import Consultation

            if operation == 'CREATE':
                Consultation.objects.update_or_create(
                    id=entity_id,
                    defaults=payload,
                )
            elif operation == 'UPDATE':
                Consultation.objects.filter(
                    id=entity_id, client__user=user,
                ).update(**payload)
            elif operation == 'DELETE':
                Consultation.objects.filter(
                    id=entity_id, client__user=user,
                ).update(is_deleted=True)


class SyncPullView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Pulls server change events after a given cursor/timestamp.
        """
        cursor = request.query_params.get('cursor')
        qs = ChangeEvent.objects.filter(user=request.user)
        if cursor:
            qs = qs.filter(timestamp__gt=cursor)

        events = list(qs[:100])
        serializer = ChangeEventSerializer(events, many=True)
        latest_cursor = events[-1].timestamp.isoformat() if events else cursor

        return Response({
            "events": serializer.data,
            "next_cursor": latest_cursor,
        })


class ServerInfoView(APIView):
    """
    Returns server network information (local IP, ports, pairing URL).
    Used by the Main PC to render the QR Code for mobile device pairing.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = '127.0.0.1'

        api_port = 8000
        web_port = 5173

        return Response({
            "local_ip": local_ip,
            "api_port": api_port,
            "web_port": web_port,
            "api_url": f"http://{local_ip}:{api_port}",
            "web_url": f"http://{local_ip}:{web_port}",
            "pair_url": f"http://{local_ip}:{web_port}/?server=http://{local_ip}:{web_port}",
        })


class DeviceListView(APIView):
    """
    Lists all active connected devices for the authenticated astrologer.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import ConnectedDevice
        from .serializers import ConnectedDeviceSerializer

        try:
            devices = ConnectedDevice.objects.filter(user=request.user, is_active=True).order_by('-last_seen')
            serializer = ConnectedDeviceSerializer(devices, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.warning("DeviceListView error: %s", e)
            if "no such table" in str(e).lower():
                return Response(
                    {"detail": "Database table 'sync_connecteddevice' does not exist yet. Please run 'python manage.py migrate'."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeviceHeartbeatView(APIView):
    """
    Registers or refreshes the heartbeat timestamp of a connected device.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import ConnectedDevice
        from .serializers import ConnectedDeviceSerializer

        device_id = request.data.get('device_id')
        if not device_id:
            return Response({"detail": "device_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        device_name = request.data.get('device_name', 'Unknown Device')
        device_type = request.data.get('device_type', 'desktop')

        # Resolve client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(',')[0].strip()
        else:
            client_ip = request.META.get('REMOTE_ADDR', '') or ''

        user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:255]

        try:
            device, _ = ConnectedDevice.objects.update_or_create(
                user=request.user,
                device_id=device_id,
                defaults={
                    'device_name': device_name,
                    'device_type': device_type,
                    'ip_address': client_ip,
                    'user_agent': user_agent,
                    'is_active': True,
                }
            )
            return Response(ConnectedDeviceSerializer(device).data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("DeviceHeartbeatView error: %s", e)
            if "no such table" in str(e).lower():
                return Response(
                    {"detail": "Database table 'sync_connecteddevice' does not exist yet. Please run 'python manage.py migrate'."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeviceDisconnectView(APIView):
    """
    Revokes / disconnects a device from the astrologer's account.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, device_id):
        from .models import ConnectedDevice

        try:
            updated = ConnectedDevice.objects.filter(
                user=request.user,
                device_id=device_id
            ).update(is_active=False)

            if updated:
                return Response({"detail": "Device disconnected successfully."}, status=status.HTTP_200_OK)
            return Response({"detail": "Device not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("DeviceDisconnectView error: %s", e)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
