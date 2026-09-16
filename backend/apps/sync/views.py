"""
Sync REST endpoints:
  POST /api/sync/push/  — Receives offline mutation queue and applies to models.
  GET  /api/sync/pull/  — Pulls server change events after a cursor timestamp.
"""
import logging
import secrets
from datetime import timedelta
from django.utils import timezone
from django.db import IntegrityError, transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ChangeEvent, ConnectedDevice, PairingTicket
from .serializers import ChangeEventSerializer, ConnectedDeviceSerializer
from .services import record_and_broadcast_change
from .authentication import DEVICE_ID_CLAIM
from apps.accounts.serializers import UserSerializer

logger = logging.getLogger(__name__)


def get_lan_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return '127.0.0.1'



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

        api_url = f"http://{local_ip}:{api_port}"

        return Response({
            "local_ip": local_ip,
            "api_port": api_port,
            "web_port": web_port,
            "api_url": api_url,
            "web_url": f"http://{local_ip}:{web_port}",
            "pair_url": f"{api_url}/pair?role=companion",
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
            paired_device_id = request.auth.get(DEVICE_ID_CLAIM) if request.auth else None
            if paired_device_id:
                # A companion may only heartbeat as itself.  Crucially, this
                # never flips is_active back to true after a Main PC removal.
                if device_id != paired_device_id:
                    return Response({"detail": "Device identity mismatch."}, status=status.HTTP_403_FORBIDDEN)
                device = ConnectedDevice.objects.filter(
                    user=request.user, device_id=paired_device_id, is_active=True,
                ).first()
                if not device:
                    return Response({"detail": "This sub system was removed from the Main PC.", "code": "device_revoked"}, status=status.HTTP_401_UNAUTHORIZED)
                device.device_name = device_name
                device.device_type = device_type
                device.ip_address = client_ip
                device.user_agent = user_agent
                device.save(update_fields=['device_name', 'device_type', 'ip_address', 'user_agent', 'last_seen'])
            else:
                # Main-PC sessions retain the existing registration behaviour.
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
            with transaction.atomic():
                device = ConnectedDevice.objects.select_for_update().filter(
                    user=request.user, device_id=device_id, is_active=True,
                ).first()
                if not device:
                    return Response({"detail": "Device not found."}, status=status.HTTP_404_NOT_FOUND)
                device.is_active = False
                device.session_version += 1
                device.revoked_at = timezone.now()
                device.save(update_fields=['is_active', 'session_version', 'revoked_at'])

            # A live companion is redirected immediately. REST polling still
            # enforces the same result if WebSockets are unavailable.
            try:
                async_to_sync(get_channel_layer().group_send)(
                    f"device_session_{device.id}",
                    {"type": "device_revoked", "data": {"type": "device_revoked"}},
                )
            except Exception as exc:
                logger.warning("Device revocation broadcast failed: %s", exc)

            if device:
                return Response({"detail": "Device disconnected successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("DeviceDisconnectView error: %s", e)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GeneratePairingTicketView(APIView):
    """
    POST /api/sync/pair/generate/
    Generates a cryptographically secure, single-use pairing ticket (valid for 5 mins).
    The main PC renders this in a QR code for mobile devices to scan.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        local_ip = get_lan_ip()
        api_port = 8000
        server_url = f"http://{local_ip}:{api_port}"

        # Friendly 6-digit numeric PIN for Laptops and Sub-PCs without cameras
        expires_at = timezone.now() + timedelta(minutes=10)

        try:
            # Clean up old expired tickets for this user
            PairingTicket.objects.filter(user=request.user, expires_at__lt=timezone.now()).delete()

            ticket = None
            for _ in range(5):
                pin_code = f"{secrets.randbelow(900000) + 100000}"
                try:
                    ticket = PairingTicket.objects.create(
                        ticket_code=pin_code,
                        user=request.user,
                        expires_at=expires_at,
                    )
                    break
                except IntegrityError:
                    continue
            if ticket is None:
                return Response(
                    {"detail": "Unable to create a pairing code. Please try again."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            user_display_name = getattr(request.user, 'name', '') or request.user.username

            return Response({
                "ticket_code": ticket.ticket_code,
                "pin_code": pin_code,
                "local_ip": local_ip,
                "server_url": server_url,
                "pair_url": f"{server_url}/pair?role=companion&t={ticket.ticket_code}",
                "expires_at": expires_at.isoformat(),
                "expires_in_seconds": 600,
                "user_name": user_display_name,
                "qr_payload": {
                    "protocol": "astroledger-pair",
                    "version": 2,
                    "server": server_url,
                    "ticket": ticket.ticket_code,
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("GeneratePairingTicketView error: %s", e)
            if "no such table" in str(e).lower():
                return Response(
                    {"detail": "Database table 'sync_pairingticket' does not exist yet. Please restart server or run 'python manage.py migrate'."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClaimPairingTicketView(APIView):
    """
    POST /api/sync/pair/claim/
    Zero-password companion login.
    Scanned by mobile camera or entered as a 6-digit PIN on sub-PC laptops.
    Validates the ticket, connects the device, and returns JWT tokens.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ticket_code = (request.data.get('ticket') or request.data.get('ticket_code') or request.data.get('pin') or '').strip().replace(' ', '').replace('-', '')
        device_name = (request.data.get('device_name') or 'Sub-PC Station').strip()
        device_id = (request.data.get('device_id') or '').strip()
        device_type = (request.data.get('device_type') or 'desktop').strip()

        if not ticket_code:
            return Response(
                {"detail": "Pairing ticket code is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Lock the ticket through validation and claiming so the one-time
            # PIN cannot be consumed by two companion devices concurrently.
            with transaction.atomic():
                ticket = PairingTicket.objects.select_for_update().filter(
                    ticket_code=ticket_code
                ).select_related('user').first()
                if not ticket:
                    return Response(
                        {"detail": "Invalid pairing ticket. Please scan a fresh QR code from your PC."},
                        status=status.HTTP_404_NOT_FOUND
                    )

                if ticket.is_claimed:
                    return Response(
                        {"detail": "This QR pairing ticket has already been used. Please refresh the QR code on your PC."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if timezone.now() > ticket.expires_at:
                    return Response(
                        {"detail": "Pairing ticket has expired. Please click 'Refresh QR' on your PC."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                ticket.is_claimed = True
                ticket.claimed_by_device = device_name[:150]
                ticket.save(update_fields=['is_claimed', 'claimed_by_device'])

            # Determine client IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                client_ip = x_forwarded_for.split(',')[0].strip()
            else:
                client_ip = request.META.get('REMOTE_ADDR', '') or ''

            # Register or update ConnectedDevice record
            if not device_id:
                device_id = f"dev_{secrets.token_hex(8)}"

            with transaction.atomic():
                device = ConnectedDevice.objects.select_for_update().filter(
                    user=ticket.user, device_id=device_id,
                ).first()
                if device:
                    # A fresh QR/PIN claim always replaces any prior session.
                    device.session_version += 1
                    device.device_name = device_name[:150]
                    device.device_type = device_type
                    device.ip_address = client_ip
                    device.user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:255]
                    device.is_active = True
                    device.revoked_at = None
                    device.save()
                else:
                    device = ConnectedDevice.objects.create(
                        user=ticket.user,
                        device_id=device_id,
                        device_name=device_name[:150],
                        device_type=device_type,
                        ip_address=client_ip,
                        user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:255],
                    )

            # Issue JWT tokens for ticket's user
            refresh = RefreshToken.for_user(ticket.user)
            refresh[DEVICE_ID_CLAIM] = device.device_id
            refresh['companion_session_version'] = device.session_version
            user_data = UserSerializer(ticket.user).data

            local_ip = get_lan_ip()
            server_url = f"http://{local_ip}:8000"

            logger.info("Device '%s' successfully paired with user '%s'", device_name, ticket.user.username)

            return Response({
                "status": "success",
                "message": f"Successfully linked to {user_data.get('name') or ticket.user.username}'s PC Station!",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": user_data,
                "server_url": server_url,
                "device_id": device_id,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("ClaimPairingTicketView error: %s", e)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
