# =============================================================================
# Human-friendly share codes (parent link codes, class join codes)
# =============================================================================

import secrets

# No 0/O, 1/I/L — easy to read aloud and type.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_code(length: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def normalize_code(value: str) -> str:
    return "".join(ch for ch in value.upper() if ch.isalnum())
