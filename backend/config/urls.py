"""
URL Configuration for AstroLedger backend.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import HttpResponse
from django.views.static import serve


def serve_spa(request, path=""):
    dist_dir = getattr(settings, 'FRONTEND_DIST_DIR', None)
    if not dist_dir or not dist_dir.exists():
        dist_dir = settings.BASE_DIR / 'frontend_dist'

    if path:
        file_path = dist_dir / path
        if file_path.exists() and file_path.is_file():
            return serve(request, path, document_root=str(dist_dir))

    index_file = dist_dir / 'index.html'
    if index_file.exists():
        with open(index_file, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')

    return HttpResponse(
        "<h1>AstroLedger Backend Server is Running</h1>"
        "<p>API is active at <code>/api/</code>.</p>",
        content_type='text/html'
    )


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/clients/', include('apps.clients.urls')),
    path('api/consultations/', include('apps.consultations.urls')),
    path('api/sync/', include('apps.sync.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/attachments/', include('apps.attachments.urls')),
    path('api/health/', include('apps.core.urls')),
    re_path(r'^(?P<path>.*)$', serve_spa),
]
