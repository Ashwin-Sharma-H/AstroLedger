from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class AccountsAuthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='acharya@astroledger.com',
            email='acharya@astroledger.com',
            name='Acharya Shridhar',
            title='Principal Jyotishi',
            phone='+91 9876500000',
            password='InitialPassword123!'
        )

    def test_registration_success(self):
        payload = {
            "email": "newguru@astroledger.com",
            "name": "Guru Ramanathan",
            "title": "Vedic Scholar",
            "phone": "+91 9123456780",
            "password": "SecurePassword456!",
            "timezone": "Asia/Kolkata"
        }
        response = self.client.post('/api/auth/register/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['email'], payload['email'])
        self.assertTrue(User.objects.filter(email=payload['email']).exists())

    def test_registration_duplicate_email(self):
        payload = {
            "email": "acharya@astroledger.com",
            "name": "Duplicate User",
            "password": "UniquePassword789!"
        }
        response = self.client.post('/api/auth/register/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success_and_jwt_tokens(self):
        response = self.client.post('/api/auth/login/', {
            "email": "acharya@astroledger.com",
            "password": "InitialPassword123!"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        # Test token refresh
        refresh_token = response.data['refresh']
        refresh_response = self.client.post('/api/auth/refresh/', {
            "refresh": refresh_token
        })
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_response.data)

    def test_login_invalid_credentials(self):
        response = self.client.post('/api/auth/login/', {
            "email": "acharya@astroledger.com",
            "password": "WrongPassword!"
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_profile_and_update(self):
        self.client.force_authenticate(user=self.user)
        
        # GET /api/auth/me/
        get_response = self.client.get('/api/auth/me/')
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data['name'], 'Acharya Shridhar')
        self.assertEqual(get_response.data['title'], 'Principal Jyotishi')

        # PATCH /api/auth/me/
        patch_response = self.client.patch('/api/auth/me/', {
            "title": "Senior Jyotish Research Acharya",
            "bio": "Specialist in Parashara system and Nadi astrology"
        })
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data['title'], 'Senior Jyotish Research Acharya')
        
        self.user.refresh_from_db()
        self.assertEqual(self.user.title, 'Senior Jyotish Research Acharya')

    def test_change_password(self):
        self.client.force_authenticate(user=self.user)
        
        # Failure on incorrect old password
        bad_change = self.client.post('/api/auth/change-password/', {
            "old_password": "WrongOldPassword",
            "new_password": "BrandNewPassword999!"
        })
        self.assertEqual(bad_change.status_code, status.HTTP_400_BAD_REQUEST)

        # Success on correct old password
        good_change = self.client.post('/api/auth/change-password/', {
            "old_password": "InitialPassword123!",
            "new_password": "BrandNewPassword999!"
        })
        self.assertEqual(good_change.status_code, status.HTTP_200_OK)
        
        # Verify user can log in with new password
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPassword999!"))

    def test_unauthenticated_access_blocked(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
