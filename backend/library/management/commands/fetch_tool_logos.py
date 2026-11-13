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
        "9.10). Prints how many. Safe to run again: a tool whose fetch waits is skipped, and so is one whose "
        "last fetch of the same link found no logo (--again asks those again)."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")
        parser.add_argument(
            "--again",
            action="store_true",
            help="Also ask the tools whose last fetch of their link found no logo (a site that changed).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        email = (options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL).lower()
        owner = User.objects.filter(username=email).first()
        if owner is None:
            raise CommandError(f"no user {email}: run seed_tools first, or pass --owner")
        queued = waiting = no_link = found_none = 0
        without_logo = services.items(owner).filter(type=Item.Type.TOOL, image_path="").order_by("id")
        for tool in without_logo:
            # annotated by services.items
            if tool.image_pending:  # type: ignore[attr-defined]
                waiting += 1
            elif not services.is_http_url(tool.source):
                no_link += 1
            elif tool.image_missing and not options["again"]:  # type: ignore[attr-defined]
                found_none += 1  # the GitHub API's hourly requests are few: never spent on a known answer
            else:
                services.request_fetch(tool, tool.source)
                queued += 1
        self.stdout.write(
            f"{queued} tool logos queued, {waiting} already waiting, {no_link} without a web link, "
            f"{found_none} whose site had no logo last time (--again asks them again), for {email}"
        )
