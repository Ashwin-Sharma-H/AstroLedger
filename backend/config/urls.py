"""
URL Configuration for AstroLedger backend.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/clients/', include('apps.clients.urls')),
    path('api/consultations/', include('apps.consultations.urls')),
    path('api/sync/', include('apps.sync.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/attachments/', include('apps.attachments.urls')),
    path('api/health/', include('apps.core.urls')),
]
