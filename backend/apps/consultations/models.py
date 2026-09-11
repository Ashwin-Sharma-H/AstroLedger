import uuid
from django.db import models

class Consultation(models.Model):
    """
    Consultation Record: information belonging to one specific visit.
    One client may have unlimited consultation records.
    Historical records must never be silently overwritten.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='consultations')
    
    consultation_date = models.DateField(db_index=True)
    consultation_time = models.TimeField(null=True, blank=True)
    consultation_type = models.CharField(max_length=100, default='General', db_index=True)
    reason = models.CharField(max_length=255, blank=True)
    discussion = models.TextField(blank=True)
    summary = models.TextField(blank=True)
    advice = models.TextField(blank=True)
    
    # Follow-up
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True, db_index=True)
    follow_up_notes = models.TextField(blank=True)
    follow_up_completed = models.BooleanField(default=False)

    # Sync & Versioning
    version = models.PositiveIntegerField(default=1)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-consultation_date', '-created_at']
        indexes = [
            models.Index(fields=['client', '-consultation_date']),
            models.Index(fields=['follow_up_required', 'follow_up_date']),
        ]

    def __str__(self):
        return f"Consultation on {self.consultation_date} for {self.client.name}"
