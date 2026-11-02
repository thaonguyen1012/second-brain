# Golden set: inbox tagging

Run before any change to `backend/prompts/inbox_tag.md`, `LLM_MODEL` or the tag schema:

    cd backend && uv run python manage.py eval tag

Each case: `{"input": {"title", "site", "text"}, "expect": {"tags": [...], "destination"?: ...}}`. The command
asserts in code that the reply fits the schema, contains every expected tag, has a one-line summary of at most
160 characters, and (when given) the destination. It calls the real LLM and is never part of `make check`.

Cases 01-10 were written by Claude at Alex's request (2026-11-02) from real books, docs and job-ad styles, not from
Alex's actual inbox. Replace them with real inbox entries over time (DECISIONS 10.3: 20-30 real inputs).
