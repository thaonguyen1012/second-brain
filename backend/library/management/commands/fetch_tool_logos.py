from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError, CommandParser

from library import services
from library.models import Item


class Command(BaseCommand):
    help = (
        "Queue the logo of each of the owner's tools that has an http(s) link, no image and no fetch waiting "
        "or running: the item_image job, made by run_jobs, takes the icon of the tool's site (DECISIONS "
        "9.10). Prints how many. Safe to run again: a tool whose fetch waits is skipped, and one whose last "
        "fetch found no logo is asked again."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")

    def handle(self, *args: Any, **options: Any) -> None:
        email = (options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL).lower()
        owner = User.objects.filter(username=email).first()
        if owner is None:
            raise CommandError(f"no user {email}: run seed_tools first, or pass --owner")
        queued = waiting = no_link = 0
        without_logo = services.items(owner).filter(type=Item.Type.TOOL, image_path="").order_by("id")
        for tool in without_logo:
            if tool.image_pending:  # type: ignore[attr-defined]  # annotated by services.items
                waiting += 1
            elif not services.is_http_url(tool.source):
                no_link += 1
            else:
                services.request_fetch(tool, tool.source)
                queued += 1
        self.stdout.write(
            f"{queued} tool logos queued, {waiting} already waiting, {no_link} without a web link, "
            f"for {email}"
        )
