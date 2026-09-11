from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncMonth, ExtractWeekDay
from datetime import date
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.consultations.models import Consultation
from apps.consultations.serializers import ConsultationSerializer

class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        clients_qs = Client.objects.filter(user=user, is_deleted=False)
        consultations_qs = Consultation.objects.filter(client__user=user, is_deleted=False)

        total_clients = clients_qs.count()
        total_consultations = consultations_qs.count()
        
        new_clients_this_month = clients_qs.filter(created_at__gte=start_of_month).count()
        consultations_this_month = consultations_qs.filter(consultation_date__gte=start_of_month.date()).count()

        # Returning clients (clients with > 1 consultation)
        returning_clients = clients_qs.annotate(
            c_count=Count('consultations')
        ).filter(c_count__gt=1).count()

        recent_clients = ClientSerializer(clients_qs.order_by('-created_at')[:5], many=True).data
        recent_consultations = ConsultationSerializer(consultations_qs.order_by('-consultation_date', '-created_at')[:5], many=True).data

        upcoming_follow_ups = ConsultationSerializer(
            consultations_qs.filter(
                follow_up_required=True,
                follow_up_completed=False,
                follow_up_date__gte=now.date()
            ).order_by('follow_up_date')[:10],
            many=True
        ).data

        return Response({
            "metrics": {
                "total_clients": total_clients,
                "total_consultations": total_consultations,
                "new_clients_this_month": new_clients_this_month,
                "consultations_this_month": consultations_this_month,
                "returning_clients": returning_clients,
            },
            "recent_clients": recent_clients,
            "recent_consultations": recent_consultations,
            "upcoming_follow_ups": upcoming_follow_ups,
            "sync_status": "synced"
        })


class DashboardAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        today = now.date()

        clients_qs = Client.objects.filter(user=user, is_deleted=False)
        consultations_qs = Consultation.objects.filter(client__user=user, is_deleted=False)

        # 1. 12-Month Rolling Window
        months_12 = []
        y, m = today.year, today.month
        for _ in range(12):
            months_12.append((y, m))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        months_12.reverse()

        earliest_month_year, earliest_month = months_12[0]
        start_date = date(earliest_month_year, earliest_month, 1)

        def format_month_key(val):
            if hasattr(val, 'strftime'):
                return val.strftime('%Y-%m')
            val_str = str(val)
            return val_str[:7]

        # 2. Monthly Consultations (Last 12 months)
        monthly_consultations_data = (
            consultations_qs
            .filter(consultation_date__gte=start_date)
            .annotate(month_val=TruncMonth('consultation_date'))
            .values('month_val')
            .annotate(count=Count('id'))
            .order_by('month_val')
        )
        consultation_counts_by_month = {}
        for entry in monthly_consultations_data:
            m_val = entry.get('month_val')
            if m_val:
                consultation_counts_by_month[format_month_key(m_val)] = entry['count']

        monthly_consultations = [
            {
                "month": f"{yr:04d}-{mo:02d}",
                "label": date(yr, mo, 1).strftime("%b '%y"),
                "count": consultation_counts_by_month.get(f"{yr:04d}-{mo:02d}", 0),
            }
            for yr, mo in months_12
        ]

        # 3. Monthly New Clients (Last 12 months)
        monthly_clients_data = (
            clients_qs
            .filter(created_at__date__gte=start_date)
            .annotate(month_val=TruncMonth('created_at'))
            .values('month_val')
            .annotate(count=Count('id'))
            .order_by('month_val')
        )
        client_counts_by_month = {}
        for entry in monthly_clients_data:
            m_val = entry.get('month_val')
            if m_val:
                client_counts_by_month[format_month_key(m_val)] = entry['count']

        monthly_new_clients = [
            {
                "month": f"{yr:04d}-{mo:02d}",
                "label": date(yr, mo, 1).strftime("%b '%y"),
                "count": client_counts_by_month.get(f"{yr:04d}-{mo:02d}", 0),
            }
            for yr, mo in months_12
        ]

        # 4. Consultation Category Breakdown
        category_data = (
            consultations_qs
            .values('consultation_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        category_distribution = [
            {
                "category": (entry.get('consultation_type') or 'General').strip() or 'General',
                "count": entry['count']
            }
            for entry in category_data
        ]

        # 5. Busiest Weekdays (Monday through Sunday)
        # In Django ExtractWeekDay: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
        WEEKDAY_MAP = {
            1: {"name": "Sunday", "short": "Sun"},
            2: {"name": "Monday", "short": "Mon"},
            3: {"name": "Tuesday", "short": "Tue"},
            4: {"name": "Wednesday", "short": "Wed"},
            5: {"name": "Thursday", "short": "Thu"},
            6: {"name": "Friday", "short": "Fri"},
            7: {"name": "Saturday", "short": "Sat"},
        }
        weekday_data = (
            consultations_qs
            .annotate(weekday=ExtractWeekDay('consultation_date'))
            .values('weekday')
            .annotate(count=Count('id'))
            .order_by('weekday')
        )
        weekday_counts = {
            entry['weekday']: entry['count']
            for entry in weekday_data
            if entry.get('weekday') is not None
        }
        # Ordered Mon -> Sun
        ordered_days = [2, 3, 4, 5, 6, 7, 1]
        busiest_weekdays = [
            {
                "day_number": d,
                "day": WEEKDAY_MAP[d]["name"],
                "short_day": WEEKDAY_MAP[d]["short"],
                "count": weekday_counts.get(d, 0)
            }
            for d in ordered_days
        ]

        # 6. Top Nakshatras (Birth Stars)
        nakshatra_data = (
            clients_qs
            .exclude(birth_star__isnull=True)
            .exclude(birth_star__exact='')
            .values('birth_star')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        top_nakshatras = [
            {
                "nakshatra": entry['birth_star'].strip(),
                "count": entry['count']
            }
            for entry in nakshatra_data
            if entry['birth_star'] and entry['birth_star'].strip()
        ]

        # 7. Follow-up Tracking & Ratios
        overdue_follow_ups = consultations_qs.filter(
            follow_up_required=True,
            follow_up_completed=False,
            follow_up_date__lt=today
        ).count()

        upcoming_follow_ups = consultations_qs.filter(
            follow_up_required=True,
            follow_up_completed=False,
            follow_up_date__gte=today
        ).count()

        completed_follow_ups = consultations_qs.filter(
            follow_up_required=True,
            follow_up_completed=True
        ).count()

        total_clients = clients_qs.count()
        total_consultations = consultations_qs.count()
        avg_visits_per_client = round(total_consultations / total_clients, 1) if total_clients > 0 else 0.0

        total_follow_ups = overdue_follow_ups + upcoming_follow_ups + completed_follow_ups
        follow_up_completion_rate = (
            round((completed_follow_ups / total_follow_ups) * 100) if total_follow_ups > 0 else 100
        )

        return Response({
            "monthly_consultations": monthly_consultations,
            "monthly_new_clients": monthly_new_clients,
            "category_distribution": category_distribution,
            "busiest_weekdays": busiest_weekdays,
            "top_nakshatras": top_nakshatras,
            "follow_up_metrics": {
                "overdue": overdue_follow_ups,
                "upcoming": upcoming_follow_ups,
                "completed": completed_follow_ups,
                "completion_rate": follow_up_completion_rate,
            },
            "practice_metrics": {
                "total_clients": total_clients,
                "total_consultations": total_consultations,
                "avg_visits_per_client": avg_visits_per_client,
            }
        })

