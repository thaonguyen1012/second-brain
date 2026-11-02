# Golden set: morning-brief tagging

Run before any change to `backend/prompts/news_tag.md`, `LLM_MODEL` or the `NewsTags` schema:

    cd backend && uv run python manage.py eval brief

Each case: `{"input": {"title", "source", "text"}, "expect": {"tags"?: [...], "new_tool"?: bool,
"relevance"?: [lowest, highest]}}`. A `tags` entry is a tag or a list of accepted tags. The command asserts in code
that the reply fits the schema (one-line summary of at most 160 characters, relevance 1-5), contains the expected
tags, has the expected "new tool/skill" flag and a relevance inside the range. It calls the real LLM and is never
part of `make check`.

Cases 01-05 were written by Claude (2026-11-02) in the style of the feeds named in DECISIONS 5 and 6.2; they are not
real feed items. Case 03 is a prompt-injection attempt. Replace them with real items over time, starting with the
ones Alex marks useful or not (DECISIONS 10.3: 20-30 real inputs).
