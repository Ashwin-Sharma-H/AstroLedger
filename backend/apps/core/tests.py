from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.clients.models import Client
from apps.consultations.models import Consultation
from apps.attachments.models import Attachment

User = get_user_model()

class HealthCheckTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_returns_healthy(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['checks']['database'], 'connected')
        self.assertEqual(data['checks']['channel_layer'], 'active')
        self.assertIn('timestamp', data)


class PasswordValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_registration_rejects_common_password(self):
        payload = {
            "email": "guru_weak@astroledger.com",
            "name": "Weak Pass User",
            "password": "password",  # Common password & too short
        }
        response = self.client.post('/api/auth/register/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_registration_rejects_purely_numeric_password(self):
        payload = {
            "email": "guru_numeric@astroledger.com",
            "name": "Numeric Pass User",
            "password": "1234567890",  # Numeric only
        }
        response = self.client.post('/api/auth/register/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_registration_accepts_strong_password(self):
        payload = {
            "email": "guru_strong@astroledger.com",
            "name": "Strong Pass User",
            "password": "Jyotish@Strong987!",
        }
        response = self.client.post('/api/auth/register/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email=payload['email']).exists())


class ClientSanitizationAndValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='astro_sec@astroledger.com',
            email='astro_sec@astroledger.com',
            password='ComplexPassword123!',
        )
        self.client.force_authenticate(user=self.user)

    def test_client_name_sanitizes_script_tags(self):
        payload = {
            "name": "<script>alert('xss')</script>Ramesh Kumar",
            "phone": "+91 9876543210",
        }
        response = self.client.post('/api/clients/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Ramesh Kumar')

    def test_client_rejects_invalid_phone_format(self):
        payload = {
            "name": "Suresh Nair",
            "phone": "not-a-phone-123",
        }
        response = self.client.post('/api/clients/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)

    def test_client_rejects_too_short_phone(self):
        payload = {
            "name": "Suresh Nair",
            "phone": "12345",  # Under 7 digits
        }
        response = self.client.post('/api/clients/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)


class AttachmentIDORSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1@astroledger.com',
            email='user1@astroledger.com',
            password='TestPassword123!',
        )
        self.user2 = User.objects.create_user(
            username='user2@astroledger.com',
            email='user2@astroledger.com',
            password='TestPassword123!',
        )

        # User 1 client & consultation
        self.c1 = Client.objects.create(user=self.user1, name="Client One")
        self.consultation1 = Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-09-01",
            consultation_type="Kundali Reading"
        )
        self.att1 = Attachment.objects.create(
            consultation=self.consultation1,
            file_name="kundali_chart.pdf",
            file_url="https://storage.example.com/charts/1.pdf"
        )

        # User 2 client & consultation
        self.c2 = Client.objects.create(user=self.user2, name="Client Two")
        self.consultation2 = Consultation.objects.create(
            client=self.c2,
            consultation_date="2026-09-02",
            consultation_type="Prashnam"
        )
        self.att2 = Attachment.objects.create(
            consultation=self.consultation2,
            file_name="prashnam_secret.pdf",
            file_url="https://storage.example.com/charts/2.pdf"
        )

    def test_user_cannot_view_other_users_attachments(self):
        # Authenticate as User 1
        self.client.force_authenticate(user=self.user1)

        # Request user 2's consultation attachments
        res = self.client.get(f'/api/attachments/?consultation_id={self.consultation2.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Should return empty list, NOT user 2's attachment
        data = res.json()
        self.assertEqual(len(data), 0)

    def test_user_cannot_attach_file_to_other_users_consultation(self):
        # Authenticate as User 1
        self.client.force_authenticate(user=self.user1)

        payload = {
            "consultation": str(self.consultation2.id),
            "file_name": "malicious_injected.pdf",
            "file_url": "https://storage.example.com/malicious.pdf"
        }
        res = self.client.post('/api/attachments/', payload, format='json')
        # Must be rejected with 403 Forbidden
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class RateLimitingTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'rest_framework_simplejwt.authentication.JWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': (
            'rest_framework.permissions.IsAuthenticated',
        ),
        'DEFAULT_THROTTLE_CLASSES': [
            'rest_framework.throttling.AnonRateThrottle',
            'rest_framework.throttling.ScopedRateThrottle',
        ],
        'DEFAULT_THROTTLE_RATES': {
            'anon': '100/day',
            'auth': '2/minute',  # Set low limit for testing
        }
    })
    def test_auth_endpoint_rate_limiting(self):
        url = '/api/auth/login/'
        credentials = {"email": "nobody@astroledger.com", "password": "WrongPassword!"}

        # First request
        res1 = self.client.post(url, credentials)
        # Second request
        res2 = self.client.post(url, credentials)
        # Third request should exceed 2/minute
        res3 = self.client.post(url, credentials)

        self.assertEqual(res3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
