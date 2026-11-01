from django.contrib.auth.models import User


def get_or_create_owner(email: str) -> User:
    """The site has a single user; it is also the Django admin superuser."""
    user, _ = User.objects.get_or_create(
        username=email.lower(),
        defaults={"email": email.lower(), "is_staff": True, "is_superuser": True},
    )
    return user
