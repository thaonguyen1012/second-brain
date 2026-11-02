from django.apps import AppConfig


class InboxConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inbox"

    def ready(self) -> None:
        from inbox import jobs, tagging  # noqa: F401  registers the job handlers
