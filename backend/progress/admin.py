from django.contrib import admin

from progress.models import LastVisited, PageProgress


@admin.register(PageProgress)
class PageProgressAdmin(admin.ModelAdmin[PageProgress]):
    list_display = ("book", "page", "done", "updated_at")
    list_filter = ("done", "book")
    search_fields = ("page",)


admin.site.register(LastVisited)
