from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.core.validators import URLValidator

from brief.models import Area, Source
from core.services.users import get_or_create_owner

# Feeds of sources that DECISIONS 6.2 names (areas 1, 2, 5). Not added unless `seed` is run; deactivate any in
# the admin. Sources without a public feed (Anthropic blog, The Economist) are left out.
NAMED_FEEDS = (
    ("Simon Willison", "https://simonwillison.net/atom/everything/", Area.AI),
    ("Hacker News (200+ points)", "https://hnrss.org/frontpage?points=200", Area.AI),
    ("Import AI", "https://importai.substack.com/feed", Area.AI),
    ("OpenAI News", "https://openai.com/news/rss.xml", Area.AI),
    ("Google DeepMind", "https://deepmind.google/blog/rss.xml", Area.AI),
    ("Stratechery", "https://stratechery.com/feed/", Area.BUSINESS),
    ("Quanta Magazine", "https://www.quantamagazine.org/feed/", Area.SCIENCE),
    ("Our World in Data", "https://ourworldindata.org/atom.xml", Area.SCIENCE),
)


class Command(BaseCommand):
    help = "List, add, activate or deactivate the morning-brief feeds (also editable in the admin)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("action", choices=("list", "add", "activate", "deactivate", "seed"))
        parser.add_argument("--name")
        parser.add_argument("--url", help="RSS or Atom feed URL (http or https).")
        parser.add_argument("--area", choices=Area.values)
        parser.add_argument("--id", type=int, help="Source id for activate / deactivate.")
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")

    def handle(self, *args: Any, **options: Any) -> None:
        email = options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL
        owner = get_or_create_owner(email)
        action = options["action"]
        if action == "add":
            if not (options["name"] and options["url"] and options["area"]):
                raise CommandError("add needs --name, --url and --area")
            self._add(owner.pk, options["name"], options["url"], options["area"])
        elif action == "seed":
            for name, url, area in NAMED_FEEDS:
                self._add(owner.pk, name, url, area)
        elif action in ("activate", "deactivate"):
            changed = Source.objects.filter(pk=options["id"], user=owner).update(active=action == "activate")
            if not changed:
                raise CommandError("no such source of this owner (--id)")
        for source in Source.objects.filter(user=owner).order_by("area", "name"):
            state = "on " if source.active else "off"
            self.stdout.write(f"{source.pk:>4} {state} {source.area:<12} {source.name}  {source.feed_url}")

    def _add(self, user_id: int, name: str, url: str, area: str) -> None:
        try:
            URLValidator(schemes=["http", "https"])(url)
        except ValidationError as error:
            raise CommandError(f"not an http(s) URL: {url}") from error
        Source.objects.get_or_create(user_id=user_id, feed_url=url, defaults={"name": name, "area": area})
