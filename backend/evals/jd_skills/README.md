# Golden set: job ad skill extraction

Run before any change to `backend/prompts/jd_skills.md`, `LLM_MODEL` or the `JdSkills` schema
(`backend/growth/extraction.py`):

    cd backend && uv run python manage.py eval jd

Each case: `{"input": {"title", "company", "text"}, "expect": {"skills": [...], "absent"?: [...], "seniority"?: ...}}`.
Each `skills` entry is a name or a list of accepted names (one of them must be in the reply); `absent` names must
not appear; `seniority` is a level or a list of accepted levels. The command asserts in code that the reply fits
the schema (at most 15 short, normalised names) and these expectations. It calls the real LLM and is never part of
`make check`.

Cases 01-05 were written by Claude at Alex's request (2026-11-02) in the style of job ads for product-minded
engineering roles (company names are placeholders); 04 is not in English, 05 carries a prompt injection. Replace them with
real pasted job ads over time (DECISIONS 10.3: 20-30 real inputs).
