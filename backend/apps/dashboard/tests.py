from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta
from apps.clients.models import Client
from apps.consultations.models import Consultation

User = get_user_model()

class DashboardAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='astrologer@astroledger.com',
            email='astrologer@astroledger.com',
            password='TestPassword123!',
            name='Test Astrologer'
        )
        self.other_user = User.objects.create_user(
            username='other@astroledger.com',
            email='other@astroledger.com',
            password='TestPassword123!',
            name='Other Astrologer'
        )
        self.today = timezone.now().date()

    def test_unauthenticated_analytics_denied(self):
        response = self.client.get('/api/dashboard/analytics/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_analytics_structure(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/dashboard/analytics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertIn('monthly_consultations', data)
        self.assertIn('monthly_new_clients', data)
        self.assertIn('category_distribution', data)
        self.assertIn('busiest_weekdays', data)
        self.assertIn('top_nakshatras', data)
        self.assertIn('follow_up_metrics', data)
        self.assertIn('practice_metrics', data)

        # 12 months rolling window
        self.assertEqual(len(data['monthly_consultations']), 12)
        self.assertEqual(len(data['monthly_new_clients']), 12)
        # 7 days of the week
        self.assertEqual(len(data['busiest_weekdays']), 7)
        self.assertEqual(data['busiest_weekdays'][0]['day'], 'Monday')
        self.assertEqual(data['busiest_weekdays'][-1]['day'], 'Sunday')

    def test_analytics_with_data_and_user_isolation(self):
        self.client.force_authenticate(user=self.user)

        # Create clients for self.user
        c1 = Client.objects.create(
            user=self.user,
            name='Anand Sharma',
            birth_star='Aswathy'
        )
        c2 = Client.objects.create(
            user=self.user,
            name='Priya Patel',
            birth_star='Bharani'
        )
        c3 = Client.objects.create(
            user=self.user,
            name='Rahul Verma',
            birth_star='Aswathy' # 2nd Aswathy
        )

        # Create client for other_user (should be isolated)
        other_client = Client.objects.create(
            user=self.other_user,
            name='Secret Client',
            birth_star='Rohini'
        )

        # Create consultations for self.user
        Consultation.objects.create(
            client=c1,
            consultation_date=self.today,
            consultation_type='Prashnam',
            follow_up_required=True,
            follow_up_completed=False,
            follow_up_date=self.today - timedelta(days=3) # overdue!
        )
        Consultation.objects.create(
            client=c2,
            consultation_date=self.today,
            consultation_type='Prashnam',
            follow_up_required=True,
            follow_up_completed=False,
            follow_up_date=self.today + timedelta(days=5) # upcoming
        )
        Consultation.objects.create(
            client=c3,
            consultation_date=self.today,
            consultation_type='Porutham',
            follow_up_required=True,
            follow_up_completed=True,
            follow_up_date=self.today - timedelta(days=1) # completed
        )

        # Other user's consultation (should be excluded)
        Consultation.objects.create(
            client=other_client,
            consultation_date=self.today,
            consultation_type='Muhurtham',
            follow_up_required=True,
            follow_up_completed=False,
            follow_up_date=self.today - timedelta(days=2)
        )

        response = self.client.get('/api/dashboard/analytics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Check category distribution
        categories = {item['category']: item['count'] for item in data['category_distribution']}
        self.assertEqual(categories.get('Prashnam'), 2)
        self.assertEqual(categories.get('Porutham'), 1)
        self.assertNotIn('Muhurtham', categories) # other user's category

        # Check top nakshatras
        nakshatras = {item['nakshatra']: item['count'] for item in data['top_nakshatras']}
        self.assertEqual(nakshatras.get('Aswathy'), 2)
        self.assertEqual(nakshatras.get('Bharani'), 1)
        self.assertNotIn('Rohini', nakshatras) # other user's star

        # Check follow-up metrics
        follow_ups = data['follow_up_metrics']
        self.assertEqual(follow_ups['overdue'], 1)
        self.assertEqual(follow_ups['upcoming'], 1)
        self.assertEqual(follow_ups['completed'], 1)

        # Check practice metrics
        practice = data['practice_metrics']
        self.assertEqual(practice['total_clients'], 3)
        self.assertEqual(practice['total_consultations'], 3)
        self.assertEqual(practice['avg_visits_per_client'], 1.0)
