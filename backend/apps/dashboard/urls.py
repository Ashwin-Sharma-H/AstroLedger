from django.urls import path
from .views import DashboardSummaryView, DashboardAnalyticsView

urlpatterns = [
    path('', DashboardSummaryView.as_view(), name='dashboard_summary'),
    path('analytics/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),
]

