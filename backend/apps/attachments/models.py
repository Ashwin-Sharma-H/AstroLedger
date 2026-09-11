import uuid
from django.db import models

class Attachment(models.Model):
    """
    Optional attachments (e.g. horoscope charts, handwritten notes) associated with a consultation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey('consultations.Consultation', on_delete=models.CASCADE, related_name='attachments')
    file_name = models.CharField(max_length=255)
    file_url = models.URLField(max_length=1024)
    file_type = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.file_name} ({self.consultation})"
