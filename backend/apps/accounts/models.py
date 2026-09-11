from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """
    AstroLedger custom user model representing an astrologer / account owner.
    """
    name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(unique=True)
    title = models.CharField(max_length=150, blank=True, default='Vedic Astrologer')
    phone = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)
    timezone = models.CharField(max_length=100, default='Asia/Kolkata')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.name or self.email
