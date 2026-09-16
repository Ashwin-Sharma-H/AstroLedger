"""
Django settings for AstroLedger backend.
"""
from pathlib import Path
from datetime import timedelta
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-astroledger-c9f28d827a41bf3910c55490')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

# Application definition
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',

    # AstroLedger Apps
    'apps.accounts',
    'apps.clients',
    'apps.consultations',
    'apps.sync',
    'apps.dashboard',
    'apps.attachments',
    'apps.core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.middleware.SecurityAuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# =============================================================================
# Database Configuration
# =============================================================================
# Priority:
#   1. DATABASE_URL (if set) — parsed into connection parameters
#   2. DB_ENGINE=postgres + individual POSTGRES_* variables
#   3. Default: SQLite for zero-setup local development
# =============================================================================

DATABASE_URL = os.environ.get('DATABASE_URL', '')

def _parse_database_url(url: str) -> dict:
    """
    Parse a DATABASE_URL (e.g. postgres://user:pass@host:port/dbname) into
    a Django DATABASES config dict. Supports postgres:// and postgresql://.
    """
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/'),
        'USER': parsed.username or 'postgres',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or 'localhost',
        'PORT': str(parsed.port or 5432),
    }

DB_ENGINE = os.environ.get('DB_ENGINE', 'sqlite')
CONN_MAX_AGE = int(os.environ.get('CONN_MAX_AGE', '0' if DEBUG else '600'))
POSTGRES_SSL_MODE = os.environ.get('POSTGRES_SSL_MODE', '')

# =============================================================================
# Writable User Data Directory (Zero-Config Desktop Support)
# =============================================================================
ASTRO_DATA_DIR = os.environ.get('ASTROLEDGER_DATA_DIR')
if ASTRO_DATA_DIR:
    DATA_PATH = Path(ASTRO_DATA_DIR)
else:
    DATA_PATH = BASE_DIR

FRONTEND_DIST_DIR = BASE_DIR.parent / 'frontend' / 'dist'

try:
    DATA_PATH.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

if DATABASE_URL:
    # Priority 1: DATABASE_URL takes precedence
    DATABASES = {
        'default': {
            **_parse_database_url(DATABASE_URL),
            'CONN_MAX_AGE': CONN_MAX_AGE,
        }
    }
elif DB_ENGINE == 'postgres':
    # Priority 2: Individual POSTGRES_* environment variables
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'astroledger'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': CONN_MAX_AGE,
        }
    }
else:
    # Priority 3: SQLite — zero-setup local development and desktop clients
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': DATA_PATH / 'db.sqlite3',
        }
    }

# Apply PostgreSQL SSL options if configured
if POSTGRES_SSL_MODE and DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
    DATABASES['default'].setdefault('OPTIONS', {})
    DATABASES['default']['OPTIONS']['sslmode'] = POSTGRES_SSL_MODE

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Custom User model
AUTH_USER_MODEL = 'accounts.User'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = DATA_PATH / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.sync.authentication.CompanionAwareJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.environ.get('THROTTLE_RATE_ANON', '100/day'),
        'user': os.environ.get('THROTTLE_RATE_USER', '1000/day'),
        'auth': os.environ.get('THROTTLE_RATE_AUTH', '10/minute'),
    },
}

# Simple JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.environ.get('JWT_ACCESS_LIFETIME_MINUTES', '60'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.environ.get('JWT_REFRESH_LIFETIME_DAYS', '14'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Configuration for Desktop (Electron) and Mobile (Capacitor)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost(:[0-9]+)?$",
    r"^http://127\.0\.0\.1(:[0-9]+)?$",
    r"^http://192\.168\.[0-9]+\.[0-9]+(:[0-9]+)?$",
    r"^http://10\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$",
    r"^capacitor://localhost$",
    r"^ionic://localhost$",
    r"^file://.*$",
    r"^null$",
]

# Channels Layer (In-memory for dev, Redis in production)
_REDIS_URL = os.environ.get('REDIS_URL', '')
if _REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [_REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }

# =============================================================================
# Production Security Hardening (enabled when DEBUG=False)
# =============================================================================
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True') == 'True'
    CORS_ALLOW_ALL_ORIGINS = False

# =============================================================================
# Backup Configuration
# =============================================================================
BACKUP_DIR = DATA_PATH / 'backups'
