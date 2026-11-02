from django.apps import AppConfig


class GrowthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "growth"

    def ready(self) -> None:
        from growth import extraction  # noqa: F401  registers the job handler
