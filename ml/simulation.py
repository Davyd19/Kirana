"""Original arithmetic procedures and response simulation used by Kirana."""

CATALOG = {
    "addition": ("A1", "A2", "A3", "A4"),
    "subtraction": ("S1", "S2", "S3", "S4", "S5", "S6"),
}


def _columns(a, b):
    width = max(len(str(a)), len(str(b)))
    return [(a // 10**i % 10, b // 10**i % 10) for i in range(width)]


def _addition_without_carry(a, b):
    return sum((x + y) % 10 * 10**i for i, (x, y) in enumerate(_columns(a, b)))


def _addition_column_totals(a, b):
    """Write full column sums, e.g. 47 + 38 becomes 715."""
    result = 0
    for x, y in reversed(_columns(a, b)):
        chunk = x + y
        result = result * (100 if chunk >= 10 else 10) + chunk
    return result


def _addition_sticky_carry(a, b):
    columns = _columns(a, b)
    register = 0
    result = 0
    for i, (x, y) in enumerate(columns):
        total = x + y + register
        if i == len(columns) - 1:
            result += total * 10**i
        else:
            result += (total % 10) * 10**i
            register += total // 10
    return result


def _addition_write_carry(a, b):
    carry = 0
    result = 0
    for i, (x, y) in enumerate(_columns(a, b)):
        total = x + y + carry
        result += (total // 10 if total >= 10 else total) * 10**i
        carry = total // 10
    return result


def _subtraction_columns(a, b):
    if not (isinstance(a, int) and isinstance(b, int) and a >= b >= 0):
        raise ValueError("require integer a >= b >= 0")
    return [list(digits) for digits in zip(*_columns(a, b))]


def _subtraction_absolute(a, b):
    top, bottom = _subtraction_columns(a, b)
    return sum(abs(x - y) * 10**i for i, (x, y) in enumerate(zip(top, bottom)))


def _subtraction_without_decrement(a, b):
    top, bottom = _subtraction_columns(a, b)
    return sum(((x + 10 if x < y else x) - y) * 10**i for i, (x, y) in enumerate(zip(top, bottom)))


def _borrow(top, column, across_failure):
    donor = column + 1
    if donor >= len(top):
        return
    if across_failure and top[donor] == 0:
        top[donor] = 9  # Write 9 without continuing to the next place.
    else:
        while donor < len(top) and top[donor] == 0:
            donor += 1
        if donor >= len(top):
            return
        top[donor] -= 1
        while donor > column + 1:
            donor -= 1
            top[donor] = 9
    top[column] += 10


def _subtraction(a, b, *, zero_rule=None, across_failure=False, persistent=False):
    top, bottom = _subtraction_columns(a, b)
    result = 0
    activated = False
    for i, lower in enumerate(bottom):
        upper = top[i]
        if zero_rule is not None and upper == 0 and lower > 0:
            digit = 0 if zero_rule == "zero" else lower
        else:
            needs_borrow = upper < lower
            force_borrow = persistent and activated and i < len(top) - 1
            if needs_borrow or force_borrow:
                _borrow(top, i, across_failure)
                activated = True
            digit = (top[i] - lower) % 10
        result += digit * 10**i
    return result


def _subtraction_zero(a, b):
    return _subtraction(a, b, zero_rule="zero")


def _subtraction_copy_bottom(a, b):
    return _subtraction(a, b, zero_rule="bottom")


def _subtraction_across_zero(a, b):
    return _subtraction(a, b, across_failure=True)


def _subtraction_persistent(a, b):
    return _subtraction(a, b, persistent=True)


PATTERNS = {
    "A1": _addition_without_carry,
    "A2": _addition_column_totals,
    "A3": _addition_sticky_carry,
    "A4": _addition_write_carry,
    "S1": _subtraction_absolute,
    "S2": _subtraction_without_decrement,
    "S3": _subtraction_zero,
    "S4": _subtraction_copy_bottom,
    "S5": _subtraction_across_zero,
    "S6": _subtraction_persistent,
}


def predict(pattern, a, b):
    return PATTERNS[pattern](int(a), int(b))


def _noise_answer(base, kind, rng):
    digits = str(base)
    if kind == "blank":
        return ""
    if kind == "slip":
        return max(0, base + rng.choice([-2, -1, 1, 2]))
    if kind == "swap" and len(digits) > 1:
        i = rng.randrange(len(digits) - 1)
        swapped = list(digits)
        swapped[i], swapped[i + 1] = swapped[i + 1], swapped[i]
        return int("".join(swapped))
    if kind == "delete" and len(digits) > 1:
        i = rng.randrange(len(digits))
        return int(digits[:i] + digits[i + 1:] or "0")
    if kind == "insert":
        i = rng.randrange(len(digits) + 1)
        return int(digits[:i] + str(rng.randrange(10)) + digits[i:])
    i = rng.randrange(len(digits))
    candidates = [str(value) for value in range(10) if str(value) != digits[i]]
    return int(digits[:i] + rng.choice(candidates) + digits[i + 1:])


def _noncatalog_random(question, rng):
    a, b = question["operand_1"], question["operand_2"]
    correct = question["correct_answer"]
    blocked = {correct} | {predict(pattern, a, b) for pattern in CATALOG[question["operation"]]}
    width = len(str(correct))
    for _ in range(100):
        candidate = rng.randrange(0, 10**(width + 1))
        if candidate not in blocked:
            return candidate
    raise RuntimeError("no random answer outside catalog")


def simulate_response(profile, question, rng):
    """Return the answer, response mechanism, active pattern, and noise type."""
    profile_type = profile["profile_type"]
    correct = question["correct_answer"]
    a, b = question["operand_1"], question["operand_2"]
    noise = profile["noise_rate"]
    if rng.random() < noise:
        slip_share = profile["slip_rate"] / noise
        random_share = profile["random_error_rate"] / noise
        typo_share = 1 - slip_share - random_share - 0.05
        kind = rng.choices(
            ["swap", "delete", "insert", "change", "slip", "random", "blank"],
            weights=[typo_share / 5, typo_share / 5, typo_share / 5, 2 * typo_share / 5,
                     slip_share, random_share, 0.05],
        )[0]
        base = predict(profile["dominant_pattern"], a, b) if profile_type == "MIXED" or profile_type in PATTERNS else correct
        if kind == "random":
            return _noncatalog_random(question, rng), "random_error", "", kind
        mechanism = {"slip": "slip", "blank": "empty"}.get(kind, "typo")
        return _noise_answer(base, kind, rng), mechanism, "", kind

    if profile_type == "RANDOM":
        if rng.random() < 0.7:
            return _noncatalog_random(question, rng), "random_error", "", "random"
    elif profile_type != "CORRECT" and rng.random() < profile["pattern_consistency"]:
        active = profile["dominant_pattern"]
        if profile_type == "MIXED" and rng.random() > profile["dominant_pattern_weight"]:
            active = profile["secondary_pattern"]
        return predict(active, a, b), "pattern", active, ""
    return correct, "correct", "", ""
