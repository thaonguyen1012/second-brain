from decimal import Decimal

from work.services import earned, effective_rate


def test_fixed_price_counts_all_hours_including_non_billable() -> None:
    # 30 000 agreed, 10 h billable + 2 h non-billable: 30 000 / 12 h.
    assert effective_rate("fixed", Decimal("30000"), None, 600, 720) == Decimal("2500.00")
    assert earned("fixed", Decimal("30000"), None, 600) == Decimal("30000")


def test_hourly_rate_is_diluted_by_non_billable_time() -> None:
    # 800/h, 6 h billable, 2 h non-billable: 4 800 earned over 8 h = 600/h.
    assert earned("hourly", None, Decimal("800"), 360) == Decimal("4800.00")
    assert effective_rate("hourly", None, Decimal("800"), 360, 480) == Decimal("600.00")
    # All billable: the effective rate is the agreed rate.
    assert effective_rate("hourly", None, Decimal("800"), 90, 90) == Decimal("800.00")


def test_rate_rounds_to_cents() -> None:
    assert effective_rate("fixed", Decimal("1000"), None, 0, 7) == Decimal("8571.43")
    assert earned("hourly", None, Decimal("999.99"), 1) == Decimal("16.67")


def test_no_rate_without_time_or_price() -> None:
    assert effective_rate("fixed", Decimal("5000"), None, 0, 0) is None
    assert effective_rate("fixed", None, None, 60, 60) is None
    assert effective_rate("hourly", None, None, 60, 60) is None
    # Only non-billable time on an hourly project: it earned nothing.
    assert effective_rate("hourly", None, Decimal("800"), 0, 120) == Decimal("0.00")
