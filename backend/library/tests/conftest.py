import pytest

from library import logos


@pytest.fixture(autouse=True)
def github_limit_forgotten(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test starts as a fresh run_jobs process: no GitHub API limit seen yet (library.logos remembers the
    limit it saw for the rest of its process)."""
    monkeypatch.setattr(logos, "_limit_resets_at", None)
