from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Client

User = get_user_model()

class ClientCoreModuleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='astrologer1@astroledger.com',
            email='astrologer1@astroledger.com',
            password='TestPassword123!'
        )
        self.other_user = User.objects.create_user(
            username='other@astroledger.com',
            email='other@astroledger.com',
            password='TestPassword123!'
        )
        self.client.force_authenticate(user=self.user)

    def test_create_client_with_jyotish_attributes(self):
        payload = {
            "name": "Kavitha Sundaram",
            "phone": "+91 9444123456",
            "gender": "Female",
            "dob": "1992-08-15",
            "birth_time": "14:30:00",
            "birth_place": "Madurai, Tamil Nadu",
            "birth_star": "Rohini",
            "rashi": "Vrishabha",
            "notes": "Native seeking guidance on career stability and business investment.",
            "extra_attributes": {
                "lagna": "Kanya",
                "gotra": "Kashyapa"
            }
        }
        response = self.client.post('/api/clients/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertIn('client_code', response.data)
        self.assertTrue(response.data['client_code'].startswith('AL-'))
        self.assertEqual(response.data['birth_star'], 'Rohini')
        self.assertEqual(response.data['extra_attributes']['lagna'], 'Kanya')

    def test_client_isolation_between_astrologers(self):
        # Create client for user 1
        c1 = Client.objects.create(user=self.user, name="Client 1")
        # Create client for other_user
        c2 = Client.objects.create(user=self.other_user, name="Client Other")

        response = self.client.get('/api/clients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in response.data]
        self.assertIn(str(c1.id), ids)
        self.assertNotIn(str(c2.id), ids)

    def test_update_client_increments_version(self):
        c = Client.objects.create(
            user=self.user,
            name="Vikram Patel",
            birth_star="Ashwini",
            version=1
        )
        response = self.client.patch(f'/api/clients/{c.id}/', {
            "birth_star": "Bharani",
            "rashi": "Mesha"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.birth_star, "Bharani")
        self.assertGreater(c.version, 1)

    def test_soft_delete_client(self):
        c = Client.objects.create(user=self.user, name="Temporary Record")
        response = self.client.delete(f'/api/clients/{c.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        c.refresh_from_db()
        self.assertTrue(c.is_deleted)

        # Confirm not returned in general list
        list_res = self.client.get('/api/clients/')
        ids = [item['id'] for item in list_res.data]
        self.assertNotIn(str(c.id), ids)

    def test_client_search_universal_and_malayalam(self):
        c1 = Client.objects.create(
            user=self.user,
            name="Anand Joshi",
            phone="+91 9840112233",
            dob="1988-04-12",
            birth_place="Kozhikode, Kerala",
            birth_star="Aswathy (അശ്വതി)",
            rashi="Medam (മേടം)"
        )
        c2 = Client.objects.create(
            user=self.user,
            name="Sunita Nambiar",
            phone="+91 9840998877",
            dob="1995-11-20",
            birth_place="Palakkad, Kerala",
            birth_star="Thiruvonam (തിരുവോണം)",
            rashi="Makaram (മകരം)"
        )

        # 1. Search by Malayalam Nakshatra
        res_star = self.client.get('/api/clients/search/?q=Thiruvonam')
        self.assertEqual(res_star.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_star.data), 1)
        self.assertEqual(res_star.data[0]['name'], "Sunita Nambiar")
        self.assertIn('birth_star', res_star.data[0]['matched_fields'])

        # 2. Combination search: Name + DOB
        res_combo1 = self.client.get('/api/clients/search/?name=Anand&dob=1988-04-12')
        self.assertEqual(res_combo1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_combo1.data), 1)
        self.assertEqual(res_combo1.data[0]['id'], str(c1.id))

        # 3. Combination search: Place + Nakshatra
        res_combo2 = self.client.get('/api/clients/search/?birth_place=Palakkad&birth_star=Thiruvonam')
        self.assertEqual(res_combo2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_combo2.data), 1)
        self.assertEqual(res_combo2.data[0]['id'], str(c2.id))

        # 4. Combination search: Name + Phone
        res_combo3 = self.client.get('/api/clients/search/?name=Sunita&phone=984099')
        self.assertEqual(res_combo3.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_combo3.data), 1)
        self.assertEqual(res_combo3.data[0]['name'], "Sunita Nambiar")

        # 5. Mismatched combination returns empty
        res_nomatch = self.client.get('/api/clients/search/?name=Anand&dob=1995-11-20')
        self.assertEqual(res_nomatch.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_nomatch.data), 0)

    def test_check_duplicates_phone_formatting(self):
        # Client exists with international format
        Client.objects.create(
            user=self.user,
            name="Rahul Varma",
            phone="+91 98470 12345",
            dob="1985-06-20",
            birth_star="Rohini"
        )

        # Checking duplicate with raw 10 digits
        payload = {
            "name": "Rahul",
            "phone": "9847012345"
        }
        res = self.client.post('/api/clients/check-duplicates/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_potential_duplicates'], 1)
        match = res.data['matches'][0]
        self.assertGreaterEqual(match['confidence_score'], 80)
        self.assertEqual(match['confidence_level'], 'HIGH')
        self.assertIn('phone', match['matched_fields'])

    def test_check_duplicates_fuzzy_name_and_star(self):
        Client.objects.create(
            user=self.user,
            name="Anandha Krishnan",
            phone="+91 94471 00000",
            dob="1990-03-15",
            birth_star="Aswathy (അശ്വതി)"
        )

        # Candidate with minor spelling variation and matching star
        payload = {
            "name": "Anand Krishnan",
            "birth_star": "Aswathy",
            "dob": "1990-03-15"
        }
        res = self.client.post('/api/clients/check-duplicates/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_potential_duplicates'], 1)
        match = res.data['matches'][0]
        self.assertGreaterEqual(match['confidence_score'], 70)
        self.assertIn('name', match['matched_fields'])
        self.assertIn('birth_star', match['matched_fields'])

    def test_check_duplicates_astrologer_isolation(self):
        # Client belonging to another astrologer
        Client.objects.create(
            user=self.other_user,
            name="Private Client",
            phone="+91 99999 88888"
        )

        payload = {"name": "Private Client", "phone": "9999988888"}
        res = self.client.post('/api/clients/check-duplicates/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_potential_duplicates'], 0)

    def test_check_duplicates_exclude_id(self):
        c = Client.objects.create(
            user=self.user,
            name="Existing Client",
            phone="+91 97777 66666"
        )

        # Excluding self ID during edit
        payload = {
            "name": "Existing Client",
            "phone": "9777766666",
            "exclude_client_id": str(c.id)
        }
        res = self.client.post('/api/clients/check-duplicates/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_potential_duplicates'], 0)

