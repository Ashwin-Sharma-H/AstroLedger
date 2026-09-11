from django.db import connection
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from channels.layers import get_channel_layer
import logging

logger = logging.getLogger(__name__)

class HealthCheckView(APIView):
    """
    Production health probe endpoint (/api/health/).
    Used by container orchestrators, load balancers, and uptime monitors
    for liveness and readiness verification.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = []  # Exclude health check from throttling

    def get(self, request):
        checks = {
            'database': 'unknown',
            'channel_layer': 'unknown',
        }
        all_healthy = True

        # 1. Test database connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                if row and row[0] == 1:
                    checks['database'] = 'connected'
                else:
                    checks['database'] = 'unexpected_response'
                    all_healthy = False
        except Exception as e:
            logger.error("Health check database error: %s", e)
            checks['database'] = f"error: {str(e)}"
            all_healthy = False

        # 2. Test channel layer availability
        try:
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                checks['channel_layer'] = 'active'
            else:
                checks['channel_layer'] = 'unconfigured'
        except Exception as e:
            logger.warning("Health check channel layer warning: %s", e)
            checks['channel_layer'] = f"degraded: {str(e)}"

        payload = {
            'status': 'healthy' if all_healthy else 'degraded',
            'service': 'AstroLedger API',
            'version': '1.0.0',
            'timestamp': timezone.now().isoformat(),
            'checks': checks,
        }

        http_status = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(payload, status=http_status)
