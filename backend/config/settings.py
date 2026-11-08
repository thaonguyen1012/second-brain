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
# Stored images (webp): inbox link thumbnails and Item images; nginx serves them from /internal/thumbs/.
# Django writes here too (uploads, removals), so the folder must be writable by it, not only by run_jobs.
THUMBS_DIR = Path(env.str("THUMBS_DIR", default=str(BASE_DIR / "media" / "thumbs")))
# Largest Item image upload (POST /api/items/{id}/image); nginx allows 10m on that route (site.conf).
ITEM_IMAGE_MAX_BYTES = env.int("ITEM_IMAGE_MAX_BYTES", default=10 * 1024 * 1024)
# make backup (DECISIONS 10.1): pg_dump -Fc files <date>.dump, the newest BACKUP_KEEP kept; the images of
# THUMBS_DIR are mirrored into BACKUP_DIR/thumbs/ (new files only, never deleted).
BACKUP_DIR = Path(env.str("BACKUP_DIR", default=str(BASE_DIR / "backups")))
BACKUP_KEEP = env.int("BACKUP_KEEP", default=14)

# LLM (DECISIONS 10.4). Every call goes through core/services/llm.py. Temporary choice: Gemini free tier.
LLM_PROVIDER = env.str("LLM_PROVIDER", default="gemini")
LLM_MODEL = env.str("LLM_MODEL", default="gemini-3.1-flash-lite")  # cheapest current Flash-Lite (2026-11)
GEMINI_API_KEY = env.str("GEMINI_API_KEY", default="")
LLM_MONTHLY_BUDGET_USD = env.float(
    "LLM_MONTHLY_BUDGET_USD", default=5.0
)  # hard cap, checked before each call
# true: LlmCall.cost is recorded as 0 (tokens are kept). The budget guard ignores it and always counts
# paid-tier prices, so a project that silently becomes billed is still capped.
LLM_FREE_TIER = env.bool("LLM_FREE_TIER", default=False)
# USD per 1M tokens on the paid tier (ai.google.dev/gemini-api/docs/pricing, read 2026-11-02).
LLM_PRICES = {
    "gemini-3.1-flash-lite": {"in": 0.25, "out": 1.50, "cache_read": 0.025},
    "gemini-3.5-flash-lite": {"in": 0.30, "out": 2.50, "cache_read": 0.03},
}
LLM_MAX_OUTPUT_TOKENS = 400
LLM_TIMEOUT_SECONDS = 30
# Google publishes no fixed free-tier numbers (they vary per project; see AI Studio). One request every
# 5 s stays under 15 RPM; a 429 leaves the job pending for the next run.
LLM_MIN_INTERVAL_SECONDS = env.float("LLM_MIN_INTERVAL_SECONDS", default=5.0)

# Morning brief (DECISIONS 5, 9.4 step 6). run_jobs enqueues a feed fetch at each of these hours (Prague) and
# the brief at BRIEF_BUILD_TIME; the brief waits for queued fetches and tagging until BRIEF_WAIT_UNTIL.
BRIEF_FETCH_HOURS = env.list("BRIEF_FETCH_HOURS", cast=int, default=[6, 12, 18])
BRIEF_BUILD_TIME = env.str("BRIEF_BUILD_TIME", default="06:30")
BRIEF_WAIT_UNTIL = env.str("BRIEF_WAIT_UNTIL", default="09:00")
# At most this many news items per day go to the LLM (free tier quota and the 5 USD cap); the rest is stored
# untagged ("skipped") and never enters a brief.
BRIEF_TAG_DAILY_CAP = env.int("BRIEF_TAG_DAILY_CAP", default=40)
BRIEF_MAX_ITEMS = env.int("BRIEF_MAX_ITEMS", default=8)  # 5-8 stories (DECISIONS 5)
BRIEF_MAX_AGE_HOURS = env.int("BRIEF_MAX_AGE_HOURS", default=48)  # older feed entries are not stored
BRIEF_INTRO = env.bool("BRIEF_INTRO", default=True)  # one LLM call per day for the intro

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
    "weeks",
    "work",
    "opportunities",
    "growth",
    "brief",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.LanguageMiddleware",
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

# DRF, Django and the app's validation messages reach the UI: Vietnamese by default, English when the web UI's
# `lang` cookie says en (core.middleware.LanguageMiddleware, core.i18n).
LANGUAGE_CODE = "vi"
LANGUAGES = [("vi", "Tiếng Việt"), ("en", "English")]
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
        "ObjectiveStatusEnum": "weeks.models.Objective.Status",
        "BillingEnum": "work.models.ProjectDetails.Billing",
        "OpportunityDecisionEnum": "opportunities.models.Opportunity.Decision",
        "EvidenceKindEnum": "opportunities.models.Evidence.Kind",
        "EvidenceStanceEnum": "opportunities.models.Evidence.Stance",
        "SkillEvidenceKindEnum": "growth.models.SkillEvidence.Kind",
        "SkillFreshnessEnum": "growth.models.Freshness",
        "SeniorityEnum": "growth.models.JobAd.Seniority",
        "PredictionOutcomeEnum": "growth.models.Prediction.Outcome",
        "NewsAreaEnum": "brief.models.Area",
        "NewsTagStatusEnum": "brief.models.NewsItem.TagStatus",
        "NewsFeedbackEnum": "brief.models.NewsItem.Feedback",
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "config.logging.JsonFormatter"}},
    "handlers": {"stdout": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["stdout"], "level": env.str("LOG_LEVEL", default="INFO")},
}
