from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def tag_field() -> ArrayField[list[str], list[str]]:
    """Tags are plain lowercase strings on the row (DECISIONS 4.5: no tag framework)."""
    return ArrayField(models.CharField(max_length=50), default=list, blank=True)


class Item(models.Model):
    """Anything Alex learns from or works on (DECISIONS 4.1); status replaces folders."""

    class Type(models.TextChoices):
        COURSE = "course"
        BOOK = "book"
        FILM = "film"
        ARTICLE = "article"
        PROJECT = "project"

    class Status(models.TextChoices):
        PLANNED = "planned"  # want to read / watch / take
        ACTIVE = "active"
        DONE = "done"
        DROPPED = "dropped"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items")
    type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    title = models.CharField(max_length=300)
    tags = tag_field()
    source = models.CharField(max_length=2000, blank=True)  # URL or free text (author, platform...)
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    # The cover (the logo of a project, DECISIONS 9.6): a file name under THUMBS_DIR, content addressed like
    # InboxEntry.og_image_path, so rows of any owner may share a file (thumbnails.discard_if_unused). Set
    # only through library.services.set_image, never by the API body. db_default keeps a column DEFAULT, so
    # a process still running the code from before this field can INSERT Items during a deploy.
    image_path = models.CharField(max_length=100, blank=True, default="", db_default="")

    class Meta:
        # (type, status) and (created_at) from DECISIONS 10.2; finished_at for the week review's body of work.
        indexes = [
            models.Index(fields=["type", "status"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["finished_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(rating__isnull=True) | models.Q(rating__gte=1, rating__lte=10),
                name="item_rating_1_10",
            )
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.type}, {self.status})"


class Note(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
    title = models.CharField(max_length=300, blank=True)
    markdown = models.TextField()
    items = models.ManyToManyField(Item, related_name="notes", blank=True)
    # The id the web editor gives a new note before its first save (POST /api/notes `clientId`): a create sent
    # again (a save that left with the page, a restored copy) answers the note it made, never a second one.
    client_id = models.UUIDField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "client_id"],
                condition=models.Q(client_id__isnull=False),
                name="note_client_id_unique",
            )
        ]

    def __str__(self) -> str:
        return self.title or self.markdown[:60]


class NoteLink(models.Model):
    """A link written in a note's markdown to an Item, another note, an opportunity or a skill (DECISIONS 9.8,
    the `[[ ]]` picker writes them as `[Title](/thu-vien/item/?id=12)`). Derived data: library.links reads
    them out of the markdown on every save of the note and replaces the note's rows, so they are never edited
    (nor exported) on their own. Exactly one target, the one its kind names; a deleted target takes the row
    with it."""

    class Kind(models.TextChoices):
        ITEM = "item"
        NOTE = "note"
        OPPORTUNITY = "opportunity"
        SKILL = "skill"

    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="links")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, null=True, blank=True, related_name="note_links")
    target_note = models.ForeignKey(
        Note, on_delete=models.CASCADE, null=True, blank=True, related_name="backlinks"
    )
    opportunity = models.ForeignKey(
        "opportunities.Opportunity",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="note_links",
    )
    skill = models.ForeignKey(
        "growth.Skill", on_delete=models.CASCADE, null=True, blank=True, related_name="note_links"
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        kind="item",
                        item__isnull=False,
                        target_note__isnull=True,
                        opportunity__isnull=True,
                        skill__isnull=True,
                    )
                    | models.Q(
                        kind="note",
                        item__isnull=True,
                        target_note__isnull=False,
                        opportunity__isnull=True,
                        skill__isnull=True,
                    )
                    | models.Q(
                        kind="opportunity",
                        item__isnull=True,
                        target_note__isnull=True,
                        opportunity__isnull=False,
                        skill__isnull=True,
                    )
                    | models.Q(
                        kind="skill",
                        item__isnull=True,
                        target_note__isnull=True,
                        opportunity__isnull=True,
                        skill__isnull=False,
                    )
                ),
                name="note_link_one_target",
            ),
        ]

    def __str__(self) -> str:
        return f"note {self.note_id} -> {self.kind}"
