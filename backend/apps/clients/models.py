import uuid
from django.db import models
from django.conf import settings

class Client(models.Model):
    """
    Client Profile: permanent identity, contact, birth and astrology information.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='clients')
    client_code = models.CharField(max_length=50, blank=True, db_index=True)
    
    # Personal & Contact
    name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=50, blank=True, db_index=True)
    alternate_phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    gender = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    
    # Birth & Astrology
    dob = models.DateField(null=True, blank=True, db_index=True)
    birth_time = models.TimeField(null=True, blank=True)
    birth_place = models.CharField(max_length=255, blank=True, db_index=True)
    birth_star = models.CharField(max_length=100, blank=True, db_index=True)  # Nakshatra
    rashi = models.CharField(max_length=100, blank=True, db_index=True)
    
    # Additional flexible metadata
    notes = models.TextField(blank=True)
    extra_attributes = models.JSONField(default=dict, blank=True)
    
    # Sync & Versioning
    version = models.PositiveIntegerField(default=1)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'name']),
            models.Index(fields=['user', 'phone']),
            models.Index(fields=['user', 'dob']),
        ]

    def save(self, *args, **kwargs):
        if not self.client_code:
            # Generate clean client code based on auto ID or hex
            self.client_code = f"AL-{str(self.id)[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.client_code})"
