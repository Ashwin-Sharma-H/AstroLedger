# =============================================================================
# AstroLedger Backend — Production Dockerfile
# =============================================================================
# Multi-stage build: installs dependencies then copies application code.
# Uses non-root user for security.
#
# Build:
#   docker build -t astroledger-backend ./backend
#
# Run standalone:
#   docker run -p 8000:8000 --env-file backend/.env astroledger-backend
# =============================================================================

FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies (PostgreSQL client for pg_dump/pg_restore + health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user
RUN groupadd --gid 1000 astro && \
    useradd --uid 1000 --gid 1000 --create-home astro

WORKDIR /app

# Install Python dependencies first (layer caching optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for static files, media, and backups
RUN mkdir -p /app/staticfiles /app/media /app/backups && \
    chown -R astro:astro /app

# Switch to non-root user
USER astro

# Collect static files for production serving
RUN python manage.py collectstatic --noinput 2>/dev/null || true

# Expose the application port
EXPOSE 8000

# Health check using the custom check_db management command
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python manage.py check_db || exit 1

# Default command: run migrations and start Daphne ASGI server
CMD ["sh", "-c", "python manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8000 config.asgi:application"]
