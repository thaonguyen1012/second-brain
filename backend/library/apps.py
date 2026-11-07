from django.apps import AppConfig


class LibraryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "library"

    def ready(self) -> None:
        from library import jobs  # noqa: F401  registers the item_image job handler
