from django.apps import AppConfig


class BriefConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "brief"

    def ready(self) -> None:
        from brief import services, tagging  # noqa: F401  registers the job handlers and the scheduler
