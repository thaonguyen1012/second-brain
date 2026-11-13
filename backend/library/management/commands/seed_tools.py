from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction

from core.services.users import get_or_create_owner
from library import services, tools
from library.models import Item


class Command(BaseCommand):
    help = (
        "Add the starter list of well-known engineering tools (library/tools.json) to the owner's library as "
        "Items of type tool, status planned, tagged with their stages; each new tool's logo is queued (the "
        "item_image job, made by run_jobs). Safe to run again: a tool the owner already has (the same title, "
        "in any case) is left exactly as it is."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")

    def handle(self, *args: Any, **options: Any) -> None:
        owner = get_or_create_owner(options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL)
        added: list[str] = []
        kept = 0
        with transaction.atomic():
            for tool in tools.seed_tools():
                mine = Item.objects.filter(user=owner, type=Item.Type.TOOL, title__iexact=tool["title"])
                if mine.exists():
                    kept += 1
                    continue
                # create_item, as the API does: a planned Item has no dates, and a tool with a link queues the
                # logo of its site (fetch_automatically; run_jobs makes the requests, never this command)
                services.create_item(
                    owner,
                    {
                        "type": Item.Type.TOOL,
                        "status": Item.Status.PLANNED,
                        "title": tool["title"],
                        "summary": tool["summary"],
                        "source": tool["source"],
                        "tags": tools.stage_tags(tool["stages"]),
                    },
                )
                added.append(tool["title"])
        if options["verbosity"] > 1:
            for title in added:
                self.stdout.write(f"+ {title}")
        self.stdout.write(f"{len(added)} tools added, {kept} already there, for {owner.email}")
