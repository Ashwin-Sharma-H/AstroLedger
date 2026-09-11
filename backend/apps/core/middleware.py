import time
import logging

logger = logging.getLogger('astroledger.audit')

class SecurityAuditMiddleware:
    """
    Middleware that records audit logs for security-relevant API requests:
    - Authentication and credential endpoints
    - Mutation operations (POST, PUT, PATCH, DELETE)
    - Client error (4xx) and server error (5xx) responses
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)

        path = request.path
        method = request.method
        status_code = response.status_code

        # Identify security-relevant paths or operations
        is_auth = '/api/auth/' in path
        is_mutation = method in ('POST', 'PUT', 'PATCH', 'DELETE')
        is_error = status_code >= 400

        if is_auth or is_mutation or is_error:
            # Resolve client IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                client_ip = x_forwarded_for.split(',')[0].strip()
            else:
                client_ip = request.META.get('REMOTE_ADDR', 'unknown')

            # Identify user
            user_id = 'anonymous'
            if hasattr(request, 'user') and request.user.is_authenticated:
                user_id = f"user_{request.user.id} ({request.user.email})"

            log_level = logging.WARNING if is_error else logging.INFO
            logger.log(
                log_level,
                "AUDIT: %s %s | Status: %d | User: %s | IP: %s | Duration: %sms",
                method,
                path,
                status_code,
                user_id,
                client_ip,
                duration_ms,
            )

        return response
