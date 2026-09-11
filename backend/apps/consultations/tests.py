from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.clients.models import Client
from apps.consultations.models import Consultation

User = get_user_model()

class ConsultationModuleTestCase(TestCase):
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

        # Create primary test client
        self.c1 = Client.objects.create(
            user=self.user,
            name="Gopakumar Pillai",
            phone="+91 94470 11111",
            birth_star="Aswathy",
            dob="1980-05-10"
        )
        # Create other astrologer's client
        self.c_other = Client.objects.create(
            user=self.other_user,
            name="Foreign Client",
            phone="+91 98888 22222"
        )

    def test_create_consultation_increments_visit_count(self):
        payload = {
            "client": str(self.c1.id),
            "consultation_date": "2026-09-10",
            "consultation_time": "10:30:00",
            "consultation_type": "Prashnam",
            "reason": "Family property dispute and health obstacles.",
            "discussion": "Analyzed 4th house and Gulikan placement.",
            "summary": "Mild afflictions observed in maternal ancestral lineage.",
            "advice": "Prescribed Mrityunjaya Homa and Navagraha Shanti.",
            "follow_up_required": True,
            "follow_up_date": "2026-10-10",
            "follow_up_notes": "Review after 41-day mandala pooja."
        }
        res = self.client.post('/api/consultations/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', res.data)
        self.assertEqual(res.data['client_name'], "Gopakumar Pillai")
        self.assertEqual(res.data['consultation_type'], "Prashnam")

        # Verify client's visit_count is now 1 via client API
        client_res = self.client.get(f'/api/clients/{self.c1.id}/')
        self.assertEqual(client_res.status_code, status.HTTP_200_OK)
        self.assertEqual(client_res.data['visit_count'], 1)
        self.assertEqual(client_res.data['last_consultation_date'], "2026-09-10")

    def test_tenant_isolation_cannot_record_on_other_client(self):
        payload = {
            "client": str(self.c_other.id),
            "consultation_date": "2026-09-10",
            "consultation_type": "General",
            "discussion": "Attempt unauthorized entry."
        }
        res = self.client.post('/api/consultations/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_consultation_isolation_between_astrologers(self):
        con1 = Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-09-01",
            consultation_type="General"
        )
        con_other = Consultation.objects.create(
            client=self.c_other,
            consultation_date="2026-09-01",
            consultation_type="General"
        )

        res = self.client.get('/api/consultations/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in res.data]
        self.assertIn(str(con1.id), ids)
        self.assertNotIn(str(con_other.id), ids)

    def test_update_consultation_increments_version(self):
        con = Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-09-01",
            consultation_type="General",
            version=1
        )
        res = self.client.patch(f'/api/consultations/{con.id}/', {
            "summary": "Updated astrological recommendation."
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        con.refresh_from_db()
        self.assertEqual(con.summary, "Updated astrological recommendation.")
        self.assertGreater(con.version, 1)

    def test_soft_delete_consultation(self):
        con = Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-09-01",
            consultation_type="General"
        )
        res = self.client.delete(f'/api/consultations/{con.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        con.refresh_from_db()
        self.assertTrue(con.is_deleted)

        # Confirm not returned in consultation list
        list_res = self.client.get('/api/consultations/')
        ids = [item['id'] for item in list_res.data]
        self.assertNotIn(str(con.id), ids)

        # Confirm client visit_count returns to 0
        client_res = self.client.get(f'/api/clients/{self.c1.id}/')
        self.assertEqual(client_res.data['visit_count'], 0)

    def test_toggle_follow_up_action(self):
        con = Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-09-01",
            follow_up_required=True,
            follow_up_completed=False,
            version=1
        )
        res = self.client.post(f'/api/consultations/{con.id}/toggle-follow-up/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['follow_up_completed'])
        con.refresh_from_db()
        self.assertTrue(con.follow_up_completed)
        self.assertGreater(con.version, 1)

    def test_full_text_search_across_history(self):
        Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-01-10",
            consultation_type="Prashnam",
            reason="Property dispute",
            discussion="Saturn transiting 8th house",
            advice="Prescribed Mrityunjaya Homa"
        )
        Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-04-15",
            consultation_type="Career & Business",
            reason="Job change to foreign location",
            discussion="Jupiter Dasha commencing with Sun aspect",
            advice="Wear Yellow Sapphire 4.5 carats in gold"
        )

        # 1. Search by remedy keyword 'Sapphire'
        res_remedy = self.client.get(f'/api/consultations/?client_id={self.c1.id}&q=Sapphire')
        self.assertEqual(res_remedy.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_remedy.data), 1)
        self.assertEqual(res_remedy.data[0]['consultation_type'], "Career & Business")

        # 2. Search by observation keyword 'Saturn'
        res_transit = self.client.get(f'/api/consultations/?client_id={self.c1.id}&q=Saturn')
        self.assertEqual(res_transit.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_transit.data), 1)
        self.assertEqual(res_transit.data[0]['consultation_type'], "Prashnam")

        # 3. Search non-matching returns empty
        res_none = self.client.get(f'/api/consultations/?client_id={self.c1.id}&q=Emerald')
        self.assertEqual(res_none.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_none.data), 0)

    def test_client_first_and_last_consultation_dates(self):
        Consultation.objects.create(
            client=self.c1,
            consultation_date="2024-05-10",
            consultation_type="General"
        )
        Consultation.objects.create(
            client=self.c1,
            consultation_date="2026-09-01",
            consultation_type="Prashnam"
        )

        client_res = self.client.get(f'/api/clients/{self.c1.id}/')
        self.assertEqual(client_res.status_code, status.HTTP_200_OK)
        self.assertEqual(client_res.data['visit_count'], 2)
        self.assertEqual(str(client_res.data['first_consultation_date']), "2024-05-10")
        self.assertEqual(str(client_res.data['last_consultation_date']), "2026-09-01")

