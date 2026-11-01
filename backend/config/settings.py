"""Django settings. Every value that differs between machines comes from the environment (backend/.env)."""

from pathlib import Path

import django_stubs_ext
import environ
from django.core.exceptions import ImproperlyConfigured

django_stubs_ext.monkeypatch()  # allows ModelAdmin[Model] etc. at runtime

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env.str("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# Auth: "cf_access" verifies the Cloudflare Access JWT; "dev" trusts DEV_USER_EMAIL (never in production).
AUTH_MODE = env.str("AUTH_MODE", default="cf_access")
OWNER_EMAIL = env.str("OWNER_EMAIL", default="")
DEV_USER_EMAIL = env.str("DEV_USER_EMAIL", default="dev@localhost")
CF_ACCESS_TEAM_DOMAIN = env.str("CF_ACCESS_TEAM_DOMAIN", default="")  # e.g. example.cloudflareaccess.com
CF_ACCESS_AUD = env.str("CF_ACCESS_AUD", default="")
if AUTH_MODE not in ("dev", "cf_access"):
    raise ImproperlyConfigured("AUTH_MODE must be 'dev' or 'cf_access'")
if AUTH_MODE == "dev" and not DEBUG:
    raise ImproperlyConfigured("AUTH_MODE=dev is only allowed with DEBUG=True")
if AUTH_MODE == "cf_access" and not DEBUG and not (OWNER_EMAIL and CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD):
    raise ImproperlyConfigured(
        "AUTH_MODE=cf_access needs OWNER_EMAIL, CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD"
    )

# Handbook content on disk; the book slugs are the directories <CONTENT_DIR>/<track>/<book>/.
CONTENT_DIR = Path(env.str("CONTENT_DIR", default=str(REPO_DIR / "web" / "content" / "docs")))
# Attachments: Django authorises /files/<path>, nginx serves it from /internal/files/ (X-Accel-Redirect).
FILES_DIR = Path(env.str("FILES_DIR", default=str(REPO_DIR / "web" / "public" / "files")))

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "core",
    "progress",
    "library",
    "inbox",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.http.ConditionalGetMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.AccessAuthMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = 60
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Prague"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/admin-static/"
STATIC_ROOT = Path(env.str("STATIC_ROOT", default=str(BASE_DIR / "staticfiles")))

# Cookies and transport security (production runs behind nginx + Cloudflare, always HTTPS).
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # the web client reads csrftoken and sends it as X-CSRFToken
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
# HTTPS is enforced at the Cloudflare edge; nginx only sees tunnel traffic. HSTS for subdomains and
# preload are not ours to decide for all of example.com.
SILENCED_SYSTEM_CHECKS = ["security.W008", "security.W005", "security.W021"]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["core.authentication.SessionAuthentication401"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Alex's Brain API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "ItemStatusEnum": "library.models.Item.Status",
        "InboxStatusEnum": "inbox.models.InboxEntry.Status",
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "config.logging.JsonFormatter"}},
    "handlers": {"stdout": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["stdout"], "level": env.str("LOG_LEVEL", default="INFO")},
}
