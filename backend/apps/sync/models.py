import uuid
from django.db import models
from django.conf import settings

class ChangeEvent(models.Model):
    """
    Tracks mutations for synchronization and conflict resolution across devices.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='change_events')
    device_id = models.CharField(max_length=100, db_index=True)
    entity_type = models.CharField(max_length=50, db_index=True)  # 'client', 'consultation'
    entity_id = models.UUIDField(db_index=True)
    operation = models.CharField(max_length=20)  # 'CREATE', 'UPDATE', 'DELETE'
    version = models.PositiveIntegerField()
    idempotency_key = models.CharField(max_length=100, unique=True, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self):
        return f"{self.operation} {self.entity_type} {self.entity_id} (v{self.version})"


class ConnectedDevice(models.Model):
    """
    Represents a client device (Windows PC, iPhone, Android, iPad, etc.)
    paired with the astrologer's account for real-time synchronization.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='connected_devices')
    device_id = models.CharField(max_length=100, db_index=True)
    device_name = models.CharField(max_length=150, default='Unknown Device')
    device_type = models.CharField(max_length=50, default='desktop')  # 'desktop', 'mobile', 'tablet', 'browser'
    ip_address = models.CharField(max_length=50, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    last_seen = models.DateTimeField(auto_now=True, db_index=True)
    is_active = models.BooleanField(default=True)
    # Incremented whenever a companion is paired again or explicitly removed.
    # QR/PIN-issued JWTs carry this value, so old sessions cannot be reused.
    session_version = models.PositiveIntegerField(default=1)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_seen']
        unique_together = ('user', 'device_id')
        indexes = [
            models.Index(fields=['user', 'last_seen']),
        ]

    def __str__(self):
        return f"{self.device_name} ({self.device_id}) - {self.user}"


class PairingTicket(models.Model):
    """
    Short-lived, single-use pairing token for zero-password companion device login.
    Generated on the main PC (via QR code) and claimed by mobile/tablet cameras.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_code = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pairing_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    is_claimed = models.BooleanField(default=False)
    claimed_by_device = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Ticket {self.ticket_code} for {self.user} (Claimed: {self.is_claimed})"
